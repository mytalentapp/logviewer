import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { LoadingPillarComponent } from './shared/overlay/loading.pillar.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HeaderComponent, LoadingPillarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit{
  title = 'logviewer';

  ngOnInit(): void {
    // sessionStorage.setItem('env', JSON.stringify('https://uat.mytalentinc.com/assessments/api/v1'))
  }
}
