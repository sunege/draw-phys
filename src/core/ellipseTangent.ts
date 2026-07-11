import { angleOfVector, rotateVec, worldToLocal } from './geometry';
import type { EllipseGeometry } from './plugin';
import type { Point, Transform } from './types';

/** 角度差を(-180,180]へ正規化 */
function normDeg(d: number): number {
  return (((d % 360) + 540) % 360) - 180;
}

/** 楕円接線の解: 接線となる直線のワールド回転角と、接点の媒介変数角度 */
export interface EllipseTangentSolution {
  /** 接線となる直線のワールド回転角(度) */
  rotation: number;
  /** 接点の媒介変数角度(度, 対象ローカル基準。P(t)=(rx·cos t, ry·sin t)) */
  t: number;
}

/**
 * ワールド点 pin を通り、対象楕円に接する直線を解く(ピン+接線拘束用)。
 * 楕円は対象の transform(回転・スケール)と楕円ジオメトリ(中心・rx・ry)で表される一般の楕円。
 *
 * 手順: pin を「楕円を単位円へ写す正規化空間(u=x/rx, v=y/ry)」へ移し、そこで
 * 単位円への接線として解く。アフィン写像は接線を接線へ写すので、正規化空間で求めた
 * 接線を対象ワールドの向きへ戻せば楕円の接線になる。接点は単位円上の垂線の足=媒介変数tと一致する。
 *
 * - pin が楕円の内側(正規化距離<1)なら接線なし=null。
 * - 複数解(2直線)のうち、ワールド回転が currentRotation に最も近いものを返す。
 */
export function solveEllipseTangentThroughPoint(
  pin: Point,
  transform: Transform,
  ellipse: EllipseGeometry,
  currentRotation: number,
): EllipseTangentSolution | null {
  const { center, radiusX: rx, radiusY: ry } = ellipse;
  if (Math.abs(rx) < 1e-9 || Math.abs(ry) < 1e-9) return null;

  // pin を対象ローカル(worldToLocalでスケール込みで打ち消し)→正規化(単位円)空間へ
  const local = worldToLocal(pin, transform);
  const nx = (local.x - center.x) / rx;
  const ny = (local.y - center.y) / ry;
  const d = Math.hypot(nx, ny);
  if (d < 1 - 1e-9) return null; // 内側=接線なし

  const alpha = angleOfVector({ x: -nx, y: -ny }); // pin→中心(正規化空間)
  const beta = (Math.asin(Math.min(1, 1 / (d || 1))) * 180) / Math.PI;

  // 正規化空間の方向(角度deg)を、対象ワールドの向きへ写す線形写像。
  // normalized dir → local dir(×rx,ry ×scale)→ rotate。長さは無視して角度だけ使う。
  const toWorldDir = (deg: number): Point => {
    const r = (deg * Math.PI) / 180;
    const localDir = { x: Math.cos(r) * rx * transform.scaleX, y: Math.sin(r) * ry * transform.scaleY };
    return rotateVec(localDir, transform.rotation);
  };

  let best: { rotation: number; e: number; delta: number } | null = null;
  for (const cand of [alpha + beta, alpha - beta, alpha + beta + 180, alpha - beta + 180]) {
    const rot = angleOfVector(toWorldDir(cand));
    const delta = Math.abs(normDeg(rot - currentRotation));
    if (!best || delta < best.delta) best = { rotation: rot, e: cand, delta };
  }
  if (!best) return null;

  // 接点(正規化空間): 原点から直線(pinNorm, 方向e)への垂線の足=単位円上の接点。
  // 単位円上の点の角度がそのまま楕円の媒介変数t(P(t)の正規化=(cos t, sin t))。
  const r = (best.e * Math.PI) / 180;
  const eu = { x: Math.cos(r), y: Math.sin(r) };
  const proj = nx * eu.x + ny * eu.y;
  const foot = { x: nx - proj * eu.x, y: ny - proj * eu.y };
  return { rotation: best.rotation, t: angleOfVector(foot) };
}
