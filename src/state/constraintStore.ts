import { create } from 'zustand';
import type { ConstraintIssue } from '../core/constraints';

/** アクセス中の拘束(オブジェクトIDとロール)を指す */
export interface FocusedConstraint {
  objectId: string;
  /** 'parallel' | 'coincident' など、除去対象のロール */
  role: string;
  /** 同一ロールが複数あるとき(coincident×2)の refs 配列上の位置 */
  refIndex?: number;
}

/** issuesが空のときに使い回す安定参照(セレクタの無限ループ防止) */
const NO_ISSUES: ConstraintIssue[] = [];

/**
 * 拘束マーカー(>>や接続点)のクリックで「アクセス中」になった拘束を保持する軽量ストア。
 * フォーカス中は解除ピルを表示し、Deleteキーでオブジェクトではなくその拘束だけを外す。
 * issues は直近の拘束解決で解けなかった拘束(過剰拘束)。マーカーの赤表示に使う。
 */
interface ConstraintState {
  focused: FocusedConstraint | null;
  issues: ConstraintIssue[];
  setFocused(focused: FocusedConstraint | null): void;
  /** 解決結果のissuesを反映する。内容が同じなら参照を変えない(再描画抑制) */
  setIssues(issues: ConstraintIssue[]): void;
}

function sameIssues(a: ConstraintIssue[], b: ConstraintIssue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (x, i) =>
      x.objectId === b[i].objectId &&
      x.role === b[i].role &&
      x.refIndex === b[i].refIndex &&
      x.message === b[i].message,
  );
}

export const useConstraintStore = create<ConstraintState>((set, get) => ({
  focused: null,
  issues: NO_ISSUES,
  setFocused(focused) {
    set({ focused });
  },
  setIssues(issues) {
    const next = issues.length === 0 ? NO_ISSUES : issues;
    if (sameIssues(get().issues, next)) return;
    set({ issues: next });
  },
}));
