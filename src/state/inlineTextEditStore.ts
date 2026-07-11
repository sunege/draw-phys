import { create } from 'zustand';

/**
 * キャンバス上インライン編集(plugin.inlineEdit)の対象オブジェクトID。
 * CanvasStage(ダブルクリック・配置直後)が open し、対象プラグインの Renderer が
 * 自身の objectId と照合して編集UI(textarea等)へ切り替える。
 */
interface InlineTextEditState {
  objectId: string | null;
  open(objectId: string): void;
  close(): void;
}

export const useInlineTextEditStore = create<InlineTextEditState>((set) => ({
  objectId: null,
  open(objectId) {
    set({ objectId });
  },
  close() {
    set({ objectId: null });
  },
}));
