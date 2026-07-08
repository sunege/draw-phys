import type { Point } from '../../core/types';

/**
 * 電磁気の回路記号(2端子インライン系)の純粋幾何。
 * すべてローカル座標(原点=中心・x軸方向)。React/SVG非依存。
 * 総長 length の中央に本体(幅 bodyLength)を置き、左右にリード導線を伸ばす。
 */

/** 本体の半幅(length を超えないようクランプ) */
export function bodyHalf(length: number, bodyLength: number): number {
  return Math.min(bodyLength, length) / 2;
}

/** 左右のリード導線(端点 ±length/2 と本体端 ±bodyHalf を結ぶ) */
export function leadLines(
  length: number,
  bodyLength: number,
): { left: [Point, Point]; right: [Point, Point] } {
  const half = length / 2;
  const bh = bodyHalf(length, bodyLength);
  return {
    left: [
      { x: -half, y: 0 },
      { x: -bh, y: 0 },
    ],
    right: [
      { x: bh, y: 0 },
      { x: half, y: 0 },
    ],
  };
}

/**
 * 抵抗(ギザギザ/米国式)のパス。bodyLength 内でジグザグ、振幅 height/2。
 * 両端は y=0 に戻り、リード導線と連続する。
 */
export function resistorZigzagPath(bodyLength: number, height: number): string {
  const half = bodyLength / 2;
  const amp = height / 2;
  const n = 6; // ジグの折れ点数
  const seg = bodyLength / n;
  const parts = [`M ${-half} 0`];
  for (let i = 0; i < n; i++) {
    const x = -half + seg * (i + 0.5);
    const y = i % 2 === 0 ? -amp : amp;
    parts.push(`L ${round(x)} ${round(y)}`);
  }
  parts.push(`L ${half} 0`);
  return parts.join(' ');
}

/**
 * コイル(半円のこぶ列)のパス。bodyLength を loops 個の半円で埋める。
 * こぶは上向き(負のy)。両端は y=0。
 */
export function coilLoopsPath(bodyLength: number, loops: number): string {
  const n = Math.max(1, Math.round(loops));
  const half = bodyLength / 2;
  const d = bodyLength / n;
  const r = d / 2;
  const parts = [`M ${-half} 0`];
  for (let i = 0; i < n; i++) {
    const x2 = -half + d * (i + 1);
    // y下向き座標系。sweep=1 で上向き(負y)のこぶを描く
    parts.push(`A ${round(r)} ${round(r)} 0 0 1 ${round(x2)} 0`);
  }
  return parts.join(' ');
}

/** コンデンサの2枚極板。原点対称に leftX / rightX、半高 halfH */
export function capacitorPlates(
  gap: number,
  plateHeight: number,
): { leftX: number; rightX: number; halfH: number } {
  return { leftX: -gap / 2, rightX: gap / 2, halfH: plateHeight / 2 };
}

/** 起電力/電池の極板(長=正極 / 短=負極)。原点対称に並ぶ */
export interface BatteryPlate {
  x: number;
  /** 極板の半高 */
  halfH: number;
  /** 短い負極(太線)なら true */
  short: boolean;
}

/**
 * 電池セル列。cellCount 個のセルを並べる(各セル=長線+短線の2枚)。
 * ピッチ pitch で等間隔、原点対称に配置。
 */
export function batteryCells(
  cellCount: number,
  longHalf: number,
  shortHalf: number,
  pitch: number,
): BatteryPlate[] {
  const n = Math.max(1, Math.round(cellCount));
  const count = 2 * n;
  const totalWidth = (count - 1) * pitch;
  const start = -totalWidth / 2;
  const plates: BatteryPlate[] = [];
  for (let i = 0; i < count; i++) {
    const short = i % 2 === 1; // 偶数=長(正) / 奇数=短(負)
    plates.push({
      x: start + i * pitch,
      halfH: short ? shortHalf : longHalf,
      short,
    });
  }
  return plates;
}

/** 電池セル列の本体半幅(端の極板まで) */
export function batteryBodyHalf(cellCount: number, pitch: number): number {
  const count = 2 * Math.max(1, Math.round(cellCount));
  return ((count - 1) * pitch) / 2;
}

/** 交流電源の円内の正弦波(1周期)の点列 */
export function acSinePoints(radius: number): Point[] {
  const w = radius * 0.6;
  const amp = radius * 0.5;
  const steps = 16;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ x: -w + 2 * w * t, y: -amp * Math.sin(2 * Math.PI * t) });
  }
  return pts;
}

/** 点列を SVG polyline/path の点文字列へ */
export function pointsAttr(pts: Point[]): string {
  return pts.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
}

/** ダイオード(三角形+バー)。reversed で向き反転 */
export function diodeShape(
  bodyLength: number,
  height: number,
  reversed: boolean,
): { triangle: Point[]; barX: number; halfH: number } {
  const bh = bodyLength / 2;
  const hh = height / 2;
  const dir = reversed ? -1 : 1;
  const triangle = [
    { x: -dir * bh, y: -hh },
    { x: -dir * bh, y: hh },
    { x: dir * bh, y: 0 },
  ];
  return { triangle, barX: dir * bh, halfH: hh };
}

/** 接地(アース)の横線列。上から下へ幅が単調減少する */
export interface GroundLine {
  y: number;
  halfW: number;
}

export function earthLines(width: number, count: number, gap: number): GroundLine[] {
  const n = Math.max(1, count);
  const lines: GroundLine[] = [];
  for (let i = 0; i < n; i++) {
    const frac = 1 - i / n;
    lines.push({ y: i * gap, halfW: (width * frac) / 2 });
  }
  return lines;
}

/** 小数を丸めてパス文字列を短くする */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
