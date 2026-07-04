import { create } from 'zustand';
import type { Point } from '../core/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

interface ViewportState {
  /** 画面左上に対応するワールド座標 */
  pan: Point;
  zoom: number;
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;

  panBy(dxScreen: number, dyScreen: number): void;
  /** worldPointの画面上の位置を保ったままズームする */
  zoomAt(worldPoint: Point, factor: number): void;
  resetView(): void;
  setGridVisible(visible: boolean): void;
  setSnapEnabled(enabled: boolean): void;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  pan: { x: -100, y: -100 },
  zoom: 1,
  gridSize: 10,
  gridVisible: true,
  snapEnabled: true,

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
}));
