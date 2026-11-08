import { Injectable, signal, computed } from '@angular/core';

export interface ApiEnvironment {
  key: 'uat' | 'demo' | 'prod';
  label: string;
  url: string;
}

export const ENVIRONMENTS: ApiEnvironment[] = [
  { key: 'uat', label: 'UAT', url: 'https://uat.mytalentinc.com/assessments/api/v1' },
  { key: 'demo', label: 'DEMO/STG', url: 'https://api.mytalentinc.com/assessments/api/v1' },
  { key: 'prod', label: 'PROD', url: 'https://api.mynaturaltalents.com/assessments/api/v1' },
];

const STORAGE_KEY = 'logviewer.env';

/** Which assessment API the viewer talks to. Each environment has its own login. */
@Injectable({ providedIn: 'root' })
export class EnvService {
  private readonly current = signal<ApiEnvironment>(this.restore());

  readonly env = this.current.asReadonly();
  readonly baseUrl = computed(() => this.current().url);

  select(key: ApiEnvironment['key']): void {
    const next = ENVIRONMENTS.find(e => e.key === key) ?? ENVIRONMENTS[0];
    this.current.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next.key);
    } catch {
      /* storage unavailable: selection lasts for this page only */
    }
  }

  /** True when the request goes to the selected assessment API (so it may carry our token). */
  isApiUrl(url: string): boolean {
    return url.startsWith(this.baseUrl() + '/');
  }

  private restore(): ApiEnvironment {
    let key: string | null = null;
    try {
      key = localStorage.getItem(STORAGE_KEY);
      if (!key) {
        // Older builds kept the full URL in sessionStorage under "env".
        const legacy = JSON.parse(sessionStorage.getItem('env') ?? 'null');
        key = ENVIRONMENTS.find(e => e.url === legacy)?.key ?? null;
      }
    } catch {
      key = null;
    }
    return ENVIRONMENTS.find(e => e.key === key) ?? ENVIRONMENTS[0];
  }
}
