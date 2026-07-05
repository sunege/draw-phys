import { create } from 'zustand';
import type { Point } from '../core/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

/** スナップ間隔の分割数。実効間隔 = gridSize / snapDivision(1=グリッド, 2=1/2, 4=1/4) */
export type SnapDivision = 1 | 2 | 4;

interface ViewportState {
  /** 画面左上に対応するワールド座標 */
  pan: Point;
  zoom: number;
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  snapDivision: SnapDivision;

  panBy(dxScreen: number, dyScreen: number): void;
  /** worldPointの画面上の位置を保ったままズームする */
  zoomAt(worldPoint: Point, factor: number): void;
  resetView(): void;
  setGridVisible(visible: boolean): void;
  setSnapEnabled(enabled: boolean): void;
  setSnapDivision(division: SnapDivision): void;
  /** スナップON/OFFを切り替える(間隔設定は保持するので、ON復帰時に直前の間隔へ戻る) */
  toggleSnap(): void;
  /** 実効スナップ間隔(ワールド距離)。gridSize を分割数で割った値 */
  snapStep(): number;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  pan: { x: -100, y: -100 },
  zoom: 1,
  gridSize: 10,
  gridVisible: true,
  snapEnabled: true,
  snapDivision: 1,

  panBy(dxScreen, dyScreen) {
    const { pan, zoom } = get();
    set({ pan: { x: pan.x - dxScreen / zoom, y: pan.y - dyScreen / zoom } });
  },

  zoomAt(worldPoint, factor) {
    const { pan, zoom } = get();
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    if (nextZoom === zoom) return;
    const ratio = zoom / nextZoom;
    set({
      zoom: nextZoom,
      pan: {
        x: worldPoint.x - (worldPoint.x - pan.x) * ratio,
        y: worldPoint.y - (worldPoint.y - pan.y) * ratio,
      },
    });
  },

  resetView() {
    set({ pan: { x: -100, y: -100 }, zoom: 1 });
  },

  setGridVisible(visible) {
    set({ gridVisible: visible });
  },

  setSnapEnabled(enabled) {
    set({ snapEnabled: enabled });
  },

  setSnapDivision(division) {
    set({ snapDivision: division });
  },

  toggleSnap() {
    set({ snapEnabled: !get().snapEnabled });
  },

  snapStep() {
    const { gridSize, snapDivision } = get();
    return gridSize / snapDivision;
  },
}));
