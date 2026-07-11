import type { Point } from '../../core/types';

const TAU = Math.PI * 2;

/**
 * 正弦波のポリライン点列(ローカル座標、x軸=進行方向・原点=中心)。
 * 左端(x=-length/2)を位相の起点とし、位相0では左端から画面上向き(-y)へ変位する。
 */
export function sineWavePoints(
  length: number,
  amplitude: number,
  wavelength: number,
  phaseDeg: number,
  step = 2,
): Point[] {
  const half = length / 2;
  const phase = phaseDeg * (Math.PI / 180);
  const n = Math.max(2, Math.ceil(length / step));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -half + (length * i) / n;
    pts.push({ x, y: -amplitude * Math.sin((TAU * (x + half)) / wavelength + phase) });
  }
  return pts;
}

/** 波面(山/谷)1本の情報。円形波・平面波で共有する */
export interface WaveFrontLine {
  /** 波面の位置。円形波=半径 / 平面波=伝搬方向の符号付き位置 */
  offset: number;
  /** true=山(実線) / false=谷(破線) */
  crest: boolean;
}

/**
 * 波源から放射される波面の位置と山/谷を返す(円形波・平面波で共有)。
 * 位相を「時間発展」とみなし、波面が波源(base)から生まれて外(leading edge)へ伝搬する。
 *
 * - base = 波源の位置(円形波=波源半径、平面波=波源のある端)。
 * - spacing = 隣り合う波面の間隔。alternate時は山→谷の半波長ぶん(2本で1波長)。
 * - phaseDeg(0〜360)= 時間。位相を進めると全波面が外へ frac ぶん進み、1本ぶん進むごとに
 *   波源から新しい波面が生まれる(先頭は外縁 base+(count-1)*spacing を超えると消える)。
 * - alternate=false のときは全て山(実線扱い、crest=true)。
 *
 * 山/谷は各波面に固定した識別番号(n+emerged)の偶奇で決めるため、波面が伝搬しても
 * 実線↔破線は入れ替わらない(波源で新たに生まれる波面だけが交互に山/谷になる)。
 */
export function waveFrontLines(
  base: number,
  spacing: number,
  phaseDeg: number,
  alternate: boolean,
  count: number,
): WaveFrontLine[] {
  const out: WaveFrontLine[] = [];
  if (spacing <= 0 || count < 1) return out;
  const periodLines = alternate ? 2 : 1;
  // 位相を「線間隔」単位の連続オフセットへ換算(360°で periodLines 本ぶん進む)
  const shift = ((((phaseDeg % 360) + 360) % 360) / 360) * periodLines;
  // emerged = 波源から追加で生まれた波面の本数(整数)、frac = 端数の進み
  const emerged = Math.floor(shift);
  const frac = shift - emerged;
  const maxOffset = base + (count - 1) * spacing; // 先頭波面が消える外縁
  for (let n = 0; n <= count; n++) {
    const offset = base + (n + frac) * spacing;
    if (offset > maxOffset + 1e-6) break; // 外縁を越えた波面は消える
    // 識別番号 n+emerged の偶奇で山/谷を固定(伝搬しても入れ替わらない)
    out.push({ offset, crest: !alternate || (n + emerged) % 2 === 0 });
  }
  return out;
}

/**
 * 変位0(節)のローカルx位置。定常波の節への目印・スナップに使う。
 * 2π(x+L/2)/λ + φ = kπ ⇔ x = -L/2 + λ(k/2 - φdeg/360)
 */
export function waveNodePositions(
  length: number,
  wavelength: number,
  phaseDeg: number,
): number[] {
  const half = length / 2;
  const kStart = Math.ceil(phaseDeg / 180 - 1e-9);
  const kEnd = Math.floor(phaseDeg / 180 + (2 * length) / wavelength + 1e-9);
  const xs: number[] = [];
  for (let k = kStart; k <= kEnd; k++) {
    const x = -half + wavelength * (k / 2 - phaseDeg / 360);
    if (x >= -half - 1e-6 && x <= half + 1e-6) xs.push(x);
  }
  return xs;
}
