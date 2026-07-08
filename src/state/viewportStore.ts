import { create } from 'zustand';
import type { Point, Rect } from '../core/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
/** rectを画面に収めるときの余白率(1=ぴったり) */
const FRAME_FIT = 0.9;

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
  /**
   * ワールド矩形 rect を画面(viewW×viewH px)の中央に収まるようズーム・パンする。
   * ページ移動(用紙枠へ表示を移す)などに使う。
   */
  frameWorldRect(rect: Rect, viewW: number, viewH: number): void;
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

  frameWorldRect(rect, viewW, viewH) {
    if (rect.width <= 0 || rect.height <= 0 || viewW <= 0 || viewH <= 0) return;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(viewW / rect.width, viewH / rect.height) * FRAME_FIT),
    );
    // pan は画面左上に対応するワールド座標。rect の中心を画面中心に合わせる
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    set({ zoom, pan: { x: cx - viewW / 2 / zoom, y: cy - viewH / 2 / zoom } });
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
