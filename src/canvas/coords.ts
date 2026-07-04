import type { Point } from '../core/types';

/** クライアント座標(マウスイベント)をワールド座標へ変換する */
export function screenToWorld(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  pan: Point,
  zoom: number,
): Point {
  const rect = svg.getBoundingClientRect();
  return {
    x: pan.x + (clientX - rect.left) / zoom,
    y: pan.y + (clientY - rect.top) / zoom,
  };
}
