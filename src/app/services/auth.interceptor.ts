import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { EnvService } from './env.service';

const withToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Adds the access token to calls to the selected assessment API. On a 401 it refreshes
 * the token once and retries; if that fails the session has ended and the user is sent
 * to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const env = inject(EnvService);

  if (!env.isApiUrl(req.url)) return next(req);

  const token = auth.accessToken;
  const outgoing = token ? withToken(req, token) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !token) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError(refreshErr => {
          auth.expire();
          return throwError(() => refreshErr);
        }),
        switchMap(fresh => next(withToken(req, fresh))),
      );
    }),
  );
};
