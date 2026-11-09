import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiResponse } from '@app/utils/apiResponse';
import { ApiEnvironment, EnvService } from './env.service';

export interface SessionUser {
  id: string;
  fullName: string;
  emailAddress: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

interface LoginData extends SessionUser {
  accessToken: string;
  refreshToken: string;
}

/**
 * Admin-only sign-in against the assessment API with an emailed code
 * (POST /auth/logs/code, /auth/logs/login), plus /auth/refresh and /auth/logout.
 *
 * Tokens are kept in sessionStorage, one session per API environment, so closing the tab
 * signs out and switching UAT/DEMO/PROD never sends one environment's token to another.
 * Calls here use HttpBackend so they skip the auth interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly env = inject(EnvService);
  private readonly router = inject(Router);
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly sessionSignal = signal<Session | null>(this.read(this.env.env().key));
  private refreshInFlight?: Observable<string>;

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this.sessionSignal()?.accessToken);

  /** Switches API environment and loads that environment's session (if any). */
  switchEnv(key: ApiEnvironment['key']): void {
    this.env.select(key);
    this.refreshInFlight = undefined;
    this.sessionSignal.set(this.read(key));
  }

  get accessToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  /**
   * Step 1: asks the API to email a sign-in code (POST /auth/logs/code). The API only
   * sends it to administrators but answers the same for any address.
   */
  requestCode(loginId: string): Observable<string> {
    return this.http
      .post<ApiResponse<string>>(`${this.env.baseUrl()}/auth/logs/code`, { loginId })
      .pipe(
        map(res => res?.message || 'If this email belongs to an administrator, a sign-in code has been sent to it'),
        catchError((err: HttpErrorResponse | Error) => throwError(() => new Error(this.loginError(err)))),
      );
  }

  /**
   * Step 2: signs in with the emailed code (POST /auth/logs/login). Fails for anyone
   * who isn't ADMIN, SUPER_ADMINISTRATOR or SYSTEM_ADMINISTRATOR.
   */
  login(loginId: string, otpCode: string): Observable<SessionUser> {
    return this.http
      .post<ApiResponse<LoginData>>(`${this.env.baseUrl()}/auth/logs/login`, { loginId, otpCode })
      .pipe(
        map(res => {
          const d = res?.data;
          if (!d?.accessToken) {
            throw new Error(res?.message || 'Login response had no access token');
          }
          const session: Session = {
            accessToken: d.accessToken,
            refreshToken: d.refreshToken,
            user: { id: d.id, fullName: d.fullName, emailAddress: d.emailAddress ?? loginId },
          };
          this.store(session);
          return session.user;
        }),
        catchError((err: HttpErrorResponse | Error) => throwError(() => new Error(this.loginError(err)))),
      );
  }

  /**
   * Swaps the refresh token for a new pair. Concurrent callers share one request: the
   * API rotates refresh tokens, so two parallel refreshes would invalidate each other.
   */
  refresh(): Observable<string> {
    const current = this.sessionSignal();
    if (!current?.refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http
        .post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${this.env.baseUrl()}/auth/refresh`,
          { refreshToken: current.refreshToken },
          { headers: { Authorization: `Bearer ${current.refreshToken}` } },
        )
        .pipe(
          map(res => {
            const t = res?.data;
            if (!t?.accessToken) throw new Error('Refresh response had no access token');
            this.store({ ...current, accessToken: t.accessToken, refreshToken: t.refreshToken || current.refreshToken });
            return t.accessToken;
          }),
          finalize(() => (this.refreshInFlight = undefined)),
          shareReplay(1),
        );
    }
    return this.refreshInFlight;
  }

  /** Revokes the session on the API (best effort) and clears it locally. */
  logout(): Observable<void> {
    const current = this.sessionSignal();
    this.clear();
    if (!current?.refreshToken) return of(undefined);
    return this.http
      .post(`${this.env.baseUrl()}/auth/logout`, { refreshToken: current.refreshToken }, {
        headers: { Authorization: `Bearer ${current.accessToken}` },
      })
      .pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  /** Session is gone or unusable: clear it and send the user to the login page. */
  expire(returnUrl = this.router.url): void {
    this.clear();
    const safeReturn = returnUrl.startsWith('/login') ? '/' : returnUrl;
    this.router.navigate(['/login'], { queryParams: { returnUrl: safeReturn, expired: 1 } });
  }

  clear(): void {
    this.sessionSignal.set(null);
    try {
      sessionStorage.removeItem(this.storageKey(this.env.env().key));
    } catch {
      /* ignore */
    }
  }

  private store(session: Session): void {
    this.sessionSignal.set(session);
    try {
      sessionStorage.setItem(this.storageKey(this.env.env().key), JSON.stringify(session));
    } catch {
      /* storage unavailable: session lasts for this page only */
    }
  }

  private read(envKey: string): Session | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey(envKey));
      const s = raw ? (JSON.parse(raw) as Session) : null;
      return s?.accessToken ? s : null;
    } catch {
      return null;
    }
  }

  private storageKey(envKey: string): string {
    return `logviewer.session.${envKey}`;
  }

  private loginError(err: HttpErrorResponse | Error): string {
    if (!(err instanceof HttpErrorResponse)) return err.message;
    if (err.status === 0) return `Can't reach the ${this.env.env().label} API. Check your connection (or CORS for this origin).`;
    if (err.status === 403) return err.error?.message || "This account doesn't have access to server logs.";
    if (err.status === 401 || err.status === 400) return err.error?.message || 'Invalid or expired code.';
    if (err.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    return err.error?.message || `Login failed (${err.status}).`;
  }
}
