import { rotateVec } from './geometry';
import type { Point, Rect } from './types';

/**
 * 塗り領域の輪郭を構成する1辺。始点は直前の辺の終点(ループ先頭は RegionLoop.start)。
 * - line … 直線
 * - arc … 楕円(円は rx=ry)上の媒介変数 t0→t1(度)の弧。
 *   点 = (cx,cy) + rotateVec((rx·cos t, ry·sin t), rotation)。t1<t0 なら逆向きに辿る
 */
export type RegionEdge =
  | { kind: 'line'; to: Point }
  | {
      kind: 'arc';
      to: Point;
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotation: number;
      t0: number;
      t1: number;
    };

/** 閉じた輪郭1本。外周と穴を区別せず、描画は evenodd で穴をくり抜く */
export interface RegionLoop {
  start: Point;
  edges: RegionEdge[];
}

const DEG = Math.PI / 180;

export function arcEdgePoint(e: Extract<RegionEdge, { kind: 'arc' }>, t: number): Point {
  const v = rotateVec({ x: e.rx * Math.cos(t * DEG), y: e.ry * Math.sin(t * DEG) }, e.rotation);
  return { x: e.cx + v.x, y: e.cy + v.y };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '0';
}

/** SVGパス(M…L/A…Z をループ数ぶん)。fill-rule="evenodd" で描くこと */
export function regionPathData(loops: RegionLoop[]): string {
  const parts: string[] = [];
  for (const loop of loops) {
    parts.push(`M ${fmt(loop.start.x)} ${fmt(loop.start.y)}`);
    for (const e of loop.edges) {
      if (e.kind === 'line') {
        parts.push(`L ${fmt(e.to.x)} ${fmt(e.to.y)}`);
      } else {
        const delta = e.t1 - e.t0;
        // y下向き座標系では媒介変数の増加方向=時計回り=sweep-flag 1
        const large = Math.abs(delta) > 180 ? 1 : 0;
        const sweep = delta > 0 ? 1 : 0;
        parts.push(`A ${fmt(e.rx)} ${fmt(e.ry)} ${fmt(e.rotation)} ${large} ${sweep} ${fmt(e.to.x)} ${fmt(e.to.y)}`);
      }
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

/** ループを折れ線で近似した点列(終点=始点は含まない)。弧は stepDeg 刻み */
export function loopPolyline(loop: RegionLoop, stepDeg = 5): Point[] {
  const pts: Point[] = [loop.start];
  for (const e of loop.edges) {
    if (e.kind === 'arc') {
      const n = Math.max(1, Math.ceil(Math.abs(e.t1 - e.t0) / stepDeg));
      for (let i = 1; i < n; i++) pts.push(arcEdgePoint(e, e.t0 + ((e.t1 - e.t0) * i) / n));
    }
    pts.push(e.to);
  }
  pts.pop(); // 閉じた終点(=始点)
  return pts;
}

export function regionBounds(loops: RegionLoop[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    for (const p of loopPolyline(loop, 2)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 全点を (dx,dy) 平行移動し、原点まわりに f 倍する(p' = (p+d)·f) */
export function mapRegion(loops: RegionLoop[], dx: number, dy: number, f = 1): RegionLoop[] {
  const mp = (p: Point): Point => ({ x: (p.x + dx) * f, y: (p.y + dy) * f });
  return loops.map((loop) => ({
    start: mp(loop.start),
    edges: loop.edges.map((e): RegionEdge => {
      if (e.kind === 'line') return { kind: 'line', to: mp(e.to) };
      const c = mp({ x: e.cx, y: e.cy });
      return { ...e, to: mp(e.to), cx: c.x, cy: c.y, rx: e.rx * f, ry: e.ry * f };
    }),
  }));
}
