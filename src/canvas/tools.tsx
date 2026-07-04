import type { ComponentType } from 'react';

/**
 * 図形プラグインではない「操作モード」ツール。
 * ツールボックスに 'select' と並んで表示され、activeTool にそのidが入る。
 * キャンバスの操作ステートマシンがidを見て振る舞いを分岐する。
 */
export interface OperationTool {
  id: string;
  name: string;
  category: string;
  Icon: ComponentType;
}

export const TANGENT_TOOL = 'tangent';

export const OPERATION_TOOLS: OperationTool[] = [
  {
    id: TANGENT_TOOL,
    name: '接線',
    category: '拘束',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <circle cx="10" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="2" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];
