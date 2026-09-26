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
    if(env.includes('uat.mytalentinc.com')){
      this.labelEnv = 'UAT';
    }else if(env.includes('api.mytalentinc.com')){
      this.labelEnv = 'DEMO/STG';
    }else if(env.includes('api.mynaturaltalents.com')){
      this.labelEnv = 'PROD';
    }else{
      this.labelEnv = 'UAT';
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

  switchEnv(appEnv:string){
    switch(appEnv){
      case 'uat':
          sessionStorage.setItem('env', JSON.stringify('https://uat.mytalentinc.com/assessments/api/v1'))
          this.labelEnv = 'UAT';
        break;
        case 'demo':
          sessionStorage.setItem('env', JSON.stringify('https://api.mytalentinc.com/assessments/api/v1'))
          this.labelEnv = 'DEMO/STG';
        break;
        case 'prod':
          sessionStorage.setItem('env', JSON.stringify('https://api.mynaturaltalents.com/assessments/api/v1'))
          this.labelEnv = 'PROD';
          break;
        default:
          sessionStorage.setItem('env', JSON.stringify('https://uat.mytalentinc.com/assessments/api/v1'))
          this.labelEnv = 'UAT';
    }
    window.location.reload();
  }
}
