import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrudService } from '@app/services/crud.service';
import { LogService } from '@app/services/log.service';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { filter, take, tap } from 'rxjs/operators';
import * as monaco from 'monaco-editor';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'myt-reader',
  standalone: true,
  imports: [MonacoEditorModule, FormsModule],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent implements OnInit {
  private logService = inject(LogService);
  private route = inject(ActivatedRoute);

  content = '// Editor is initialised, fetch log...';

  private editorReady = false;
  eventSource?: EventSource;
  public selectedLog!:string;

  editorOptions = {
    theme: 'vs',
    language: 'csharp',
    automaticLayout: true,
    minimap: { enabled: false },
    readOnly: true
  };

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
        const id = params['id'];
        this.loadLogContent(id)
    });
  }

  onEditorInit(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editorReady = true;
    this.content = `${this.content}`;
  }

  private loadLogContent(filename: string): void {
    this.content = '// Loading log content...';

    this.logService.readLog(filename).subscribe({
      next: ({ data }) => {
        if (this.editorReady) {
          this.content = data;
          console.log(this.content)
        } else {
          setTimeout(() => this.content = data);
        }
      },
      error: (err) => {
        this.content =
          `// Error loading log\n` +
          `// ${err?.message || err}`;
      }
    });
  }

  startStreaming() {
    this.eventSource?.close();
    this.eventSource = this.logService.streamLog('assessment.log');

    this.eventSource.onmessage = (e) => {
        this.content += '\n' + e.data;
    };
    }
}
