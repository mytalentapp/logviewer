import { Component, Input, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-confirm',
    imports: [CommonModule],
    template: `
    <div class="modal-header border-0">
      <h6 class="modal-title fw-bold">{{title || 'Confirm delete item'}}</h6>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss('Cross click')"></button>
    </div>
    <div class="modal-body py-0">
      @if (isTemplate) {
        <ng-template [ngTemplateOutlet]="$any(body)"></ng-template>
      } @else {
        {{body}}
      }
    </div>
    <div class="modal-footer border-0 justify-content-center">
      <button type="button" class="btn btn-outline-dark" (click)="activeModal.dismiss('Close click')">Close</button>
      <button type="button" class="btn btn-primary" (click)="handleConfirm()">Confirm</button>
    </div>
    `,
    styles: []
})
export class ConfirmComponent {
  @Input() title?: string;
  @Input() body?: TemplateRef<any> | string;
  public activeModal = inject(NgbActiveModal);

  get isTemplate(): boolean {
    return this.body instanceof TemplateRef;
  }

  handleConfirm(): void {
    this.activeModal.close(true);
  }
}
