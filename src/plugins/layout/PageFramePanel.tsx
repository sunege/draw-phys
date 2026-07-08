import { orderedPageFrames } from '../../core/pageFrames';
import { useDocumentStore } from '../../state/documentStore';
import styles from './PageFramePanel.module.css';
import { PAGE_PRESETS, landscape, portrait, type PageFrameProps } from './pageFrameMath';

/**
 * 用紙枠のプロパティパネル拡張。
 * ページ順の入れ替え、定型サイズ(A4/B4/B5等)のワンクリック設定と縦横の切り替えを提供する。
 * サイズの実体は width/height(mm) なので、プリセットはそれらを書き換えるだけ。
 */
export function PageFramePanel({
  objectId,
  props,
}: {
  objectId: string;
  props: PageFrameProps;
}) {
  const objects = useDocumentStore((s) => s.objects);
  const updateProps = useDocumentStore((s) => s.updateProps);
  const updatePropsMany = useDocumentStore((s) => s.updatePropsMany);
  const setSize = (width: number, height: number) => updateProps(objectId, { width, height });

  // ページ順は pageNumber の並び。隣と入れ替えて全用紙枠を 1..N に振り直す(1履歴エントリ)
  const frames = orderedPageFrames(objects);
  const index = frames.findIndex((f) => f.id === objectId);
  const total = frames.length;
  const move = (dir: -1 | 1) => {
    const j = index + dir;
    if (index < 0 || j < 0 || j >= total) return;
    const reordered = [...frames];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];
    const patches: Record<string, Record<string, unknown>> = {};
    reordered.forEach((f, i) => {
      patches[f.id] = { pageNumber: i + 1 };
    });
    updatePropsMany(patches);
  };

  return (
    <>
      <div className={styles.section}>
        <span className={styles.label}>ページ順</span>
        <div className={styles.row}>
          <button type="button" disabled={index <= 0} onClick={() => move(-1)} title="前のページへ">
            ◀ 前へ
          </button>
          <span className={styles.pageNo}>
            {index >= 0 ? index + 1 : '-'} / {total}
          </span>
          <button
            type="button"
            disabled={index < 0 || index >= total - 1}
            onClick={() => move(1)}
            title="次のページへ"
          >
            後へ ▶
          </button>
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.label}>用紙サイズ</span>
      <div className={styles.row}>
        {PAGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={`${p.w}×${p.h}mm`}
            onClick={() => setSize(p.w, p.h)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          title="縦向き(幅≤高さ)"
          onClick={() => {
            const o = portrait(props.width, props.height);
            setSize(o.width, o.height);
          }}
        >
          縦
        </button>
        <button
          type="button"
          title="横向き(幅≥高さ)"
          onClick={() => {
            const o = landscape(props.width, props.height);
            setSize(o.width, o.height);
          }}
        >
          横
        </button>
      </div>
      </div>
    </>
  );
}
