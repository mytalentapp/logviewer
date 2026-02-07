import { Routes } from '@angular/router';
import { LogsComponent } from './feature/logs/logs.component';
import { ReaderComponent } from './feature/reader/reader.component';

export const routes: Routes = [
    { path: '', component: LogsComponent },
    { path: 'log-reader', component: ReaderComponent },
    { path: '', redirectTo: '/logs', pathMatch: 'full' },
];
