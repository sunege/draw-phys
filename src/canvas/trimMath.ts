import { angleOfVector, normalizeAngle360, rotateVec } from '../core/geometry';
import type { Point } from '../core/types';

const EPS = 1e-7;

/** 線分ab上での点pのパラメタ(0=a, 1=b。クランプしない) */
export function projectSegmentT(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < EPS) return 0;
  return ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
}

/** 線分ab × 線分cd の交点。両線分の内部で交わればその点、なければ(平行・範囲外) null */
export function segmentSegment(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < EPS) return null; // 平行/縮退
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

/** 線分ab × 円(center,r) の交点(線分範囲内、0〜2点) */
export function segmentCircle(a: Point, b: Point, center: Point, r: number): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  if (A < EPS) return [];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const out: Point[] = [];
  for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
    if (t >= -EPS && t <= 1 + EPS) out.push({ x: a.x + t * dx, y: a.y + t * dy });
  }
  return out;
}

/** 円(c0,r0) × 円(c1,r1) の交点(0〜2点) */
export function circleCircle(c0: Point, r0: number, c1: Point, r1: number): Point[] {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const dist = Math.hypot(dx, dy);
  if (dist < EPS) return []; // 同心
  if (dist > r0 + r1 + EPS || dist < Math.abs(r0 - r1) - EPS) return []; // 離れている/内包
  const aLen = (r0 * r0 - r1 * r1 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, r0 * r0 - aLen * aLen));
  const mx = c0.x + (aLen * dx) / dist;
  const my = c0.y + (aLen * dy) / dist;
  if (h < EPS) return [{ x: mx, y: my }]; // 接する
  const ox = (-dy * h) / dist;
  const oy = (dx * h) / dist;
  return [
    { x: mx + ox, y: my + oy },
    { x: mx - ox, y: my - oy },
  ];
}

/** 点pが、中心center・world回転rotationの円弧(ローカル start..end 度, 増加方向)上にあるか */
export function pointOnArc(
  center: Point,
  rotation: number,
  start: number,
  end: number,
  p: Point,
): boolean {
  const world = angleOfVector({ x: p.x - center.x, y: p.y - center.y });
  const rel = normalizeAngle360(world - rotation - start);
  const sweep = normalizeAngle360(end - start) || 360;
  return rel <= sweep + 1e-3 || rel >= 360 - 1e-3;
}

/**
 * ワールド点pの、中心center・半径radiusX/radiusY・回転rotationの楕円に対する媒介変数角度(度)。
 * P(t)=(radiusX·cos t, radiusY·sin t) の t を返す。回転を先に打ち消してから軸ごとに
 * radiusX/radiusYで割らないと角度がずれる(円と違い、回転と非一様スケールの順序が重要)。
 */
export function ellipseParamAngle(
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation: number,
  p: Point,
): number {
  const local = rotateVec({ x: p.x - center.x, y: p.y - center.y }, -rotation);
  return angleOfVector({ x: local.x / radiusX, y: local.y / radiusY });
}

/** 点pが、中心center・半径radiusX/radiusY・world回転rotationの楕円弧(ローカル start..end 度)上にあるか */
export function pointOnEllipticalArc(
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation: number,
  start: number,
  end: number,
  p: Point,
): boolean {
  const t = ellipseParamAngle(center, radiusX, radiusY, rotation, p);
  const rel = normalizeAngle360(t - start);
  const sweep = normalizeAngle360(end - start) || 360;
  return rel <= sweep + 1e-3 || rel >= 360 - 1e-3;
}

/**
 * 線分ab × 楕円(center, radiusX, radiusY, rotation) の交点(線分範囲内、0〜2点)。
 * 回転を打ち消しx/radiusX・y/radiusYで割った「u空間」では楕円が単位円になるため、
 * 既存の segmentCircle をそのまま再利用してワールド座標へ戻す(近似ではなく厳密)。
 */
export function segmentEllipse(
  a: Point,
  b: Point,
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation: number,
): Point[] {
  const toU = (p: Point): Point => {
    const local = rotateVec({ x: p.x - center.x, y: p.y - center.y }, -rotation);
    return { x: local.x / radiusX, y: local.y / radiusY };
  };
  const fromU = (u: Point): Point => {
    const local = rotateVec({ x: u.x * radiusX, y: u.y * radiusY }, rotation);
    return { x: local.x + center.x, y: local.y + center.y };
  };
  return segmentCircle(toU(a), toU(b), { x: 0, y: 0 }, 1).map(fromU);
}

/** 楕円(center, rx, ry, rotation)の陰関数値。楕円上で0・内側<0・外側>0 */
function ellipseImplicit(p: Point, center: Point, rx: number, ry: number, rotation: number): number {
  const local = rotateVec({ x: p.x - center.x, y: p.y - center.y }, -rotation);
  const ux = local.x / rx;
  const uy = local.y / ry;
  return ux * ux + uy * uy - 1;
}

