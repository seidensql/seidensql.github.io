import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { sql, SQLite } from '@codemirror/lang-sql';
import { defaultKeymap, history, historyKeymap, undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import { syntaxHighlighting, bracketMatching, HighlightStyle } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  error?: string;
  fontSize?: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export interface QueryEditorHandle {
  undo: () => void;
  redo: () => void;
}

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-content': {
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--muted))',
    borderRight: '1px solid hsl(var(--border))',
    color: 'hsl(var(--muted-foreground))',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--accent))',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--accent) / 0.3)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--primary) / 0.1) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'hsl(var(--primary) / 0.15) !important',
  },
});

function fontSizeTheme(size: number) {
  return EditorView.theme({ '&': { fontSize: `${size}px` } });
}

const sqlHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#708' },
  { tag: tags.function, color: '#708' },
  { tag: tags.string, color: '#a11' },
  { tag: tags.comment, color: '#940' },
  { tag: tags.number, color: '#164' },
  { tag: tags.typeName, color: '#085' },
]);

export const QueryEditor = forwardRef<QueryEditorHandle, QueryEditorProps>(({ value, onChange, onExecute, error, fontSize = 13, onHistoryChange }: QueryEditorProps, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fontSizeCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onExecuteRef = useRef(onExecute);
  const onHistoryChangeRef = useRef(onHistoryChange);
  onChangeRef.current = onChange;
  onExecuteRef.current = onExecute;
  onHistoryChangeRef.current = onHistoryChange;

  useImperativeHandle<QueryEditorHandle, QueryEditorHandle>(ref, () => ({
    undo: () => {
      const view = viewRef.current;
      if (!view) return;
      // `undo`/`redo` from @codemirror/commands are StateCommands: they take a
      // { state, dispatch } target and return whether an undo/redo happened.
      const ok = undo({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
      if (ok) view.focus();
    },
    redo: () => {
      const view = viewRef.current;
      if (!view) return;
      const ok = redo({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
      if (ok) view.focus();
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const runKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: () => {
          onExecuteRef.current();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        runKeymap,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        sql({ dialect: SQLite }),
        syntaxHighlighting(sqlHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        baseTheme,
        fontSizeCompartment.current.of(fontSizeTheme(fontSize)),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          const canUndo = undoDepth(update.state) > 0;
          const canRedo = redoDepth(update.state) > 0;
          onHistoryChangeRef.current?.(canUndo, canRedo);
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update font size without reinitializing the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: fontSizeCompartment.current.reconfigure(fontSizeTheme(fontSize)) });
  }, [fontSize]);

  // Sync external value changes
  const setExternally = useCallback((newVal: string) => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== newVal) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: newVal },
      });
    }
  }, []);

  useEffect(() => {
    setExternally(value);
  }, [value, setExternally]);

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-1 overflow-auto border border-border rounded-md" />
      {error && (
        <div className="mt-1 px-3 py-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
          {error}
        </div>
      )}
    </div>
  );
});

QueryEditor.displayName = 'QueryEditor';
