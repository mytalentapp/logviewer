import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, OnChanges, Output, signal, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { DynamicPipe } from '../pipes/dynamic.pipe';

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  badge?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
  style?: (value: any) => string;
  pipe?: { token: any; args?: any[] };
  template?: TemplateRef<any>;
  type: 'text' | 'date' | 'datetime' | 'number' | 'boolean' | 'actions';
  onClick?: (row: any, value: any) => void;
  clickable?: boolean;
}

export interface PageEvent {
  page: number;
  pageSize: number;
  sortBy?: string | null;
  orderBy?: 'asc' | 'desc' | null;
}

export interface Pagination {
  maxSize: number;
  pageSize: number;
  pageStart: number;
  collectionSize: number;
}

@Component({
    selector: 'bluekios-data-table',
    imports: [CommonModule, FormsModule, NgbPaginationModule, DynamicPipe],
    providers: [DatePipe, CurrencyPipe, DecimalPipe, PercentPipe],
    template: `
  <div class="table-container d-flex flex-column">
  <div class="table-scrollable flex-grow-1 overflow-auto">
   @if (pagination.collectionSize === 0) {
      <ng-content select="[emptyState]"></ng-content>
    } @else {
      <table class="table table-hover mb-0">
        <thead class="table-light sticky-header">
          <tr>
            @if (enableSelection) {
              <th scope="col" class="text-center" style="width: 50px;">
                <input type="checkbox" class="form-check-input form-check-input-lg m-0" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)"/>
              </th>
            }
            @for (col of columns; track col.key) {
              <th 
                scope="col" 
                [class.text-end]="col.align === 'right'"
                [class.sortable]="col.sortable"
                [class.actions-col]="col.type === 'actions'"
                (click)="col.sortable ? toggleSort(col.key) : null"
              >
                {{ col.label }}
                @if (col.sortable) {
                  <i class="las ms-1" [ngClass]="getSortIcon(col.key)"></i>
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of data; track item[trackByKey]) {
            <tr 
              [class.table-active]="isSelected(item)"
              [class.selected-row]="isSelected(item)"
            >
                @if (enableSelection) {
                  <td class="text-center" style="width: 50px;">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      [checked]="isSelected(item)"
                      (change)="toggleSelection(item, $any($event.target).checked)"
                    />
                  </td>
                }
              @for (col of columns; track col.key) {
                @let cell = resolveValue(item, col);
                <td 
                    [class.text-end]="col.align === 'right'" 
                    [class.clickable-cell]="cell.clickable"
                    (click)="cell.clickable && cell.onClick?.(item, cell.raw); $event.stopPropagation()"
                    [class.actions-col]="col.type === 'actions'"
                    >
                  @if (col.type === 'actions' && actionsTemplate) {
                    <ng-container [ngTemplateOutlet]="actionsTemplate" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
                  } @else if (col.template) {
                    <ng-container [ngTemplateOutlet]="col.template" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
                  } @else if (col.pipe) {
                    {{ cell.raw | dynamic : col.pipe.token : col.pipe.args }}
                  }@else {
                    @if (cell.badge) {
                      <span class="badge rounded-pill" [ngClass]="cell.style">{{ cell.display }}</span>
                    } @else {
                      <span class="cell-value">{{ cell.display }}</span>
                    }
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    }
  </div>

  @if(data.length > 0) {
    <div class="pagination-fixed mt-3">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <label class="me-2">Items per page:</label>
          <select 
            [ngModel]="pageSize()" 
            (ngModelChange)="updatePageSize($event)"
            class="form-select d-inline-block w-auto"
          >
            @for (size of pageSizeOptions; track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </div>

        <ngb-pagination
          [collectionSize]="pagination.collectionSize"
          [page]="currentPage()"
          [pageSize]="pageSize()"
          [maxSize]="pagination.maxSize"
          [boundaryLinks]="true"
          [rotate]="true"
          [ellipses]="true"
          (pageChange)="setPage($event)"
        ></ngb-pagination>
      </div>
    </div>
  }
</div>
  `,
    styleUrls: ['./table.component.scss']
})
export class BluekiosDataTableComponent<T> implements OnChanges {
  @ContentChild('columnTemplate', { read: TemplateRef }) columnTemplate?: TemplateRef<any>;
  @ContentChild('actions', { read: TemplateRef }) actionsTemplate?: TemplateRef<any>;

