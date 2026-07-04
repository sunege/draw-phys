import { create } from 'zustand';

/** 'select' または配置するプラグインID */
export type ActiveTool = 'select' | (string & {});

interface ToolState {
  activeTool: ActiveTool;
  setActiveTool(tool: ActiveTool): void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  setActiveTool(tool) {
    set({ activeTool: tool });
  },
}));
