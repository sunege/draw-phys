import type { SceneObject, SceneObjects } from './document';
import {
  angleOfVector,
  distance,
  localToWorld,
  pointOnCircleAtAngle,
  pointOnEllipseAtParam,
  rectCorners,
} from './geometry';
import { mirrorObject } from './mirror';
import type { AnyPlugin, ResolvedRef } from './plugin';
import type { PluginRegistry } from './registry';
import type { ObjectRef, Point, Transform } from './types';

/**
 * 拘束が解けなかった(過剰拘束・幾何学的に解なし)ことの報告。
 * refs配列順=優先度で先着の拘束を厳密に満たし、後着で解けないものをここへ載せる。
 * 拘束作成時の事前チェック(却下)と、マーカーの赤表示に使う。
 */
export interface ConstraintIssue {
  objectId: string;
  /** 問題のrefのロール */
  role: string;
  /** refs配列上の位置(複数coincident対応) */
  refIndex: number;
  /** 日本語の理由(トースト・ツールチップ用) */
  message: string;
}

/** 拘束充足チェックの許容誤差(位置=px, 角度=度)。追従時は浮動小数誤差のみなので十分大きい */
const TOL = 1e-3;
/** 線分系の局所アンカーが軸上(y≈0)とみなす許容誤差 */
const AXIS_EPS = 1e-6;

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
 * 接線拘束(円周へのanchor)を返す。**円周への一致拘束(role:'coincident', kind:'circle')は
 * 接線ではないので対象外**。接点ハンドルの表示/接点スライドdrag/マスター円の移動追従など、
 * 「接線らしさ」の判定はすべてこれを通す(kind==='circle'だけで判定すると一致拘束を誤検出する)。
 */
export function findTangentAnchor(refs?: ObjectRef[]): ObjectRef | undefined {
  return refs?.find((r) => r.role === 'anchor' && r.kind === 'circle');
}

/**
 * 回転が拘束で決まっているか。平行/垂直のほか、一致×2(2点拘束)や
 * 一致+接線(円周アンカー)の合成でも回転は解の側で決まる。
 * 回転ハンドル・角度入力の無効化判定に使う。
 */
export function isRotationConstrained(refs?: ObjectRef[]): boolean {
  if (!refs?.length) return false;
  if (findRotationLock(refs)) return true;
  const coincidents = refs.filter((r) => r.role === 'coincident').length;
  if (coincidents >= 2) return true;
  return coincidents >= 1 && !!findTangentAnchor(refs);
}

/**
 * 線分系の長さが拘束で決まっているか(一致×2=2点拘束は両端が基準点で固定=長さも確定)。
 * true のときはパネルでの長さ変更を禁止する。
 */
export function isLengthConstrained(refs?: ObjectRef[]): boolean {
  if (!refs?.length) return false;
  return refs.filter((r) => r.role === 'coincident').length >= 2;
}

/**
 * ピン点Pを通り円(中心C, 半径r)に接する直線の向き(度)。
 * 4つの解(α±β とその180°反転)のうち現在の回転に最も近いものを、
 * 現回転からの最小差分として返す。Pが円の内側(d<r)なら解なし=null。
 */
export function tangentAngleThroughPoint(
  P: Point,
  C: Point,
  r: number,
  currentRotation: number,
): number | null {
  const d = distance(P, C);
  if (d < r - 1e-9) return null;
  const alpha = angleOfVector({ x: C.x - P.x, y: C.y - P.y });
  const beta = (Math.asin(Math.min(1, r / (d || 1))) * 180) / Math.PI;
  let bestDelta = Infinity;
  for (const cand of [alpha + beta, alpha - beta, alpha + beta + 180, alpha - beta + 180]) {
    const delta = normDeg(cand - currentRotation);
    if (Math.abs(delta) < Math.abs(bestDelta)) bestDelta = delta;
  }
  return currentRotation + bestDelta;
}

/**
 * 線分系の2点一致を長さの変化込みで解く。
 * u1,u2 は両端A,Bの内分パラメタ(A=0, B=1)、P1,P2 はそれぞれの基準点(ワールド)。
 * u1==u2(同一アンカー)は解なし=null。
 */
export function solveTwoPointEndpoints(
  u1: number,
  u2: number,
  P1: Point,
  P2: Point,
): { a: Point; b: Point } | null {
  const du = u2 - u1;
  if (Math.abs(du) < 1e-9) return null;
  const v = { x: (P2.x - P1.x) / du, y: (P2.y - P1.y) / du }; // B-A
  const a = { x: P1.x - u1 * v.x, y: P1.y - u1 * v.y };
  return { a, b: { x: a.x + v.x, y: a.y + v.y } };
}

