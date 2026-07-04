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
  const clones = buffer.map((obj) => {
    let groupId = obj.groupId;
    if (groupId) {
      if (!groupIdMap.has(groupId)) groupIdMap.set(groupId, crypto.randomUUID());
      groupId = groupIdMap.get(groupId);
    }
    return {
      ...structuredClone(obj),
      id: crypto.randomUUID(),
      groupId,
      zIndex: z++,
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
