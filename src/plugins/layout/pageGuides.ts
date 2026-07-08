import type { Point } from '../../core/types';

/**
 * 用紙のレイアウト補助線(等分線・対角線)の純粋な幾何計算。
 * すべて中央原点のローカル座標・内部単位(width/height は mmToUnits 済みの値を渡す)。
 */

export interface GuideConfig {
  /** 用紙の幅(内部単位) */
  width: number;
  /** 用紙の高さ(内部単位) */
  height: number;
  /** 縦の等分数(cols-1 本の縦線)。1以下で縦線なし */
  cols: number;
  /** 横の等分数(rows-1 本の横線)。1以下で横線なし */
  rows: number;
  /** 対角線を含める */
  diagonals: boolean;
}

/**
 * [-half, +half] の範囲を count 等分する内部境界位置(count-1 個、中央原点)。
 * count<=1 なら空。full=幅または高さ。
 */
export function divisions(full: number, count: number): number[] {
  const out: number[] = [];
  const n = Math.floor(count);
  if (n <= 1) return out;
  const half = full / 2;
  for (let i = 1; i < n; i++) out.push(-half + (i * full) / n);
  return out;
}

/** 補助線の線分(ローカル座標)。等分の縦線・横線と、任意で2本の対角線 */
export function guideSegments(cfg: GuideConfig): [Point, Point][] {
  const hw = cfg.width / 2;
  const hh = cfg.height / 2;
  const segs: [Point, Point][] = [];
  for (const x of divisions(cfg.width, cfg.cols)) {
    segs.push([{ x, y: -hh }, { x, y: hh }]);
  }
  for (const y of divisions(cfg.height, cfg.rows)) {
    segs.push([{ x: -hw, y }, { x: hw, y }]);
  }
  if (cfg.diagonals) {
    segs.push([{ x: -hw, y: -hh }, { x: hw, y: hh }]);
    segs.push([{ x: hw, y: -hh }, { x: -hw, y: hh }]);
  }
  return segs;
}

/**
 * 補助線に関わるスナップ点(ローカル座標)。
 * 内部の等分格子の交点と、各辺上の等分点(段組み・図の端合わせに使う)。
 */
export function guidePoints(cfg: GuideConfig): Point[] {
  const hw = cfg.width / 2;
  const hh = cfg.height / 2;
  const xs = divisions(cfg.width, cfg.cols);
  const ys = divisions(cfg.height, cfg.rows);
  const pts: Point[] = [];
  for (const x of xs) for (const y of ys) pts.push({ x, y });
  for (const x of xs) pts.push({ x, y: -hh }, { x, y: hh });
  for (const y of ys) pts.push({ x: -hw, y }, { x: hw, y });
  return pts;
}
