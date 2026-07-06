import { useDocumentStore } from '../../state/documentStore';
import type { LineStyle } from '../basic/lineUtils';
import type { LabelContent } from '../basic/objectLabel';
import styles from './GraphPanel.module.css';
import { isValidRange } from './graphMath';
import type { GraphProps, GraphRange } from './graphTypes';

/** 数値フィールド(NaNは無視) */
function Num({
  label,
  value,
  onChange,
  min,
  max,
  step,
  title,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  title?: string;
}) {
  return (
    <label className={styles.field} title={title}>
      <span className={styles.label}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  title?: string;
}) {
  return (
    <label className={styles.field} title={title}>
      <span className={styles.label}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** 線種セレクタ(実線/破線/点線) */
function StyleSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LineStyle;
  onChange: (s: LineStyle) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as LineStyle)}>
        <option value="solid">実線</option>
        <option value="dashed">破線</option>
        <option value="dotted">点線</option>
      </select>
    </label>
  );
}

/** 軸ラベル(テキスト/LaTeX/なし)の編集 */
function LabelEditor({
  label,
  content,
  onChange,
}: {
  label: string;
  content: LabelContent;
  onChange: (c: LabelContent) => void;
}) {
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>{label}</span>
        <select
          value={content.mode}
          onChange={(e) => onChange({ ...content, mode: e.target.value as LabelContent['mode'] })}
        >
          <option value="text">テキスト</option>
          <option value="latex">LaTeX</option>
          <option value="none">なし</option>
        </select>
      </label>
      {content.mode === 'text' && (
        <label className={styles.field}>
          <span className={styles.label}>文字</span>
          <input
            type="text"
            value={content.text}
            onChange={(e) => onChange({ ...content, text: e.target.value })}
          />
        </label>
      )}
      {content.mode === 'latex' && (
        <label className={styles.field}>
          <span className={styles.label}>LaTeX式</span>
          <input
            type="text"
            value={content.latex}
            onChange={(e) => onChange({ ...content, latex: e.target.value })}
          />
        </label>
      )}
    </>
  );
}

/** ラベル位置補正(dx/dy)の横並び入力 */
function OffsetPair({
  label,
  dx,
  dy,
  onChange,
}: {
  label: string;
  dx: number;
  dy: number;
  onChange: (dx: number, dy: number) => void;
}) {
  const handle = (value: string, other: number, isX: boolean) => {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    if (isX) onChange(n, other);
    else onChange(other, n);
  };
  return (
    <div className={styles.field} title="ラベルの位置補正(px)。キャンバス上のドラッグでも動かせる">
      <span className={styles.label}>{label}</span>
      <span className={styles.pair}>
        <input type="number" value={dx} onChange={(e) => handle(e.target.value, dy, true)} />
        <input type="number" value={dy} onChange={(e) => handle(e.target.value, dx, false)} />
      </span>
    </div>
  );
}

/**
 * グラフのプロパティパネル拡張。
 * スキーマでは表せない範囲リセット・軸ラベル・グリッド詳細・プロット一覧を提供する。
 */
