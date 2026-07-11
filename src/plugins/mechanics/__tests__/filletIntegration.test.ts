import { beforeEach, describe, expect, it } from 'vitest';
import { solveConstraints } from '../../../core/constraints';
import { createSceneObject } from '../../../core/document';
import { localToWorld } from '../../../core/geometry';
import type { SegmentPick } from '../../../core/plugin';
import { pluginRegistry } from '../../../core/registry';
import type { Point } from '../../../core/types';
import { useDocumentStore } from '../../../state/documentStore';
import { linePlugin } from '../../basic/line';
import { filletGeometry } from '../filletMath';
import { filletPlugin } from '../fillet';

for (const p of [linePlugin, filletPlugin]) {
  try {
    pluginRegistry.register(p);
  } catch {
    /* 登録済みなら無視 */
  }
}

const state = () => useDocumentStore.getState();

/** 2端点(ワールド)から実 line オブジェクトを追加しIDを返す */
function addLine(a: Point, b: Point): string {
  const { props, transform } = linePlugin.setFromEndpoints!(linePlugin.defaultProps, a, b);
  const base = createSceneObject(linePlugin, transform, state().nextZIndex);
  const obj = { ...base, props: props as unknown as Record<string, unknown>, transform };
  state().addObject(obj);
  return obj.id;
}

/** line オブジェクトの唯一の線分をワールド端点でピック情報にする */
function pickOf(id: string, clickLocalT: number): SegmentPick {
  const obj = state().objects[id];
  const seg = linePlugin.getSegments!(obj.props as never)[0];
  const a = localToWorld(seg[0], obj.transform);
  const b = localToWorld(seg[1], obj.transform);
  return {
    targetId: id,
    segIndex: 0,
    worldPoint: { x: a.x + (b.x - a.x) * clickLocalT, y: a.y + (b.y - a.y) * clickLocalT },
    a,
    b,
  };
}

const lineLen = (id: string) => (state().objects[id].props as { length: number }).length;

describe('フィレット統合(実 line + 実ソルバ)', () => {
  beforeEach(() => {
    state().loadObjects({});
  });

  it('2線分から生成し、母線を接点まで詰め、頂点に置く', () => {
    const floor = addLine({ x: 0, y: 0 }, { x: 200, y: 0 }); // 水平
    const wall = addLine({ x: 200, y: 0 }, { x: 200, y: -200 }); // 鉛直
    // 残す側(左/上)をクリック
    const created = filletPlugin.createFromPicks!([pickOf(floor, 0.25), pickOf(wall, 0.25)]);
    const base = createSceneObject(filletPlugin, created.transform, state().nextZIndex);
    const fobj = {
      ...base,
      props: created.props as unknown as Record<string, unknown>,
      transform: created.transform,
      refs: created.refs,
    };
    state().addObjectWithHostTrims(fobj, created.hostTrims!);

    // フィレットは頂点(200,0)に配置
    const f = state().objects[fobj.id];
    expect(f.transform.x).toBeCloseTo(200, 3);
    expect(f.transform.y).toBeCloseTo(0, 3);
    // 母線は接点まで詰まる(200→160)。両方詰まる
    expect(lineLen(floor)).toBeCloseTo(160, 3);
    expect(lineLen(wall)).toBeCloseTo(160, 3);
    // 弧が有効に作れている
    const p = f.props as { armA: number; armB: number; radius: number };
    expect(filletGeometry(p.armA, p.armB, p.radius)).not.toBeNull();
  });

  it('母線を動かすと交点・接線を解き直し、正しい角(残す側)に接し続ける', () => {
    const floor = addLine({ x: 0, y: 0 }, { x: 200, y: 0 });
    const wall = addLine({ x: 200, y: 0 }, { x: 200, y: -200 });
    const created = filletPlugin.createFromPicks!([pickOf(floor, 0.25), pickOf(wall, 0.25)]);
    const base = createSceneObject(filletPlugin, created.transform, state().nextZIndex);
    const fobj = {
      ...base,
      props: created.props as unknown as Record<string, unknown>,
      transform: created.transform,
      refs: created.refs,
    };
    state().addObjectWithHostTrims(fobj, created.hostTrims!);

    // 生成直後の弧の中心は頂点から見て「左上側」(残す側の内側)にあるはず
    const f0 = state().objects[fobj.id];
    const g0 = filletGeometry(
      (f0.props as { armA: number }).armA,
      (f0.props as { armB: number }).armB,
      (f0.props as { radius: number }).radius,
    )!;
    expect(g0.center.x).toBeLessThan(0); // 頂点原点で左
    expect(g0.center.y).toBeLessThan(0); // 上

    // 床を y=+50 へ平行移動(頂点は(200,50)へ動く想定)
    const moved = { ...state().objects };
    const fl = moved[floor];
    moved[floor] = { ...fl, transform: { ...fl.transform, y: 50 } };
    const solved = solveConstraints(moved, pluginRegistry);

    const f1 = solved[fobj.id];
    // 頂点(=フィレット原点)が新しい交点(200,50)へ追従
    expect(f1.transform.x).toBeCloseTo(200, 3);
    expect(f1.transform.y).toBeCloseTo(50, 3);
    // 依然として同じ側(左上)に接している=角が反転していない
    const g1 = filletGeometry(
      (f1.props as { armA: number }).armA,
      (f1.props as { armB: number }).armB,
      (f1.props as { radius: number }).radius,
    )!;
    expect(g1.center.x).toBeLessThan(0);
    expect(g1.center.y).toBeLessThan(0);
  });
});
