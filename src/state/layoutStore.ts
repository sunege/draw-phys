import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { resizeAxis, toggleAxisState, type AxisConfig } from './layoutMath';

export const LEFT_CFG: AxisConfig = {
  min: 140,
  max: 360,
  collapseBelow: 110,
  expandAbove: 140,
  collapsedSize: 48,
};
export const RIGHT_CFG: AxisConfig = {
  min: 170,
  max: 420,
  collapseBelow: 130,
  expandAbove: 170,
  collapsedSize: 36,
};
export const BOTTOM_CFG: AxisConfig = {
  min: 100,
  max: 360,
  collapseBelow: 70,
  expandAbove: 100,
  collapsedSize: 36,
};
/** PropertyPanelのフィールドをラベル上/入力下の2行へ切り替える幅の閾値(折りたたみとは別軸) */
export const RIGHT_NARROW_BELOW = 210;

interface LayoutState {
  leftWidth: number;
  leftCollapsed: boolean;
  rightWidth: number;
  rightCollapsed: boolean;
  bottomHeight: number;
  bottomCollapsed: boolean;

  resizeLeft(deltaGrow: number): void;
  resizeRight(deltaGrow: number): void;
  resizeBottom(deltaGrow: number): void;
  toggleLeft(): void;
  toggleRight(): void;
  toggleBottom(): void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      leftWidth: 180,
      leftCollapsed: false,
      rightWidth: 240,
      rightCollapsed: false,
      bottomHeight: 160,
      bottomCollapsed: false,

      resizeLeft(deltaGrow) {
        const { leftWidth, leftCollapsed } = get();
        const next = resizeAxis({ size: leftWidth, collapsed: leftCollapsed }, deltaGrow, LEFT_CFG);
        set({ leftWidth: next.size, leftCollapsed: next.collapsed });
      },
      resizeRight(deltaGrow) {
        const { rightWidth, rightCollapsed } = get();
        const next = resizeAxis({ size: rightWidth, collapsed: rightCollapsed }, deltaGrow, RIGHT_CFG);
        set({ rightWidth: next.size, rightCollapsed: next.collapsed });
      },
      resizeBottom(deltaGrow) {
        const { bottomHeight, bottomCollapsed } = get();
        const next = resizeAxis(
          { size: bottomHeight, collapsed: bottomCollapsed },
          deltaGrow,
          BOTTOM_CFG,
        );
        set({ bottomHeight: next.size, bottomCollapsed: next.collapsed });
      },

      toggleLeft() {
        const { leftWidth, leftCollapsed } = get();
        const next = toggleAxisState({ size: leftWidth, collapsed: leftCollapsed }, LEFT_CFG);
        set({ leftWidth: next.size, leftCollapsed: next.collapsed });
      },
      toggleRight() {
        const { rightWidth, rightCollapsed } = get();
        const next = toggleAxisState({ size: rightWidth, collapsed: rightCollapsed }, RIGHT_CFG);
        set({ rightWidth: next.size, rightCollapsed: next.collapsed });
      },
      toggleBottom() {
        const { bottomHeight, bottomCollapsed } = get();
        const next = toggleAxisState(
          { size: bottomHeight, collapsed: bottomCollapsed },
          BOTTOM_CFG,
        );
        set({ bottomHeight: next.size, bottomCollapsed: next.collapsed });
      },
    }),
    {
      name: 'draw-phys:layout',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        leftWidth: s.leftWidth,
        leftCollapsed: s.leftCollapsed,
        rightWidth: s.rightWidth,
        rightCollapsed: s.rightCollapsed,
        bottomHeight: s.bottomHeight,
        bottomCollapsed: s.bottomCollapsed,
      }),
    },
  ),
);
