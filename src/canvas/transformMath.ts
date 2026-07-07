import { angleOfVector, rotateVec } from '../core/geometry';
import type { AnyPlugin } from '../core/plugin';
import type { Point, Rect, Transform } from '../core/types';

const MIN_SCALE = 0.05;

/** 角度を(-180, 180]へ正規化する */
export function normalizeAngle(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

/**
 * 内部回転(SVG rotate。画面Yが下向きのため時計回りが正)を、
 * ユーザー表示用の角度(水平右=0°, 反時計回りが正の物理/数学慣習)へ変換する。
 */
export function toDisplayAngle(rotation: number): number {
  return normalizeAngle(-rotation);
}

/** 表示角(水平右=0°, 反時計回り正)を内部回転へ戻す */
export function fromDisplayAngle(display: number): number {
  return normalizeAngle(-display);
}

/** スケールハンドルの位置。-1/0/+1 でバウンディングボックスの左/中央/右(上/中央/下)を表す */
export interface HandleDir {
  sx: -1 | 0 | 1;
  sy: -1 | 0 | 1;
}

function clampScale(s: number): number {
  const sign = s < 0 ? -1 : 1;
  return Math.abs(s) < MIN_SCALE ? MIN_SCALE * sign : s;
}

/** バウンディングボックス上のハンドル位置のローカル座標(スケール適用前) */
function handleLocal(bounds: Rect, sx: number, sy: number): Point {
  return {
    x: sx < 0 ? bounds.x : sx > 0 ? bounds.x + bounds.width : bounds.x + bounds.width / 2,
    y: sy < 0 ? bounds.y : sy > 0 ? bounds.y + bounds.height : bounds.y + bounds.height / 2,
  };
}

/**
 * スケールハンドルのドラッグから新しいtransformを計算する。
 * ドラッグ中のハンドルの対角(反対側の点)をワールド座標で固定したまま拡大縮小する。
 */
export function computeScaleDrag(
  before: Transform,
  bounds: Rect,
  handle: HandleDir,
  worldPoint: Point,
  uniform: boolean,
): Transform {
  const { sx, sy } = handle;
  const theta = before.rotation;
  // アンカー(固定点): ドラッグ軸は反対側、非ドラッグ軸は中央
  const anchor = handleLocal(bounds, -sx, -sy);
  const target = handleLocal(bounds, sx, sy);

  const anchorWorld = {
    x: before.x + rotateVec({ x: anchor.x * before.scaleX, y: anchor.y * before.scaleY }, theta).x,
    y: before.y + rotateVec({ x: anchor.x * before.scaleX, y: anchor.y * before.scaleY }, theta).y,
  };
  // アンカー→ポインタのベクトルを、回転を除いたフレームで見る
  const d = rotateVec(
    { x: worldPoint.x - anchorWorld.x, y: worldPoint.y - anchorWorld.y },
    -theta,
  );

  let scaleX = before.scaleX;
  let scaleY = before.scaleY;
  if (sx !== 0) scaleX = clampScale(d.x / (target.x - anchor.x));
  if (sy !== 0) scaleY = clampScale(d.y / (target.y - anchor.y));

  if (uniform) {
    const fx = scaleX / before.scaleX;
    const fy = scaleY / before.scaleY;
    // 変化の大きい軸に合わせて等比にする(辺ハンドルは動いた軸を採用)
    const f = sx === 0 ? fy : sy === 0 ? fx : Math.abs(fx) > Math.abs(fy) ? fx : fy;
    scaleX = clampScale(before.scaleX * f);
    scaleY = clampScale(before.scaleY * f);
  }

  const anchorScaled = rotateVec({ x: anchor.x * scaleX, y: anchor.y * scaleY }, theta);
  return {
    ...before,
    scaleX,
    scaleY,
    x: anchorWorld.x - anchorScaled.x,
    y: anchorWorld.y - anchorScaled.y,
  };
}

/** 拡大縮小をpropsへ反映した結果 */
export interface ScalePropsResult {
  props: Record<string, unknown>;
  transform: Transform;
}

/**
 * スケールハンドルのドラッグを、transformのscaleではなくpropsのサイズへ反映する。
 * 対角のアンカーをワールド座標で固定したまま、プラグインの applyScale で
 * サイズprops(幅・半径・フォントサイズ等)を更新する。transformのscaleは常に1。
 * before.scaleX/Y は 1 であることを前提とする(呼び出し側で正規化する)。
 */
export function computeScaleToProps(
  before: Transform,
  beforeProps: Record<string, unknown>,
  plugin: AnyPlugin,
  handle: HandleDir,
  worldPoint: Point,
  uniform: boolean,
): ScalePropsResult {
  const { sx, sy } = handle;
  const theta = before.rotation;
  const b0 = plugin.getBounds(beforeProps);
  const anchor0 = handleLocal(b0, -sx, -sy);
  const target0 = handleLocal(b0, sx, sy);

  const anchorVec = rotateVec(anchor0, theta);
  const anchorWorld = { x: before.x + anchorVec.x, y: before.y + anchorVec.y };
  const d = rotateVec({ x: worldPoint.x - anchorWorld.x, y: worldPoint.y - anchorWorld.y }, -theta);

  const clampFactor = (f: number) => (Math.abs(f) < MIN_SCALE ? MIN_SCALE : Math.abs(f));
  let fx = sx !== 0 && target0.x !== anchor0.x ? clampFactor(d.x / (target0.x - anchor0.x)) : 1;
  let fy = sy !== 0 && target0.y !== anchor0.y ? clampFactor(d.y / (target0.y - anchor0.y)) : 1;

  if (uniform) {
    const f =
      sx === 0 ? fy : sy === 0 ? fx : Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;
    fx = f;
    fy = f;
  }

  const props = plugin.applyScale!(beforeProps, fx, fy) as Record<string, unknown>;
  const b1 = plugin.getBounds(props);
  const anchor1 = rotateVec(handleLocal(b1, -sx, -sy), theta);
  return {
    props,
    transform: {
      ...before,
      scaleX: 1,
      scaleY: 1,
      x: anchorWorld.x - anchor1.x,
      y: anchorWorld.y - anchor1.y,
    },
  };
}

/**
 * 回転ハンドルのドラッグから新しいtransformを計算する。
 * ハンドルはオブジェクト上方にあるため、真上へドラッグした状態が回転0度。
 */
export function computeRotationDrag(
  before: Transform,
  worldPoint: Point,
  snapDegrees?: number,
): Transform {
  let rotation =
    (Math.atan2(worldPoint.y - before.y, worldPoint.x - before.x) * 180) / Math.PI + 90;
  if (snapDegrees) rotation = Math.round(rotation / snapDegrees) * snapDegrees;
  return { ...before, rotation: normalizeAngle(rotation) };
}

/**
 * 任意のピボット(回転軸)まわりの回転。
 * つかんだ点(grab)と現在のポインタの、ピボットに対する角度差だけ回し、
 * オブジェクトの中心もピボットまわりに移動させる(ピボット=中心なら中心回転)。
 * スナップ時は結果の回転角を snapDegrees 刻みへ丸める。
 */
export function computeRotationAboutPivot(
  before: Transform,
  pivot: Point,
  grab: Point,
  pointer: Point,
  snapDegrees?: number,
): Transform {
  const a0 = angleOfVector({ x: grab.x - pivot.x, y: grab.y - pivot.y });
  const a1 = angleOfVector({ x: pointer.x - pivot.x, y: pointer.y - pivot.y });
  let rotation = before.rotation + (a1 - a0);
  if (snapDegrees) rotation = Math.round(rotation / snapDegrees) * snapDegrees;
  rotation = normalizeAngle(rotation);
  // 中心をピボットまわりに、実際に回った差分だけ回す
  const c = rotateVec({ x: before.x - pivot.x, y: before.y - pivot.y }, rotation - before.rotation);
  return { ...before, rotation, x: pivot.x + c.x, y: pivot.y + c.y };
}

/**
 * 長さ固定の端点ドラッグ。anchor(反対端)からの距離を length に保ったまま、
 * target 方向(スナップ結果を含む)へ向く点を返す(anchor中心・半径lengthの円上への射影)。
 * target が anchor と一致する退化ケースは angle=0(水平)にフォールバックする。
 */
export function projectOntoFixedRadius(anchor: Point, length: number, target: Point): Point {
  const dir = { x: target.x - anchor.x, y: target.y - anchor.y };
  const d = Math.hypot(dir.x, dir.y);
  const unit = d > 1e-9 ? { x: dir.x / d, y: dir.y / d } : { x: 1, y: 0 };
  return { x: anchor.x + unit.x * length, y: anchor.y + unit.y * length };
}