/**
 * 剛体の2点一致: スケール適用済みの局所ベクトルをワールドの基準ベクトルへ写す回転(度)。
 * 長さが許容誤差を超えて異なれば解なし=null(過剰拘束)。
 */
export function solveRigidRotation(localVec: Point, worldVec: Point, tol = TOL): number | null {
  const ll = Math.hypot(localVec.x, localVec.y);
  const wl = Math.hypot(worldVec.x, worldVec.y);
  if (Math.abs(ll - wl) > tol) return null;
  if (ll < 1e-9) return 0; // 同一点どうし: 回転は自由(変更なし扱い)
  return angleOfVector(worldVec) - angleOfVector(localVec);
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

  if (ref.kind === 'ellipse') {
    // 楕円周上の媒介変数角度tの点を求め、transformでワールドへ(一致拘束の基準点)。
    // 接線・半径は楕円では一意なスカラーにならないため付けない(coincident専用)。
    const ellipse = plugin.getEllipse?.(target.props);
    if (!ellipse) return null;
    const off = pointOnEllipseAtParam(ellipse.radiusX, ellipse.radiusY, ref.t ?? 0);
    const localP = { x: ellipse.center.x + off.x, y: ellipse.center.y + off.y };
    return { role: ref.role, point: localToWorld(localP, target.transform) };
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
 * 予約ロール(coincident/parallel/perpendicular/接線anchor)を1オブジェクト分だけ解く。
 * refs配列順=優先度の逐次DOF解決。ただし位置ピン(最初のcoincident)だけは先に処理する
 * (回転系拘束は常にピン点まわりの回転になるため、順序によらず同じ解になる)。
 * 解けない後着の拘束は姿勢を変えず issues へ報告する(先着優先)。
 */
function solveReservedRoles(
  obj: SceneObject,
  objs: SceneObjects,
  registry: PluginRegistry,
  issues?: ConstraintIssue[],
): void {
  const plugin = registry.get(obj.pluginId);
  let refs = obj.refs!;
  let transform: Transform = { ...obj.transform };
  let props = obj.props;
  /** 最初のcoincidentで固定した点(局所/ワールド)とそのref位置 */
  let pin: { local: Point; world: Point; index: number } | null = null;
  let rotationLocked = false;
  let lengthConsumed = false;

  const report = (refIndex: number, message: string) => {
    issues?.push({ objectId: obj.id, role: refs[refIndex].role, refIndex, message });
  };
  /** ピン点を基準ワールド点へ戻す平行移動(回転・長さ変更後の再ピン) */
  const applyPin = () => {
    if (!pin) return;
    const cur = localToWorld(pin.local, transform);
    transform = { ...transform, x: transform.x + pin.world.x - cur.x, y: transform.y + pin.world.y - cur.y };
  };
  /** 局所アンカーが線分軸上にあり、長さの変化で解ける線分系か */
  const canStretch = (anchor: Point) =>
    !!plugin?.getEndpoints &&
    !!plugin.setFromEndpoints &&
    !plugin.isLengthLocked?.(props) &&
    !lengthConsumed &&
    Math.abs(anchor.y) < AXIS_EPS;

  // 2本目以降のcoincident: 残った自由度(回転・長さ)でアンカーを基準点へ合わせる
  const solveExtraCoincident = (i: number, anchor: Point, base: Point) => {
    if (!pin) return;
    const p = pin;
    // 線分系: 両端を直接解いて長さ込みで一致させる(回転が自由なときのみ)
    if (!rotationLocked && canStretch(anchor) && Math.abs(p.local.y) < AXIS_EPS && plugin?.getEndpoints && plugin.setFromEndpoints) {
      const eps = plugin.getEndpoints(props);
      const span = eps[1].x - eps[0].x;
      if (Math.abs(span) < 1e-9) {
        report(i, '長さ0の線分は2点で拘束できません');
        return;
      }
      // 基準点どうしが重なると線分が長さ0に潰れ、以後復元できないため解かない
      if (distance(p.world, base) < 1e-6) {
        report(i, '2つの基準点が同じ位置にあります');
        return;
      }
      const u1 = (p.local.x - eps[0].x) / span;
      const u2 = (anchor.x - eps[0].x) / span;
      const solved = solveTwoPointEndpoints(u1, u2, p.world, base);
      if (!solved) {
        report(i, '同じ点を2つの基準へ一致させることはできません');
        return;
      }
      const res = plugin.setFromEndpoints(props, solved.a, solved.b);
      props = res.props as Record<string, unknown>;
      transform = res.transform;
      // 長さが変わるので両アンカーを新しい局所座標へ書き直す(再解決で冪等になる)
      const neps = plugin.getEndpoints(props);
      const nspan = neps[1].x - neps[0].x;
      const newLocal = (u: number): Point => ({ x: neps[0].x + u * nspan, y: 0 });
      const pinLocal = newLocal(u1);
      refs = refs.map((r, j) =>
        j === p.index ? { ...r, localAnchor: pinLocal } : j === i ? { ...r, localAnchor: newLocal(u2) } : r,
      );
      pin = { local: pinLocal, world: p.world, index: p.index };
      rotationLocked = true;
      lengthConsumed = true;
      applyPin(); // setFromEndpointsで位置も決まるが、数値誤差の分だけ再ピンする
      return;
    }
    // 剛体: 回転のみで合わせる(基準点間の距離が一致している必要がある)
    if (!rotationLocked) {
      const lv = {
        x: (anchor.x - p.local.x) * transform.scaleX,
        y: (anchor.y - p.local.y) * transform.scaleY,
      };
      const wv = { x: base.x - p.world.x, y: base.y - p.world.y };
      const rot = solveRigidRotation(lv, wv);
      if (rot == null) {
        report(i, '2つの基準点の距離がオブジェクト上の2点の距離と一致しません');
        return;
      }
      transform = { ...transform, rotation: transform.rotation + normDeg(rot - transform.rotation) };
      rotationLocked = true;
      applyPin();
      return;
    }
    // 回転は消費済み: 向きを保ったままの伸縮で解けるか(基準点が軸上にある場合のみ)
    if (canStretch(anchor) && Math.abs(p.local.y) < AXIS_EPS && plugin?.getEndpoints && plugin.setFromEndpoints) {
      const eps = plugin.getEndpoints(props);
      const span = eps[1].x - eps[0].x;
      const u1 = (p.local.x - eps[0].x) / span;
      const u2 = (anchor.x - eps[0].x) / span;
      const solved = Math.abs(span) < 1e-9 ? null : solveTwoPointEndpoints(u1, u2, p.world, base);
      if (solved) {
        const ang = angleOfVector({ x: solved.b.x - solved.a.x, y: solved.b.y - solved.a.y });
        const diff = Math.abs(normDeg(ang - transform.rotation));
        if (diff < TOL || Math.abs(diff - 180) < TOL) {
          const res = plugin.setFromEndpoints(props, solved.a, solved.b);
          props = res.props as Record<string, unknown>;
          transform = res.transform;
          const neps = plugin.getEndpoints(props);
          const nspan = neps[1].x - neps[0].x;
          const newLocal = (u: number): Point => ({ x: neps[0].x + u * nspan, y: 0 });
          const pinLocal = newLocal(u1);
          refs = refs.map((r, j) =>
            j === p.index ? { ...r, localAnchor: pinLocal } : j === i ? { ...r, localAnchor: newLocal(u2) } : r,
          );
          pin = { local: pinLocal, world: p.world, index: p.index };
          lengthConsumed = true;
          applyPin();
          return;
        }
      }
      report(i, '基準点が拘束済みの向きの軸上にありません');
      return;
    }
    // 自由度なし: 現姿勢で満たしていなければ過剰拘束
    if (distance(localToWorld(anchor, transform), base) > TOL) {
      report(i, '位置と回転が既に他の拘束で決まっています');
    }
  };

  // 接線(円周へのanchor): ピン点を通る円への接線として回転を解く
  const solveTangent = (i: number, ref: ObjectRef) => {
    const target = objs[ref.targetId];
    const tPlugin = target ? registry.get(target.pluginId) : undefined;
    const circle = target && tPlugin?.getCircle?.(target.props);
    if (!target || !circle) return; // 欠損はスキップ(現行踏襲)
    if (!pin) {
      // 一致拘束が無い場合、単独接線はプラグイン(applyRefs)の担当。
      // 回転拘束と同居していると解けないため報告する(既存データの[接線,平行]順は従来どおり黙認)
      if (rotationLocked) report(i, '回転が既に他の拘束で決まっているため接線にできません');
      return;
    }
    if (Math.abs(pin.local.y) > AXIS_EPS) {
      report(i, '接線拘束は線分軸上の一致点とのみ組み合わせられます');
      return;
    }
    const C = localToWorld(circle.center, target.transform);
    const r = circle.radius * Math.abs(target.transform.scaleX);
    if (!rotationLocked) {
      const ang = tangentAngleThroughPoint(pin.world, C, r, transform.rotation);
      if (ang == null) {
        report(i, '一致点が円の内側にあるため接線を引けません');
        return;
      }
      transform = { ...transform, rotation: ang };
      rotationLocked = true;
      applyPin();
    } else {
      // 回転消費済み: 現在の向きで接しているかだけ確認する
      const rad = (transform.rotation * Math.PI) / 180;
      const dir = { x: Math.cos(rad), y: Math.sin(rad) };
      const toC = { x: C.x - pin.world.x, y: C.y - pin.world.y };
      if (Math.abs(Math.abs(toC.x * dir.y - toC.y * dir.x) - r) > TOL) {
        report(i, '回転が既に他の拘束で決まっているため接線にできません');
        return;
      }
    }
    // 接点の角度をrefへ書き直す(マーカー表示・保存の整合。値が同じなら書かない)
    const rad = (transform.rotation * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const s = (C.x - pin.world.x) * dir.x + (C.y - pin.world.y) * dir.y;
    const contact = { x: pin.world.x + s * dir.x, y: pin.world.y + s * dir.y };
    const t = projectPointToCircleAngle(contact, target, C);
    if (Math.abs(normDeg(t - (ref.t ?? 0))) > 1e-9) {
      refs = refs.map((r2, j) => (j === i ? { ...r2, t } : r2));
    }
  };

  // 位置ピン(最初のcoincident)を先に処理し、残りは配列順で
  const pinIndex = refs.findIndex(
    (r) => r.role === 'coincident' && resolveCoincidentAnchor(r, objs, registry) != null,
  );
  if (pinIndex >= 0) {
    const ref = refs[pinIndex];
    const base = resolveCoincidentAnchor(ref, objs, registry)!;
    pin = { local: ref.localAnchor ?? { x: 0, y: 0 }, world: base, index: pinIndex };
    applyPin();
  }
  for (let i = 0; i < refs.length; i++) {
    if (i === pinIndex) continue;
    const ref = refs[i];
    if (ref.role === 'parallel' || ref.role === 'perpendicular') {
      const r = resolveRef(ref, objs, registry);
      if (!r?.tangent) continue; // 欠損はスキップ
      const target = angleOfVector(r.tangent) + (ref.angleOffset ?? 0);
      if (!rotationLocked) {
        transform = { ...transform, rotation: target };
        rotationLocked = true;
        applyPin();
      } else {
        const diff = Math.abs(normDeg(transform.rotation - target));
        if (diff > TOL && Math.abs(diff - 180) > TOL) {
          report(i, '回転が既に他の拘束で決まっています');
        }
      }
    } else if (ref.role === 'coincident') {
      const base = resolveCoincidentAnchor(ref, objs, registry);
      if (!base) continue; // 欠損はスキップ
      solveExtraCoincident(i, ref.localAnchor ?? { x: 0, y: 0 }, base);
    } else if (ref.role === 'anchor' && ref.kind === 'circle') {
      solveTangent(i, ref);
    }
  }

  obj.transform = transform;
  if (props !== obj.props) obj.props = props;
  if (refs !== obj.refs) obj.refs = refs;
}

/**
 * refを持つ全オブジェクトを依存順に解決し、objs を直接書き換える。
 * immerドラフト・事前クローン済みマップのどちらに対しても動く
 * (各エントリをフィールド代入で更新する)。
 */
function solveInto(objs: SceneObjects, registry: PluginRegistry, issues?: ConstraintIssue[]): void {
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
      // 対称は全自由度を消費するため、他の位置・回転系拘束とは両立しない
      obj.refs.forEach((r, refIndex) => {
        if (r.role === 'coincident' || r.role === 'parallel' || r.role === 'perpendicular') {
          issues?.push({ objectId: obj.id, role: r.role, refIndex, message: '対称拘束と両立しません' });
        }
      });
      continue;
    }

    // 本体が直接解く汎用拘束(プラグイン種別を問わない)。refs配列順=優先度の逐次DOF解決で、
    // 一致×2(2点拘束)・一致+平行/垂直・一致+接線を合成できる。
    const rotLock = findRotationLock(obj.refs);
    const hasCoincident = obj.refs.some((r) => r.role === 'coincident');
    if (rotLock || hasCoincident) {
      solveReservedRoles(obj, objs, registry, issues);
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

/** immerドラフトに対して拘束を解決する(mutate内で使用)。issues に解けなかった拘束を集める */
export function solveConstraintsInPlace(
  draft: SceneObjects,
  registry: PluginRegistry,
  issues?: ConstraintIssue[],
): void {
  solveInto(draft, registry, issues);
}

/**
 * 拘束を解決した新しいオブジェクトマップを返す純粋版。
 * 変更されうるオブジェクトを事前に浅くクローンしてから解くため、元のマップは不変。
 * issues に解けなかった拘束(過剰拘束)を集める。
 */
export function solveConstraints(
  objects: SceneObjects,
  registry: PluginRegistry,
  issues?: ConstraintIssue[],
): SceneObjects {
  const copy: SceneObjects = {};
  for (const [id, obj] of Object.entries(objects)) copy[id] = { ...obj } as SceneObject;
  solveInto(copy, registry, issues);
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
