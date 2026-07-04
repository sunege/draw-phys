import type { SceneObject, SceneObjects } from './document';
import { angleOfVector, distance, localToWorld, pointOnCircleAtAngle } from './geometry';
import type { ResolvedRef } from './plugin';
import type { PluginRegistry } from './registry';
import type { ObjectRef, Point } from './types';

/** 単位ベクトル(ゼロ長なら+x) */
function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 1つの参照を、対象オブジェクトの現在位置からワールド座標のアンカーへ解決する。
 * 対象やジオメトリが得られなければ null。
 */
export function resolveRef(
  ref: ObjectRef,
  objects: SceneObjects,
  registry: PluginRegistry,
): ResolvedRef | null {
  const target = objects[ref.targetId];
  if (!target) return null;
  const plugin = registry.get(target.pluginId);
  if (!plugin) return null;

  if (ref.kind === 'segment') {
    const segs = plugin.getSegments?.(target.props);
    const seg = segs?.[ref.segIndex ?? 0];
    if (!seg) return null;
    const a = localToWorld(seg[0], target.transform);
    const b = localToWorld(seg[1], target.transform);
    const t = ref.t ?? 0;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    let tangent = normalize({ x: b.x - a.x, y: b.y - a.y });
    // 角度マークの腕など、線分方向の逆向きを指す参照は mode:'neg' で反転する
    if (ref.mode === 'neg') tangent = { x: -tangent.x, y: -tangent.y };
    return { role: ref.role, point, tangent };
  }

  // circle: 対象ローカルで角度tの点を求め、transformでワールドへ。接線・半径も算出
  const circle = plugin.getCircle?.(target.props);
  if (!circle) return null;
  const angle = ref.t ?? 0;
  const localP = pointOnCircleAtAngle(circle.center, circle.radius, angle);
  const point = localToWorld(localP, target.transform);
  const center = localToWorld(circle.center, target.transform);
  // 接線 = 半径方向を+90°回した向き(ワールドで2点法により回転・スケールを反映)
  const localP2 = pointOnCircleAtAngle(circle.center, circle.radius, angle + 1);
  const nextP = localToWorld(localP2, target.transform);
  const tangent = normalize({ x: nextP.x - point.x, y: nextP.y - point.y });
  return { role: ref.role, point, tangent, radius: distance(center, point) };
}

/**
 * 参照グラフを依存順(対象→依存)に並べる。DFSトポロジカルソート。
 * 循環は検出したら打ち切る(一方向依存を前提)。
 */
function topoOrder(objects: SceneObjects): string[] {
  const result: string[] = [];
  const state = new Map<string, 1 | 2>(); // 1=訪問中, 2=完了
  const visit = (id: string) => {
    const s = state.get(id);
    if (s === 2 || s === 1) return; // 完了 or 循環検出は打ち切り
    state.set(id, 1);
    const obj = objects[id];
    if (obj?.refs) {
      for (const ref of obj.refs) {
        if (objects[ref.targetId]) visit(ref.targetId);
      }
    }
    state.set(id, 2);
    result.push(id);
  };
  for (const id of Object.keys(objects)) visit(id);
  return result;
}

/**
 * refを持つ全オブジェクトを依存順に解決し、objs を直接書き換える。
 * immerドラフト・事前クローン済みマップのどちらに対しても動く
 * (各エントリをフィールド代入で更新する)。
 */
function solveInto(objs: SceneObjects, registry: PluginRegistry): void {
  const order = topoOrder(objs);
  for (const id of order) {
    const obj = objs[id];
    if (!obj?.refs?.length) continue;
    const plugin = registry.get(obj.pluginId);
    if (!plugin?.applyRefs) continue;
    const resolved: ResolvedRef[] = [];
    for (const ref of obj.refs) {
      const r = resolveRef(ref, objs, registry);
      if (r) resolved.push(r);
    }
    if (resolved.length === 0) continue;
    const res = plugin.applyRefs(obj.props, resolved, obj.transform);
    obj.props = res.props as Record<string, unknown>;
    obj.transform = res.transform;
  }
}

/** immerドラフトに対して拘束を解決する(mutate内で使用) */
export function solveConstraintsInPlace(draft: SceneObjects, registry: PluginRegistry): void {
  solveInto(draft, registry);
}

/**
 * 拘束を解決した新しいオブジェクトマップを返す純粋版。
 * 変更されうるオブジェクトを事前に浅くクローンしてから解くため、元のマップは不変。
 */
export function solveConstraints(objects: SceneObjects, registry: PluginRegistry): SceneObjects {
  const copy: SceneObjects = {};
  for (const [id, obj] of Object.entries(objects)) copy[id] = { ...obj } as SceneObject;
  solveInto(copy, registry);
  return copy;
}

/** ワールド座標の点を、円周上の角度(度, 対象ローカル基準)へ投影する(接続点スライド用) */
export function projectPointToCircleAngle(
  worldPoint: Point,
  target: SceneObject,
  centerWorld: Point,
): number {
  // ワールドの中心→点ベクトルの角度から、対象の回転を差し引いてローカル角度にする
  const worldAngle = angleOfVector({
    x: worldPoint.x - centerWorld.x,
    y: worldPoint.y - centerWorld.y,
  });
  return worldAngle - target.transform.rotation;
}
