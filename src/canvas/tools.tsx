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
export const PARALLEL_TOOL = 'parallel';
export const PERPENDICULAR_TOOL = 'perpendicular';
export const COINCIDENT_TOOL = 'coincident';
export const TRIM_TOOL = 'trim';
export const GRAPH_RANGE_TOOL = 'graphRange';

export const OPERATION_TOOLS: OperationTool[] = [
  {
    id: TRIM_TOOL,
    name: 'トリム',
    category: '編集',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <circle cx="7" cy="7" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="7" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <line x1="8.9" y1="8.4" x2="20" y2="18" stroke="currentColor" strokeWidth="1.6" />
        <line x1="8.9" y1="15.6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: GRAPH_RANGE_TOOL,
    name: 'グラフ範囲',
    category: '編集',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <rect
          x="3"
          y="4"
          width="13"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <circle cx="15" cy="15" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <line x1="18.2" y1="18.2" x2="22" y2="22" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
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
  {
    id: PARALLEL_TOOL,
    name: '平行',
    category: '拘束',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <line x1="4" y1="8" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="18" x2="20" y2="14" stroke="currentColor" strokeWidth="2" />
        <path
          d="M11 11 L14 12.5 L11 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: PERPENDICULAR_TOOL,
    name: '垂直',
    category: '拘束',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="2" />
        <line x1="6" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="15" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: COINCIDENT_TOOL,
    name: '一致',
    category: '拘束',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <circle cx="9" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="15" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
    ),
  },
];
