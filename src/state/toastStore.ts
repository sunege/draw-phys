import { create } from 'zustand';

/**
 * 画面下部中央に一時表示する通知(トースト)。一定時間で自動的に消える。
 * hintStore(モード連動の常設ガイド)とは別で、操作完了の一過性フィードバック用。
 * どのコンポーネントからでも showToast で駆動できる汎用の仕組み。
 */
export type ToastKind = 'success' | 'error';

export interface Toast {
  /** 表示ごとに増える識別子。古いタイマーが新しいトーストを消さないために使う */
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toast: Toast | null;
  /** トーストを表示する(既定2.5秒で自動消滅)。連続表示は新しいidで出し直す */
  showToast(message: string, kind?: ToastKind, durationMs?: number): void;
  clearToast(): void;
}

let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  showToast(message, kind = 'success', durationMs = 2500) {
    if (timer) clearTimeout(timer);
    const id = ++seq;
    set({ toast: { id, message, kind } });
    timer = setTimeout(() => {
      // 自分より後に出たトーストがあれば消さない
      if (get().toast?.id === id) set({ toast: null });
      timer = null;
    }, durationMs);
  },
  clearToast() {
    if (timer) clearTimeout(timer);
    timer = null;
    set({ toast: null });
  },
}));
