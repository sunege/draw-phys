import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestPlugin, type TestProps } from '../../core/__tests__/testPlugin';
import { createSceneObject, sortedObjects } from '../../core/document';
import { pluginRegistry } from '../../core/registry';
import { expandWithGroups, useDocumentStore } from '../documentStore';

// 整列はレジストリ経由でバウンディングボックスを引くため、共有レジストリへ登録する
const plugin = makeTestPlugin({ id: 'test.actions-box' });
// 長さ変更テスト用の線分プラグイン(length propを持ち getEndpoints/setFromEndpoints で伸縮)
const linePlugin = makeTestPlugin({
  id: 'test.actions-line',
  defaultProps: { width: 100, height: 1, length: 100 } as unknown as TestProps,
  getEndpoints: (p) => {
    const len = (p as unknown as { length: number }).length;
    return [
      { x: -len / 2, y: 0 },
      { x: len / 2, y: 0 },
    ];
  },
  setFromEndpoints: (p, a, b) => ({
    props: { ...p, length: Math.hypot(b.x - a.x, b.y - a.y) },
    transform: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rotation: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      scaleX: 1,
      scaleY: 1,
    },
  }),
});
// 一致拘束の基準にする、中心スナップ点を持つターゲット
const snapPlugin = makeTestPlugin({ id: 'test.actions-snap', getSnapPoints: () => [{ x: 0, y: 0 }] });
for (const p of [plugin, linePlugin, snapPlugin]) {
  try {
    pluginRegistry.register(p);
  } catch {
    /* 登録済みなら無視 */
  }
}

function add(x: number, y: number) {
  const store = useDocumentStore.getState();
  const obj = createSceneObject(plugin, { x, y }, store.nextZIndex);
  store.addObject(obj);
  return obj;
}

beforeEach(() => {
  useDocumentStore.getState().loadObjects({});
});

const state = () => useDocumentStore.getState();

describe('線分の長さ変更と一致拘束', () => {
  it('長さ変更で一致点は固定され、反対端だけが動く(localAnchorも比例更新)', () => {
    const target = createSceneObject(snapPlugin, { x: 200, y: 100 }, state().nextZIndex);
    state().addObject(target);
    const line = createSceneObject(linePlugin, { x: 150, y: 100 }, state().nextZIndex);
    state().addObject(line);
    // 右端(局所+50)を target(200,100)へ一致 → 中心(150,100)・右端(200,100)
    state().setObjectRefs(line.id, [
      { role: 'coincident', targetId: target.id, kind: 'point', pointIndex: 0, localAnchor: { x: 50, y: 0 } },
    ]);
    expect(state().objects[line.id].transform.x).toBeCloseTo(150);

    // 長さを200へ変更
    state().updateProps(line.id, { length: 200 });
    const solved = state().objects[line.id];
    // localAnchor は長さ比(×2)で +50→+100 に更新される
    expect(solved.refs?.[0].localAnchor?.x).toBeCloseTo(100);
    // 一致点(右端)は(200,100)で不動 → 中心(100,100)・左端(0,100)
    expect(solved.transform.x).toBeCloseTo(100);
    expect(solved.transform.y).toBeCloseTo(100);
    expect((solved.props as { length: number }).length).toBeCloseTo(200);
  });

  it('拘束の無い線分は長さ変更で中心が動かない(従来どおり対称に伸縮)', () => {
    const line = createSceneObject(linePlugin, { x: 150, y: 100 }, state().nextZIndex);
    state().addObject(line);
    state().updateProps(line.id, { length: 200 });
    expect(state().objects[line.id].transform.x).toBeCloseTo(150);
  });
});