  @Input() data: T[] = [];
  @Input() columns: TableColumn<T>[] = [];
  @Input() trackByKey: keyof T = 'id' as keyof T;
  @Input() pageSizeOptions: number[] = [5, 10, 20, 50];
  @Input() enableSelection: boolean = false;
  @Input() pagination: Pagination = {
    maxSize: 5,
    pageSize: 10,
    pageStart: 1,
    collectionSize: 0
  };
  @Output() selectionChange = new EventEmitter<T[]>();
  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<{ sortBy: string | null; orderBy: 'asc' | 'desc' | null }>();
  selectedRows = signal<Set<number>>(new Set());

  public currentPage = signal(this.pagination.pageStart);
  public pageSize = signal(this.pagination.pageSize);

  private sortColumn = signal<string | null>(null);
  private sortDirection = signal<'asc' | 'desc'>('asc');

  public safeGetValue(item: T, key: keyof T | string): any {
    if (typeof key === 'string' && key in (item as any)) {
      return (item as any)[key];
    }
    return undefined;
  }

  public toggleSelection(item: T, checked: boolean) {
    const id = item[this.trackByKey] as any
    if (checked) {
      this.selectedRows.update(rows => rows.add(id));
    } else {
      this.selectedRows.update(rows => {
        rows.delete(id);
        return rows;
      });
    }

    this.selectionChange.emit(
      this.data.filter(row => this.selectedRows().has(row[this.trackByKey] as number))
    );
  }

  public ngOnChanges() {
    this.currentPage.set(this.pagination.pageStart);
    this.pageSize.set(this.pagination.pageSize);
    this.clearSelection();
  }

  private emitPageChange() {
    this.pageChange.emit({
      page: this.currentPage(),
      pageSize: this.pageSize(),
      sortBy: this.sortColumn(),
      orderBy: this.sortDirection()
    });
  }

  private emitSortChange() {
    this.sortChange.emit({
      sortBy: this.sortColumn(),
      orderBy: this.sortDirection()
    });
  }

  public toggleSort(key: string | keyof T) {
    const keyStr = String(key);
    if (this.sortColumn() === keyStr) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(keyStr);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
    this.emitSortChange();
  }

  public setPage(value: number) {
    if (value !== this.currentPage()) {
      this.currentPage.set(value);
      this.clearSelection();
      this.emitPageChange();
    }
  }

  public updatePageSize(newSize: number) {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.clearSelection();
    this.emitPageChange();
  }

  public getSortIcon(key: string | keyof T): string {
    const keyStr = String(key);
    if (this.sortColumn() !== keyStr) return 'las la-arrow-down-up';
    return this.sortDirection() === 'asc' ? 'las la-sort-amount-down-alt' : 'las la-sort-amount-up-alt';
  }

  public isSelected(item: any): boolean {
    return this.selectedRows().has(item[this.trackByKey]);
  }

  public allSelected(): boolean {
    return this.data.every(item => this.selectedRows().has(item[this.trackByKey] as number));
  }

  public toggleAll(checked: boolean) {
    this.data.forEach(item => {
      const id = item[this.trackByKey] as number;
      if (checked) {
        this.selectedRows.update(rows => rows.add(id));
      } else {
        this.selectedRows.update(rows => {
          rows.delete(id);
          return rows;
        });
      }
    });
    this.selectionChange.emit(this.data.filter(item => this.selectedRows().has(item[this.trackByKey] as number)));
  }

  public resolveValue(item: T, col: TableColumn<T>) {
    const raw = this.safeGetValue(item, col.key);
    return {
      raw,
      display: col.format ? col.format(raw) : raw,
      style: col.style ? col.style(raw) : null,
      badge: !!col.badge,
      clickable: !!col.clickable,
      onClick: col.onClick
    };
  }

  private clearSelection() {
    this.selectedRows.set(new Set());
    this.selectionChange.emit([]);
  }

}