import { saveAs } from 'file-saver';
import { useState } from 'react';
import { pluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';
import styles from './ExportDialog.module.css';

type Target = 'all' | 'selection' | 'viewport';
type Format = 'png' | 'jpeg' | 'svg' | 'pdf';

/** キャンバスに現在表示されている範囲(ワールド座標) */
function viewportWorldRect(): Rect | null {
  const svg = document.querySelector('[data-canvas-stage]');
  if (!(svg instanceof SVGSVGElement)) return null;
  const { pan, zoom } = useViewportStore.getState();
  const bounds = svg.getBoundingClientRect();
  return { x: pan.x, y: pan.y, width: bounds.width / zoom, height: bounds.height / zoom };
}

export function ExportDialog({ fileName, onClose }: { fileName: string; onClose: () => void }) {
  const selectionCount = useDocumentStore((s) => s.selection.length);
  const [target, setTarget] = useState<Target>('all');
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState(2);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (action: 'download' | 'clipboard') => {
    setBusy(true);
    setMessage('');
    try {
      // 書き出し機能(react-dom/server等)は使うときだけ読み込む
      const exporter = await import('../export/exporter');
      const { objects, selection } = useDocumentStore.getState();
      const all = Object.values(objects);
      const targets =
        target === 'selection' ? all.filter((o) => selection.includes(o.id)) : all;
      const region =
        target === 'viewport'
          ? viewportWorldRect()
          : exporter.contentRegion(targets, pluginRegistry);
      if (!region || targets.length === 0) {
        setMessage('書き出す対象がありません');
        return;
      }
      const background = format === 'svg' && !transparent ? '#ffffff' : undefined;
      const svg = await exporter.buildSvgString(targets, region, pluginRegistry, background);

      if (action === 'clipboard') {
        await exporter.copyToClipboard(svg, region);
        setMessage('クリップボードへコピーしました');
        return;
      }
      if (format === 'svg') {
        saveAs(new Blob([svg], { type: 'image/svg+xml' }), `${fileName}.svg`);
      } else if (format === 'pdf') {
        saveAs(await exporter.exportPdf(svg, region, scale), `${fileName}.pdf`);
      } else {
        saveAs(
          await exporter.exportRaster(svg, region, { scale, format, transparent }),
          `${fileName}.${format}`,
        );
      }
      setMessage('書き出しました');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '書き出しに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>書き出し</h2>

        <fieldset className={styles.fieldset}>
          <legend>対象</legend>
          <label>
            <input type="radio" checked={target === 'all'} onChange={() => setTarget('all')} />
            キャンバス全体
          </label>
          <label>
            <input
              type="radio"
              checked={target === 'selection'}
              onChange={() => setTarget('selection')}
              disabled={selectionCount === 0}
            />
            選択オブジェクト({selectionCount})
          </label>
          <label>
            <input
              type="radio"
              checked={target === 'viewport'}
              onChange={() => setTarget('viewport')}
            />
            表示範囲
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>形式</legend>
          {(['png', 'jpeg', 'svg', 'pdf'] as const).map((f) => (
            <label key={f}>
              <input type="radio" checked={format === f} onChange={() => setFormat(f)} />
              {f.toUpperCase()}
            </label>
          ))}
        </fieldset>

        <div className={styles.options}>
          {(format === 'png' || format === 'jpeg' || format === 'pdf') && (
            <label>
              倍率
              <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            </label>
          )}
          {(format === 'png' || format === 'svg') && (
            <label>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              背景を透過
            </label>
          )}
        </div>

        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.buttons}>
          <button type="button" onClick={() => void run('clipboard')} disabled={busy}>
            クリップボードへコピー
          </button>
          <div className={styles.buttonsRight}>
            <button type="button" onClick={onClose} disabled={busy}>
              閉じる
            </button>
            <button type="button" className={styles.primary} onClick={() => void run('download')} disabled={busy}>
              書き出し
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
