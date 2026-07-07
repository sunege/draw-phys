import { create } from 'zustand';

/**
 * プラグインの大型エディタモーダル(plugin.EditorModal)の開閉状態。
 * CanvasStage(ダブルクリック・配置直後)と PropertyPanel(編集ボタン)から開き、
 * EditorModalHost が表示する。
 */
interface EditorModalState {
  /** 編集中オブジェクトのID(nullなら閉じている) */
  objectId: string | null;
  open(objectId: string): void;
  close(): void;
}

export const useEditorModalStore = create<EditorModalState>((set) => ({
  objectId: null,
  open(objectId) {
    set({ objectId });
  },
  close() {
    set({ objectId: null });
  },
}));
