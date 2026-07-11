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
