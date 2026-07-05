import type { SceneObject } from '../core/document';
import { useDocumentStore } from './documentStore';

/** アプリ内クリップボード(OSクリップボードへの画像コピーはM6で対応) */
let buffer: SceneObject[] = [];
let pasteCount = 0;

const PASTE_OFFSET = 20;

export function copySelection(): void {
  const { objects, selection } = useDocumentStore.getState();
  buffer = selection
    .map((id) => objects[id])
    .filter((obj): obj is SceneObject => obj !== undefined)
    .map((obj) => structuredClone(obj));
  pasteCount = 0;
}

export function pasteClipboard(): void {
  if (buffer.length === 0) return;
  pasteCount += 1;
  const store = useDocumentStore.getState();
  let z = store.nextZIndex;
  // 元のグループ関係は保ちつつ、既存グループとは別グループにする
  const groupIdMap = new Map<string, string>();
  // 旧ID→新IDの対応。コピー範囲内を指す拘束(refs)を貼付け後のオブジェクトへ張り替えるため先に採番する
  const idMap = new Map<string, string>();
  for (const obj of buffer) idMap.set(obj.id, crypto.randomUUID());
  const clones = buffer.map((obj) => {
    let groupId = obj.groupId;
    if (groupId) {
      if (!groupIdMap.has(groupId)) groupIdMap.set(groupId, crypto.randomUUID());
      groupId = groupIdMap.get(groupId);
    }
    const clone = structuredClone(obj);
    return {
      ...clone,
      id: idMap.get(obj.id)!,
      groupId,
      zIndex: z++,
      // コピー範囲内を指す拘束は貼付け後のオブジェクトへ張り替える(範囲外は元の参照を保つ)
      refs: clone.refs?.map((ref) =>
        idMap.has(ref.targetId) ? { ...ref, targetId: idMap.get(ref.targetId)! } : ref,
      ),
      transform: {
        ...obj.transform,
        x: obj.transform.x + PASTE_OFFSET * pasteCount,
        y: obj.transform.y + PASTE_OFFSET * pasteCount,
      },
    };
  });
  store.addObjects(clones);
}

/** 選択オブジェクトを複製して少しずらして配置する(Ctrl+D) */
export function duplicateSelection(): void {
  copySelection();
  pasteClipboard();
}
