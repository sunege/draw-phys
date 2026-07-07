import type { Point, Rect } from '../../core/types';
import { isFullArc, sweepDelta } from './arc';

const DEG = Math.PI / 180;

/** 媒介変数角度degにおける楕円周上の点(中心原点)。P(t)=(rx·cos t, ry·sin t) */
export function ellipsePointAt(rx: number, ry: number, deg: number): Point {
  const rad = deg * DEG;
  return { x: rx * Math.cos(rad), y: ry * Math.sin(rad) };
}

/** 楕円弧のSVGパス(中心原点) */
export function ellipseArcPath(rx: number, ry: number, startAngle: number, endAngle: number): string {
  const delta = sweepDelta(startAngle, endAngle);
  const s = ellipsePointAt(rx, ry, startAngle);
  const e = ellipsePointAt(rx, ry, startAngle + delta);
  const largeArc = delta > 180 ? 1 : 0;
  // y下向き座標系では増加方向=時計回りなので sweep-flag=1
  return `M ${s.x} ${s.y} A ${rx} ${ry} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

/**
 * 楕円弧の軸平行バウンディングボックス(中心原点)。
 * x=rx·cos t, y=ry·sin t はそれぞれ独立に t=0/90/180/270 で極値を取るため、
 * 円のarcBoundsと同じロジック(90°刻みの極値を含める)がそのまま成り立つ。
 */
export function ellipseArcBounds(rx: number, ry: number, startAngle: number, endAngle: number): Rect {
  if (isFullArc(startAngle, endAngle)) {
    return { x: -rx, y: -ry, width: rx * 2, height: ry * 2 };
  }
  const delta = sweepDelta(startAngle, endAngle);
  const a1 = startAngle + delta;
  const pts: Point[] = [ellipsePointAt(rx, ry, startAngle), ellipsePointAt(rx, ry, a1)];
  // 範囲内の90°倍数(x=±rx, y=±ryの極値)を加える
  for (let k = Math.ceil(startAngle / 90) * 90; k <= a1; k += 90) {
    pts.push(ellipsePointAt(rx, ry, k));
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}
