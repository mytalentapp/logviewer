import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiResponse } from "../utils/apiResponse";
import { catchError, Observable, throwError } from "rxjs";

@Injectable({ providedIn: 'root' })
export class LogService {
  private http = inject(HttpClient);

  private endpoint = JSON.parse(sessionStorage.getItem('env')!);

  constructor(){

  }

  listLogs(){
    return this.http.get<ApiResponse<any>>(`${this.endpoint}/logs`)
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  readLog(file: string, tail = 2000) {
    return this.http.get<ApiResponse<any>>(
      `${this.endpoint}/logs/${file}`,
      { params: { tail } }
    )
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  streamLog(file: string) {
    return new EventSource(`${this.endpoint}/logs/stream/${file}`);
  }

  public handleError(error: HttpErrorResponse): Observable<never> {
    const errorMessage = error.error?.message || 'Something went wrong; please try again later.';
    return throwError(() => new Error(errorMessage));
  }
}
