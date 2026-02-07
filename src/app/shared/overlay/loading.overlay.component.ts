import { Component, inject } from '@angular/core';
import { LoadingService } from './loading.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'myt-loading-overlay',
  imports: [CommonModule],
  template: `
  @if(loadingService.isLoading$ | async){
    <div class="loading-overlay">
      <div class="loading-spinner">
        <!-- <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div> -->
        <img src="loader.gif" alt="">
        <p>Please wait...</p> 
      </div>
    </div>
  }
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    //   background: rgba(0, 0, 0, 0.3);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .loading-spinner {
      text-align: center;
    }
  `]
})
export class LoadingOverlayComponent {
    public loadingService = inject(LoadingService);
    constructor() {}
}