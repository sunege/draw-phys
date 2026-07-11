import { pointOnCircleAtAngle } from '../../core/geometry';
import type { Point } from '../../core/types';

const DEG = Math.PI / 180;

export type LensKind = 'convex' | 'concave';
export type CurvedMirrorKind = 'concave' | 'convex';

/** 両凹レンズの各面のえぐれ(矢)と縁厚の比。中央厚 = 縁厚·(1-2·比) */
const CONCAVE_SAG_RATIO = 0.35;

/**
 * 弦の半分 halfHeight・矢(sagitta)から円弧の曲率半径を返す。
 * 球面レンズ断面の各面は球の一部=円弧なので、端点(0,±halfHeight)と中央の
 * ふくらみ量 sagitta を通る円の半径 R=(halfHeight²+sagitta²)/(2·sagitta) を逆算する。
 */
export function lensArcRadius(halfHeight: number, sagitta: number): number {
  return (halfHeight * halfHeight + sagitta * sagitta) / (2 * sagitta);
}

/** パスの桁あふれ防止に小数を丸める */
function trim(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * レンズ形(shapeスタイル)の輪郭パス。実際のレンズ断面に合わせ、各面を球面=円弧で描く。
 * - 凸(両凸): 端点(0,±h/2)で尖り、中央が±thickness/2までふくらむ円弧2枚(レンズ形)。
 * - 凹(両凹): 幅thicknessの矩形の左右面を、中央が内側(thickness·(1-2·比))までえぐる円弧2枚。
 * height=有効径、thickness=凸は中央厚 / 凹は縁厚。
 */
export function lensOutlinePath(kind: LensKind, height: number, thickness: number): string {
  const hh = height / 2;
  if (kind === 'convex') {
    const s = thickness / 2; // 中央のふくらみ(片側)=矢
    if (s < 0.5 || hh < 0.5) return `M 0 ${-hh} L 0 ${hh} Z`; // 退化時は直線
    const r = trim(lensArcRadius(hh, s));
    // 右へふくらむ弧→左へふくらむ弧。minor arc(large-arc=0)・画面時計回り(sweep=1)
    return `M 0 ${-hh} A ${r} ${r} 0 0 1 0 ${hh} A ${r} ${r} 0 0 1 0 ${-hh} Z`;
  }
  const w = thickness / 2;
  const s = thickness * CONCAVE_SAG_RATIO; // 各面が内側へえぐれる矢
  if (s < 0.5 || hh < 0.5) {
    // 退化時は矩形
    return `M ${-w} ${-hh} L ${w} ${-hh} L ${w} ${hh} L ${-w} ${hh} Z`;
  }
  const r = trim(lensArcRadius(hh, s));
  // 上辺→右面(内側へえぐる弧)→下辺→左面(えぐる弧)。minor arc・sweep=0でくびれる
  return `M ${-w} ${-hh} L ${w} ${-hh} A ${r} ${r} 0 0 0 ${w} ${hh} L ${-w} ${hh} A ${r} ${r} 0 0 0 ${-w} ${-hh} Z`;
}

export interface CurvedMirrorGeometry {
  /** 球面の中心(ローカル) */
  center: Point;
  radius: number;
  /** 円弧の角度範囲(度)。arc.tsx と同じ「0=+x・画面時計回り正」、start→end は増加方向 */
  startAngle: number;
  endAngle: number;
  /** 円弧の両端点(ローカル) */
  ends: [Point, Point];
  /** 焦点F(距離R/2)。凸面鏡は鏡の裏側の虚焦点 */
  focus: Point;
  /** 曲率中心C */
  curvatureCenter: Point;
}

/**
 * 球面鏡のローカル幾何。鏡の頂点を原点・光軸を+x方向(反射面は+x側を向く)とする。
 * 凹面鏡はC・Fが+x側(実焦点)、凸面鏡は-x側(虚焦点)。
 */
export function curvedMirrorGeometry(
  kind: CurvedMirrorKind,
  radius: number,
  halfAngleDeg: number,
): CurvedMirrorGeometry {
  const a = halfAngleDeg;
  if (kind === 'concave') {
    const center = { x: radius, y: 0 };
    return {
      center,
      radius,
      startAngle: 180 - a,
      endAngle: 180 + a,
      ends: [
        pointOnCircleAtAngle(center, radius, 180 - a),
        pointOnCircleAtAngle(center, radius, 180 + a),
      ],
      focus: { x: radius / 2, y: 0 },
      curvatureCenter: center,
    };
  }
  const center = { x: -radius, y: 0 };
  return {
    center,
    radius,
    startAngle: -a,
    endAngle: a,
    ends: [pointOnCircleAtAngle(center, radius, -a), pointOnCircleAtAngle(center, radius, a)],
    focus: { x: -radius / 2, y: 0 },
    curvatureCenter: center,
  };
}

/**
 * 円弧の裏側ハッチ(放射状の短い線)。outward=true で円の中心から離れる向きへ、
 * false で中心へ向かって描く。弧長を spacing で刻んだ位置に生成する。
 */
export function arcHatchTicks(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  outward: boolean,
  tickLength: number,
  spacing: number,
): [Point, Point][] {
  const sweep = endAngle - startAngle;
  const arcLen = Math.abs(sweep) * DEG * radius;
  const n = Math.max(2, Math.round(arcLen / spacing));
  const s = outward ? 1 : -1;
  const ticks: [Point, Point][] = [];
  for (let i = 0; i <= n; i++) {
    const p = pointOnCircleAtAngle(center, radius, startAngle + (sweep * i) / n);
    const ux = (p.x - center.x) / radius;
    const uy = (p.y - center.y) / radius;
    ticks.push([p, { x: p.x + ux * tickLength * s, y: p.y + uy * tickLength * s }]);
  }
  return ticks;
}

/** プリズム(二等辺三角形)の頂点。頂角を上(0,-h/2)・底辺を下に置く */
export function prismVertices(height: number, apexAngleDeg: number): [Point, Point, Point] {
  const hh = height / 2;
  const w = height * Math.tan((apexAngleDeg / 2) * DEG);
  return [
    { x: 0, y: -hh },
    { x: w, y: hh },
    { x: -w, y: hh },
  ];
}
