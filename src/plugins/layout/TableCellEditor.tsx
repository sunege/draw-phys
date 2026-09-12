import { useEffect, useRef } from 'react';
import type { Transform } from '../../core/types';
import { useDocumentStore } from '../../state/documentStore';
import { useInlineTextEditStore } from '../../state/inlineTextEditStore';
import styles from './TableCellEditor.module.css';
import { cellFontStyle, edges, tableSize, type TableProps } from './tableMath';

/**
 * 表のセル直接入力。編集中の表の上に、各セルとぴったり重なる input を敷く。
 *
 * 編集はドラッグ操作と同じ transient → commit の2段(text.tsx のインライン編集と同じ):
 * 入力は setObjectTransient でライブ反映(履歴に残らない)、編集終了で commitObject(履歴1エントリ)、
 * Escape で編集前へ復元する。入力内容は $...$ を含む生のソースで、確定後に数式として描かれる。
 */
export function TableCellEditor({
  objectId,
  props,
  focusIndex,
}: {
  objectId: string;
  props: TableProps;
  focusIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  // 編集開始時のスナップショット(キャンセル復元・commit差分の基準)
  const beforeRef = useRef<{ transform: Transform; props: Record<string, unknown> } | null>(null);
  const canceledRef = useRef(false);

  useEffect(() => {
    const obj = useDocumentStore.getState().objects[objectId];
    if (obj) beforeRef.current = { transform: obj.transform, props: obj.props };
    canceledRef.current = false;
    const input = inputsRef.current[focusIndex] ?? inputsRef.current[0];
    input?.focus();
    input?.select();
  }, [objectId, focusIndex]);

  const finish = () => {
    const doc = useDocumentStore.getState();
    const before = beforeRef.current;
    if (before) {
      if (canceledRef.current) doc.setObjectTransient(objectId, { props: before.props });
      else doc.commitObject(objectId, before);
    }
    useInlineTextEditStore.getState().close();
  };

  const setCell = (idx: number, value: string) => {
    const doc = useDocumentStore.getState();
    const cur = doc.objects[objectId];
    if (!cur) return;
    const cells = [...(cur.props as unknown as TableProps).cells];
    cells[idx] = value;
    doc.setObjectTransient(objectId, { props: { ...cur.props, cells } });
  };

  /** 入力欄の間を移動する(端は折り返す)。移動できなければ false */
  const focusCell = (idx: number): boolean => {
    const input = inputsRef.current[idx];
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  };

  const count = props.rows * props.cols;
  const xs = edges(props.colWidths);
  const ys = edges(props.rowHeights);
  const { width, height } = tableSize(props);

  return (
    <foreignObject
      x={xs[0]}
      y={ys[0]}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <div
        ref={containerRef}
        // 単体SVGとして書き出したときにも正しく解釈されるよう名前空間を明示する
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        style={{ position: 'relative', width: `${width}px`, height: `${height}px` }}
      >
        {Array.from({ length: count }, (_, idx) => {
          const r = Math.floor(idx / props.cols);
          const c = idx % props.cols;
          return (
            <input
              key={idx}
              ref={(el) => {
                inputsRef.current[idx] = el;
              }}
              className={styles.cell}
              type="text"
              value={props.cells[idx] ?? ''}
              style={{
                ...cellFontStyle({
                  fontSize: props.fontSize,
                  fontFamily: props.fontFamily,
                  bold: props.headerRow && r === 0,
                }),
                left: `${xs[c] - xs[0]}px`,
                top: `${ys[r] - ys[0]}px`,
                width: `${xs[c + 1] - xs[c]}px`,
                height: `${ys[r + 1] - ys[r]}px`,
                color: props.textColor,
                textAlign: props.align,
              }}
              onChange={(e) => setCell(idx, e.target.value)}
              // 入力欄の中でのクリック・ドラッグ選択を表の移動ドラッグにしない
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // CanvasStage の window キーハンドラ(Delete で選択削除など)へ渡さない
                e.stopPropagation();
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Escape') {
                  canceledRef.current = true;
                  e.currentTarget.blur();
                } else if (e.key === 'Enter') {
                  // 次の行の同じ列へ(最終行なら編集を終える)
                  if (!focusCell(idx + props.cols)) e.currentTarget.blur();
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  const next = e.shiftKey ? idx - 1 : idx + 1;
                  focusCell((next + count) % count);
                }
              }}
              onBlur={() => {
                // 入力欄から入力欄への移動では終了しない(activeElement の確定を待って判定する)
                setTimeout(() => {
                  if (containerRef.current?.contains(document.activeElement)) return;
                  finish();
                }, 0);
              }}
            />
          );
        })}
      </div>
    </foreignObject>
  );
}
