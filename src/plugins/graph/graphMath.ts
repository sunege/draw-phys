import type { Point } from '../../core/types';
import type { GraphRange } from './graphTypes';

/**
 * グラフの座標変換の文脈: 表示範囲(グラフ座標)+箱サイズ(ローカルpx)。
 * ローカルpxは原点=箱中心・y下向き、グラフ座標はy上向き。
 */
export interface GraphView extends GraphRange {
  width: number;
  height: number;
}

/** 表示範囲の妥当性(有限かつ min < max) */
export function isValidRange(r: GraphRange): boolean {
  return (
    Number.isFinite(r.xMin) &&
    Number.isFinite(r.xMax) &&
    Number.isFinite(r.yMin) &&
    Number.isFinite(r.yMax) &&
    r.xMin < r.xMax &&
    r.yMin < r.yMax
  );
}

/** 目盛りの自動刻み(1-2-5系列)。span を targetTicks 分割程度にする値 */
export function niceStep(span: number, targetTicks = 6): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / mag;
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * mag;
}

/**
 * [min,max] 内の目盛り値(0を位相基準に step 刻み)。境界は誤差εで包含判定。
 * 極端な指定で本数が暴走しないよう1000本を超える場合は空を返す。
 */
export function tickValues(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max > min)) return [];
  const eps = step * 1e-6;
  const start = Math.ceil((min - eps) / step);
  const end = Math.floor((max + eps) / step);
  if (end - start > 1000) return [];
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i * step + 0); // +0 で -0 を回避
  return out;
}

/** グラフ座標→ローカルpx(y反転) */
export function graphToLocal(p: Point, v: GraphView): Point {
  return {
    x: ((p.x - v.xMin) / (v.xMax - v.xMin) - 0.5) * v.width,
    y: (0.5 - (p.y - v.yMin) / (v.yMax - v.yMin)) * v.height,
  };
}

/** ローカルpx→グラフ座標(graphToLocal の逆) */
export function localToGraph(p: Point, v: GraphView): Point {
  return {
    x: v.xMin + (p.x / v.width + 0.5) * (v.xMax - v.xMin),
    y: v.yMin + (0.5 - p.y / v.height) * (v.yMax - v.yMin),
  };
}

/**
 * 軸のローカルpx位置。0 が表示範囲外のときは最寄りの辺へクランプする
 * (clamped フラグで判別。クランプ時は原点Oを表示しない等に使う)。
 */
export function axisPositions(v: GraphView): {
  /** x軸(横線)のローカルy */
  xAxisY: number;
  /** y軸(縦線)のローカルx */
  yAxisX: number;
  xClamped: boolean;
  yClamped: boolean;
} {
  const o = graphToLocal({ x: 0, y: 0 }, v);
  const hw = v.width / 2;
  const hh = v.height / 2;
  const xAxisY = Math.max(-hh, Math.min(hh, o.y));
  const yAxisX = Math.max(-hw, Math.min(hw, o.x));
  return { xAxisY, yAxisX, xClamped: xAxisY !== o.y, yClamped: yAxisX !== o.x };
}

/** 原点(軸の交点)のローカル位置(箱内へクランプ済み)。原点ハンドル表示に使う */
export function originLocal(v: GraphView): Point {
  const a = axisPositions(v);
  return { x: a.yAxisX, y: a.xAxisY };
}

/** 刻みから目盛り数値の小数桁を推定(0.5→1, 0.25→2, 5→0) */
export function decimalsForStep(step: number): number {
  for (let d = 0; d <= 6; d++) {
    const scaled = step * Math.pow(10, d);
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d;
  }
  return 6;
}

/** 目盛り数値の表示文字列。decimals < 0 は刻みから自動。-0 は 0 に寄せる */
export function formatTick(value: number, step: number, decimals: number): string {
  const d = decimals >= 0 ? decimals : decimalsForStep(step);
  const s = value.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
}

/**
 * 関数を幅方向に約2px間隔でサンプリングし、ローカルpxのポリライン群を返す。
 * 非有限値・急峻なジャンプ(|Δy| > 箱高さ×2)で線を分割し、tan 等の縦線を防ぐ。
 * y はSVG座標の暴走を防ぐため箱高さの±5倍へクランプする。
 */
