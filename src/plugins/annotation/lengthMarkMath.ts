import type { ResolvedRef } from '../../core/plugin';
import type { Point, Transform } from '../../core/types';
import { segmentFromEndpoints } from '../basic/lineUtils';

/**
 * 参照から「測定する2点」(ワールド座標)を求める。
 * - circle ref: measureMode に応じて 中心→円周(radius) or 円周→反対側(diameter)
 * - segment ref(p0,p1): 2点をそのまま
 */
export function measuredEndpoints(
  resolved: ResolvedRef[],
  measureMode: string,
): [Point, Point] | null {
  const circle = resolved.find((r) => r.role === 'circle');
  if (circle?.tangent && circle.radius != null) {
    // 外向き半径方向 = 接線を-90°回した向き((t.y, -t.x))
    const radial = { x: circle.tangent.y, y: -circle.tangent.x };
    const edge = circle.point;
    const r = circle.radius;
    if (measureMode === 'diameter') {
      return [edge, { x: edge.x - 2 * r * radial.x, y: edge.y - 2 * r * radial.y }];
    }
    return [{ x: edge.x - r * radial.x, y: edge.y - r * radial.y }, edge];
  }
  const p0 = resolved.find((r) => r.role === 'p0');
  const p1 = resolved.find((r) => r.role === 'p1');
  if (p0 && p1) return [p0.point, p1.point];
  return null;
}

/**
 * 解決済み参照から長さマークの length と transform を求める。
 * perpOffset を与えると、測定線分と平行に垂直オフセットした位置へ寸法線を置く。
 * 参照が不足していれば null(現状維持)。
 */
export function lengthMarkFromResolved(
  resolved: ResolvedRef[],
  measureMode: string,
  perpOffset = 0,
): { length: number; transform: Transform } | null {
  const pts = measuredEndpoints(resolved, measureMode);
  if (!pts) return null;
  const [a, b] = pts;
  const seg = segmentFromEndpoints(a, b);
  if (perpOffset) {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // 線分方向を+90°回した単位法線((-dy, dx))方向へオフセット
    seg.transform.x += (-(b.y - a.y) / len) * perpOffset;
    seg.transform.y += ((b.x - a.x) / len) * perpOffset;
  }
  return seg;
}
