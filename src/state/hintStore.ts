import { create } from 'zustand';

/**
 * 画面上部中央に浮かべる操作ガイド(モード連動の常設ヒント)。
 * どのコンポーネントからでも setHint/clearHint で駆動できる汎用の仕組み。
 * トースト(自動消滅)ではなく、モードが有効な間ステップに応じて出しっぱなしにする用途。
 */
export interface Hint {
  /** 現在行うべき操作の説明 */
  message: string;
  /** モード名などの見出し(任意) */
  title?: string;
  /** 進捗表示(任意, 例 1/2) */
  step?: { current: number; total: number };
}

interface HintState {
  hint: Hint | null;
  /** ヒントを表示/更新する(null で消す) */
  setHint(hint: Hint | null): void;
  clearHint(): void;
}

export const useHintStore = create<HintState>((set) => ({
  hint: null,
  setHint(hint) {
    set({ hint });
  },
  clearHint() {
    set({ hint: null });
  },
}));