export function GraphPanel({ objectId, props }: { objectId: string; props: GraphProps }) {
  const updateProps = useDocumentStore((s) => s.updateProps);
  const up = (patch: Partial<GraphProps>) => updateProps(objectId, patch as Record<string, unknown>);

  const range: GraphRange = { xMin: props.xMin, xMax: props.xMax, yMin: props.yMin, yMax: props.yMax };
  // 表示範囲は min<max を満たす変更のみ受け付ける
  const setRange = (patch: Partial<GraphRange>) => {
    if (isValidRange({ ...range, ...patch })) up(patch);
  };

  // 座標スタイルのワンクリック切替
  const applyPreset = (preset: 'grid' | 'ticks' | 'plain') => {
    if (preset === 'grid') {
      up({ showAxes: true, showMajorGrid: true, showTicks: true, showTickLabels: true });
    } else if (preset === 'ticks') {
      up({
        showAxes: true,
        showMajorGrid: false,
        showMinorGrid: false,
        showTicks: true,
        showTickLabels: true,
      });
    } else {
      up({
        showAxes: true,
        showMajorGrid: false,
        showMinorGrid: false,
        showTicks: false,
        showTickLabels: false,
      });
    }
  };

  return (
    <div>
      <details open className={styles.section}>
        <summary>表示範囲</summary>
        <Num label="x最小" value={props.xMin} step={1} onChange={(n) => setRange({ xMin: n })} />
        <Num label="x最大" value={props.xMax} step={1} onChange={(n) => setRange({ xMax: n })} />
        <Num label="y最小" value={props.yMin} step={1} onChange={(n) => setRange({ yMin: n })} />
        <Num label="y最大" value={props.yMax} step={1} onChange={(n) => setRange({ yMax: n })} />
        <div className={styles.row}>
          <button
            type="button"
            title="表示範囲を既定値へ戻す"
            onClick={() => up({ ...props.defaultRange })}
          >
            範囲をリセット
          </button>
          <button
            type="button"
            title="現在の表示範囲をリセットの戻り先にする"
            onClick={() => up({ defaultRange: range })}
          >
            現在を既定にする
          </button>
        </div>
      </details>

      <details className={styles.section}>
        <summary>軸</summary>
        <Check label="軸を表示" checked={props.showAxes} onChange={(b) => up({ showAxes: b })} />
        <Check label="矢印" checked={props.showArrows} onChange={(b) => up({ showArrows: b })} />
        <Color label="軸の色" value={props.axisColor} onChange={(c) => up({ axisColor: c })} />
        <Num
          label="軸の太さ"
          value={props.axisWidth}
          min={0.5}
          step={0.5}
          onChange={(n) => up({ axisWidth: n })}
        />
        <LabelEditor label="x軸ラベル" content={props.xLabel} onChange={(c) => up({ xLabel: c })} />
        <OffsetPair
          label="x位置補正"
          dx={props.xLabelDx}
          dy={props.xLabelDy}
          onChange={(dx, dy) => up({ xLabelDx: dx, xLabelDy: dy })}
        />
        <LabelEditor label="y軸ラベル" content={props.yLabel} onChange={(c) => up({ yLabel: c })} />
        <OffsetPair
          label="y位置補正"
          dx={props.yLabelDx}
          dy={props.yLabelDy}
          onChange={(dx, dy) => up({ yLabelDx: dx, yLabelDy: dy })}
        />
        <Num
          label="ラベルサイズ"
          value={props.labelFontSize}
          min={6}
          step={2}
          onChange={(n) => up({ labelFontSize: n })}
        />
        <Check label="原点O" checked={props.showOrigin} onChange={(b) => up({ showOrigin: b })} />
        <label className={styles.field}>
          <span className={styles.label}>原点の文字</span>
          <input
            type="text"
            value={props.originText}
            onChange={(e) => up({ originText: e.target.value })}
          />
        </label>
      </details>

      <details className={styles.section}>
        <summary>目盛り・グリッド</summary>
        <div className={styles.row}>
          <button type="button" onClick={() => applyPreset('grid')} title="罫線グリッドあり">
            方眼
          </button>
          <button type="button" onClick={() => applyPreset('ticks')} title="軸上の目盛りのみ">
            目盛りのみ
          </button>
          <button type="button" onClick={() => applyPreset('plain')} title="目盛りなし">
            軸のみ
          </button>
        </div>
        <Num
          label="x刻み"
          value={props.xStep}
          min={0}
          step={0.5}
          title="0 = 自動(1-2-5系列)"
          onChange={(n) => up({ xStep: n })}
        />
        <Num
          label="y刻み"
          value={props.yStep}
          min={0}
          step={0.5}
          title="0 = 自動(1-2-5系列)"
          onChange={(n) => up({ yStep: n })}
        />
        <Num
          label="副分割数"
          value={props.minorDivisions}
          min={1}
          max={10}
          step={1}
          title="主目盛り1区間を何分割するか(1=副目盛りなし)"
          onChange={(n) => up({ minorDivisions: Math.max(1, Math.round(n)) })}
        />
        <Check label="目盛り線" checked={props.showTicks} onChange={(b) => up({ showTicks: b })} />
        <Num
          label="目盛り長さ"
          value={props.tickLength}
          min={0}
          step={1}
          onChange={(n) => up({ tickLength: n })}
        />
        <Check
          label="目盛り数値"
          checked={props.showTickLabels}
          onChange={(b) => up({ showTickLabels: b })}
        />
        <Num
          label="数値サイズ"
          value={props.tickFontSize}
          min={6}
          step={1}
          onChange={(n) => up({ tickFontSize: n })}
        />
        <Num
          label="小数桁"
          value={props.tickDecimals}
          min={-1}
          max={6}
          step={1}
          title="-1 = 刻みから自動"
          onChange={(n) => up({ tickDecimals: Math.round(n) })}
        />
        <Check
          label="主グリッド"
          checked={props.showMajorGrid}
          onChange={(b) => up({ showMajorGrid: b })}
        />
        <Color
          label="主の色"
          value={props.majorGridColor}
          onChange={(c) => up({ majorGridColor: c })}
        />
        <Num
          label="主の線幅"
          value={props.majorGridWidth}
          min={0.25}
          step={0.25}
          onChange={(n) => up({ majorGridWidth: n })}
        />
        <StyleSelect
          label="主の線種"
          value={props.majorGridStyle}
          onChange={(s) => up({ majorGridStyle: s })}
        />
        <Check
          label="副グリッド"
          checked={props.showMinorGrid}
          onChange={(b) => up({ showMinorGrid: b })}
        />
        <Color
          label="副の色"
          value={props.minorGridColor}
          onChange={(c) => up({ minorGridColor: c })}
        />
        <Num
          label="副の線幅"
          value={props.minorGridWidth}
          min={0.25}
          step={0.25}
          onChange={(n) => up({ minorGridWidth: n })}
        />
        <StyleSelect
          label="副の線種"
          value={props.minorGridStyle}
          onChange={(s) => up({ minorGridStyle: s })}
        />
      </details>
    </div>
  );
}
