import { create } from 'zustand';

/** アクセス中の拘束(オブジェクトIDとロール)を指す */
export interface FocusedConstraint {
  objectId: string;
  /** 'parallel' | 'coincident' など、除去対象のロール */
  role: string;
}

/**
 * 拘束マーカー(>>や接続点)のクリックで「アクセス中」になった拘束を保持する軽量ストア。
 * フォーカス中は解除ピルを表示し、Deleteキーでオブジェクトではなくその拘束だけを外す。
 */
interface ConstraintState {
  focused: FocusedConstraint | null;
  setFocused(focused: FocusedConstraint | null): void;
}

export const useConstraintStore = create<ConstraintState>((set) => ({
  focused: null,
  setFocused(focused) {
    set({ focused });
  },
}));
