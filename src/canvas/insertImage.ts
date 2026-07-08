import { createSceneObject } from '../core/document';
import { pluginRegistry } from '../core/registry';
import type { Point } from '../core/types';
import { readImageBlob } from '../plugins/layout/imageLoad';
import { useDocumentStore } from '../state/documentStore';

const IMAGE_PLUGIN_ID = 'layout.image';
/** 複数枚を同時に入れるときのずらし量(内部単位) */
const STACK_OFFSET = 16;

/** 画像Blobを取り込み、center を中心に画像オブジェクトを1つ追加する(追加した1つを選択) */
export async function insertImageFromBlob(blob: Blob, center: Point): Promise<void> {
  const plugin = pluginRegistry.get(IMAGE_PLUGIN_ID);
  if (!plugin) return;
  const loaded = await readImageBlob(blob);
  const store = useDocumentStore.getState();
  const base = createSceneObject(plugin, center, store.nextZIndex);
  store.addObject({ ...base, props: { ...base.props, ...loaded } });
}

/** 複数の画像Blobを少しずつずらして順に追加する */
export async function insertImagesFromBlobs(blobs: Blob[], center: Point): Promise<void> {
  for (let i = 0; i < blobs.length; i++) {
    await insertImageFromBlob(blobs[i], {
      x: center.x + i * STACK_OFFSET,
      y: center.y + i * STACK_OFFSET,
    });
  }
}

/**
 * DataTransfer(ファイルドロップ / クリップボード貼り付け)から画像Blobを取り出す。
 * files を優先し、無ければ items(kind='file' の画像)から拾う。
 */
export function imageBlobsFromDataTransfer(dt: DataTransfer): Blob[] {
  const blobs: Blob[] = [];
  for (const file of Array.from(dt.files)) {
    if (file.type.startsWith('image/')) blobs.push(file);
  }
  if (blobs.length > 0) return blobs;
  for (const item of Array.from(dt.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) blobs.push(file);
    }
  }
  return blobs;
}

/** ドラッグ中のデータにファイルが含まれるか(dragover で drop を許可する判定) */
export function dragHasFiles(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes('Files');
}
