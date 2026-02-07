import { Component, inject, Input } from '@angular/core';
import { LoadingService } from './loading.service';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: 'myt-loader',
  imports: [CommonModule, NgbCarouselModule],
  template: `
  
  @if(loadingService.isLoading$ | async){
    <ng-container *ngTemplateOutlet="loadingTemplate"></ng-container>
  }@else{
    <ng-container *ngTemplateOutlet="loadingTemplate"></ng-container>
  }

  <ng-template #loadingTemplate>
    <div class="loading-overlay">
        <div class="loading-text">
         {{ loadingText  || 'Loading'}} <span class="dots"></span>
        </div>
    </div>
  </ng-template>
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      // background: rgba(255, 255, 255, 0.92);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    }

  .loading-text {
    font-size: 14px;
    // font-weight: bolder;
    color: #012970;
    display: inline-flex;
    align-items: center;
    letter-spacing: 0.3px;
  }

  .dots::after {
    content: '';
    display: inline-block;
    width: 1.2em;
    text-align: left;
    animation: dots 1.4s steps(3, end) infinite;
  }

  @keyframes dots {
    0%   { content: '' }
    33%  { content: '.' }
    66%  { content: '..' }
    100% { content: '...' }
  }

    `]
  })

export class LoaderComponent {
  @Input() loadingText: string | null = null;
  public loadingService = inject(LoadingService);
  constructor() {}
}