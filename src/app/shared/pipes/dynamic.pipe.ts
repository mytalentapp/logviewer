import { Pipe, PipeTransform, Injector } from '@angular/core';

@Pipe({
  name: 'dynamic',
  standalone: true
})
export class DynamicPipe implements PipeTransform {
  constructor(private injector: Injector) {}

  transform(value: any, pipeToken: any, pipeArgs: any[] = []): any {
    if (!pipeToken) return value;

    const pipe = this.injector.get(pipeToken) as PipeTransform;
    return pipe.transform(value, ...pipeArgs);
  }
}