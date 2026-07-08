/** 画像プラグインの純粋な寸法計算(取込時のフィット・縦横比復元)。 */

/** 取込時に収める最大寸法(内部単位)。大きな写真でも扱いやすいサイズに落とす */
export const IMPORT_MAX_DIM = 400;

export interface ImageProps {
  /** 画像データURL(空文字=未設定のプレースホルダ) */
  src: string;
  /** 表示幅(内部単位) */
  width: number;
  /** 表示高さ(内部単位) */
  height: number;
  /** 元画像の実ピクセル寸法。縦横比の復元に使う */
  naturalW: number;
  naturalH: number;
  /** 不透明度(0..1) */
  opacity: number;
}

/**
 * 取込時、最大寸法 maxDim(内部単位)に収まるよう縦横比を保って縮めた表示サイズ。
 * 元より小さくはしても拡大はしない(scale<=1)。
 */
export function fitSize(
  naturalW: number,
  naturalH: number,
  maxDim: number,
): { width: number; height: number } {
  if (naturalW <= 0 || naturalH <= 0) return { width: maxDim, height: maxDim };
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
  };
}

/** 現在の幅を基準に、元画像の縦横比へ揃えた高さ。元寸法が無ければ現在の高さを返す */
export function aspectHeight(props: Pick<ImageProps, 'width' | 'height' | 'naturalW' | 'naturalH'>): number {
  if (props.naturalW <= 0 || props.naturalH <= 0) return props.height;
  return Math.max(1, Math.round((props.width * props.naturalH) / props.naturalW));
}
