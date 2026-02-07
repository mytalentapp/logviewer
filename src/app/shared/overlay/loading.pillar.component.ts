import { Component, inject } from '@angular/core';
import { LoadingService } from './loading.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'myt-loading-pillar',
  imports: [CommonModule],
  template: `
  @if(loadingService.isLoading$ | async){
    <div class="loading-overlay">
        <span class="loader"></span>
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
      // background: rgba(255, 255, 255, 0.92);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    }

  .loader {
    color: #012970;
    position: relative;
    font-size: 11px;
    background: #012970;
    animation: escaleY 1s infinite ease-in-out;
    width: 0.5em;
    height: 3.5em;
    animation-delay: -0.16s;
  }
  .loader:before,
  .loader:after {
    content: '';
    position: absolute;
    top: 0;
    left: 1em;
    background: #012970;
    width: 0.5em;
    height: 3.5em;
    animation: escaleY 1s infinite ease-in-out;
  }
  .loader:before {
    left: -1em;
    animation-delay: -0.32s;
  }

  @keyframes escaleY {
    0%, 80%, 100% {
      box-shadow: 0 0;
      height: 4em;
    }
    40% {
      box-shadow: 0 -2em;
      height: 5em;
    }
  }
    `]
  })

export class LoadingPillarComponent {
    public loadingService = inject(LoadingService);
    constructor() {}
}