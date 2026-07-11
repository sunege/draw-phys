import { create } from 'zustand';

/** 'select' または配置するプラグインID */
export type ActiveTool = 'select' | (string & {});

interface ToolState {
  activeTool: ActiveTool;
  /** 直前に使った配置/操作ツール(右クリックで再選択して繰り返すため。'select'は記憶しない) */
  lastTool: ActiveTool | null;
  setActiveTool(tool: ActiveTool): void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  lastTool: null,
  setActiveTool(tool) {
    set(tool === 'select' ? { activeTool: tool } : { activeTool: tool, lastTool: tool });
  },
}));