describe('一致マーカードラッグの発散防止', () => {
  const addSnap = (x: number, y: number) => {
    const o = createSceneObject(snapPlugin, { x, y }, state().nextZIndex);
    state().addObject(o);
    return o;
  };

  it('2点一致した線分はマーカードラッグ(基準点移動)を繰り返しても長さが発散しない', () => {
    const t1 = addSnap(0, 100);
    const t2 = addSnap(200, 100);
    const line = createSceneObject(linePlugin, { x: 100, y: 100 }, state().nextZIndex);
    state().addObject(line);
    // 左端(-50)→t1, 右端(+50)→t2 の2点一致 → 長さ=基準点間距離200へ
    state().setObjectRefs(line.id, [
      { role: 'coincident', targetId: t1.id, kind: 'point', pointIndex: 0, localAnchor: { x: -50, y: 0 } },
      { role: 'coincident', targetId: t2.id, kind: 'point', pointIndex: 0, localAnchor: { x: 50, y: 0 } },
    ]);
    const solved0 = state().objects[line.id];
    expect((solved0.props as { length: number }).length).toBeCloseTo(200);
    // ドラッグ開始スナップショット(props/transform/refsは互いに整合したフレーム)
    const beforeProps = solved0.props;
    const beforeTransform = solved0.transform;
    const beforeRefs = solved0.refs!;

    // 修正後のドラッグtick: 毎回開始値へ戻してから解く。基準点t1が動いても長さは基準点間距離に一致し続ける
    for (const y of [80, 60, 40, 20, 0]) {
      state().setTransformsTransient({ [t1.id]: { x: 0, y, rotation: 0, scaleX: 1, scaleY: 1 } });
      state().setObjectTransient(line.id, {
        transform: { ...beforeTransform },
        props: { ...beforeProps },
        refs: beforeRefs,
      });
      const len = (state().objects[line.id].props as { length: number }).length;
      expect(len).toBeCloseTo(Math.hypot(200, 100 - y));
    }
  });

  it('propsを開始値へ戻さず古いフレームのlocalAnchorを注入し続けると長さが発散する(バグの根本原因)', () => {
    const t1 = addSnap(0, 100);
    const t2 = addSnap(200, 100);
    const line = createSceneObject(linePlugin, { x: 100, y: 100 }, state().nextZIndex);
    state().addObject(line);
    // 常に length=100 フレームの端点(±50)を注入。propsは前tickで伸びたまま持ち越すため再パラメタ化がずれる
    const lengths: number[] = [];
    for (let i = 0; i < 4; i++) {
      state().setObjectRefsTransient(line.id, [
        { role: 'coincident', targetId: t1.id, kind: 'point', pointIndex: 0, localAnchor: { x: -50, y: 0 } },
        { role: 'coincident', targetId: t2.id, kind: 'point', pointIndex: 0, localAnchor: { x: 50, y: 0 } },
      ]);
      lengths.push((state().objects[line.id].props as { length: number }).length);
    }
    // 基準点間距離は常に200なのにフレーム不整合で毎tick倍増していく(=マーカードラッグで発散した現象)
    expect(lengths[1]).toBeGreaterThan(lengths[0] + 1);
    expect(lengths[3]).toBeGreaterThan(lengths[1]);
  });
});

describe('グループ化', () => {
  it('選択中の複数オブジェクトが同じgroupIdになる', () => {
    const a = add(0, 0);
    const b = add(100, 0);
    state().setSelection([a.id, b.id]);
    state().groupSelection();
    const ga = state().objects[a.id]?.groupId;
    expect(ga).toBeDefined();
    expect(state().objects[b.id]?.groupId).toBe(ga);
    // expandWithGroupsは片方のIDからグループ全体へ広げる
    expect(new Set(expandWithGroups(state().objects, [a.id]))).toEqual(new Set([a.id, b.id]));
    state().ungroupSelection();
    expect(state().objects[a.id]?.groupId).toBeUndefined();
  });

  it('1個だけの選択ではグループ化しない', () => {
    const a = add(0, 0);
    state().setSelection([a.id]);
    state().groupSelection();
    expect(state().objects[a.id]?.groupId).toBeUndefined();
  });

  it('グループ化はUndoできる', () => {
    const a = add(0, 0);
    const b = add(100, 0);
    state().setSelection([a.id, b.id]);
    state().groupSelection();
    state().undo();
    expect(state().objects[a.id]?.groupId).toBeUndefined();
  });
});

describe('整列', () => {
  it('左揃えで左端が一致する', () => {
    // 100x50・中心原点 → 左端は x-50
    const a = add(0, 0);
    const b = add(200, 100);
    state().setSelection([a.id, b.id]);
    state().alignSelection('left');
    expect(state().objects[a.id]?.transform.x).toBe(0);
    expect(state().objects[b.id]?.transform.x).toBe(0);
    // Yは変わらない
    expect(state().objects[b.id]?.transform.y).toBe(100);
  });

  it('上下中央揃えでY中心が一致する', () => {
    const a = add(0, 0);
    const b = add(200, 100);
    state().setSelection([a.id, b.id]);
    state().alignSelection('centerY');
    expect(state().objects[a.id]?.transform.y).toBe(50);
    expect(state().objects[b.id]?.transform.y).toBe(50);
  });
});

describe('重なり順', () => {
  it('最前面・最背面・1段ずつの移動ができる', () => {
    const a = add(0, 0);
    const b = add(0, 0);
    const c = add(0, 0);
    const order = () => sortedObjects(state().objects).map((o) => o.id);
    expect(order()).toEqual([a.id, b.id, c.id]);

    state().setSelection([a.id]);
    state().reorderSelection('front');
    expect(order()).toEqual([b.id, c.id, a.id]);

    state().reorderSelection('backward');
    expect(order()).toEqual([b.id, a.id, c.id]);

    state().reorderSelection('back');
    expect(order()).toEqual([a.id, b.id, c.id]);

    state().reorderSelection('forward');
    expect(order()).toEqual([b.id, a.id, c.id]);
  });
});

describe('ロック・表示', () => {
  it('フラグ変更が履歴に残る', () => {
    const a = add(0, 0);
    state().setObjectFlags([a.id], { locked: true, visible: false });
    expect(state().objects[a.id]?.locked).toBe(true);
    expect(state().objects[a.id]?.visible).toBe(false);
    state().undo();
    expect(state().objects[a.id]?.locked).toBe(false);
    expect(state().objects[a.id]?.visible).toBe(true);
  });

  it('コンストラクションフラグを設定でき、Undoで戻る', () => {
    const a = add(0, 0);
    state().setObjectFlags([a.id], { construction: true });
    expect(state().objects[a.id]?.construction).toBe(true);
    state().undo();
    expect(state().objects[a.id]?.construction).toBeFalsy();
  });
});
