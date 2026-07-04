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

/** パターン付き塗りを持つプラグイン共通のプロパティ */
export interface PatternFillProps {
  fill: string;
  stroke: string;
  fillPattern: FillPattern;
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

/** タイル間隔(ローカル座標。scaleは常に1なので実寸に一致する) */
export const PATTERN_SPACING = 8;
export const PATTERN_LINE_WIDTH = 1;

function sanitize(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, '');
}

/** パターンの一意なdefs id(同一パラメータなら共有される) */
export function patternId(pattern: FillPattern, fill: string, stroke: string): string {
  return `fp-${pattern}-${sanitize(fill)}-${sanitize(stroke)}`;
}

/** props.fillPattern に応じた fill 値(url参照 または 塗り色) */
export function resolveFill(props: PatternFillProps): string {
  const pattern = props.fillPattern ?? 'none';
  if (pattern === 'none') return props.fill;
  return `url(#${patternId(pattern, props.fill, props.stroke)})`;
}
