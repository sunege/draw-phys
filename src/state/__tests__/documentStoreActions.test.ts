import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { createSceneObject, sortedObjects } from '../../core/document';
import { pluginRegistry } from '../../core/registry';
import { expandWithGroups, useDocumentStore } from '../documentStore';

// 整列はレジストリ経由でバウンディングボックスを引くため、共有レジストリへ登録する
const plugin = makeTestPlugin({ id: 'test.actions-box' });
try {
  pluginRegistry.register(plugin);
} catch {
  /* 登録済みなら無視 */
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
