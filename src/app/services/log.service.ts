import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map, Observable, throwError, catchError } from 'rxjs';
import { ApiResponse } from '../utils/apiResponse';
import { EnvService } from './env.service';
import { AuthService } from './auth.service';

export type LogStreamEvent =
  | { type: 'connected'; size: number }
  | { type: 'lines'; text: string }
  | { type: 'rotated' }
  | { type: 'reconnecting'; attempt: number; delayMs: number }
  | { type: 'error'; message: string; fatal: boolean };

export class LogApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000];

@Injectable({ providedIn: 'root' })
export class LogService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly auth = inject(AuthService);

  private get endpoint(): string {
    return `${this.env.baseUrl()}/logs`;
  }

  listLogs(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(this.endpoint).pipe(
      map(res => res?.data ?? []),
      catchError(err => this.handleError(err)),
    );
  }

  readLog(file: string, tail = 2000): Observable<string> {
    return this.http
      .get<ApiResponse<string>>(`${this.endpoint}/${encodeURIComponent(file)}`, { params: { tail } })
      .pipe(
        map(res => res?.data ?? ''),
        catchError(err => this.handleError(err)),
      );
  }

  downloadLog(file: string): Observable<Blob> {
    return this.http
      .get(`${this.endpoint}/download`, { params: { filename: file }, responseType: 'blob' })
      .pipe(catchError(err => this.handleError(err)));
  }

  deleteLog(file: string): Observable<unknown> {
    return this.http
      .delete(this.endpoint, { params: { filename: file } })
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Follows a log file live via GET /logs/stream/{file} (Server-Sent Events).
   *
   * EventSource can't send an Authorization header (and the API won't take tokens in
   * the query string), so this reads the stream with fetch. With {@code tail} the server
   * first sends the last N lines, then new ones as they are written. Dropped connections
   * reconnect with backoff and resume from the last byte offset, so nothing is missed or
   * repeated. Unsubscribing closes the connection.
   */
  streamLog(file: string, tail = 0): Observable<LogStreamEvent> {
    return new Observable<LogStreamEvent>(subscriber => {
      const controller = new AbortController();
      let lastEventId: string | null = null;
      let attempt = 0;
      let refreshed = false;

      const sleep = (ms: number) =>
        new Promise<void>(resolve => {
          const t = setTimeout(resolve, ms);
          controller.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
        });

      const connectOnce = async (): Promise<'ended'> => {
        const params = new URLSearchParams();
        if (lastEventId) params.set('from', lastEventId);
        else if (tail > 0) params.set('tail', String(tail));
        const qs = params.toString();
        const url = `${this.endpoint}/stream/${encodeURIComponent(file)}${qs ? '?' + qs : ''}`;

        const headers: Record<string, string> = {
          // JSON as a fallback so errors come back with a readable message.
          Accept: 'text/event-stream, application/json;q=0.5',
          'Cache-Control': 'no-cache',
        };
        const token = this.auth.accessToken;
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (lastEventId) headers['Last-Event-ID'] = lastEventId;

        const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });

        if (res.status === 401 && !refreshed) {
          refreshed = true;
          try {
            await firstValueFrom(this.auth.refresh());
          } catch {
            throw new LogApiError('Session expired', 401);
          }
          return connectOnce();
        }
        if (!res.ok || !res.body) {
          let message = `Stream failed (${res.status})`;
          try {
            const body = await res.json();
            message = body?.message || body?.error || message;
          } catch { /* not JSON */ }
          throw new LogApiError(this.describe(res.status, message), res.status);
        }

        refreshed = false;
        attempt = 0;
        await this.readEvents(res.body, controller.signal, (event, data, id) => {
          if (id) lastEventId = id;
          switch (event) {
            case 'connected':
              subscriber.next({ type: 'connected', size: Number(data) || 0 });
              break;
            case 'log':
            case 'message':
              subscriber.next({ type: 'lines', text: data });
              break;
            case 'rotated':
              lastEventId = null;
              subscriber.next({ type: 'rotated' });
              break;
          }
        });
        return 'ended';
      };

      (async () => {
        while (!controller.signal.aborted) {
          try {
            await connectOnce();
            // Server closed the stream (e.g. its timeout): reconnect and resume.
          } catch (err) {
            if (controller.signal.aborted) return;
            const status = err instanceof LogApiError ? err.status : 0;
            if (status === 401) {
              subscriber.next({ type: 'error', message: 'Your session has expired. Please sign in again.', fatal: true });
              this.auth.expire();
              subscriber.complete();
              return;
            }
            if (status >= 400 && status < 500 && status !== 429) {
              subscriber.next({ type: 'error', message: (err as Error).message, fatal: true });
              subscriber.complete();
              return;
            }
          }
          if (controller.signal.aborted) return;
          const delayMs = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
          attempt++;
          subscriber.next({ type: 'reconnecting', attempt, delayMs });
          await sleep(delayMs);
        }
      })();

      return () => controller.abort();
    });
  }

  /** Minimal SSE parser (https://html.spec.whatwg.org/multipage/server-sent-events.html). */
  private async readEvents(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    onEvent: (event: string, data: string, id: string | null) => void,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let event = '';
    let data: string[] = [];
    let id: string | null = null;

    const dispatch = () => {
      if (data.length) onEvent(event || 'message', data.join('\n'), id);
      event = '';
      data = [];
      id = null;
    };

    try {
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.search(/\r\n|\r|\n/)) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + (buffer.startsWith('\r\n', nl) ? 2 : 1));

          if (line === '') { dispatch(); continue; }
          if (line.startsWith(':')) continue; // comment / heartbeat
          const colon = line.indexOf(':');
          const field = colon >= 0 ? line.slice(0, colon) : line;
          let val = colon >= 0 ? line.slice(colon + 1) : '';
          if (val.startsWith(' ')) val = val.slice(1);

          if (field === 'event') event = val;
          else if (field === 'data') data.push(val);
          else if (field === 'id') id = val;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private describe(status: number, fallback: string): string {
    switch (status) {
      case 403: return "Your account doesn't have admin access to server logs.";
      case 404: return fallback || 'Log file not found.';
      case 429: return 'Too many open log streams on the server. Try again shortly.';
      default: return fallback;
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;
    if (error.status === 0) {
      message = `Can't reach the ${this.env.env().label} API.`;
    } else if (error.status === 403) {
      message = this.describe(403, '');
    } else {
      message = error.error?.message || error.error?.error || error.message || 'Something went wrong; please try again later.';
    }
    return throwError(() => new LogApiError(message, error.status));
  }
}
