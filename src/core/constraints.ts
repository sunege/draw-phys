import type { SceneObject, SceneObjects } from './document';
import { angleOfVector, distance, localToWorld, pointOnCircleAtAngle, rectCorners } from './geometry';
import { mirrorObject } from './mirror';
import type { AnyPlugin, ResolvedRef } from './plugin';
import type { PluginRegistry } from './registry';
import type { ObjectRef, Point } from './types';

/**
 * 対象のスナップ点(ローカル座標)。getSnapPoints 未実装なら
 * バウンディングボックスの四隅+中心で代用する。
 * 一致/接続のアンカー選択(CanvasStage)と resolveRef で同じ並びを使う。
 */
export function localSnapPoints(plugin: AnyPlugin, props: unknown): Point[] {
  const explicit = plugin.getSnapPoints?.(props);
  if (explicit && explicit.length) return explicit;
  const b = plugin.getBounds(props);
  return [...rectCorners(b), { x: b.x + b.width / 2, y: b.y + b.height / 2 }];
}

/** 単位ベクトル(ゼロ長なら+x) */
function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** 角度差を(-180,180]へ正規化 */
function normDeg(d: number): number {
  return (((d % 360) + 540) % 360) - 180;
}

/**
 * 現在の回転 objRot を基準角 refAngle と「平行」にするための最小回転オフセット。
 * 平行は向き無視なので 0(同方向) か 180(逆方向) のいずれか近い方を返す。
 */
export function parallelOffset(objRot: number, refAngle: number): number {
  return Math.abs(normDeg(objRot - refAngle)) <= 90 ? 0 : 180;
}

/**
 * 現在の回転 objRot を基準角 refAngle と「垂直」にするための最小回転オフセット。
 * refAngle±90 のうち objRot に近い方(+90 か -90)を返す。
 */
export function perpendicularOffset(objRot: number, refAngle: number): number {
  return normDeg(objRot - refAngle) >= 0 ? 90 : -90;
}

/**
 * 回転を拘束する参照(平行 or 垂直)を返す。両者は同一成分(回転)を奪い合うため排他。
 * どちらも angleOffset を基準角に足して回転を決める(平行=0/180, 垂直=±90)。
 */
export function findRotationLock(refs?: ObjectRef[]): ObjectRef | undefined {
  return refs?.find((r) => r.role === 'parallel' || r.role === 'perpendicular');
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

  if (ref.kind === 'point') {
    // 対象のスナップ点(pointIndex)をワールド座標で返す(一致/接続の基準点)
    const pts = localSnapPoints(plugin, target.props);
    const p = pts[ref.pointIndex ?? 0];
    if (!p) return null;
    return { role: ref.role, point: localToWorld(p, target.transform) };
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
 * 一致拘束(coincident)の基準点をワールド座標で返す。
 * 対象オブジェクトが解決できればそのスナップ点/線分/円周の点、
 * 解決できなければ自由基準点(worldAnchor)を使う。どちらも無ければ null。
 */
export function resolveCoincidentAnchor(
  ref: ObjectRef,
  objects: SceneObjects,
  registry: PluginRegistry,
): Point | null {
  if (objects[ref.targetId]) {
    const r = resolveRef(ref, objects, registry);
    if (r) return r.point;
  }
  return ref.worldAnchor ?? null;
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

    // 対称拘束: 自オブジェクト全体を、基準オブジェクトの「対称軸に関する鏡像」に保つ。
    // 基準は既に依存順で解決済み(トポロジカル順)なので、その現在状態を鏡像化して丸ごと上書きする。
    const symmetric = obj.refs.find((r) => r.role === 'symmetric');
    if (symmetric) {
      const source = objs[symmetric.targetId];
      const axisRef = obj.refs.find((r) => r.role === 'symmetricAxis');
      const axis = axisRef ? resolveRef(axisRef, objs, registry) : null;
      const sourcePlugin = source ? registry.get(source.pluginId) : undefined;
      // 基準・軸・プラグインが揃わない(欠損)場合はスキップ=自分を保つ
      if (source && sourcePlugin && axis?.tangent) {
        const a = axis.point;
        const b = { x: a.x + axis.tangent.x, y: a.y + axis.tangent.y };
        const m = mirrorObject(source, sourcePlugin, a, b);
        // 箱型の鏡像は基準の props を共有参照で返すため、必ずクローンしてから代入する
        obj.props = { ...m.props };
        obj.transform = m.transform;
      }
      continue;
    }

    // 本体が直接解く汎用拘束(プラグイン種別を問わない)。回転(平行)と位置(一致)は
    // それぞれ別の成分に作用するため、両方あれば合成できる。
    const rotLock = findRotationLock(obj.refs);
    const coincident = obj.refs.find((r) => r.role === 'coincident');
    if (rotLock || coincident) {
      let transform = obj.transform;
      // 平行/垂直: 回転だけを基準線分の向き+angleOffsetへ揃える(平行=0/180, 垂直=±90)
      if (rotLock) {
        const r = resolveRef(rotLock, objs, registry);
        if (r?.tangent) {
          transform = { ...transform, rotation: angleOfVector(r.tangent) + (rotLock.angleOffset ?? 0) };
        }
      }
      // 一致/接続: 局所アンカーを基準点へ一致させる(平行で回した姿勢のまま平行移動)
      if (coincident) {
        const base = resolveCoincidentAnchor(coincident, objs, registry);
        if (base) {
          const anchor = coincident.localAnchor ?? { x: 0, y: 0 };
          const cur = localToWorld(anchor, transform);
          transform = {
            ...transform,
            x: transform.x + (base.x - cur.x),
            y: transform.y + (base.y - cur.y),
          };
        }
      }
      obj.transform = transform;
      continue;
    }

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
