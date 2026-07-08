import type { SceneObject, SceneObjects } from './document';
import { pluginRegistry } from './registry';

/**
 * 用紙枠の props に載るページ順の並び替えキー(小さいほど前)。
 * 未設定(旧データ)は 0 として扱う。
 */
export function pageNumberOf(obj: SceneObject): number {
  const n = (obj.props as { pageNumber?: unknown }).pageNumber;
  return typeof n === 'number' ? n : 0;
}

/**
 * 印刷用の用紙枠(capabilities.printFrame かつ visible)をページ順に並べて返す。
 * 並びは pageNumber 昇順、同値は位置(上→下, 左→右)で決める。
 * 返り値の index がそのまま 0 始まりのページ順(画面表示は +1)。
 * print / 用紙書き出し / ページ番号バッジで共用する。
 */
export function orderedPageFrames(objects: SceneObjects): SceneObject[] {
  return Object.values(objects)
    .filter((o) => o.visible && pluginRegistry.get(o.pluginId)?.capabilities?.printFrame)
    .sort(
      (a, b) =>
        pageNumberOf(a) - pageNumberOf(b) ||
        a.transform.y - b.transform.y ||
        a.transform.x - b.transform.x,
    );
}
