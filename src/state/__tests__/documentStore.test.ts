import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { createSceneObject } from '../../core/document';
import { useDocumentStore } from '../documentStore';

const plugin = makeTestPlugin();

function addObject(x = 0, y = 0) {
  const store = useDocumentStore.getState();
  const obj = createSceneObject(plugin, { x, y }, store.nextZIndex);
  store.addObject(obj);
  return obj;
}

beforeEach(() => {
  useDocumentStore.getState().loadObjects({});
});

describe('documentStore', () => {
  it('addObjectで追加され選択される', () => {
    const obj = addObject();
    const state = useDocumentStore.getState();
    expect(state.objects[obj.id]).toBeDefined();
    expect(state.selection).toEqual([obj.id]);
    expect(state.nextZIndex).toBe(obj.zIndex + 1);
  });

  it('追加をUndo/Redoできる', () => {
    const obj = addObject();
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().objects[obj.id]).toBeUndefined();
    expect(useDocumentStore.getState().selection).toEqual([]);
    useDocumentStore.getState().redo();
    expect(useDocumentStore.getState().objects[obj.id]).toBeDefined();
  });

  it('削除をUndoできる', () => {
    const obj = addObject();
    useDocumentStore.getState().removeObjects([obj.id]);
    expect(useDocumentStore.getState().objects[obj.id]).toBeUndefined();
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().objects[obj.id]).toBeDefined();
  });

  it('updatePropsは履歴に残る', () => {
    const obj = addObject();
    useDocumentStore.getState().updateProps(obj.id, { width: 999 });
    expect(useDocumentStore.getState().objects[obj.id]?.props['width']).toBe(999);
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().objects[obj.id]?.props['width']).toBe(100);
  });

  it('transient変更は履歴に残らず、commitで1エントリになる', () => {
    const obj = addObject(0, 0);
    const before = { [obj.id]: obj.transform };
    const historyLen = useDocumentStore.getState().undoStack.length;

    // ドラッグ中の連続更新
    for (const x of [10, 20, 30]) {
      useDocumentStore
        .getState()
        .setTransformsTransient({ [obj.id]: { ...obj.transform, x } });
    }
    expect(useDocumentStore.getState().undoStack).toHaveLength(historyLen);

    useDocumentStore.getState().commitTransforms(before);
    const state = useDocumentStore.getState();
    expect(state.undoStack).toHaveLength(historyLen + 1);
    expect(state.objects[obj.id]?.transform.x).toBe(30);

    state.undo();
    expect(useDocumentStore.getState().objects[obj.id]?.transform.x).toBe(0);
    useDocumentStore.getState().redo();
    expect(useDocumentStore.getState().objects[obj.id]?.transform.x).toBe(30);
  });

  it('変化がなければcommitTransformsは履歴を積まない', () => {
    const obj = addObject();
    const len = useDocumentStore.getState().undoStack.length;
    useDocumentStore.getState().commitTransforms({ [obj.id]: obj.transform });
    expect(useDocumentStore.getState().undoStack).toHaveLength(len);
  });

  it('新しい操作でredoスタックはクリアされる', () => {
    const obj = addObject();
    useDocumentStore.getState().updateProps(obj.id, { width: 1 });
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().redoStack).toHaveLength(1);
    useDocumentStore.getState().updateProps(obj.id, { width: 2 });
    expect(useDocumentStore.getState().redoStack).toHaveLength(0);
  });
});