/** 円周上の媒介変数角度deg(度)の点(円は回転対称なので回転不要) */
function circlePoint(center: Point, r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: center.x + r * Math.cos(rad), y: center.y + r * Math.sin(rad) };
}

/** 楕円上の媒介変数角度deg(度)の点 */
function ellipsePoint(center: Point, rx: number, ry: number, rotation: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const local = rotateVec({ x: rx * Math.cos(rad), y: ry * Math.sin(rad) }, rotation);
  return { x: center.x + local.x, y: center.y + local.y };
}

/**
 * 曲線1(param: 角度deg∈[0,360)→点で1周パラメタ表示)と曲線2(implicit: 曲線2上で0・内側<0)の
 * 交点を数値的に求める。全周を細かくサンプルし、陰関数の符号が変わる区間を二分法で詰める。
 * 内外が入れ替わる「横断的な交点」だけを返す=トリムの区間境界にちょうど必要な点。
 * 接点(符号が変わらず触れるだけ)は区間を分けないので返さない(円×円の circleCircle と同趣旨)。
 * 円錐曲線(円・楕円)同士は最大4交点。楕円×楕円の4次方程式を陽に解かずに済ませる。
 */
function conicIntersections(param: (deg: number) => Point, implicit: (p: Point) => number): Point[] {
  const STEPS = 720; // 0.5°刻み。これより近接した2交点は1点に融合する(ほぼ接する場合のみ)
  const pts: Point[] = [];
  let prevDeg = 0;
  let prev = implicit(param(0));
  for (let i = 1; i <= STEPS; i++) {
    const deg = (i * 360) / STEPS;
    const cur = implicit(param(deg));
    if (prev * cur < 0) {
      // [prevDeg, deg] に根。二分法で詰める
      let lo = prevDeg;
      let hi = deg;
      let flo = prev;
      for (let k = 0; k < 50 && hi - lo > 1e-7; k++) {
        const mid = (lo + hi) / 2;
        const fm = implicit(param(mid));
        if (fm === 0) {
          lo = hi = mid;
          break;
        }
        if (flo * fm < 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      pts.push(param((lo + hi) / 2));
    }
    prevDeg = deg;
    prev = cur;
  }
  return pts;
}

/** 円(cc, cr) × 楕円(ec, erx, ery, erot) の交点(ワールド, 0〜4点)。円周をサンプルして数値的に求める */
export function circleEllipse(
  cc: Point,
  cr: number,
  ec: Point,
  erx: number,
  ery: number,
  erot: number,
): Point[] {
  return conicIntersections(
    (deg) => circlePoint(cc, cr, deg),
    (p) => ellipseImplicit(p, ec, erx, ery, erot),
  );
}

/** 2楕円の交点(ワールド, 0〜4点)。片方の楕円周をサンプルして数値的に求める */
export function ellipseEllipse(
  c1: Point,
  rx1: number,
  ry1: number,
  rot1: number,
  c2: Point,
  rx2: number,
  ry2: number,
  rot2: number,
): Point[] {
  return conicIntersections(
    (deg) => ellipsePoint(c1, rx1, ry1, rot1, deg),
    (p) => ellipseImplicit(p, c2, rx2, ry2, rot2),
  );
}

/** 昇順の境界(定義域端を含む)から、click を挟む隣接ペア[lo,hi]を返す。無ければnull */
export function bracketLinear(bounds: number[], click: number): [number, number] | null {
  const s = [...bounds].sort((x, y) => x - y);
  for (let i = 0; i < s.length - 1; i++) {
    if (click >= s[i] - 1e-6 && click <= s[i + 1] + 1e-6) return [s[i], s[i + 1]];
  }
  return null;
}

/**
 * 円周(cyclic)で、交点角の間の click を含む「削除ギャップ」[lo,hi](増加方向 lo→hi)を返す。
 * lo,hi は[0,360)へ正規化した角度。2交点未満はnull。
 */
export function bracketCyclic(angles: number[], click: number): [number, number] | null {
  if (angles.length < 2) return null;
  const s = angles.map(normalizeAngle360).sort((x, y) => x - y);
  const c = normalizeAngle360(click);
  for (let i = 0; i < s.length; i++) {
    const lo = s[i];
    const hi = i + 1 < s.length ? s[i + 1] : s[0] + 360;
    let cc = c;
    if (cc < lo - 1e-6) cc += 360;
    if (cc >= lo - 1e-6 && cc <= hi + 1e-6) return [normalizeAngle360(lo), normalizeAngle360(hi)];
  }
  return null;
}
