import { Component, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { NgbModalModule, NgbModalConfig, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import {  RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'myt-header',
  standalone: true,
  imports: [CommonModule,NgbModalModule,NgbDropdownModule,RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit{
  public isAuthenticated: boolean | undefined;

  @ViewChild('navbarCollapse') navbarCollapse!: ElementRef;
  @ViewChild('navbarToggler') navbarToggler!: ElementRef;
  isNavbarOpen = false;

  public labelEnv!:string;

  constructor(){
    inject(NgbModalConfig).centered = true;
  }
  
  ngOnInit(): void {
    const env = JSON.parse(sessionStorage.getItem('env')!);
    if(env.includes('uat')){
      this.labelEnv = 'UAT';
    }else{
      this.labelEnv = 'PROD';
    }
  }

  toggleNavbar() {
    this.isNavbarOpen = !this.isNavbarOpen;
    const collapse = this.navbarCollapse.nativeElement;
    collapse.classList.toggle('show', this.isNavbarOpen);
  }

  closeNavbar() {
    if (this.isNavbarOpen) {
      this.isNavbarOpen = false;
      const collapse = this.navbarCollapse.nativeElement;
      collapse.classList.remove('show');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.navbarCollapse?.nativeElement.contains(event.target) ||
                          this.navbarToggler?.nativeElement.contains(event.target);
    if (!clickedInside && this.isNavbarOpen) {
      this.closeNavbar();
    }
  }

  switchEnv(){
    const env = JSON.parse(sessionStorage.getItem('env')!);
    if(!env){
      sessionStorage.setItem('env', JSON.stringify('https://uat.mytalentinc.com/assessments/api/v1'))
      this.labelEnv = 'UAT';
    }

    if(env.includes('uat')){
      this.labelEnv = 'PROD';
      sessionStorage.setItem('env', JSON.stringify('https://prod.mytalentinc.com/assessments/api/v1'))
    }else{
      this.labelEnv = 'UAT';
      sessionStorage.setItem('env', JSON.stringify('https://uat.mytalentinc.com/assessments/api/v1'))
    }
    window.location.reload();
  }
}
