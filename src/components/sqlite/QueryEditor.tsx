import { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { sql, SQLite } from '@codemirror/lang-sql';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  error?: string;
  fontSize?: number;
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

export function QueryEditor({ value, onChange, onExecute, error, fontSize = 13 }: QueryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fontSizeCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onExecuteRef = useRef(onExecute);
  onChangeRef.current = onChange;
  onExecuteRef.current = onExecute;

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
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        baseTheme,
        fontSizeCompartment.current.of(fontSizeTheme(fontSize)),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
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
}
