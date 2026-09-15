import {
  angleOfVector,
  distance,
  nearestPointOnSegment,
  normalizeAngle180,
  normalizeAngle360,
  rotateVec,
} from '../core/geometry';
import type { RegionEdge, RegionLoop } from '../core/regionPath';
import type { Point } from '../core/types';
import { ellipseParamAngle, projectSegmentT } from './trimMath';
import {
  circleCutterPoints,
  cutterInRange,
  ellipseCutterPoints,
  segmentCutterPoints,
  type WorldCurve,
} from './worldCurves';

/**
 * 領域塗り(バケツ)の幾何計算。
 *
 * 線分・円(弧)・楕円(弧)の集まりを交点で切り分けて平面グラフ(頂点=交点/端点, 辺=曲線片)にし、
 * 各頂点で辺を向きの順に並べて「面」を辿る。クリック点を含む最小の有界な面が塗る領域。
 * 面の内側にある別の連結成分(図形の中の独立した円など)は穴としてくり抜く。
 *
 * - 近接端点の吸着: 許容距離 tol 以内の端点どうし・端点と他曲線はつながっているとみなす
 *   (スナップせずに描いたわずかな隙間で色が漏れないように)
 * - 片側だけつながった枝(線の飛び出し)は面を作らないので事前に刈り取る
 * - 結果の輪郭は直線と円弧の厳密な列(近似でない)なので、書き出しでも鮮明
 */

export interface OwnedCurve {
  owner: string;
  curve: WorldCurve;
}

