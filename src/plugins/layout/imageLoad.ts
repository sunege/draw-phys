import { fitSize, IMPORT_MAX_DIM } from './imageMath';

export interface LoadedImage {
  /** data URL */
  src: string;
  /** 表示サイズ(内部単位、fitSizeで最大寸法に収めたもの) */
  width: number;
  height: number;
  /** 元画像の実ピクセル寸法 */
  naturalW: number;
  naturalH: number;
}

/**
 * 画像Blob(ファイル選択・ドロップ・クリップボード)を data URL 化し、
 * 実寸を測って fitSize で表示サイズを決めて返す。
 * 画像プラグインの props(src/width/height/naturalW/naturalH)へそのまま流し込める形。
 */
export async function readImageBlob(blob: Blob): Promise<LoadedImage> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(blob);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('画像を認識できませんでした'));
    el.src = src;
  });
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, IMPORT_MAX_DIM);
  return { src, width, height, naturalW: img.naturalWidth, naturalH: img.naturalHeight };
}
