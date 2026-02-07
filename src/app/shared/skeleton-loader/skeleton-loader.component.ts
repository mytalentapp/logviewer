import { Component, Input } from '@angular/core';


@Component({
    selector: 'skeleton-loader',
    imports: [],
    template: `
    <div class="custom-skeleton">
      @for (i of rows; track i) {
        <div class="skeleton-row">
          <div class="skeleton-cell w-20"><div class="skeleton-bar"></div></div>
          <div class="skeleton-cell w-15 d-none d-md-block"><div class="skeleton-bar"></div></div>
          <div class="skeleton-cell w-15 d-none d-md-block"><div class="skeleton-bar"></div></div>
          <div class="skeleton-cell w-35"><div class="skeleton-bar"></div></div>
          @if(!skip){
            <div class="skeleton-cell w-10 text-end"><div class="skeleton-bar short"></div></div>
          }
          <div class="skeleton-cell w-5 text-end">
            <div class="skeleton-circle"></div>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    .custom-skeleton { width: 100%; padding: 8px 0; }

    .skeleton-row {
      display: flex;
      align-items: center;
      background: #ffffff;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      animation: skeleton-pulse 2s ease-in-out infinite;
    }

    .skeleton-cell { padding: 0 8px; }
    .skeleton-cell.w-5   { flex: 0 0 5%; }
    .skeleton-cell.w-10  { flex: 0 0 10% }
    .skeleton-cell.w-15  { flex: 0 0 15% }
    .skeleton-cell.w-20  { flex: 0 0 20% }
    .skeleton-cell.w-35  { flex: 0 0 35% }

    .skeleton-bar {
      height: 18px;
      width: 100%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      border-radius: 6px;
      animation: shimmer 2s infinite;
    }

    .skeleton-bar.short { width: 60%; margin-left: auto; }

    .skeleton-circle {
      width: 38px;
      height: 38px;
      background: #e0e0e0;
      border-radius: 50%;
      margin-left: auto;
      animation: shimmer 2s infinite;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 1 }
      50% { opacity: 0.85 }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0 }
      100% { background-position: 200% 0 }
    }

    @media (max-width: 768px) {
      .skeleton-row {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 16px;
      }
      .skeleton-cell { width: 100% !important; text-align: left !important; }
      .skeleton-bar.short { margin-left: 0; }
      .skeleton-circle { align-self: flex-end; }
    }
  `]
})
export class SkeletonLoaderComponent {
  @Input() count = 5;
  @Input() skip = false;
  
  get rows(): number[] {
    return Array(this.count).fill(0).map((_, i) => i + 1);
  }
}