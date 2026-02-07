import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment as env } from "@env/environment";
import { catchError, defer, finalize, forkJoin, map, Observable, of, Subject, tap, throwError } from 'rxjs';
import { ApiResponse, ApiResponse2 } from '@app/utils/apiResponse';
import { LoadingService } from '@app/shared/overlay/loading.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Query } from '@app/feature/models/model';


@Injectable({
  providedIn: 'root'
})
export class CrudService {
  private http = inject(HttpClient);
  private loading = inject(LoadingService);
  private sanitizer = inject(DomSanitizer);
  private lookupEndpoint:string;
  private imageCache = new Map<string, SafeUrl>();

  private readonly dataSubject = new Subject<any>();
  public data$ = this.dataSubject.asObservable();
  
  constructor() {
    this.lookupEndpoint = env.endpoint+"/data"
   }

  setData(data?: any) { 
    this.dataSubject.next(data);
  }
  
  save(payload: any, path:string) {
    if (!payload.id){
      return this.http.post<ApiResponse<any>>(`${env.endpoint}/${path}`, payload)
      .pipe(tap(res => this.dataSubject.next(res)))
      .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
    }else{
      return this.http.put<ApiResponse<any>>(`${env.endpoint}/${path}`, payload)
      .pipe(tap(res => this.dataSubject.next(res)))
      .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
    }
  }

  saveUpload(form: FormData, path:string) {
    return this.http.post<ApiResponse<any>>(`${env.endpoint}/${path}`, form)
    .pipe(tap(res => this.dataSubject.next(res)))
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  post(payload:any, path:string){
    return this.http.post<ApiResponse<any>>(`${env.endpoint}/${path}`, payload);
  }

  findById(id:string, path:string){
    return this.http.get<ApiResponse<any>>(`${env.endpoint}/${path}/${id}`)
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  fetchAll(path:string){
    return this.http.get<ApiResponse<any>>(`${env.endpoint}/${path}`)
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  delete(id: string, path:string){
    return this.http.delete<any>(`${env.endpoint}/${path}/${id}`)
    .pipe(tap(res => this.dataSubject.next({ delete: true, obj: { id }, ...res })))
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  deleteAll(arr:any[], path:string){
    const request$ = arr.map(id => this.delete(id, path));
    return forkJoin(request$).pipe(map((res) => res))
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  checkAvailability(value:string, path:string){
    return this.http.get<ApiResponse<any>>(`${env.endpoint}/${path}/${value}`, { withCredentials: true })
    .pipe(catchError((error:HttpErrorResponse) => this.handleError(error)));
  }

  getBlobs(imageUrl:string):Observable<SafeUrl>{
    return this.http.get(`${imageUrl}`, { responseType: 'blob' })
    .pipe(
      map(blob => {
        const objectUrl = URL.createObjectURL(blob);
        return this.sanitizer.bypassSecurityTrustUrl(objectUrl);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getPlaceholderImage(): Observable<Blob> {
    return this.http.get('placeholder.png',{ responseType: 'blob' });
  }

  public loadImage(url: string): Observable<SafeUrl> {
    if (this.imageCache.has(url)) {
      return of(this.imageCache.get(url)!);
    }

    return this.getBlobs(url).pipe(
      tap(safeUrl => this.imageCache.set(url, safeUrl)),
      catchError(() => {
        const fallback = this.getPlaceholderUrl();
        this.imageCache.set(url, fallback);
        return of(fallback);
      })
    );
  }

  public getPlaceholderUrl(): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl('placeholder.jpg');
  }
  
  fetchQuery(q:Query, path:string): Observable<{ data: any[]; total: number; page: number; pageSize: number }> {
    return defer(() => {
      this.loading.show()
      let params = new HttpParams()
      .set('page', q.$page)
      .set('size', q.$pageSize)

    if(q.$filter) params = params.set('filter', q.$filter);
    if(q.$sortBy) params = params.set('sortBy', q.$sortBy);
    if(q.$orderBy) params = params.set('orderBy', q.$orderBy.toUpperCase());

    return this.http.get<ApiResponse<any>>(`${env.endpoint}/${path}`, { params })
      .pipe(
        map(({ data }) => ({
          data: data?.pageResult ?? [],
          total: data?.count ?? 0,
          page: data?.page ?? q.$page,
          pageSize: data?.pageSize ?? q.$pageSize
        })),
         finalize(() => this.loading.hide())
      );
    });
  }


fetchImagesQuery(q: Query, path: string): Observable<{ data: any[]; total: number; page: number; pageSize: number }> {
  let params = new HttpParams()
    .set('page', q.$page.toString())
    .set('size', q.$pageSize.toString());

  if (q.$filter) params = params.set('filter', q.$filter);
  if (q.$sortBy) params = params.set('sortBy', q.$sortBy);
  if (q.$orderBy) params = params.set('orderBy', q.$orderBy.toUpperCase());

  return this.http.get<ApiResponse<any>>(`${env.endpoint}/${path}`, { params }).pipe(
    map(({ data }) => ({
      data: data?.pageResult ?? [],
      total: data?.count ?? 0,
      page: data?.page ?? q.$page,
      pageSize: data?.pageSize ?? q.$pageSize
    })),
    catchError((error: HttpErrorResponse) => this.handleError(error))
  );
}

  public handleError(error: HttpErrorResponse): Observable<never> {
    const errorMessage = error.error?.message || 'Something went wrong; please try again later.';
    return throwError(() => new Error(errorMessage));
  }
}
