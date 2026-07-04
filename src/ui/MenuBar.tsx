import { useState } from 'react';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';
import { ExportDialog } from './ExportDialog';
import styles from './MenuBar.module.css';

export function MenuBar({ fileName }: { fileName?: string }) {
  const [exportOpen, setExportOpen] = useState(false);
  const canUndo = useDocumentStore((s) => s.undoStack.length > 0);
  const canRedo = useDocumentStore((s) => s.redoStack.length > 0);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const zoom = useViewportStore((s) => s.zoom);
  const gridVisible = useViewportStore((s) => s.gridVisible);
  const snapEnabled = useViewportStore((s) => s.snapEnabled);
  const setGridVisible = useViewportStore((s) => s.setGridVisible);
  const setSnapEnabled = useViewportStore((s) => s.setSnapEnabled);
  const resetView = useViewportStore((s) => s.resetView);

  return (
    <header className={styles.bar}>
      <span className={styles.title}>物理教材ドロー</span>
      {fileName && <span className={styles.fileName}>{fileName}</span>}
      <div className={styles.group}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={undo}
          disabled={!canUndo}
          title="元に戻す (Ctrl+Z)"
        >
          ↩ 元に戻す
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={redo}
          disabled={!canRedo}
          title="やり直す (Ctrl+Shift+Z)"
        >
          ↪ やり直す
        </button>
      </div>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setExportOpen(true)}
        title="PNG / JPEG / SVG / PDF へ書き出し・クリップボードコピー"
      >
        書き出し…
      </button>
      <div className={styles.spacer} />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={gridVisible}
          onChange={(e) => setGridVisible(e.target.checked)}
        />
        グリッド
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
        スナップ
      </label>
      <button type="button" className={styles.zoomButton} onClick={resetView} title="表示をリセット">
        {Math.round(zoom * 100)}%
      </button>
      {exportOpen && (
        <ExportDialog fileName={fileName ?? '図'} onClose={() => setExportOpen(false)} />
      )}
    </header>
  );
}
