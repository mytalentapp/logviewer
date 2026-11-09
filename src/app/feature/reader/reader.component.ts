import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import type * as Monaco from 'monaco-editor';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { LogService, LogStreamEvent } from '@app/services/log.service';

type LiveState = 'off' | 'connecting' | 'live' | 'reconnecting' | 'error';

/** Lines kept in the editor while live; older ones are dropped from the top. */
const MAX_LIVE_LINES = 20000;

@Component({
  selector: 'myt-reader',
  standalone: true,
  imports: [MonacoEditorModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss'],
})
export class ReaderComponent implements OnInit, OnDestroy {
  private readonly logService = inject(LogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tailOptions = [500, 1000, 2000, 5000];

  readonly file = signal('');
  readonly tail = signal(2000);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly live = signal<LiveState>('off');
  readonly liveMessage = signal('');
  readonly follow = signal(true);
  readonly wrap = signal(false);
  readonly lineCount = signal(0);
  readonly newLines = signal(0);

  private editor?: Monaco.editor.IStandaloneCodeEditor;
  private pendingText: string | null = null;
  private loadSub?: Subscription;
  private streamSub?: Subscription;

  readonly editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
    theme: 'log-light',
    language: 'log',
    readOnly: true,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    renderWhitespace: 'none',
    fontSize: 13,
    lineNumbersMinChars: 6,
    folding: false,
    stickyScroll: { enabled: false },
  };

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      // "id" is what older links used.
      const file = params.get('file') ?? params.get('id') ?? '';
      if (!file) {
        this.router.navigate(['/']);
        return;
      }
      this.stopLive();
      this.file.set(file);
      if (params.has('live')) this.startLive();
      else this.load();
    });
    this.destroyRef.onDestroy(() => this.stopLive());
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.stopLive();
  }

  onEditorInit(editor: Monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    registerLogLanguage();
    const model = editor.getModel();
    const monaco = monacoGlobal();
    if (model && monaco) monaco.editor.setModelLanguage(model, 'log');
    monaco?.editor.setTheme('log-light');

    // Scrolling up pauses follow mode; scrolling back to the bottom resumes it.
    editor.onDidScrollChange(e => {
      if (!e.scrollTopChanged) return;
      const atBottom = e.scrollTop + editor.getLayoutInfo().height >= e.scrollHeight - 30;
      if (atBottom && !this.follow()) {
        this.follow.set(true);
        this.newLines.set(0);
      } else if (!atBottom && this.follow() && this.live() !== 'off') {
        this.follow.set(false);
      }
    });

    if (this.pendingText !== null) {
      this.setText(this.pendingText);
      this.pendingText = null;
    }
  }

  // ---- static read -------------------------------------------------------

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loadSub = this.logService.readLog(this.file(), this.tail()).subscribe({
      next: text => {
        this.setText(text);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  changeTail(value: number): void {
    this.tail.set(Number(value));
    if (this.live() !== 'off') {
      this.stopLive();
      this.startLive();
    } else {
      this.load();
    }
  }

  // ---- live stream -------------------------------------------------------

  toggleLive(): void {
    if (this.live() === 'off' || this.live() === 'error') this.startLive();
    else this.stopLive();
  }

  startLive(): void {
    this.loadSub?.unsubscribe();
    this.stopLive();
    this.error.set(null);
    this.live.set('connecting');
    this.liveMessage.set('Connecting…');
    this.follow.set(true);
    let firstConnect = true;

    this.streamSub = this.logService.streamLog(this.file(), this.tail()).subscribe({
      next: (e: LogStreamEvent) => {
        switch (e.type) {
          case 'connected':
            if (firstConnect) {
              // The server sends the last N lines next, so start from a clean slate.
              this.setText('');
              firstConnect = false;
            }
            this.live.set('live');
            this.liveMessage.set('Live');
            break;
          case 'lines':
            this.append(e.text);
            break;
          case 'rotated':
            this.append('──────── log file rotated ────────');
            break;
          case 'reconnecting':
            this.live.set('reconnecting');
            this.liveMessage.set(`Connection lost, retrying in ${Math.round(e.delayMs / 1000)}s…`);
            break;
          case 'error':
            this.live.set('error');
            this.liveMessage.set(e.message);
            if (e.fatal) this.toastr.error(e.message, 'Live stream stopped');
            break;
        }
      },
      complete: () => {
        if (this.live() !== 'error') this.live.set('off');
      },
    });
  }

  stopLive(): void {
    this.streamSub?.unsubscribe();
    this.streamSub = undefined;
    if (this.live() !== 'error') this.live.set('off');
    this.newLines.set(0);
  }

  // ---- view controls -----------------------------------------------------

  toggleWrap(): void {
    this.wrap.update(w => !w);
    this.editor?.updateOptions({ wordWrap: this.wrap() ? 'on' : 'off' });
  }

  jumpToEnd(): void {
    this.follow.set(true);
    this.newLines.set(0);
    this.scrollToEnd();
  }

  find(): void {
    this.editor?.focus();
    this.editor?.getAction('actions.find')?.run();
  }

  download(): void {
    this.logService.downloadLog(this.file()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.file();
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (err: Error) => this.toastr.error(err.message, 'Download failed'),
    });
  }

  // ---- editor helpers ----------------------------------------------------

  private setText(text: string): void {
    if (!this.editor) {
      this.pendingText = text;
      return;
    }
    this.editor.setValue(text);
    this.lineCount.set(text ? this.editor.getModel()?.getLineCount() ?? 0 : 0);
    this.newLines.set(0);
    this.scrollToEnd();
  }

  private append(text: string): void {
    if (!text) return;
    const model = this.editor?.getModel();
    if (!this.editor || !model) {
      this.pendingText = (this.pendingText ? this.pendingText + '\n' : '') + text;
      return;
    }
    const monaco = monacoGlobal();
    if (!monaco) return;

    const empty = model.getValueLength() === 0;
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    model.applyEdits([{
      range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
      text: empty ? text : '\n' + text,
    }]);

    const overflow = model.getLineCount() - MAX_LIVE_LINES;
    if (overflow > 0) {
      model.applyEdits([{ range: new monaco.Range(1, 1, overflow + 1, 1), text: '' }]);
    }

    const added = text.split('\n').length;
    this.lineCount.set(model.getLineCount());
    if (this.follow()) this.scrollToEnd();
    else this.newLines.update(n => n + added);
  }

  private scrollToEnd(): void {
    const editor = this.editor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    editor.revealLine(model.getLineCount(), 1 /* Immediate */);
  }
}

// ---- Monaco "log" language ------------------------------------------------

function monacoGlobal(): typeof Monaco | undefined {
  return (window as unknown as { monaco?: typeof Monaco }).monaco;
}

let logLanguageRegistered = false;

/** Highlights timestamps, levels, exceptions and stack frames in Spring/logback output. */
function registerLogLanguage(): void {
  const monaco = monacoGlobal();
  if (!monaco || logLanguageRegistered) return;
  logLanguageRegistered = true;

  monaco.languages.register({ id: 'log' });
  monaco.languages.setMonarchTokensProvider('log', {
    tokenizer: {
      root: [
        [/\b(ERROR|FATAL|SEVERE|ERR)\b/, 'log-error'],
        [/\b(WARN|WARNING|WRN)\b/, 'log-warn'],
        [/\b(INFO|INF)\b/, 'log-info'],
        [/\b(DEBUG|DBG|TRACE|TRC)\b/, 'log-debug'],
        [/^\s+at\s.*$/, 'log-stack'],
        [/^\s*\.\.\. \d+ (more|common frames omitted)$/, 'log-stack'],
        [/\b[\w.$]+(Exception|Error)\b/, 'log-exception'],
        [/^Caused by:.*$/, 'log-exception'],
        [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}([.,]\d+)?(Z|[+-]\d{2}:?\d{2})?/, 'log-date'],
        [/\[[^\]\s]{1,60}\]/, 'log-thread'],
        [/\bhttps?:\/\/[^\s"'<>]+/, 'log-url'],
      ],
    },
  });
  monaco.editor.defineTheme('log-light', {
    base: 'vs',
    inherit: true,
    // Only problems get strong colour, so errors stand out: red for errors, exceptions
    // and their stack traces, a muted dark gold for warnings. Links are the usual blue; everything
    // else stays neutral.
    rules: [
      { token: 'log-error', foreground: 'e00000', fontStyle: 'bold' },
      { token: 'log-exception', foreground: 'e00000', fontStyle: 'bold' },
      { token: 'log-stack', foreground: 'c62828' },
      { token: 'log-warn', foreground: '8a6a12', fontStyle: 'bold' },
      { token: 'log-info', foreground: '1f2937' },
      { token: 'log-debug', foreground: '9ca3af' },
      { token: 'log-date', foreground: '6b7280' },
      { token: 'log-thread', foreground: '6b7280' },
      { token: 'log-url', foreground: '1a5fd6' },
    ],
    colors: {
      'editor.lineHighlightBackground': '#f6f7f9',
      'editor.selectionBackground': '#dbe4f0',
      'editorLineNumber.foreground': '#b0b5bd',
      'editorLineNumber.activeForeground': '#4b5563',
    },
  });
}
