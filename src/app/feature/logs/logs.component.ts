import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { LogService } from '@app/services/log.service';
import { SkeletonLoaderComponent } from '@app/shared/skeleton-loader/skeleton-loader.component';
import { ConfirmComponent } from '@app/shared/confirm/confirm.component';

export interface LogItem {
  /** Real file name on the server (used for every API call). */
  id: string;
  /** Shorter label for display. */
  label: string;
  date: string | null;
  isCurrent: boolean;
  isArchive: boolean;
}

const CURRENT_LOG = 'assessment.log';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [FormsModule, NgbDropdownModule, SkeletonLoaderComponent],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent implements OnInit {
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);
  private readonly modal = inject(NgbModal);
  private readonly toastr = inject(ToastrService);

  readonly logs = signal<LogItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly busy = signal<string | null>(null);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.logs().filter(l => l.id.toLowerCase().includes(q)) : this.logs();
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.logService.listLogs().subscribe({
      next: files => {
        this.logs.set(files.map(toItem).sort(byNewest));
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Failed to load logs.');
        this.loading.set(false);
      },
    });
  }

  open(log: LogItem, live = false): void {
    if (log.isArchive) {
      this.download(log);
      return;
    }
    this.router.navigate(['/log-reader'], { queryParams: { file: log.id, ...(live ? { live: 1 } : {}) } });
  }

  download(log: LogItem): void {
    this.busy.set(log.id);
    this.logService.downloadLog(log.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = log.id;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.busy.set(null);
      },
      error: (err: Error) => {
        this.toastr.error(err.message, 'Download failed');
        this.busy.set(null);
      },
    });
  }

  remove(log: LogItem): void {
    const ref = this.modal.open(ConfirmComponent, { centered: true });
    ref.componentInstance.title = 'Delete log file';
    ref.componentInstance.body = `Permanently delete ${log.id} from the server? This can't be undone.`;
    ref.result.then(
      ok => {
        if (!ok) return;
        this.busy.set(log.id);
        this.logService.deleteLog(log.id).subscribe({
          next: () => {
            this.logs.update(list => list.filter(l => l.id !== log.id));
            this.toastr.success(`${log.id} deleted`);
            this.busy.set(null);
          },
          error: (err: Error) => {
            this.toastr.error(err.message, 'Delete failed');
            this.busy.set(null);
          },
        });
      },
      () => undefined,
    );
  }
}

function toItem(file: string): LogItem {
  return {
    id: file,
    label: file.replace(/^assessment-/, ''),
    date: file.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    isCurrent: file === CURRENT_LOG,
    isArchive: /\.(gz|zip)$/i.test(file),
  };
}

/** Current log first, then newest date first, then by name. */
function byNewest(a: LogItem, b: LogItem): number {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
  if (!!a.date !== !!b.date) return a.date ? -1 : 1;
  return b.id.localeCompare(a.id, undefined, { numeric: true });
}
