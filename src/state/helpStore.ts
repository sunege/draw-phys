import { create } from 'zustand';

/**
 * ユーザーガイド(ヘルプダイアログ)の開閉状態。
 * メニューバーの「ガイド」ボタンとキーボードの「?」の両方から開けるよう共有ストアにする。
 */
interface HelpState {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

export const useHelpStore = create<HelpState>((set) => ({
  open: false,
  setOpen(open) {
    set({ open });
  },
  toggle() {
    set((s) => ({ open: !s.open }));
  },
}));
