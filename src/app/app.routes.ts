import { Routes } from '@angular/router';
import { LogsComponent } from './feature/logs/logs.component';
import { ReaderComponent } from './feature/reader/reader.component';
import { LoginComponent } from './feature/login/login.component';
import { authGuard, guestGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'Sign in · Log Viewer' },
  { path: '', component: LogsComponent, canActivate: [authGuard], title: 'Logs · Log Viewer' },
  { path: 'log-reader', component: ReaderComponent, canActivate: [authGuard], title: 'Reader · Log Viewer' },
  { path: '**', redirectTo: '' },
];
