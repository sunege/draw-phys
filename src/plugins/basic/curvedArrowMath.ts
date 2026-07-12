import type { Point, Rect } from '../../core/types';
import { ellipsePointAt } from './ellipseMath';

const DEG = Math.PI / 180;
const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * 巻矢印(回転方向を示す弧の矢印)の形状パラメータ。
 * ローカル座標=原点は弧を含む楕円の中心。角度は媒介変数角(度)で 0=+x方向、
 * y下向きなので角度が増えると画面上は時計回り。radiusX/radiusY で縦横に潰せる
 * (ソレノイドを斜めから見た楕円などに合わせられる)。
 * startAngle から掃引角 sweep ぶん ccw の向きへ弧を描き、終端に接線方向の矢先を付ける。
 */
export interface CurvedArrowShape {
  /** 横半径 */
  radiusX: number;
  /** 縦半径 */
  radiusY: number;
  /** 開始角(媒介変数角, 度) */
  startAngle: number;
  /** 掃引角(度, 正) */
  sweep: number;
  /** true=反時計回り(画面), false=時計回り */
  ccw: boolean;
}

/** 掃引角を [1,360] にクランプ */
export function clampSweep(sweep: number): number {
  if (!Number.isFinite(sweep)) return 1;
  return Math.max(1, Math.min(360, sweep));
}

/** 描画方向の符号。y下向き座標では角度増加=画面時計回りなので、時計回り=+1・反時計回り=-1 */
export function dirSign(ccw: boolean): 1 | -1 {
  return ccw ? -1 : 1;
}

/** 描画方向へ進む単位接ベクトル(媒介変数角deg, 向きdir)。楕円は速さが一定でないため正規化する */
export function ellipseTangentAt(rx: number, ry: number, deg: number, dir: 1 | -1): Point {
  const rad = deg * DEG;
  // dP/dt = (-rx·sin t, ry·cos t)
  const vx = -rx * Math.sin(rad);
  const vy = ry * Math.cos(rad);
  const len = Math.hypot(vx, vy) || 1;
  return { x: (dir * vx) / len, y: (dir * vy) / len };
}

/** 終了角(度) */
export function endAngleOf(shape: CurvedArrowShape): number {
  return shape.startAngle + dirSign(shape.ccw) * clampSweep(shape.sweep);
}

/**
 * 楕円弧のSVGパス。fromDeg→toDeg の符号付き差が向き(増加=時計回り)と大きさを表す。
 */
export function arcPathDeg(rx: number, ry: number, fromDeg: number, toDeg: number): string {
  const s = ellipsePointAt(rx, ry, fromDeg);
  const e = ellipsePointAt(rx, ry, toDeg);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  // y下向き座標系では角度増加=時計回りなので sweep-flag=1
  const sweepFlag = toDeg >= fromDeg ? 1 : 0;
  return `M ${round(s.x)} ${round(s.y)} A ${rx} ${ry} 0 ${largeArc} ${sweepFlag} ${round(e.x)} ${round(e.y)}`;
}

/** 矢先ポリゴンの点列(先端tip, 単位方向dir, 大きさheadSize) */
export function arrowHeadPoints(tip: Point, dir: Point, headSize: number): string {
  const halfW = headSize * 0.4;
  const back = { x: tip.x - dir.x * headSize, y: tip.y - dir.y * headSize };
  const perp = { x: -dir.y, y: dir.x };
  const p1 = { x: back.x + perp.x * halfW, y: back.y + perp.y * halfW };
  const p2 = { x: back.x - perp.x * halfW, y: back.y - perp.y * halfW };
  return `${round(tip.x)},${round(tip.y)} ${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)}`;
}

export interface CurvedArrowPaths {
  /** 弧の線(矢先の付け根まで縮めてある) */
  arc: string;
  /** 矢先ポリゴンの点列(終端の1つ、両端矢印なら始端も) */
  heads: string[];
}

/** 媒介変数角degでの楕円周上の速さ(=|dP/dt|)。矢先ぶん詰める角度の換算に使う */
function speedAt(rx: number, ry: number, deg: number): number {
  const rad = deg * DEG;
  return Math.hypot(rx * Math.sin(rad), ry * Math.cos(rad)) || 1;
}

/**
 * 巻矢印の描画データ。矢先と線の重なりを避けるため、弧を矢先ぶん(局所の弧長で換算した
 * 角度)詰めて描く。掃引角の45%を超えては詰めない。
 */
export function curvedArrowPaths(
  shape: CurvedArrowShape,
  headSize: number,
  doubleHead: boolean,
): CurvedArrowPaths {
  const { radiusX: rx, radiusY: ry } = shape;
  const dir = dirSign(shape.ccw);
  const sweep = clampSweep(shape.sweep);
  const a0 = shape.startAngle;
  const a1 = a0 + dir * sweep;
  const trimDeg = (deg: number): number =>
    Math.min(((headSize * 0.8) / speedAt(rx, ry, deg)) / DEG, sweep * 0.45);
  const lineFrom = doubleHead ? a0 + dir * trimDeg(a0) : a0;
  const lineTo = a1 - dir * trimDeg(a1);

  const heads = [
    // 終端は必ず矢先(描画方向を向く)
    arrowHeadPoints(ellipsePointAt(rx, ry, a1), ellipseTangentAt(rx, ry, a1, dir), headSize),
  ];
  if (doubleHead) {
    // 始端は描画方向の逆向き
    const t = ellipseTangentAt(rx, ry, a0, dir);
    heads.push(arrowHeadPoints(ellipsePointAt(rx, ry, a0), { x: -t.x, y: -t.y }, headSize));
  }
  return { arc: arcPathDeg(rx, ry, lineFrom, lineTo), heads };
}

/** バウンディングボックス(弧のサンプル点+矢先先端+線幅/矢先ぶんのパディング) */
export function curvedArrowBounds(
  shape: CurvedArrowShape,
  headSize: number,
  strokeWidth: number,
): Rect {
  const { radiusX: rx, radiusY: ry } = shape;
  const dir = dirSign(shape.ccw);
  const sweep = clampSweep(shape.sweep);
  const n = Math.max(8, Math.ceil(sweep / 10));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(ellipsePointAt(rx, ry, shape.startAngle + dir * sweep * (i / n)));
  }
  // 矢先の先端も含める
  const a1 = shape.startAngle + dir * sweep;
  const tip = ellipsePointAt(rx, ry, a1);
  const t = ellipseTangentAt(rx, ry, a1, dir);
  pts.push({ x: tip.x + t.x * headSize, y: tip.y + t.y * headSize });

  const pad = Math.max(strokeWidth, headSize * 0.4) + strokeWidth;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  };
}
