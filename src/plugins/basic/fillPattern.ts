import type { PropertyField } from '../../core/plugin';

/**
 * モノクロ印刷向けの塗りつぶしパターン。
 * 色の代わりに斜線・網掛け・ドット等で内部を装飾する。
 */
export type FillPattern =
  | 'none'
  | 'hatch'
  | 'hatchBack'
  | 'cross'
  | 'horizontal'
  | 'vertical'
  | 'dots';

/** パターンの粗さ。図形の大きさに合わせて線幅・間隔を切り替える */
export type PatternSize = 'small' | 'medium' | 'large';

/** パターン付き塗りを持つプラグイン共通のプロパティ */
export interface PatternFillProps {
  fill: string;
  stroke: string;
  fillPattern: FillPattern;
  /** パターンの粗さ。小さい図形ほど細かいものを選ぶ。未設定は中 */
  patternSize?: PatternSize;
  /** 塗りの不透明度(0=透明〜1=不透明)。未設定は不透明扱い。パターン使用時は無視 */
  fillOpacity?: number;
}

/** プロパティパネル用の塗りパターン選択フィールド */
export const fillPatternField: PropertyField = {
  key: 'fillPattern',
  label: '塗りパターン',
  type: 'select',
  options: [
    { value: 'none', label: 'なし(塗り色)' },
    { value: 'hatch', label: '斜線 /' },
    { value: 'hatchBack', label: '斜線 \\' },
    { value: 'cross', label: '網掛け' },
    { value: 'horizontal', label: '横線' },
    { value: 'vertical', label: '縦線' },
    { value: 'dots', label: 'ドット' },
  ],
};

/** プロパティパネル用のパターン粗さ選択フィールド */
export const patternSizeField: PropertyField = {
  key: 'patternSize',
  label: 'パターンの粗さ',
  type: 'select',
  options: [
    { value: 'small', label: '細かい(小さい図形向け)' },
    { value: 'medium', label: '標準' },
    { value: 'large', label: '粗い(大きい図形向け)' },
  ],
};

/** プロパティパネル用の塗り不透明度フィールド(0=透明〜1=不透明) */
export const fillOpacityField: PropertyField = {
  key: 'fillOpacity',
  label: '塗りの不透明度',
  type: 'number',
  min: 0,
  max: 1,
  step: 0.1,
};

/**
 * 粗さ別のタイル間隔・線幅(ローカル座標。scaleは常に1なので実寸に一致する)。
 * 小さい図形は細かく、大きい図形は粗くしてパターンが見やすいようにする。
 */
export const PATTERN_SIZES: Record<PatternSize, { spacing: number; lineWidth: number }> = {
  small: { spacing: 4, lineWidth: 0.5 },
  medium: { spacing: 8, lineWidth: 1 },
  large: { spacing: 14, lineWidth: 1.6 },
};

/** パターンの粗さ(未設定は中) */
export function resolvePatternSize(props: PatternFillProps): PatternSize {
  return props.patternSize ?? 'medium';
}

function sanitize(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, '');
}

/** パターンの一意なdefs id(同一パラメータなら共有される) */
export function patternId(
  pattern: FillPattern,
  fill: string,
  stroke: string,
  size: PatternSize,
): string {
  return `fp-${pattern}-${size}-${sanitize(fill)}-${sanitize(stroke)}`;
}

/** props.fillPattern に応じた fill 値(url参照 または 塗り色) */
export function resolveFill(props: PatternFillProps): string {
  const pattern = props.fillPattern ?? 'none';
  if (pattern === 'none') return props.fill;
  return `url(#${patternId(pattern, props.fill, props.stroke, resolvePatternSize(props))})`;
}

/**
 * 塗りの不透明度(未設定は不透明=1)。SVGの fill-opacity にそのまま渡す。
 * パターン使用時は不透明度を無視し常に1(パターンが薄れて見えなくなるのを防ぐ)。
 */
export function resolveFillOpacity(props: PatternFillProps): number {
  if ((props.fillPattern ?? 'none') !== 'none') return 1;
  return props.fillOpacity ?? 1;
}
