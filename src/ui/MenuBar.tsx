import { useState } from 'react';
import { worldBounds } from '../core/geometry';
import { orderedPageFrames } from '../core/pageFrames';
import { pluginRegistry } from '../core/registry';
import { useDocumentStore } from '../state/documentStore';
import { useHelpStore } from '../state/helpStore';
import { useToastStore } from '../state/toastStore';
import { useViewportStore } from '../state/viewportStore';
import { ExportDialog } from './ExportDialog';
import { HelpDialog } from './HelpDialog';
import styles from './MenuBar.module.css';

export function MenuBar({ fileName }: { fileName?: string }) {
  const [exportOpen, setExportOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [page, setPage] = useState(1);
  const showToast = useToastStore((s) => s.showToast);
  // orderedPageFrames は毎回新配列を返すためセレクタで返さず、安定参照の objects から本体で導出する
  const objects = useDocumentStore((s) => s.objects);
  const pageFrames = orderedPageFrames(objects);
  const pageCount = pageFrames.length;
  const currentPage = Math.min(Math.max(page, 1), pageCount || 1);

  // 選んだ用紙枠が画面中央に収まるよう表示を移す(ページ移動)
  const goToPage = (index: number) => {
    const frame = pageFrames[index];
    const plugin = frame ? pluginRegistry.get(frame.pluginId) : undefined;
    if (!frame || !plugin) return;
    const rect = worldBounds(plugin.getBounds(frame.props), frame.transform);
    const svg = document.querySelector('[data-canvas-stage]');
    if (!(svg instanceof SVGSVGElement)) return;
    const b = svg.getBoundingClientRect();
    useViewportStore.getState().frameWorldRect(rect, b.width, b.height);
  };
  const canUndo = useDocumentStore((s) => s.undoStack.length > 0);
  const canRedo = useDocumentStore((s) => s.redoStack.length > 0);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const zoom = useViewportStore((s) => s.zoom);
  const gridVisible = useViewportStore((s) => s.gridVisible);
  const snapEnabled = useViewportStore((s) => s.snapEnabled);
  const snapDivision = useViewportStore((s) => s.snapDivision);
  const setGridVisible = useViewportStore((s) => s.setGridVisible);
  const setSnapEnabled = useViewportStore((s) => s.setSnapEnabled);
  const setSnapDivision = useViewportStore((s) => s.setSnapDivision);
  const resetView = useViewportStore((s) => s.resetView);
  const helpOpen = useHelpStore((s) => s.open);
  const setHelpOpen = useHelpStore((s) => s.setOpen);

  // 書き出しの既定設定(選択優先・PNG)でクリップボードへコピーし、完了をトースト表示
  const onCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const { copyDefaultToClipboard } = await import('../export/copyImage');
      await copyDefaultToClipboard();
      showToast('クリップボードへコピーしました（PNG）');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'コピーに失敗しました', 'error');
    } finally {
      setCopying(false);
    }
  };

  // 用紙枠を実寸PNG化して印刷ダイアログを開く(用紙枠が無ければ案内トースト)
  const onPrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const { printDocument } = await import('../export/print');
      const { objects, selection } = useDocumentStore.getState();
      await printDocument(objects, selection);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '印刷に失敗しました', 'error');
    } finally {
      setPrinting(false);
    }
  };

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
        onClick={() => void onCopy()}
        disabled={copying}
        title="既定設定(選択優先・PNG)でクリップボードへコピー"
      >
        📋 コピー
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setExportOpen(true)}
        title="PNG / JPEG / SVG / PDF へ書き出し・クリップボードコピー"
      >
        書き出し…
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => void onPrint()}
        disabled={printing}
        title="用紙枠を実寸で印刷する(用紙枠が必要)"
      >
        🖨 印刷
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
      <label className={styles.toggle} title="スナップON/OFF (Sキー)">
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
        スナップ
      </label>
      <select
        className={styles.snapSelect}
        value={snapDivision}
        onChange={(e) => setSnapDivision(Number(e.target.value) as 1 | 2 | 4)}
        disabled={!snapEnabled}
        title="スナップ間隔"
      >
        <option value={1}>グリッド</option>
        <option value={2}>1/2</option>
        <option value={4}>1/4</option>
      </select>
      {pageCount > 0 && (
        <select
          className={styles.pageSelect}
          value={currentPage}
          onChange={(e) => {
            const p = Number(e.target.value);
            setPage(p);
            goToPage(p - 1);
          }}
          title="選んだページ(用紙枠)へ表示を移す"
        >
          {pageFrames.map((_, i) => (
            <option key={i} value={i + 1}>
              ページ {i + 1}
            </option>
          ))}
        </select>
      )}
      <button type="button" className={styles.zoomButton} onClick={resetView} title="表示をリセット">
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => setHelpOpen(true)}
        title="ユーザーガイド (?)"
      >
        ❓ ガイド
      </button>
      {exportOpen && (
        <ExportDialog fileName={fileName ?? '図'} onClose={() => setExportOpen(false)} />
      )}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </header>
  );
}
