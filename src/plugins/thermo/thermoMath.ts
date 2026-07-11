import type { Point, Rect } from '../../core/types';

/**
 * シリンダー壁のパス(ローカル座標、原点=内腔の中心)。
 * 内腔は x∈[-L/2, L/2]・y∈[±bore/2]、左端(-x)が閉端・右端(+x)が開口。
 * 外周→内周を一筆で辿る閉パスで、塗りつぶすと「コの字」の壁になる。
 */
export function cylinderWallPath(length: number, bore: number, wallThickness: number): string {
  const hl = length / 2;
  const hb = bore / 2;
  const wt = wallThickness;
  return [
    `M ${hl} ${-hb - wt}`,
    `L ${-hl - wt} ${-hb - wt}`,
    `L ${-hl - wt} ${hb + wt}`,
    `L ${hl} ${hb + wt}`,
    `L ${hl} ${hb}`,
    `L ${-hl} ${hb}`,
    `L ${-hl} ${-hb}`,
    `L ${hl} ${-hb}`,
    'Z',
  ].join(' ');
}

/** ピストン位置(閉端からピストン左面までの距離)を内腔に収まる範囲へクランプ */
export function pistonClamp(pistonPos: number, length: number, pistonThickness: number): number {
  return Math.min(Math.max(pistonPos, 0), Math.max(length - pistonThickness, 0));
}

export interface Molecule {
  x: number;
  y: number;
  /** 速度の向き(度、0=+x・画面時計回り正) */
  angle: number;
}

/** 決定的な乱数(mulberry32)。seedが同じなら常に同じ配置になる */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 気体分子の配置(ローカル座標、原点=領域中心)。seedから決定的に生成し、
 * margin だけ内側の領域に、互いに radius×3 以上離して置く(混みすぎたら妥協)。
 */
export function gasMoleculeLayout(
  width: number,
  height: number,
  count: number,
  radius: number,
  seed: number,
  margin: number,
): Molecule[] {
  const rand = mulberry32(Math.floor(seed) || 1);
  const w = Math.max(width - margin * 2, 1);
  const h = Math.max(height - margin * 2, 1);
  const minDist = radius * 3;
  const molecules: Molecule[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = (rand() - 0.5) * w;
      y = (rand() - 0.5) * h;
      const ok = molecules.every((m) => Math.hypot(m.x - x, m.y - y) >= minDist);
      if (ok) break;
    }
    molecules.push({ x, y, angle: rand() * 360 });
  }
  return molecules;
}

/**
 * 炎の輪郭パス(ローカル座標、原点=中心)。上が尖り、下が丸い涙滴形。
 */
export function flamePath(width: number, height: number): string {
  const hw = width / 2;
  const hh = height / 2;
  return [
    `M 0 ${-hh}`,
    `C ${hw * 0.35} ${-hh * 0.45} ${hw} ${-hh * 0.05} ${hw} ${hh * 0.35}`,
    `A ${hw} ${hh * 0.65} 0 0 1 ${-hw} ${hh * 0.35}`,
    `C ${-hw} ${-hh * 0.05} ${-hw * 0.35} ${-hh * 0.45} 0 ${-hh}`,
    'Z',
  ].join(' ');
}

export interface ThermometerLayout {
  /** 全体の高さ(管+球部) */
  totalHeight: number;
  /** 球部の中心(ローカル) */
  bulbCenter: Point;
  /** 管の外形 */
  tube: Rect;
  /** 液柱(level=0で高さ0、1で管上端近くまで) */
  liquid: Rect;
  /** 目盛りのy位置 */
  ticksY: number[];
}

/** 温度計のローカルレイアウト。管を上(-y)・球部を下(+y)に置く */
export function thermometerLayout(
  stemLength: number,
  bulbRadius: number,
  tubeWidth: number,
  level: number,
  tickCount: number,
): ThermometerLayout {
  const totalHeight = stemLength + bulbRadius * 2;
  const top = -totalHeight / 2;
  const bulbCenterY = totalHeight / 2 - bulbRadius;
  const clamped = Math.min(Math.max(level, 0), 1);
  // 液柱の可動範囲: 球部の中心から管の上端近く(丸み分を残す)まで
  const liquidTopMax = top + tubeWidth;
  const liquidTop = bulbCenterY - clamped * (bulbCenterY - liquidTopMax);
  const lw = tubeWidth * 0.6;
  const ticksY: number[] = [];
  const tickTop = liquidTopMax;
  const tickBottom = bulbCenterY - bulbRadius - tubeWidth * 0.5;
  for (let i = 0; i < tickCount; i++) {
    const t = tickCount === 1 ? 0.5 : i / (tickCount - 1);
    ticksY.push(tickTop + t * (tickBottom - tickTop));
  }
  return {
    totalHeight,
    bulbCenter: { x: 0, y: bulbCenterY },
    tube: { x: -tubeWidth / 2, y: top, width: tubeWidth, height: bulbCenterY - top },
    liquid: { x: -lw / 2, y: liquidTop, width: lw, height: bulbCenterY - liquidTop },
    ticksY,
  };
}
