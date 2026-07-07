/**
 * ダブルクリック判定。
 * ネイティブdblclickはポインタイベント駆動のテスト(合成PointerEvent)から発火しないため、
 * onPointerUp で「移動していないクリック」2回を自前で判定する。
 */
export interface ClickRecord {
  /** クリックしたオブジェクトID */
  id: string;
  /** イベントのtimeStamp(ms) */
  time: number;
  /** スクリーン座標(クリック位置のずれ判定用) */
  x: number;
  y: number;
}

export const DOUBLE_CLICK_MS = 400;
export const DOUBLE_CLICK_DIST = 6;

/** 直前クリックと今回クリックがダブルクリックを構成するか(同一対象・時間内・移動閾値内) */
export function isDoubleClick(prev: ClickRecord | null, cur: ClickRecord): boolean {
  if (!prev) return false;
  return (
    prev.id === cur.id &&
    cur.time - prev.time <= DOUBLE_CLICK_MS &&
    Math.abs(cur.x - prev.x) <= DOUBLE_CLICK_DIST &&
    Math.abs(cur.y - prev.y) <= DOUBLE_CLICK_DIST
  );
}
