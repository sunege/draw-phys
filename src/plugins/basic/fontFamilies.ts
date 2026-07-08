/**
 * テキスト・LaTeX文章オブジェクトで選べるフォント種別。
 * 値はOS標準搭載フォントのみで構成したCSS font-familyスタック
 * (書き出しはブラウザのcanvas描画に頼るため、@font-face埋め込み不要なシステムフォントに限定する)。
 */
export const FONT_FAMILY_OPTIONS = [
  { value: 'sans', label: 'ゴシック体' },
  { value: 'serif', label: '明朝体' },
  { value: 'mono', label: '等幅' },
] as const;

export type FontFamilyKey = (typeof FONT_FAMILY_OPTIONS)[number]['value'];

const FONT_FAMILY_STACKS: Record<FontFamilyKey, string> = {
  sans: "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic UI', sans-serif",
  serif: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif",
  mono: "'SF Mono', 'Cascadia Code', 'Consolas', 'Noto Sans Mono CJK JP', monospace",
};

export const DEFAULT_FONT_FAMILY: FontFamilyKey = 'serif';

/** 未知の値(旧データ等)は既定のゴシック体スタックにフォールバックする */
export function resolveFontFamily(key: string | undefined): string {
  return FONT_FAMILY_STACKS[key as FontFamilyKey] ?? FONT_FAMILY_STACKS[DEFAULT_FONT_FAMILY];
}
