/**
 * 用紙枠プラグインの純粋部分(プリセット・向き変換)。
 * サイズ等は props に実寸(mm)で持ち、描画・当たり判定へは mmToUnits で内部単位へ換算する。
 */

export interface PageFrameProps {
  /** ページ順の並び替えキー(小さいほど前)。配置時に末尾へ自動採番される */
  pageNumber: number;
  /** 用紙の幅(mm) */
  width: number;
  /** 用紙の高さ(mm) */
  height: number;
  /** 余白(mm)。余白ガイドの内側矩形のインセット量 */
  marginMm: number;
  /** 余白ガイド(破線)を表示する(キャンバス上のみ。書き出しには出ない) */
  showMargin: boolean;
  /** 用紙の枠線を表示する */
  showBorder: boolean;
  /** 用紙を色で塗る(既定は塗らない=背面の内容が透ける) */
  filled: boolean;
  /** 用紙色(filled のとき有効) */
  fill: string;
  /** 枠線色 */
  stroke: string;
  /** レイアウト補助線(等分線・対角線)を表示する(キャンバス上のみ。書き出しには出ない) */
  showGuides: boolean;
  /** 縦の等分数(guideCols=2 で中央に縦線1本)。1で縦の等分線なし */
  guideCols: number;
  /** 横の等分数(guideRows=2 で中央に横線1本)。1で横の等分線なし */
  guideRows: number;
  /** 対角線の補助線を引く */
  guideDiagonals: boolean;
}

export interface PagePreset {
  id: string;
  label: string;
  /** 幅(mm) */
  w: number;
  /** 高さ(mm) */
  h: number;
}

/** 用紙プリセット(mm)。紙は縦向き、スライドは横向きを既定の並びにする */
export const PAGE_PRESETS: PagePreset[] = [
  { id: 'a3', label: 'A3', w: 297, h: 420 },
  { id: 'b4', label: 'B4', w: 257, h: 364 },
  { id: 'a4', label: 'A4', w: 210, h: 297 },
  { id: 'b5', label: 'B5', w: 182, h: 257 },
  { id: 'a5', label: 'A5', w: 148, h: 210 },
  { id: 'slide', label: 'スライド16:9', w: 254, h: 143 },
];

/** 縦向き(幅≤高さ)にそろえる */
export function portrait(width: number, height: number): { width: number; height: number } {
  return { width: Math.min(width, height), height: Math.max(width, height) };
}

/** 横向き(幅≥高さ)にそろえる */
export function landscape(width: number, height: number): { width: number; height: number } {
  return { width: Math.max(width, height), height: Math.min(width, height) };
}
