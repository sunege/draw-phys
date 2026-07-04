import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SceneObject } from '../core/document';
import { sortedObjects } from '../core/document';
import { transformToString, unionRects, worldBounds } from '../core/geometry';
import type { PluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';

const EXPORT_MARGIN = 10;

/** 書き出し対象オブジェクトを包含する領域(余白付き)。対象が無ければnull */
export function contentRegion(objects: SceneObject[], registry: PluginRegistry): Rect | null {
  const rects: Rect[] = [];
  for (const obj of objects) {
    if (!obj.visible) continue;
    const plugin = registry.get(obj.pluginId);
    if (!plugin) continue;
    rects.push(worldBounds(plugin.getBounds(obj.props), obj.transform));
  }
  const union = unionRects(rects);
  if (!union) return null;
  return {
    x: union.x - EXPORT_MARGIN,
    y: union.y - EXPORT_MARGIN,
    width: union.width + EXPORT_MARGIN * 2,
    height: union.height + EXPORT_MARGIN * 2,
  };
}

/**
 * オブジェクト群を自己完結したSVG文字列にする。
 * 各プラグインのexportStyles()(フォント埋め込み等)を<style>として同梱する。
 */
export async function buildSvgString(
  objects: SceneObject[],
  region: Rect,
  registry: PluginRegistry,
  background?: string,
): Promise<string> {
  const visible = sortedObjects(
    Object.fromEntries(objects.filter((o) => o.visible).map((o) => [o.id, o])),
  );

  const styleSources = new Map<string, () => Promise<string>>();
  const body = visible
    .map((obj) => {
      const plugin = registry.get(obj.pluginId);
      if (!plugin) return '';
      if (plugin.exportStyles) styleSources.set(plugin.id, plugin.exportStyles.bind(plugin));
      const markup = renderToStaticMarkup(createElement(plugin.Renderer, { props: obj.props }));
      return `<g transform="${transformToString(obj.transform)}">${markup}</g>`;
    })
    .join('\n');

  const styles = (await Promise.all([...styleSources.values()].map((fn) => fn()))).join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${region.x} ${region.y} ${region.width} ${region.height}" width="${region.width}" height="${region.height}">`,
    styles ? `<style>${styles}</style>` : '',
    background ? `<rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" fill="${background}"/>` : '',
    body,
    '</svg>',
  ]
    .filter((s) => s.length > 0)
    .join('\n');
}

/** SVG文字列を<img>経由でcanvasに描画する */
async function rasterize(
  svgString: string,
  region: Rect,
  scale: number,
  background?: string,
): Promise<HTMLCanvasElement> {
  // blob URLだとforeignObjectを含むSVGでcanvasが汚染される環境があるため、
  // data URL + crossOrigin で読み込む
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVGの画像化に失敗しました'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface RasterOptions {
  /** 出力解像度の倍率(1=等倍) */
  scale: number;
  /** 'png'は背景透過可。'jpeg'は白背景 */
  format: 'png' | 'jpeg';
  transparent: boolean;
}

export async function exportRaster(
  svgString: string,
  region: Rect,
  options: RasterOptions,
): Promise<Blob> {
  const background =
    options.format === 'jpeg' ? '#ffffff' : options.transparent ? undefined : '#ffffff';
  const canvas = await rasterize(svgString, region, options.scale, background);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像の生成に失敗しました'))),
      options.format === 'png' ? 'image/png' : 'image/jpeg',
      0.92,
    );
  });
}

export async function exportPdf(svgString: string, region: Rect, scale: number): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const canvas = await rasterize(svgString, region, scale, '#ffffff');
  // px→pt(72/96)。ページサイズを図の縦横比に合わせる
  const widthPt = region.width * 0.75;
  const heightPt = region.height * 0.75;
  const pdf = new jsPDF({
    orientation: widthPt >= heightPt ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [widthPt, heightPt],
  });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthPt, heightPt);
  return pdf.output('blob');
}

/** PNG(+可能ならSVGテキスト)をOSクリップボードへコピーする */
export async function copyToClipboard(svgString: string, region: Rect): Promise<void> {
  const png = await exportRaster(svgString, region, {
    scale: 2,
    format: 'png',
    transparent: false,
  });
  const items: Record<string, Blob> = { 'image/png': png };
  // SVGを直接受け付ける環境向け(非対応ならPNGのみ)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        ...items,
        'image/svg+xml': new Blob([svgString], { type: 'image/svg+xml' }),
      }),
    ]);
  } catch {
    await navigator.clipboard.write([new ClipboardItem(items)]);
  }
}
