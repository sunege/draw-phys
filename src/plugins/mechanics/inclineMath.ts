import type { Point } from '../../core/types';

export type InclineDirection = 'right' | 'left';

export interface InclineGeometry {
  /** [底角θ側の底辺端, 直角側の底辺端, 頂上] (ローカル座標、原点=外接箱の中心) */
  vertices: [Point, Point, Point];
  /** 斜面の高さ(=底辺×tanθ) */
  height: number;
}

/** 斜面(直角三角形)のローカル幾何。direction='right' で右上がり(高い側が右) */
export function inclineGeometry(
  base: number,
  angleDeg: number,
  direction: InclineDirection,
): InclineGeometry {
  const height = base * Math.tan(angleDeg * (Math.PI / 180));
  const hb = base / 2;
  const hh = height / 2;
  const s = direction === 'right' ? 1 : -1;
  return {
    vertices: [
      { x: -s * hb, y: hh },
      { x: s * hb, y: hh },
      { x: s * hb, y: -hh },
    ],
    height,
  };
}
