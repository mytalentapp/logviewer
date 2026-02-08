import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { LogService } from '@app/services/log.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NgPipesModule } from 'ngx-pipes';
import { BehaviorSubject } from 'rxjs';
import { SkeletonLoaderComponent } from "@app/shared/skeleton-loader/skeleton-loader.component";
import { CrudService } from '@app/services/crud.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule, NgPipesModule, NgbDropdownModule, SkeletonLoaderComponent, FormsModule,MonacoEditorModule],
    templateUrl: './logs.component.html',
    styleUrl: './logs.component.scss'
})
export class LogsComponent implements OnInit {
    private crud = inject(CrudService);
    private logService = inject(LogService);
    private router = inject(Router);
      
    private logSubject:BehaviorSubject<{id:string, filename:string}[]> = new BehaviorSubject<{id:string, filename:string}[]>([]);
    public logs$ = this.logSubject.asObservable();

    public searchText = ''
    public selectedLog!:string;
    public hoveredIndex = -1;
    public loading = signal<boolean>(false);
    public error = signal<string | null>(null);

    ngOnInit(): void {
        this.loading.set(true);
        this.logService.listLogs()
        .subscribe({
            next: ({ data }) => {
                const logItems = data.map((file:string) => ({
                    id: file,
                    filename: file.replace(/^assessment-/, '') 
                }))
                .sort((a:{id:string}, b:{id:string}) => {
                    if (a.id === 'assessment.log') return -1; 
                    if (b.id === 'assessment.log') return 1;

                    const dateA = a.id.match(/\d{4}-\d{2}-\d{2}/)?.[0];
                    const dateB = b.id.match(/\d{4}-\d{2}-\d{2}/)?.[0];
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;
                    if (!dateB) return -1;

                    return dateB.localeCompare(dateA); 
                });
                this.logSubject.next(logItems);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching logs:', err);
                this.error.set('Failed to load logs. Please try again later.');
                this.loading.set(false);
            }
        })
    }

    public select(filename:string){
        this.selectedLog = filename;
    }

  public route2ViewLog(log:{id:string, filename:string}){
    const ext = log.filename.split('.').pop();
    if (ext === 'log') {
        this.crud.setData(log);
        this.router.navigate(['/log-reader'], { queryParams: { id: log.id, filename: log.filename } });
    }
  }

  public deleteLog(log:{filename:string}){
  }
}
