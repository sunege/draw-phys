import { useDocumentStore } from '../../state/documentStore';
import styles from './TablePanel.module.css';
import { resizeTable, type TableProps } from './tableMath';

/** 行・列を追加したときの既定寸法(内部単位) */
const DEFAULT_COL_W = 80;
const DEFAULT_ROW_H = 34;

/**
 * 表のパネル拡張。行数・列数の増減と、各セルの文字入力を提供する。
 * 行列の増減は resizeTable で既存内容を保ったまま cells/colWidths/rowHeights を作り直す。
 */
export function TablePanel({ objectId, props }: { objectId: string; props: TableProps }) {
  const updateProps = useDocumentStore((s) => s.updateProps);

  const resize = (rows: number, cols: number) =>
    updateProps(objectId, resizeTable(props, rows, cols, DEFAULT_COL_W, DEFAULT_ROW_H));

  const setCell = (idx: number, value: string) => {
    const cells = [...props.cells];
    cells[idx] = value;
    updateProps(objectId, { cells });
  };

  return (
    <>
      <div className={styles.section}>
        <span className={styles.label}>行 × 列</span>
        <div className={styles.row}>
          <span className={styles.label}>行</span>
          <button type="button" disabled={props.rows <= 1} onClick={() => resize(props.rows - 1, props.cols)}>
            −
          </button>
          <span className={styles.count}>{props.rows}</span>
          <button type="button" onClick={() => resize(props.rows + 1, props.cols)}>
            ＋
          </button>
          <span className={styles.spacer} />
          <span className={styles.label}>列</span>
          <button type="button" disabled={props.cols <= 1} onClick={() => resize(props.rows, props.cols - 1)}>
            −
          </button>
          <span className={styles.count}>{props.cols}</span>
          <button type="button" onClick={() => resize(props.rows, props.cols + 1)}>
            ＋
          </button>
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.label}>セル内容</span>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${props.cols}, minmax(52px, 1fr))` }}
        >
          {Array.from({ length: props.rows * props.cols }, (_, idx) => (
            <input
              key={idx}
              type="text"
              value={props.cells[idx] ?? ''}
              onChange={(e) => setCell(idx, e.target.value)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