interface Carrier {
  curve: WorldCurve;
  owner: string;
  u0: number;
  u1: number;
  closed: boolean;
  length: number;
  at(u: number): Point;
  /** 接線ベクトル(uの増加方向) */
  tangent(u: number): Point;
  paramOf(p: Point): number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

const DEG = Math.PI / 180;

function conicCarrier(
  curve: WorldCurve,
  owner: string,
  center: Point,
  rx: number,
  ry: number,
  rotation: number,
  start: number | undefined,
  end: number | undefined,
  rawParam: (p: Point) => number,
): Carrier {
  const hasRange = start != null && end != null;
  const sweep = hasRange ? normalizeAngle360(end! - start!) || 360 : 360;
  const closed = sweep >= 359.999;
  const u0 = hasRange && !closed ? start! : 0;
  const u1 = u0 + (closed ? 360 : sweep);
  const at = (u: number): Point => {
    const v = rotateVec({ x: rx * Math.cos(u * DEG), y: ry * Math.sin(u * DEG) }, rotation);
    return { x: center.x + v.x, y: center.y + v.y };
  };
  const tangent = (u: number): Point =>
    rotateVec({ x: -rx * Math.sin(u * DEG), y: ry * Math.cos(u * DEG) }, rotation);
  const paramOf = (p: Point): number => {
    const u = u0 + normalizeAngle360(rawParam(p) - u0);
    if (closed || u <= u1) return u;
    // 範囲外は近い方の端側へ(開始角の手前ならマイナス側に展開)
    return u - u1 > u0 - (u - 360) ? u - 360 : u;
  };
  // Ramanujan の楕円周長近似 × 掃引割合
  const h = ((rx - ry) * (rx - ry)) / ((rx + ry) * (rx + ry) || 1);
  const perimeter = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const carrier: Carrier = {
    curve,
    owner,
    u0,
    u1,
    closed,
    length: (perimeter * (u1 - u0)) / 360,
    at,
    tangent,
    paramOf,
    bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  };
  carrier.bbox = sampleBBox(carrier);
  return carrier;
}

function sampleBBox(c: Carrier) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const n = c.curve.kind === 'segment' ? 1 : Math.max(4, Math.ceil((c.u1 - c.u0) / 5));
  for (let i = 0; i <= n; i++) {
    const p = c.at(c.u0 + ((c.u1 - c.u0) * i) / n);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function makeCarrier(oc: OwnedCurve): Carrier | null {
  const c = oc.curve;
  if (c.kind === 'segment') {
    const len = distance(c.a, c.b);
    if (len < 1e-9) return null;
    const carrier: Carrier = {
      curve: c,
      owner: oc.owner,
      u0: 0,
      u1: 1,
      closed: false,
      length: len,
      at: (u) => ({ x: c.a.x + (c.b.x - c.a.x) * u, y: c.a.y + (c.b.y - c.a.y) * u }),
      tangent: () => ({ x: c.b.x - c.a.x, y: c.b.y - c.a.y }),
      paramOf: (p) => projectSegmentT(p, c.a, c.b),
      bbox: {
        minX: Math.min(c.a.x, c.b.x),
        minY: Math.min(c.a.y, c.b.y),
        maxX: Math.max(c.a.x, c.b.x),
        maxY: Math.max(c.a.y, c.b.y),
      },
    };
    return carrier;
  }
  if (c.kind === 'circle') {
    if (c.radius < 1e-9) return null;
    return conicCarrier(c, oc.owner, c.center, c.radius, c.radius, c.rotation, c.start, c.end, (p) =>
      angleOfVector({ x: p.x - c.center.x, y: p.y - c.center.y }) - c.rotation,
    );
  }
  if (c.radiusX < 1e-9 || c.radiusY < 1e-9) return null;
  return conicCarrier(c, oc.owner, c.center, c.radiusX, c.radiusY, c.rotation, c.start, c.end, (p) =>
    ellipseParamAngle(c.center, c.radiusX, c.radiusY, c.rotation, p),
  );
}

/** 2曲線の交点(両方の範囲内) */
function carrierHits(a: Carrier, b: Carrier): Point[] {
  const c = a.curve;
  const pts =
    c.kind === 'segment'
      ? segmentCutterPoints(c.a, c.b, b.curve)
      : c.kind === 'circle'
        ? circleCutterPoints(c.center, c.radius, b.curve)
        : ellipseCutterPoints(c.center, c.radiusX, c.radiusY, c.rotation, b.curve);
  return pts.filter((p) => cutterInRange(a.curve, p) && cutterInRange(b.curve, p));
}

/** 曲線上で点pに最も近い点(円弧・楕円弧の範囲外なら null。楕円は媒介変数で近似) */
function nearestOnCarrier(c: Carrier, p: Point): Point | null {
  const cv = c.curve;
  if (cv.kind === 'segment') return nearestPointOnSegment(p, cv.a, cv.b);
  const u = c.paramOf(p);
  if (!c.closed && (u < c.u0 - 1e-6 || u > c.u1 + 1e-6)) return null;
  return c.at(u);
}

function bboxNear(a: Carrier['bbox'], b: Carrier['bbox'], tol: number): boolean {
  return a.minX - tol <= b.maxX && b.minX - tol <= a.maxX && a.minY - tol <= b.maxY && b.minY - tol <= a.maxY;
}

class UnionFind {
  private parent: number[] = [];
  add(): number {
    this.parent.push(this.parent.length);
    return this.parent.length - 1;
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

interface Piece {
  carrier: Carrier;
  ua: number;
  ub: number;
  va: number;
  vb: number;
  length: number;
  alive: boolean;
}

interface HalfEdge {
  piece: number;
  forward: boolean;
  from: number;
  to: number;
  angle: number;
}

interface Cycle {
  halfEdges: number[];
  polyline: Point[];
  area: number;
  component: number;
}

export interface Arrangement {
  vertices: Point[];
  pieces: Piece[];
  halfEdges: HalfEdge[];
  cycles: Cycle[];
}

export interface RegionResult {
  loops: RegionLoop[];
  /** 輪郭に使われた曲線の持ち主(オブジェクトid) */
  owners: string[];
  area: number;
}

function heStart(pieces: Piece[], he: HalfEdge): number {
  return he.forward ? pieces[he.piece].ua : pieces[he.piece].ub;
}
function heEnd(pieces: Piece[], he: HalfEdge): number {
  return he.forward ? pieces[he.piece].ub : pieces[he.piece].ua;
}

/** 曲線群から平面グラフと全ての面(閉路)を構築する。tol=端点をつなぐ許容距離 */
export function buildArrangement(curves: OwnedCurve[], tol: number): Arrangement {
  const carriers = curves.map(makeCarrier).filter((c): c is Carrier => c !== null);
  const splits: number[][] = carriers.map((c) => [c.u0, c.u1]);

  // 1. 交点で分割点を集める
  for (let i = 0; i < carriers.length; i++) {
    for (let j = i + 1; j < carriers.length; j++) {
      if (!bboxNear(carriers[i].bbox, carriers[j].bbox, tol)) continue;
      for (const p of carrierHits(carriers[i], carriers[j])) {
        splits[i].push(carriers[i].paramOf(p));
        splits[j].push(carriers[j].paramOf(p));
      }
    }
  }

  // 2. 隙間の吸着: 開いた曲線の端点が他曲線の近く(tol以内)にあれば、その位置でも分割する
  for (let i = 0; i < carriers.length; i++) {
    const ci = carriers[i];
    if (ci.closed) continue;
    for (const end of [ci.at(ci.u0), ci.at(ci.u1)]) {
      for (let j = 0; j < carriers.length; j++) {
        if (i === j || !bboxNear(ci.bbox, carriers[j].bbox, tol)) continue;
        const q = nearestOnCarrier(carriers[j], end);
        if (q && distance(q, end) <= tol) splits[j].push(carriers[j].paramOf(q));
      }
    }
  }

  // 3. 分割点で曲線片にする(弧は180°以下に刻む=自己ループやSVGの弧フラグの曖昧さを避ける)
  const rawPieces: { carrier: Carrier; ua: number; ub: number; length: number }[] = [];
  carriers.forEach((c, ci) => {
    const span = c.u1 - c.u0;
    const us = splits[ci]
      .map((u) => Math.max(c.u0, Math.min(c.u1, u)))
      .sort((a, b) => a - b);
    const uniq: number[] = [];
    for (const u of us) {
      if (uniq.length === 0 || ((u - uniq[uniq.length - 1]) / span) * c.length > 1e-6) uniq.push(u);
    }
    for (let k = 0; k + 1 < uniq.length; k++) {
      const a = uniq[k];
      const b = uniq[k + 1];
      const n = c.curve.kind === 'segment' ? 1 : Math.max(1, Math.ceil((b - a) / 179.9));
      for (let m = 0; m < n; m++) {
        const ua = a + ((b - a) * m) / n;
        const ub = a + ((b - a) * (m + 1)) / n;
        rawPieces.push({ carrier: c, ua, ub, length: ((ub - ua) / span) * c.length });
      }
    }
  });

  // 4. 端点を tol でクラスタリングして頂点にする(グリッドハッシュで近傍だけ比較)
  const uf = new UnionFind();
  const pts: Point[] = [];
  const grid = new Map<string, number[]>();
  const cell = Math.max(tol, 1e-6);
  const addPoint = (p: Point): number => {
    const id = uf.add();
    pts.push(p);
    const gx = Math.floor(p.x / cell);
    const gy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (distance(pts[other], p) <= tol) uf.union(other, id);
        }
      }
    }
    const key = `${gx},${gy}`;
    const list = grid.get(key);
    if (list) list.push(id);
    else grid.set(key, [id]);
    return id;
  };
  const endpointIds = rawPieces.map((rp) => [addPoint(rp.carrier.at(rp.ua)), addPoint(rp.carrier.at(rp.ub))]);
  const rootToVertex = new Map<number, number>();
  const sums: { x: number; y: number; n: number }[] = [];
  const vertexOf = (id: number): number => {
    const r = uf.find(id);
    let v = rootToVertex.get(r);
    if (v === undefined) {
      v = sums.length;
      rootToVertex.set(r, v);
      sums.push({ x: 0, y: 0, n: 0 });
    }
    return v;
  };
  pts.forEach((p, id) => {
    const s = sums[vertexOf(id)];
    s.x += p.x;
    s.y += p.y;
    s.n += 1;
  });
  const vertices = sums.map((s) => ({ x: s.x / s.n, y: s.y / s.n }));

  const pieces: Piece[] = rawPieces.map((rp, k) => ({
    ...rp,
    va: vertexOf(endpointIds[k][0]),
    vb: vertexOf(endpointIds[k][1]),
    alive: true,
  }));

  // 5. 縮退(両端が同じ頂点)・重複(同じ頂点対で中点も一致=重なった辺)を除く
  const seen = new Map<string, Point[]>();
  for (const pc of pieces) {
    if (pc.va === pc.vb) {
      pc.alive = false;
      continue;
    }
    const key = pc.va < pc.vb ? `${pc.va}-${pc.vb}` : `${pc.vb}-${pc.va}`;
    const mid = pc.carrier.at((pc.ua + pc.ub) / 2);
    const mids = seen.get(key) ?? [];
    if (mids.some((m) => distance(m, mid) <= tol)) {
      pc.alive = false;
      continue;
    }
    mids.push(mid);
    seen.set(key, mids);
  }

  // 6. 行き止まりの枝を刈る(次数1の頂点につながる片を繰り返し除去)
  const degree = new Array<number>(vertices.length).fill(0);
  const incident: number[][] = vertices.map(() => []);
  pieces.forEach((pc, k) => {
    if (!pc.alive) return;
    degree[pc.va]++;
    degree[pc.vb]++;
    incident[pc.va].push(k);
    incident[pc.vb].push(k);
  });
  const queue = degree.map((d, v) => (d === 1 ? v : -1)).filter((v) => v >= 0);
  while (queue.length > 0) {
    const v = queue.pop()!;
    if (degree[v] !== 1) continue;
    const k = incident[v].find((idx) => pieces[idx].alive);
    if (k === undefined) continue;
    const pc = pieces[k];
    pc.alive = false;
    degree[pc.va]--;
    degree[pc.vb]--;
    const other = pc.va === v ? pc.vb : pc.va;
    if (degree[other] === 1) queue.push(other);
  }

  // 7. 半辺と、各頂点での出ていく向きの順序
  const halfEdges: HalfEdge[] = [];
  const outgoing: number[][] = vertices.map(() => []);
  const twinOf: number[] = [];
  pieces.forEach((pc, k) => {
    if (!pc.alive) return;
    for (const forward of [true, false]) {
      const u = forward ? pc.ua : pc.ub;
      const t = pc.carrier.tangent(u);
      const dir = forward ? t : { x: -t.x, y: -t.y };
      const he: HalfEdge = {
        piece: k,
        forward,
        from: forward ? pc.va : pc.vb,
        to: forward ? pc.vb : pc.va,
        // 丸めてから正規化(水平右向きが 359.9999… と 0 に割れて順序が逆転しないよう)
        angle: normalizeAngle360(Math.round(angleOfVector(dir) * 1e6) / 1e6),
      };
      halfEdges.push(he);
      outgoing[he.from].push(halfEdges.length - 1);
    }
    twinOf[halfEdges.length - 2] = halfEdges.length - 1;
    twinOf[halfEdges.length - 1] = halfEdges.length - 2;
  });

  // 同じ接線方向(接する曲線どうし)は、少し進んだ点の向きで順序を決める
  const sampleAngle = (he: HalfEdge, arcLen: number): number => {
    const pc = pieces[he.piece];
    const s = heStart(pieces, he);
    const e = heEnd(pieces, he);
    const p = pc.carrier.at(s + ((e - s) * Math.min(0.5, arcLen / pc.length)));
    const v = vertices[he.from];
    // 接線方向からのずれ(時計回り=正)
    return normalizeAngle180(angleOfVector({ x: p.x - v.x, y: p.y - v.y }) - he.angle);
  };
  for (const list of outgoing) {
    list.sort((ia, ib) => {
      const a = halfEdges[ia];
      const b = halfEdges[ib];
      if (Math.abs(normalizeAngle180(a.angle - b.angle)) > 1e-4) return a.angle - b.angle;
      const len = Math.min(pieces[a.piece].length, pieces[b.piece].length) * 0.2;
      return sampleAngle(a, len) - sampleAngle(b, len);
    });
  }
  const position = new Map<number, number>();
  for (const list of outgoing) list.forEach((he, i) => position.set(he, i));

  // 8. 面を辿る: 頂点vへ半辺で着いたら、戻り向き(twin)の1つ手前(角度の減る側=最も鋭い右折)へ進む。
  //    y下向き座標でこの規則だと有界な面は符号付き面積が正、各連結成分の外周は負になる
  const compUf = new UnionFind();
  vertices.forEach(() => compUf.add());
  for (const pc of pieces) if (pc.alive) compUf.union(pc.va, pc.vb);

  const cycles: Cycle[] = [];
  const visited = new Array<boolean>(halfEdges.length).fill(false);
  for (let h0 = 0; h0 < halfEdges.length; h0++) {
    if (visited[h0]) continue;
    const cycle: number[] = [];
    let h = h0;
    let guard = 0;
    while (!visited[h] && guard++ <= halfEdges.length) {
      visited[h] = true;
      cycle.push(h);
      const twin = twinOf[h];
      const list = outgoing[halfEdges[h].to];
      h = list[(position.get(twin)! - 1 + list.length) % list.length];
    }
    if (h !== h0) continue; // 閉じない(数値的な不整合)は捨てる
    const polyline = cyclePolyline(cycle, halfEdges, pieces, vertices);
    cycles.push({
      halfEdges: cycle,
      polyline,
      area: signedArea(polyline),
      component: compUf.find(halfEdges[h0].from),
    });
  }

  return { vertices, pieces, halfEdges, cycles };
}

function cyclePolyline(cycle: number[], halfEdges: HalfEdge[], pieces: Piece[], vertices: Point[]): Point[] {
  const out: Point[] = [];
  for (const h of cycle) {
    const he = halfEdges[h];
    const pc = pieces[he.piece];
    out.push(vertices[he.from]);
    if (pc.carrier.curve.kind !== 'segment') {
      const s = heStart(pieces, he);
      const e = heEnd(pieces, he);
      const n = Math.max(1, Math.ceil(Math.abs(e - s) / 3));
      for (let i = 1; i < n; i++) out.push(pc.carrier.at(s + ((e - s) * i) / n));
    }
  }
  return out;
}

function signedArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** 偶奇規則の点の内外判定 */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function cycleToLoop(cycle: Cycle, arr: Arrangement): RegionLoop {
  const { halfEdges, pieces, vertices } = arr;
  const first = halfEdges[cycle.halfEdges[0]];
  const edges: RegionEdge[] = cycle.halfEdges.map((h): RegionEdge => {
    const he = halfEdges[h];
    const to = vertices[he.to];
    const cv = pieces[he.piece].carrier.curve;
    if (cv.kind === 'segment') return { kind: 'line', to };
    const rx = cv.kind === 'circle' ? cv.radius : cv.radiusX;
    const ry = cv.kind === 'circle' ? cv.radius : cv.radiusY;
    return {
      kind: 'arc',
      to,
      cx: cv.center.x,
      cy: cv.center.y,
      rx,
      ry,
      rotation: cv.rotation,
      t0: heStart(pieces, he),
      t1: heEnd(pieces, he),
    };
  });
  return { start: vertices[first.from], edges };
}

/**
 * 点pを囲む領域。p を含む最小の有界面を外周とし、その内側にある別成分の外周を穴にする。
 * 閉じた領域が無い(外側をクリック・隙間がある)ときは null。
 */
export function regionAt(arr: Arrangement, p: Point): RegionResult | null {
  const EPS = 1e-6;
  let face: Cycle | null = null;
  for (const c of arr.cycles) {
    if (c.area <= EPS || !pointInPolygon(p, c.polyline)) continue;
    if (!face || c.area < face.area) face = c;
  }
  if (!face) return null;
  const outer = face;

  const candidates = arr.cycles.filter(
    (c) =>
      c.area < -EPS &&
      c.component !== outer.component &&
      pointInPolygon(c.polyline[0], outer.polyline) &&
      !pointInPolygon(p, c.polyline),
  );
  // 穴の中の穴(さらに内側の成分)はこの領域に関係しないので、最も外側の穴だけ残す
  const holes = candidates.filter(
    (h) => !candidates.some((o) => o !== h && -o.area > -h.area && pointInPolygon(h.polyline[0], o.polyline)),
  );

  const used = [outer, ...holes];
  const owners = new Set<string>();
  for (const c of used) for (const h of c.halfEdges) owners.add(arr.pieces[arr.halfEdges[h].piece].carrier.owner);
  return {
    loops: used.map((c) => cycleToLoop(c, arr)),
    owners: [...owners],
    area: outer.area + holes.reduce((s, h) => s + h.area, 0),
  };
}
