import { pluginRegistry } from '../core/registry';
import { useDocumentStore } from '../state/documentStore';

/**
 * 書き出しの既定設定でクリップボードへコピーする。
 * - 対象: 選択があれば選択オブジェクト、無ければキャンバス全体
 * - 形式: PNG(白背景・2倍)。KaTeX誤描画を避けるため画像のみ載せる(copyToClipboard参照)
 * 書き出しモジュール(react-dom/server等)は呼び出し時にのみ読み込む。
 */
export async function copyDefaultToClipboard(): Promise<void> {
  const exporter = await import('./exporter');
  const { objects, selection } = useDocumentStore.getState();
  const all = Object.values(objects);
  const targets = selection.length > 0 ? all.filter((o) => selection.includes(o.id)) : all;
  if (targets.length === 0) throw new Error('コピーする対象がありません');
  const region = exporter.contentRegion(targets, pluginRegistry);
  if (!region) throw new Error('コピーする対象がありません');
  const svg = await exporter.buildSvgString(targets, region, pluginRegistry);
  await exporter.copyToClipboard(svg, region);
}
