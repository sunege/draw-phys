import type { ResolvedRef } from '../../core/plugin';
import type { Transform } from '../../core/types';
import { segmentFromEndpoints } from '../basic/lineUtils';

/**
 * 解決済み参照から長さマークの length と transform を求める。
 * - circle ref: measureMode に応じて 中心→円周(radius) or 円周→反対側(diameter)
 * - segment ref(p0,p1): 2点をそのまま両端に
 * 参照が不足していれば null(現状維持)。
 */
export function lengthMarkFromResolved(
  resolved: ResolvedRef[],
  measureMode: string,
): { length: number; transform: Transform } | null {
  const circle = resolved.find((r) => r.role === 'circle');
  if (circle?.tangent && circle.radius != null) {
    // 外向き半径方向 = 接線を-90°回した向き((t.y, -t.x))
    const radial = { x: circle.tangent.y, y: -circle.tangent.x };
    const edge = circle.point;
    const r = circle.radius;
    if (measureMode === 'diameter') {
      const opposite = { x: edge.x - 2 * r * radial.x, y: edge.y - 2 * r * radial.y };
      return segmentFromEndpoints(edge, opposite);
    }
    const center = { x: edge.x - r * radial.x, y: edge.y - r * radial.y };
    return segmentFromEndpoints(center, edge);
  }

  const p0 = resolved.find((r) => r.role === 'p0');
  const p1 = resolved.find((r) => r.role === 'p1');
  if (p0 && p1) return segmentFromEndpoints(p0.point, p1.point);
  return null;
}
