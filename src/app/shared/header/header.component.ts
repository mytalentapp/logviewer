import { Component, ElementRef, HostListener, ViewChild, computed, inject } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@app/services/auth.service';
import { ApiEnvironment, ENVIRONMENTS, EnvService } from '@app/services/env.service';

@Component({
  selector: 'myt-header',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly env = inject(EnvService);
  readonly environments = ENVIRONMENTS;

  readonly initials = computed(() => {
    const u = this.auth.user();
    const source = u?.fullName?.trim() || u?.emailAddress || '';
    return source.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  });

  @ViewChild('navbarCollapse') navbarCollapse!: ElementRef<HTMLElement>;
  @ViewChild('navbarToggler') navbarToggler!: ElementRef<HTMLElement>;
  isNavbarOpen = false;

  toggleNavbar(): void {
    this.isNavbarOpen = !this.isNavbarOpen;
    this.navbarCollapse.nativeElement.classList.toggle('show', this.isNavbarOpen);
  }

  closeNavbar(): void {
    if (!this.isNavbarOpen) return;
    this.isNavbarOpen = false;
    this.navbarCollapse.nativeElement.classList.remove('show');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const inside = this.navbarCollapse?.nativeElement.contains(target) || this.navbarToggler?.nativeElement.contains(target);
    if (!inside) this.closeNavbar();
  }

  /** Each environment has its own session; without one, the guard sends us to login. */
  switchEnv(key: ApiEnvironment['key']): void {
    this.closeNavbar();
    if (key === this.env.env().key) return;
    this.auth.switchEnv(key);
    const target = this.auth.isAuthenticated() ? '/' : '/login';
    // Re-create the current page so it reloads data from the new environment.
    this.router.navigateByUrl('/login', { skipLocationChange: true }).then(() => this.router.navigateByUrl(target));
  }

  logout(): void {
    this.closeNavbar();
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
