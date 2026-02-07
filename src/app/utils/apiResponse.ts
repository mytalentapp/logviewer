export interface ApiResponse<T>{
    data:T
    message:string;
    success:boolean;
}

export interface PageResult<T> {
  pageResult: T[];
  count: number;
}

export interface ApiResponse2<T>{
    data:T[]
    message:string;
    success:boolean;
    statusCode:number;
}