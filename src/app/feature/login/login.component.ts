import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { ENVIRONMENTS, EnvService, ApiEnvironment } from '@app/services/env.service';

@Component({
  selector: 'myt-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly env = inject(EnvService);

  readonly environments = ENVIRONMENTS;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly expired = this.route.snapshot.queryParamMap.has('expired');

  readonly form = this.fb.nonNullable.group({
    emailAddress: ['', [Validators.required, Validators.email]],
    userPassword: ['', Validators.required],
  });

  selectEnv(key: ApiEnvironment['key']): void {
    this.auth.switchEnv(key);
    this.error.set(null);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { emailAddress, userPassword } = this.form.getRawValue();

    this.auth.login(emailAddress.trim(), userPassword).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Only follow in-app paths.
        const target = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
        this.router.navigateByUrl(target);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.form.controls.userPassword.reset();
        this.submitting.set(false);
      },
    });
  }
}
