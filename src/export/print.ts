import type { SceneObject } from '../core/document';
import { orderedPageFrames } from '../core/pageFrames';
import { pluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';
import { unitsToMm } from '../core/units';
import { buildSvgString, exportRaster, frameRegion } from './exporter';

/** 印刷解像度(dpi)。実寸に対する画像の細かさ */
const PRINT_DPI = 300;
/**
 * canvas面積の安全上限(px)。Safariは概ね16.7Mpxを超えるとcanvasが空になる。
 * 大判(A3等)で上限を超える場合は自動で解像度を落として破綻を防ぐ。
 */
const MAX_CANVAS_PX = 16_000_000;

/** region(内部単位)を目標dpiでラスタライズする倍率。canvas上限を超える場合は落とす */
function printScale(region: Rect, dpi: number): number {
  const scale = dpi / 96;
  const area = region.width * scale * (region.height * scale);
  return area <= MAX_CANVAS_PX ? scale : scale * Math.sqrt(MAX_CANVAS_PX / area);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の変換に失敗しました'));
    reader.readAsDataURL(blob);
  });
}

/** iframe内の全画像のロード完了を待つ */
function waitImages(doc: Document): Promise<void> {
  const pending = Array.from(doc.images)
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    );
  return Promise.all(pending).then(() => undefined);
}

interface PrintPage {
  widthMm: number;
  heightMm: number;
  dataUrl: string;
}

/** 各ページを実寸で並べた印刷用HTMLを隠しiframeへ書き込み、印刷ダイアログを開く */
async function runPrint(pages: PrintPage[]): Promise<void> {
  const first = pages[0];
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('印刷用フレームを作成できませんでした');
  }

  const body = pages
    .map(
      (p) =>
        `<div class="page" style="width:${p.widthMm}mm;height:${p.heightMm}mm">` +
        `<img src="${p.dataUrl}" alt=""/></div>`,
    )
    .join('');
  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
      `@page{size:${first.widthMm}mm ${first.heightMm}mm;margin:0}` +
      'html,body{margin:0;padding:0}' +
      '.page{overflow:hidden;page-break-after:always}' +
      '.page:last-child{page-break-after:auto}' +
      'img{display:block;width:100%;height:100%}' +
      `</style></head><body>${body}</body></html>`,
  );
  doc.close();

  await waitImages(doc);
  // レイアウト確定を1フレーム待ってから印刷(空白ページ防止)
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const cleanup = () => window.setTimeout(() => iframe.remove(), 500);
  win.onafterprint = cleanup;
  win.focus();
  win.print();
  // afterprintが発火しない環境向けのフォールバック
  window.setTimeout(cleanup, 60_000);
}

/**
 * ドキュメントを印刷する。用紙枠を選択中ならそれらを、無ければ全用紙枠を
 * 読み順で複数ページとして印刷する。用紙枠が無ければ例外を投げる。
 */
export async function printDocument(
  objects: Record<string, SceneObject>,
  selection: string[],
): Promise<void> {
  const frames = orderedPageFrames(objects);
  const selected = frames.filter((f) => selection.includes(f.id));
  const targets = selected.length > 0 ? selected : frames;
  if (targets.length === 0) {
    throw new Error('用紙枠がありません。ツールボックスの「レイアウト → 用紙」で追加してください');
  }

  const all = Object.values(objects);
  const pages: PrintPage[] = [];
  for (const frame of targets) {
    const region = frameRegion(frame, pluginRegistry);
    if (!region) continue;
    // 全内容を用紙枠でクリップ(SVG viewBoxが自動クリップ)し白背景で焼く
    const svg = await buildSvgString(all, region, pluginRegistry, '#ffffff');
    const blob = await exportRaster(svg, region, {
      scale: printScale(region, PRINT_DPI),
      format: 'png',
      transparent: false,
    });
    pages.push({
      widthMm: unitsToMm(region.width),
      heightMm: unitsToMm(region.height),
      dataUrl: await blobToDataUrl(blob),
    });
  }
  if (pages.length === 0) throw new Error('印刷できる用紙枠がありません');
  await runPrint(pages);
}
