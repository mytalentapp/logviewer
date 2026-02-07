import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, BrowserModule } from '@angular/platform-browser';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

export const appConfig: ApplicationConfig = {
    providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch()),
    provideClientHydration(),
    provideToastr({ timeOut: 4000, preventDuplicates: true }),
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes),
    importProvidersFrom([BrowserModule]),
    provideMonacoEditor() 
  ]
};
