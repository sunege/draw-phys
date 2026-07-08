import type { Point } from '../../core/types';

export interface BlockArrowShape {
  length: number;
  shaftWidth: number;
  headWidth: number;
  headLength: number;
  doubleHead: boolean;
}

/**
 * 中抜き太矢印の輪郭点列(ローカル座標、x軸方向)。
 * 軸(shaftWidth)から矢先(headWidth)へ広がる多角形。doubleHead時は両端が矢先になる。
 * headLength は軸の半分(または全長)を超えないようクランプし自己交差を防ぐ。
 */
export function blockArrowPoints(shape: BlockArrowShape): Point[] {
  const half = shape.length / 2;
  const shaftHalfW = shape.shaftWidth / 2;
  const headHalfW = shape.headWidth / 2;
  if (shape.doubleHead) {
    const headLen = Math.min(shape.headLength, shape.length / 2);
    const hs1 = -half + headLen;
    const hs2 = half - headLen;
    return [
      { x: -half, y: 0 },
      { x: hs1, y: -headHalfW },
      { x: hs1, y: -shaftHalfW },
      { x: hs2, y: -shaftHalfW },
      { x: hs2, y: -headHalfW },
      { x: half, y: 0 },
      { x: hs2, y: headHalfW },
      { x: hs2, y: shaftHalfW },
      { x: hs1, y: shaftHalfW },
      { x: hs1, y: headHalfW },
    ];
  }
  const headLen = Math.min(shape.headLength, shape.length);
  const headStart = half - headLen;
  return [
    { x: -half, y: -shaftHalfW },
    { x: headStart, y: -shaftHalfW },
    { x: headStart, y: -headHalfW },
    { x: half, y: 0 },
    { x: headStart, y: headHalfW },
    { x: headStart, y: shaftHalfW },
    { x: -half, y: shaftHalfW },
  ];
}

/** バウンディングボックスの高さ(矢先幅と軸太さの大きい方) */
export function blockArrowHeight(shape: Pick<BlockArrowShape, 'shaftWidth' | 'headWidth'>): number {
  return Math.max(shape.shaftWidth, shape.headWidth);
}

/** SVG polygon の points 属性文字列 */
export function blockArrowPointsAttr(shape: BlockArrowShape): string {
  return blockArrowPoints(shape)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}
