import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-nodata',
  standalone:true,
  template: `
  <div class="nodata pt-5 d-flex flex-column align-items-center">
    <img src="noresult.png" alt="No Data" class="img-fluid pt-5 py-3" style="width: 150px;"/>
    <small class="text-secondary">{{message || 'No data available!.'}}</small>
  </div>
  `,
  styles: `
    .nodata{
      display: block;
      margin: auto;
      width: 50%;
  }

img{
  width: 40%;
  height: 40%;
}
  `,
})
export class NodataComponent {
  @Input()
  public message!:string;
}
