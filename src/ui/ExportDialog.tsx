import { saveAs } from 'file-saver';
import { useState } from 'react';
import { orderedPageFrames } from '../core/pageFrames';
import { pluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';
import { dpiToScale } from '../core/units';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';
import styles from './ExportDialog.module.css';

type Target = 'all' | 'selection' | 'viewport' | 'page';
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
  const pageFrameCount = useDocumentStore((s) => orderedPageFrames(s.objects).length);
  // 選択があれば「選択」、無ければ用紙枠があれば「用紙」、それも無ければ全体を既定にする
  const [target, setTarget] = useState<Target>(() =>
    selectionCount > 0 ? 'selection' : pageFrameCount > 0 ? 'page' : 'all',
  );
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState(2);
  const [dpi, setDpi] = useState(300);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isPage = target === 'page';

  const run = async (action: 'download' | 'clipboard') => {
    setBusy(true);
    setMessage('');
    try {
      // 書き出し機能(react-dom/server等)は使うときだけ読み込む
      const exporter = await import('../export/exporter');
      const { objects, selection } = useDocumentStore.getState();
      const all = Object.values(objects);
      // 用紙印刷は全内容を用紙枠でクリップして出す。それ以外は従来どおり
      const targets =
        target === 'selection' ? all.filter((o) => selection.includes(o.id)) : all;

      let region: Rect | null;
      if (target === 'page') {
        const frames = orderedPageFrames(objects);
        // 用紙枠を選択中ならそれを、無ければ先頭ページの用紙枠を書き出す
        const frame = frames.find((f) => selection.includes(f.id)) ?? frames[0];
        region = frame ? exporter.frameRegion(frame, pluginRegistry) : null;
      } else if (target === 'viewport') {
        region = viewportWorldRect();
      } else {
        region = exporter.contentRegion(targets, pluginRegistry);
      }
      if (!region || targets.length === 0) {
        setMessage(target === 'page' ? '用紙枠がありません' : '書き出す対象がありません');
        return;
      }

      // 用紙印刷は常に白背景・不透過。ラスタ倍率はDPI(region は内部単位)から求める
      const effTransparent = target === 'page' ? false : transparent;
      const rasterScale = target === 'page' ? dpiToScale(dpi) : scale;
      const background = format === 'svg' && !effTransparent ? '#ffffff' : undefined;
      const svg = await exporter.buildSvgString(targets, region, pluginRegistry, background);

      if (action === 'clipboard') {
        // クリップボードは常にPNGで渡す(Word/PowerPointがSVGを誤描画するため)
        await exporter.copyToClipboard(svg, region, effTransparent);
        setMessage('クリップボードへコピーしました（PNG）');
        return;
      }
      if (format === 'svg') {
        saveAs(new Blob([svg], { type: 'image/svg+xml' }), `${fileName}.svg`);
      } else if (format === 'pdf') {
        saveAs(await exporter.exportPdf(svg, region, rasterScale, target === 'page'), `${fileName}.pdf`);
      } else {
        saveAs(
          await exporter.exportRaster(svg, region, {
            scale: rasterScale,
            format,
            transparent: effTransparent,
          }),
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
          <label title="用紙枠の内側を印刷範囲として書き出す">
            <input
              type="radio"
              checked={target === 'page'}
              onChange={() => setTarget('page')}
              disabled={pageFrameCount === 0}
            />
            用紙({pageFrameCount})
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
          {isPage && (format === 'png' || format === 'jpeg' || format === 'pdf') && (
            <label title="用紙の実寸(mm)に対する印刷解像度">
              解像度
              <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                <option value={150}>150 dpi</option>
                <option value={300}>300 dpi（印刷）</option>
                <option value={600}>600 dpi</option>
              </select>
            </label>
          )}
          {!isPage && (format === 'png' || format === 'jpeg' || format === 'pdf') && (
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
          {!isPage && (format === 'png' || format === 'svg') && (
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
