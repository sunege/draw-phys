import { useRef } from 'react';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  orientation: 'vertical' | 'horizontal';
  /** onResizeへ渡す値が常に「正=拡大」になるよう、raw pointer移動量へ掛ける符号 */
  sign: 1 | -1;
  collapsed: boolean;
  onResize: (deltaGrow: number) => void;
  onToggle: () => void;
  /** 展開時につまみに出す矢印(押すと閉じる向き) */
  glyphWhenExpanded: string;
  /** 折りたたみ時につまみに出す矢印(押すと開く向き) */
  glyphWhenCollapsed: string;
  /** ツールチップ・aria-label用のパネル名 */
  label: string;
}

/**
 * 左右パネル・下パネルの境界に置く共通のドラッグリサイズハンドル。
 * 中央のつまみ(タブ)はドラッグの取っ掛かりを示すと同時に、タップ/クリックで
 * 折りたたみ⇄展開を即座に切り替えるボタンでもある(トラックパッド・タッチ向け)。
 */
export function ResizeHandle({
  orientation,
  sign,
  collapsed,
  onResize,
  onToggle,
  glyphWhenExpanded,
  glyphWhenCollapsed,
  label,
}: ResizeHandleProps) {
  const dragOwnerRef = useRef<number | null>(null);
  const lastPosRef = useRef(0);

  const posFromEvent = (e: React.PointerEvent) =>
    orientation === 'vertical' ? e.clientX : e.clientY;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 既に別のポインタでドラッグ中なら、2本目以降は無視する(CanvasStageと同じ単一所有の考え方)
    if (dragOwnerRef.current !== null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ポインタが既に無効な場合は捕捉できなくてもよい */
    }
    dragOwnerRef.current = e.pointerId;
    lastPosRef.current = posFromEvent(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragOwnerRef.current !== e.pointerId) return;
    const pos = posFromEvent(e);
    const delta = (pos - lastPosRef.current) * sign;
    lastPosRef.current = pos;
    if (delta !== 0) onResize(delta);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragOwnerRef.current !== e.pointerId) return;
    dragOwnerRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const toggleTitle = collapsed ? `${label}を開く` : `${label}を折りたたむ`;

  return (
    <div
      className={styles.strip}
      data-orientation={orientation}
      data-collapsed={collapsed}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={styles.line} />
      <button
        type="button"
        className={styles.tab}
        // ここで止めないと、つまみのタップがストリップ側のドラッグ開始として扱われてしまう
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        title={toggleTitle}
        aria-label={toggleTitle}
      >
        {collapsed ? glyphWhenCollapsed : glyphWhenExpanded}
      </button>
    </div>
  );
}