export function sampleFunction(
  fn: (x: number) => number,
  v: GraphView,
  domain?: { min: number; max: number } | null,
): Point[][] {
  const x0 = Math.max(v.xMin, domain?.min ?? -Infinity);
  const x1 = Math.min(v.xMax, domain?.max ?? Infinity);
  if (!(x1 > x0)) return [];
  const widthPx = (v.width * (x1 - x0)) / (v.xMax - v.xMin);
  const n = Math.max(2, Math.ceil(widthPx / 2));
  const yLimit = v.height * 5;
  const jump = v.height * 2;
  const lines: Point[][] = [];
  let cur: Point[] = [];
  let prevY: number | null = null;
  for (let i = 0; i <= n; i++) {
    const gx = x0 + ((x1 - x0) * i) / n;
    const gy = fn(gx);
    if (!Number.isFinite(gy)) {
      if (cur.length >= 2) lines.push(cur);
      cur = [];
      prevY = null;
      continue;
    }
    const p = graphToLocal({ x: gx, y: gy }, v);
    const py = Math.max(-yLimit, Math.min(yLimit, p.y));
    if (prevY !== null && Math.abs(py - prevY) > jump) {
      if (cur.length >= 2) lines.push(cur);
      cur = [];
    }
    cur.push({ x: p.x, y: py });
    prevY = py;
  }
  if (cur.length >= 2) lines.push(cur);
  return lines;
}

/** 最小二乗の一次直線 y=ax+b。点が2個未満・x が全て同値なら null */
export function fitLinear(pts: Point[]): { a: number; b: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const a = (n * sxy - sx * sy) / denom;
  return { a, b: (sy - a * sx) / n };
}

/** 原点を通る比例直線 y=ax(物理実験で頻出)。Σx²=0 なら null */
export function fitProportional(pts: Point[]): { a: number } | null {
  if (pts.length < 1) return null;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  if (sxx < 1e-12) return null;
  return { a: sxy / sxx };
}

/** 近似直線の式表示("y = 1.23x + 0.45" / "y = 1.23x") */
export function formatFitEquation(fit: { a: number; b?: number }, decimals: number): string {
  const a = fit.a.toFixed(decimals);
  if (fit.b === undefined) return `y = ${a}x`;
  const sign = fit.b < 0 ? '−' : '+';
  return `y = ${a}x ${sign} ${Math.abs(fit.b).toFixed(decimals)}`;
}

/**
 * 散布図データのテキスト(1行1点、タブ/カンマ/空白区切り)を点列へ。
 * Excel/スプレッドシートからの貼り付け(TSV)に対応。
 * 数値2個が取れない行はスキップとして数える(空行は無視)。
 */
export function parseScatterText(text: string): { points: Point[]; skipped: number } {
  const points: Point[] = [];
  let skipped = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    const parts = line.split(/[\s,]+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      points.push({ x: parts[0], y: parts[1] });
    } else {
      skipped++;
    }
  }
  return { points, skipped };
}

/** 点列→テキスト(1行 "x\ty") */
export function scatterToText(points: Point[]): string {
  return points.map((p) => `${p.x}\t${p.y}`).join('\n');
}

/**
 * ローカル矩形(対角2点)から新しい表示範囲を求める(矩形ズーム)。
 * どちらかのスパンが現範囲の 1e-6 未満(実質クリック)なら null。
 */
export function zoomRangeToLocalRect(v: GraphView, a: Point, b: Point): GraphRange | null {
  const ga = localToGraph(a, v);
  const gb = localToGraph(b, v);
  const xMin = Math.min(ga.x, gb.x);
  const xMax = Math.max(ga.x, gb.x);
  const yMin = Math.min(ga.y, gb.y);
  const yMax = Math.max(ga.y, gb.y);
  if (xMax - xMin < (v.xMax - v.xMin) * 1e-6) return null;
  if (yMax - yMin < (v.yMax - v.yMin) * 1e-6) return null;
  return { xMin, xMax, yMin, yMax };
}

/**
 * 原点ドラッグによるパン: 原点の表示位置がローカルpxで d だけ動くよう、
 * 表示範囲を逆方向へシフトした新しい範囲を返す(スパンは不変)。
 */
export function panRangeByLocalDelta(
  r: GraphRange,
  d: Point,
  size: { width: number; height: number },
): GraphRange {
  const dx = (-d.x * (r.xMax - r.xMin)) / size.width;
  const dy = (d.y * (r.yMax - r.yMin)) / size.height;
  return { xMin: r.xMin + dx, xMax: r.xMax + dx, yMin: r.yMin + dy, yMax: r.yMax + dy };
}
