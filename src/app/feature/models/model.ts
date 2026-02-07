export interface Query{
  $filter?:string;
  $pageSize:number;
  $page:number;
  $sortBy?:string;
  $orderBy?:'asc' | 'desc' | string;
}