import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { ENVIRONMENTS, EnvService, ApiEnvironment } from '@app/services/env.service';

/** Seconds before another code can be requested (the API throttles at 60 s). */
const RESEND_SECONDS = 60;

/**
 * Admin sign-in without a password: the login ID (an email address) gets a one-time
 * code by email, and the code signs in. The API refuses anyone who isn't an
 * administrator.
 */
@Component({
  selector: 'myt-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly env = inject(EnvService);

  readonly environments = ENVIRONMENTS;
  readonly step = signal<'loginId' | 'code'>('loginId');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly resendIn = signal(0);
  readonly expired = this.route.snapshot.queryParamMap.has('expired');

  private timer?: ReturnType<typeof setInterval>;

  readonly form = this.fb.nonNullable.group({
    loginId: ['', [Validators.required, Validators.email]],
    otpCode: [''],
  });

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  selectEnv(key: ApiEnvironment['key']): void {
    this.auth.switchEnv(key);
    this.error.set(null);
    // A code is only valid on the environment that sent it.
    if (this.step() === 'code') this.changeLoginId();
  }

  submit(): void {
    if (this.step() === 'loginId') this.sendCode();
    else this.signIn();
  }

  sendCode(): void {
    const loginId = this.form.controls.loginId;
    if (loginId.invalid || this.submitting()) {
      loginId.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.requestCode(loginId.value.trim()).subscribe({
      next: message => {
        this.notice.set(message);
        this.step.set('code');
        this.form.controls.otpCode.setValidators([Validators.required, Validators.pattern(/^\s*\S{4,10}\s*$/)]);
        this.form.controls.otpCode.reset();
        this.startResendTimer();
        this.submitting.set(false);
        // autofocus only applies on page load; focus the new field once it renders.
        setTimeout(() => document.getElementById('otpCode')?.focus());
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.submitting.set(false);
      },
    });
  }

  signIn(): void {
    const code = this.form.controls.otpCode;
    if (code.invalid || this.submitting()) {
      code.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(this.form.controls.loginId.value.trim(), code.value.trim()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Only follow in-app paths.
        const target = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
        this.router.navigateByUrl(target);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        code.reset();
        this.submitting.set(false);
        setTimeout(() => document.getElementById('otpCode')?.focus());
      },
    });
  }

  changeLoginId(): void {
    this.step.set('loginId');
    this.notice.set(null);
    this.error.set(null);
    this.form.controls.otpCode.clearValidators();
    this.form.controls.otpCode.reset();
    clearInterval(this.timer);
    this.resendIn.set(0);
    setTimeout(() => document.getElementById('loginId')?.focus());
  }

  private startResendTimer(): void {
    clearInterval(this.timer);
    this.resendIn.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.resendIn.update(s => s - 1);
      if (this.resendIn() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
