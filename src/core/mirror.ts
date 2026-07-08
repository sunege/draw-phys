import type { SceneObject } from './document';
import { angleOfVector, localToWorld, reflectAngle, reflectPoint } from './geometry';
import type { AnyPlugin } from './plugin';
import type { Point, Transform } from './types';

export interface MirrorResult {
  props: Record<string, unknown>;
  transform: Transform;
}

/**
 * オブジェクトを対称軸(a・b を通る直線)に関して鏡像化した props/transform を返す。
 * 反射は translate→rotate→scale では素直に表せない(行列式 −1)ため、種別で手段を変える:
 *   1. プラグイン固有 mirror … 円弧の角度反転・文字の可読維持など手性のある図形
 *   2. 端点系(getEndpoints/setFromEndpoints) … 両端をワールドで反射して張り直す(向き込みで正確)
 *   3. 箱型 … 中心を反射し回転を軸に対して反転(対称形状は見た目が完全一致)
 */
export function mirrorObject(
  obj: SceneObject,
  plugin: AnyPlugin,
  a: Point,
  b: Point,
): MirrorResult {
  if (plugin.mirror) {
    return plugin.mirror(obj.props, obj.transform, a, b) as MirrorResult;
  }
  if (plugin.getEndpoints && plugin.setFromEndpoints) {
    const [e0, e1] = plugin.getEndpoints(obj.props);
    const w0 = localToWorld(e0, obj.transform);
    const w1 = localToWorld(e1, obj.transform);
    const res = plugin.setFromEndpoints(obj.props, reflectPoint(w0, a, b), reflectPoint(w1, a, b));
    return { props: res.props as Record<string, unknown>, transform: res.transform };
  }
  const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
  const c = reflectPoint({ x: obj.transform.x, y: obj.transform.y }, a, b);
  return {
    props: obj.props,
    transform: { ...obj.transform, x: c.x, y: c.y, rotation: reflectAngle(obj.transform.rotation, axisAngle) },
  };
}

/**
 * 位置だけ反射し向きは保つ鏡像。文字・数式のように内容を反転させたくない図形が
 * mirror フックとして使う(「図形は反転・文字は読める向き」方針)。
 */
export function mirrorKeepUpright<P>(
  props: P,
  t: Transform,
  a: Point,
  b: Point,
): { props: P; transform: Transform } {
  const c = reflectPoint({ x: t.x, y: t.y }, a, b);
  return { props, transform: { ...t, x: c.x, y: c.y } };
}
