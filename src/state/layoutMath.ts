/** パネルの伸縮＋折りたたみを1軸(幅 or 高さ)で表す設定。collapsedSizeはヒステリシス計算専用でCSSには使わない */
export interface AxisConfig {
  min: number;
  max: number;
  /** 展開中にこれを下回ったら折りたたみへ */
  collapseBelow: number;
  /** 折りたたみ中にこれを上回ったら展開へ(collapseBelowより大きい値=ヒステリシスの不感帯) */
  expandAbove: number;
  collapsedSize: number;
}

export interface AxisState {
  size: number;
  collapsed: boolean;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * ドラッグ1回分の適用。sizeは折りたたみ中も内部的に追従し続ける。
 * collapseBelow < min であるため、下限は min ではなく collapsedSize でクランプする
 * (min始まりだと size が collapseBelow まで下がれず、折りたたみへ遷移できなくなる)。
 * collapsedは2閾値のシュミットトリガーとして導出する(不感帯 = [collapseBelow, expandAbove))。
 */
export function resizeAxis(state: AxisState, deltaGrow: number, cfg: AxisConfig): AxisState {
  const size = clamp(state.size + deltaGrow, cfg.collapsedSize, cfg.max);
  const collapsed = state.collapsed ? size < cfg.expandAbove : size < cfg.collapseBelow;
  return { size, collapsed };
}

/** つまみクリックでの即時トグル。展開時にsizeがmin未満(永続化直後の初回等)なら引き上げる */
export function toggleAxisState(state: AxisState, cfg: AxisConfig): AxisState {
  const collapsed = !state.collapsed;
  const size = collapsed ? state.size : clamp(state.size, cfg.min, cfg.max);
  return { size, collapsed };
}
