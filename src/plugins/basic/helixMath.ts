import type { Point } from '../../core/types';

/**
 * らせん(ヘリックス)の形状パラメータ。ローカル座標=原点中心、x=軸方向(右)、y下向き。
 * 3Dのらせんを「軸まわりにわずかに回した(斜めから見た)」斜投影で2Dへ落とす。
 * - 縦(y)は輪の全高 2*radius をそのまま見せる
 * - 横(x)は軸方向の前進 a(φ) に、奥行き成分 radiusX*sin(φ) を足す(=各輪が楕円に見える)
 * radiusX が大きいほど「開いた(正面寄り)」、小さいほど「閉じた(真横寄り)」見え方になる。
 */
export interface HelixShape {
  /** 軸方向の全長 */
  length: number;
  /** 縦方向の輪の半径(見かけの高さの半分) */
  radius: number;
  /** 横方向の輪の半径(斜めから見た開き具合=奥行きの見かけ幅) */
  radiusX: number;
  /** 巻き数 */
  turns: number;
  /** 巻き方向(手性)を反転する */
  flip?: boolean;
  /** 始点の位相角(度)。0=輪の頂点、90=手前へ張り出し、180=輪の底。他図形との接続位置合わせ用 */
  startAngle?: number;
  /** 終点の位相角(度)。turns 巻き後の頂点(0)からのずれ */
  endAngle?: number;
}

/** 1巻きあたりのサンプル数。偶数=前後の切替(sinφ=0)が必ずサンプル点に一致する */
const SAMPLES_PER_TURN = 48;

/**
 * らせんが辿る位相 φ の範囲 [start, end]。
 * start = 始点の角度、end = turns 巻き分 + 終点の角度。
 * 角度で指定した分だけ螺旋が伸縮する(範囲は正規化せずそのまま使い、ピッチは一定に保つ)。
 * 角度指定で start/end が接近/逆転しても最低半周(π)は確保して破綻を防ぐ。
 */
export function helixPhaseRange(shape: HelixShape): { start: number; end: number } {
  const turns = Math.max(1, Math.round(shape.turns));
  const start = ((shape.startAngle ?? 0) * Math.PI) / 180;
  const end = 2 * Math.PI * turns + ((shape.endAngle ?? 0) * Math.PI) / 180;
  return end - start < Math.PI ? { start, end: start + Math.PI } : { start, end };
}

/** 1巻きあたりの軸方向の進み(ピッチ)。length/turns で決まり、角度に依存しない */
function helixPitch(shape: HelixShape): number {
  const turns = Math.max(1, Math.round(shape.turns));
  return shape.length / turns;
}

/**
 * ピッチ一定の軸方向位置。原点は「角度なしの本体(位相 0..2π·turns)」の中央に固定する。
 * 角度で本体の外へ出た位相の分だけ、本体を動かさず端へ螺旋を追加/削除する(純粋な追加描画)。
 * これにより始点/終点の角度を変えても既存の巻き(ピッチ・傾き=開き)はその場に保たれる。
 */
function axialAt(shape: HelixShape, phi: number): number {
  return (helixPitch(shape) * phi) / (2 * Math.PI) - shape.length / 2;
}

/** 軸方向の描画範囲(sin成分を除く)。始点/終点の角度で本体の外側へ非対称に伸縮する */
export function helixAxialBounds(shape: HelixShape): { min: number; max: number } {
  const { start, end } = helixPhaseRange(shape);
  return { min: axialAt(shape, start), max: axialAt(shape, end) };
}

/**
 * 角度指定を含めた螺旋の軸方向の全長(= ピッチ × 総位相/2π)。
 * 始点・終点の角度で伸縮するが、ピッチは変わらない。
 */
export function helixLength(shape: HelixShape): number {
  const { min, max } = helixAxialBounds(shape);
  return max - min;
}

/** 位相 φ における、らせん上の点(ローカル座標) */
export function helixPoint(shape: HelixShape, phi: number): Point {
  const sx = shape.flip ? -1 : 1;
  const a = axialAt(shape, phi);
  return {
    x: a + sx * shape.radiusX * Math.sin(phi),
    y: -shape.radius * Math.cos(phi),
  };
}

/** らせんの両端の点(ローカル座標)。他図形との接続点(スナップ点)に使う */
export function helixEndpoints(shape: HelixShape): { start: Point; end: Point } {
  const { start, end } = helixPhaseRange(shape);
  return { start: helixPoint(shape, start), end: helixPoint(shape, end) };
}

export interface HelixPaths {
  /** 手前側(実線で描く)。輪ごとに1つのサブパス */
  front: string;
  /** 奥側(破線/なし等で描く)。輪ごとに1つのサブパス */
  back: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function subpath(pts: Point[], from: number, to: number): string {
  let d = `M ${round2(pts[from].x)} ${round2(pts[from].y)}`;
  for (let i = from + 1; i <= to; i++) d += ` L ${round2(pts[i].x)} ${round2(pts[i].y)}`;
  return d;
}

/**
 * らせんを手前側(near)と奥側(far)のSVGパスに分割して返す。
 * 奥行きの符号 sin(φ) で前後を判定し、手前を実線・奥を破線等で描くと3Dらせんに見える。
 * 前後の境界(φ=kπ)は巻き数を整数に丸め・サンプルを偶数にすることで必ずサンプル点に一致させ、
 * 隣接サブパスが同じ境界点を共有する=線が途切れずつながる。
 */
export function helixPaths(shape: HelixShape): HelixPaths {
  const { start, end } = helixPhaseRange(shape);
  const span = end - start;
  const M = Math.max(2, Math.round((span / (2 * Math.PI)) * SAMPLES_PER_TURN));

  const pts: Point[] = [];
  for (let i = 0; i <= M; i++) pts.push(helixPoint(shape, start + (span * i) / M));

  // セグメント i(点 i→i+1)が手前かどうか=中点位相の sin の符号
  const segFront = (seg: number): boolean => Math.sin(start + (span * (seg + 0.5)) / M) >= 0;

  const frontRuns: string[] = [];
  const backRuns: string[] = [];
  let runStart = 0;
  let runFront = segFront(0);
  for (let i = 1; i < M; i++) {
    const f = segFront(i);
    if (f !== runFront) {
      (runFront ? frontRuns : backRuns).push(subpath(pts, runStart, i));
      runStart = i;
      runFront = f;
    }
  }
  (runFront ? frontRuns : backRuns).push(subpath(pts, runStart, M));

  return { front: frontRuns.join(' '), back: backRuns.join(' ') };
}
