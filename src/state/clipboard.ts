import type { SceneObject } from '../core/document';
import { unionRects, worldBounds } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import type { Point } from '../core/types';
import { useDocumentStore } from './documentStore';

/** アプリ内クリップボード(図形のコピー/貼付け) */
let buffer: SceneObject[] = [];
let pasteCount = 0;

const PASTE_OFFSET = 20;

// --- OSクリップボード画像とアプリ内コピー(Ctrl+C)の競合調停用の状態 ---
/** 直近のコピーがアプリ内(Ctrl+C)で、貼付け時に図形を優先すべきか */
let internalActive = false;
/** コピー後にウィンドウがブラーしたか(＝別アプリで画像をコピーした可能性がある) */
let blurredSinceCopy = false;
/** 直近に貼った/優先判定に使ったクリップボード画像の指紋(type:size) */
let lastImageKey = '';

export type PasteTarget = 'image' | 'internal' | 'none';

/**
 * クリップボード画像とアプリ内コピーのどちらを貼るかを純粋に判定する。
 * 方針は「直近のコピー操作を優先」:
 * - 画像が無ければ図形(あれば)。
 * - 画像があっても、アプリ内コピーが有効で、その画像が「新規(未見)かつコピー後に
 *   ウィンドウがブラーした(＝外部で新たにコピーされた可能性)」でない限り図形を優先。
 *   これで「同じ画像が残っているだけ」の状況では図形の貼付けができる。
 */
export function decidePasteTarget(params: {
  hasImage: boolean;
  imageKey: string | null;
  lastImageKey: string;
  hasInternal: boolean;
  internalActive: boolean;
  blurredSinceCopy: boolean;
}): PasteTarget {
  if (!params.hasImage) return params.hasInternal ? 'internal' : 'none';
  const competes = params.internalActive && params.hasInternal;
  if (!competes) return 'image';
  const imageIsFresh = params.imageKey !== params.lastImageKey && params.blurredSinceCopy;
  return imageIsFresh ? 'image' : 'internal';
}

/** decidePasteTarget を現在の状態で評価し、画像優先が決まったら内部状態を更新する */
export function chooseClipboardTarget(imageKey: string | null): PasteTarget {
  const target = decidePasteTarget({
    hasImage: imageKey !== null,
    imageKey,
    lastImageKey,
    hasInternal: buffer.length > 0,
    internalActive,
    blurredSinceCopy,
  });
  if (target === 'image') {
    lastImageKey = imageKey ?? lastImageKey;
    internalActive = false; // 画像が勝ったらアプリ内コピーの優先を解除
  }
  return target;
}

/** ウィンドウがブラーしたことを記録する(アプリ内コピー中のみ意味を持つ) */
export function markWindowBlurred(): void {
  if (internalActive) blurredSinceCopy = true;
}

export function copySelection(): void {
  const { objects, selection } = useDocumentStore.getState();
  buffer = selection
    .map((id) => objects[id])
    .filter((obj): obj is SceneObject => obj !== undefined)
    .map((obj) => structuredClone(obj));
  pasteCount = 0;
  // このコピーを「直近のコピー操作」とし、以後の貼付けで図形を優先する
  internalActive = buffer.length > 0;
  blurredSinceCopy = false;
}

/**
 * クリップボード(アプリ内コピー)の内容を貼り付ける。
 * cursorWorld を渡すと、コピー範囲の外接矩形の左上がその座標へ来るようにずらして貼る
 * (Ctrl+V=マウス位置基準)。省略時は元の位置から少しずつオフセットして重ね貼りする
 * (Ctrl+D の複製=元の近くに置きたいため)。
 */
export function pasteClipboard(cursorWorld?: Point): void {
  if (buffer.length === 0) return;
  pasteCount += 1;
  const store = useDocumentStore.getState();
  let z = store.nextZIndex;
  // 元のグループ関係は保ちつつ、既存グループとは別グループにする
  const groupIdMap = new Map<string, string>();
  // 旧ID→新IDの対応。コピー範囲内を指す拘束(refs)を貼付け後のオブジェクトへ張り替えるため先に採番する
  const idMap = new Map<string, string>();
  for (const obj of buffer) idMap.set(obj.id, crypto.randomUUID());

  let dx = PASTE_OFFSET * pasteCount;
  let dy = PASTE_OFFSET * pasteCount;
  if (cursorWorld) {
    const rects = buffer
      .map((obj) => {
        const plugin = pluginRegistry.get(obj.pluginId);
        return plugin ? worldBounds(plugin.getBounds(obj.props), obj.transform) : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const box = unionRects(rects);
    if (box) {
      dx = cursorWorld.x - box.x;
      dy = cursorWorld.y - box.y;
    }
  }

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
        x: obj.transform.x + dx,
        y: obj.transform.y + dy,
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
