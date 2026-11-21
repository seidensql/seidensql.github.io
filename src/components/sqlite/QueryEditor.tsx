import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { sql, SQLDialect } from '@codemirror/lang-sql';
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
  { tag: tags.function(tags.name), color: '#708' },
  { tag: tags.standard(tags.name), color: '#708' },
  { tag: tags.string, color: '#a11' },
  { tag: tags.comment, color: '#940' },
  { tag: tags.number, color: '#164' },
  { tag: tags.typeName, color: '#085' },
]);

// SQL keyword list mirroring the one in @codemirror/lang-sql (plus the SQLite
// specific extras), extended with SQL function names so that function calls like
// AVG(...) or SUM(...) are tokenized as builtins and highlighted like keywords.
const SQLITE_KEYWORDS =
  'absolute action add after all allocate alter and any are as asc assertion at authorization before begin between both breadth by call cascade cascaded case cast catalog check close collate collation column commit condition connect connection constraint constraints constructor continue corresponding count create cross cube current current_date current_default_transform_group current_transform_group_for_type current_path current_role current_time current_timestamp current_user cursor cycle data day deallocate declare default deferrable deferred delete depth deref desc describe descriptor deterministic diagnostics disconnect distinct do domain drop dynamic each else elseif end end-exec equals escape except exception exec execute exists exit external fetch first for foreign found from free full function general get global go goto grant group grouping handle having hold hour identity if immediate in indicator initially inner inout input insert intersect into is isolation join key language last lateral leading leave left level like limit local localtime localtimestamp locator loop map match method minute modifies module month names natural nesting new next no none not of old on only open option or order ordinality out outer output overlaps pad parameter partial path prepare preserve primary prior privileges procedure public read reads recursive redo ref references referencing relative release repeat resignal restrict result return returns revoke right role rollback rollup routine row rows savepoint schema scroll search second section select session session_user set sets signal similar size some space specific specifictype sql sqlexception sqlstate sqlwarning start state static system_user table temporary then timezone_hour timezone_minute to trailing transaction translation treat trigger under undo union unique unnest until update usage user using value values view when whenever where while with without work write year zone ' +
  'abort analyze attach autoincrement conflict database detach exclusive fail glob ignore index indexed instead isnull notnull offset plan pragma query raise regexp reindex rename replace temp vacuum virtual';

const SQLITE_BUILTIN =
  'auth backup bail changes clone databases dbinfo dump echo eqp explain fullschema headers help import imposter indexes iotrace lint load log mode nullvalue once print prompt quit restore save scanstats separator shell show stats system tables testcase timeout timer trace vfsinfo vfslist vfsname width';

const SQL_TYPES =
  'array binary bit boolean char character clob date decimal double float int integer interval large national nchar nclob numeric object precision real smallint time timestamp varchar varying bool blob long longblob longtext medium mediumblob mediumint mediumtext tinyblob tinyint tinytext text bigint int2 int8 unsigned signed real';

const SQL_FUNCTIONS = [
  'abs',
  'acos',
  'asin',
  'atan',
  'avg',
  'bit_length',
  'ceil',
  'ceiling',
  'coalesce',
  'concat',
  'concat_ws',
  'cos',
  'cot',
  'count',
  'covar_pop',
  'covar_samp',
  'cume_dist',
  'degrees',
  'exp',
  'floor',
  'ln',
  'log',
  'log10',
  'now',
  'power',
  'radians',
  'round',
  'sign',
  'sin',
  'sqrt',
  'sum',
  'tan',
  'trunc',
  'upper',
  'lower',
  'length',
  'trim',
  'ltrim',
  'rtrim',
  'substr',
  'substring',
  'instr',
  'replace',
  'reverse',
  'ascii',
  'format',
  'strftime',
  'total',
  'group_concat',
  'string_agg',
  'max',
  'min',
  'bool_or',
  'any_value',
  'count_if',
  'json_array',
  'json_object',
  'json_extract',
  'json_each',
  'json_group_array',
  'json_group_object',
  'json_quote',
  'nth_value',
  'ntile',
  'percentile_cont',
  'percentile_disc',
  'row_number',
  'rank',
  'dense_rank',
  'lag',
  'lead',
  'first_value',
  'last_value',
].join(' ');

const sqlDialect = SQLDialect.define({
  keywords: SQLITE_KEYWORDS,
  types: SQL_TYPES,
  builtin: SQLITE_BUILTIN + ' ' + SQL_FUNCTIONS,
});

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
        sql({ dialect: sqlDialect }),
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
