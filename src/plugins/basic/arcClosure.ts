import type { PropertyField } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';

/**
 * 円弧・楕円弧の閉じ方。
 * - open … 弧のみ(塗りなし)
 * - chord … 弓形(両端を弦で結ぶ)。半円は掃引180°の弓形
 * - sector … 扇形(両端を中心と結ぶ)
 */
export type ArcClosure = 'open' | 'chord' | 'sector';

export const arcClosureField: PropertyField = {
  key: 'closure',
  label: '閉じ方',
  type: 'select',
  options: [
    { value: 'open', label: '開いた弧' },
    { value: 'chord', label: '弓形(弦で閉じる)' },
    { value: 'sector', label: '扇形(中心で閉じる)' },
  ],
};

/** 未設定(旧データ)は開いた弧 */
export function resolveClosure(closure: ArcClosure | undefined): ArcClosure {
  return closure ?? 'open';
}

/** 開いた弧のパス(M…A…)を閉じ方に応じて閉じたパスにする。中心は原点 */
export function closeArcPath(openPath: string, closure: ArcClosure): string {
  if (closure === 'chord') return `${openPath} Z`;
  // 「M 始点 A …」の先頭に中心を足し「M 0 0 L 始点 A … Z」にする
  if (closure === 'sector') return `${openPath.replace(/^M/, 'M 0 0 L')} Z`;
  return openPath;
}

/** 扇形は中心(原点)を含むので外接矩形を広げる */
export function closureBounds(bounds: Rect, closure: ArcClosure): Rect {
  if (closure !== 'sector') return bounds;
  const minX = Math.min(bounds.x, 0);
  const minY = Math.min(bounds.y, 0);
  return {
    x: minX,
    y: minY,
    width: Math.max(bounds.x + bounds.width, 0) - minX,
    height: Math.max(bounds.y + bounds.height, 0) - minY,
  };
}

/** 閉じる辺(弦 or 2本の半径)。スナップ・拘束・領域塗りの境界として公開する */
export function closureSegments(start: Point, end: Point, closure: ArcClosure): [Point, Point][] {
  const origin = { x: 0, y: 0 };
  if (closure === 'chord') return [[start, end]];
  if (closure === 'sector') return [[origin, start], [end, origin]];
  return [];
}
