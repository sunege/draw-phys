import type { Point, Transform } from '../../core/types';

/** 線分系プラグイン共通: 始点→終点のドラッグから中心・長さ・回転を求める */
export function lineFromDrag(
  start: Point,
  end: Point,
  fallbackLength: number,
): { length: number; transform: Transform } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let length = Math.hypot(dx, dy);
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (length < 2) {
    // クリックのみで配置された場合は既定の長さで水平に置く
    length = fallbackLength;
    rotation = 0;
    return {
      length,
      transform: {
        x: start.x + length / 2,
        y: start.y,
        rotation,
        scaleX: 1,
        scaleY: 1,
      },
    };
  }
  return {
    length,
    transform: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      rotation,
      scaleX: 1,
      scaleY: 1,
    },
  };
}

/**
 * 2端点(ワールド座標)から中心・長さ・回転を求める。
 * 端点ドラッグ編集で使う(fallback無し。長さ0付近は最小長でクランプ)。
 */
export function segmentFromEndpoints(
  a: Point,
  b: Point,
): { length: number; transform: Transform } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    length,
    transform: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rotation,
      scaleX: 1,
      scaleY: 1,
    },
  };
}

/** 中心・長さ・回転を持つ線分系プラグインのローカル端点 */
export function segmentEndpoints(length: number): [Point, Point] {
  return [
    { x: -length / 2, y: 0 },
    { x: length / 2, y: 0 },
  ];
}

/** 細い線でもクリックしやすくするためのヒット領域の太さ */
export function hitStrokeWidth(strokeWidth: number): number {
  return Math.max(strokeWidth, 12);
}
