import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BluekiosDataTableComponent } from './table.component';

describe('BluekiosDataTableComponent', () => {
  let component: BluekiosDataTableComponent<any>;
  let fixture: ComponentFixture<BluekiosDataTableComponent<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BluekiosDataTableComponent<any>]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BluekiosDataTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
