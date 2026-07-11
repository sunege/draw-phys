import {
  COINCIDENT_TOOL,
  MIDPOINT_TOOL,
  PARALLEL_TOOL,
  PERPENDICULAR_TOOL,
  SPLIT_TOOL,
  SYMMETRY_TOOL,
  TANGENT_TOOL,
  TRIM_TOOL,
} from './tools';

/**
 * よく使うツールの単一キーショートカット(修飾キーなし)。
 * CanvasStage のキーボードハンドラとToolbox のヒント表示で共用する。
 */
export const TOOL_SHORTCUTS: Record<string, string> = {
  'core.line': 'l',
  'mech.vector': 'v',
  'core.rect': 's',
  'core.circle': 'c',
  'core.ellipse': 'e',
  'core.point': 'p',
  'core.angleMark': 'a',
  'core.text': 't',
  'core.lengthMark': 'i',
  'core.graph': 'g',
  'core.latex': 'm',
  'core.latexDoc': 'd',
  [TRIM_TOOL]: 'x',
  [SPLIT_TOOL]: 'z',
};

/** キー→ツールidの逆引き(修飾キーなし) */
export const KEY_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUTS).map(([id, key]) => [key, id]),
);

/**
 * 編集・拘束ツールのShift+キーショートカット。
 * 図形ツールの単一キー(TOOL_SHORTCUTS)と同じ文字を使っていても、
 * Shift有無で区別されるため衝突しない(例: 't'=テキスト / Shift+'t'=接線拘束)。
 */
export const SHIFT_TOOL_SHORTCUTS: Record<string, string> = {
  [TANGENT_TOOL]: 't',
  [COINCIDENT_TOOL]: 'c',
  [PARALLEL_TOOL]: 'p',
  [PERPENDICULAR_TOOL]: 'n',
  [MIDPOINT_TOOL]: 'm',
  [SYMMETRY_TOOL]: 's',
};

/** キー→ツールidの逆引き(Shift+キー) */
export const SHIFT_KEY_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(SHIFT_TOOL_SHORTCUTS).map(([id, key]) => [key, id]),
);
