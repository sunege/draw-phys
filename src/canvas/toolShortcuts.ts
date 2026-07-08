import { TRIM_TOOL } from './tools';

/**
 * よく使うツールの単一キーショートカット(修飾キーなし)。
 * CanvasStage のキーボードハンドラとToolbox のヒント表示で共用する。
 */
export const TOOL_SHORTCUTS: Record<string, string> = {
  'core.line': 'l',
  'mech.vector': 'v',
  'core.rect': 's',
  'core.circle': 'c',
  'core.point': 'p',
  'core.angleMark': 'a',
  [TRIM_TOOL]: 't',
  'core.latex': 'm',
  'core.latexDoc': 'd',
};

/** キー→ツールidの逆引き */
export const KEY_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUTS).map(([id, key]) => [key, id]),
);
