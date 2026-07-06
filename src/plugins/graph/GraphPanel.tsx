import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import type { LineStyle } from '../basic/lineUtils';
import type { LabelContent } from '../basic/objectLabel';
import styles from './GraphPanel.module.css';
import { compileExpression } from './exprParser';
import { isValidRange, parseScatterText, scatterToText } from './graphMath';
import {
  createFunctionPlot,
  createScatterPlot,
  GRAPH_TEMPLATES,
  type FitKind,
  type FunctionPlot,
  type GraphPlot,
  type GraphProps,
  type GraphRange,
  type ScatterMarker,
  type ScatterPlot,
} from './graphTypes';

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

/** 関数プロット1件の編集カード */
function FunctionCard({
  plot,
  index,
  defaultDomain,
  onChange,
  onRemove,
}: {
  plot: FunctionPlot;
  index: number;
  /** 定義域を有効にしたときの初期値(現在の表示範囲) */
  defaultDomain: { min: number; max: number };
  onChange: (id: string, patch: Partial<FunctionPlot>) => void;
  onRemove: (id: string) => void;
}) {
  const compiled = compileExpression(plot.expression);
  const setDomain = (value: string, key: 'min' | 'max') => {
    const n = Number(value);
    if (Number.isNaN(n) || !plot.domain) return;
    onChange(plot.id, { domain: { ...plot.domain, [key]: n } });
  };
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span>関数 {index + 1}</span>
        <button type="button" onClick={() => onRemove(plot.id)}>
          削除
        </button>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>y =</span>
        <input
          type="text"
          value={plot.expression}
          placeholder="例: 2*sin(x)"
          onChange={(e) => onChange(plot.id, { expression: e.target.value })}
        />
      </label>
      {!compiled.ok && <div className={styles.error}>{compiled.error}</div>}
      <div className={styles.row}>
        {GRAPH_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            title={`y = ${t.expression}`}
            onClick={() => onChange(plot.id, { expression: t.expression })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Color label="色" value={plot.color} onChange={(c) => onChange(plot.id, { color: c })} />
      <Num
        label="線幅"
        value={plot.strokeWidth}
        min={0.5}
        step={0.5}
        onChange={(n) => onChange(plot.id, { strokeWidth: n })}
      />
      <StyleSelect
        label="線種"
        value={plot.lineStyle}
        onChange={(s) => onChange(plot.id, { lineStyle: s })}
      />
      <Check
        label="定義域を限定"
        checked={plot.domain !== null}
        onChange={(b) => onChange(plot.id, { domain: b ? { ...defaultDomain } : null })}
      />
      {plot.domain && (
        <div className={styles.field}>
          <span className={styles.label}>定義域</span>
          <span className={styles.pair}>
            <input
              type="number"
              value={plot.domain.min}
              onChange={(e) => setDomain(e.target.value, 'min')}
            />
            <input
              type="number"
              value={plot.domain.max}
              onChange={(e) => setDomain(e.target.value, 'max')}
            />
          </span>
        </div>
      )}
    </div>
  );
}

/** 散布図1件の編集カード */
function ScatterCard({
  plot,
  index,
  onChange,
  onRemove,
}: {
  plot: ScatterPlot;
  index: number;
  onChange: (id: string, patch: Partial<ScatterPlot>) => void;
  onRemove: (id: string) => void;
}) {
  // 入力中の生テキストを保持する(整形で編集中の行が壊れないように)
  const [text, setText] = useState(() => scatterToText(plot.points));
  const [skipped, setSkipped] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;
  // Undo等の外部変更でデータが変わったらテキストを作り直す
  useEffect(() => {
    const parsed = parseScatterText(textRef.current).points;
    if (scatterToText(parsed) !== scatterToText(plot.points)) {
      setText(scatterToText(plot.points));
      setSkipped(0);
    }
  }, [plot.points]);
  const onTextChange = (t: string) => {
    setText(t);
    const r = parseScatterText(t);
    setSkipped(r.skipped);
    onChange(plot.id, { points: r.points });
  };
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span>データ点 {index + 1}</span>
        <button type="button" onClick={() => onRemove(plot.id)}>
          削除
        </button>
      </div>
      <textarea
        className={styles.dataArea}
        rows={5}
        value={text}
        placeholder={'1行に「x y」\n例: 1.0 2.0'}
        title="タブ・カンマ・空白区切り。Excelからの貼り付けに対応"
        onChange={(e) => onTextChange(e.target.value)}
      />
      <div className={styles.note}>
        {plot.points.length}点{skipped > 0 ? `(${skipped}行スキップ)` : ''}
      </div>
      <label className={styles.field}>
        <span className={styles.label}>マーカー</span>
        <select
          value={plot.marker}
          onChange={(e) => onChange(plot.id, { marker: e.target.value as ScatterMarker })}
        >
          <option value="circle">塗り丸</option>
          <option value="circleOpen">白丸</option>
          <option value="cross">バツ</option>
          <option value="square">四角</option>
        </select>
      </label>
      <Num
        label="サイズ"
        value={plot.markerSize}
        min={1}
        step={0.5}
        onChange={(n) => onChange(plot.id, { markerSize: n })}
      />
      <Color label="色" value={plot.color} onChange={(c) => onChange(plot.id, { color: c })} />
      <label className={styles.field}>
        <span className={styles.label}>近似直線</span>
        <select
          value={plot.fit}
          onChange={(e) => onChange(plot.id, { fit: e.target.value as FitKind })}
        >
          <option value="none">なし</option>
          <option value="linear">一次 y=ax+b</option>
          <option value="proportional">比例 y=ax</option>
        </select>
      </label>
      {plot.fit !== 'none' && (
        <>
          <Color
            label="直線の色"
            value={plot.fitColor}
            onChange={(c) => onChange(plot.id, { fitColor: c })}
          />
          <Num
            label="直線の線幅"
            value={plot.fitStrokeWidth}
            min={0.5}
            step={0.5}
            onChange={(n) => onChange(plot.id, { fitStrokeWidth: n })}
          />
          <StyleSelect
            label="直線の線種"
            value={plot.fitLineStyle}
            onChange={(s) => onChange(plot.id, { fitLineStyle: s })}
          />
          <Check
            label="式を表示"
            checked={plot.showFitEq}
            onChange={(b) => onChange(plot.id, { showFitEq: b })}
          />
          <Num
            label="係数の桁"
            value={plot.fitDecimals}
            min={0}
            max={6}
            step={1}
            onChange={(n) => onChange(plot.id, { fitDecimals: Math.round(n) })}
          />
        </>
      )}
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

  const patchPlot = (id: string, patch: Partial<FunctionPlot> | Partial<ScatterPlot>) => {
    up({ plots: props.plots.map((p) => (p.id === id ? ({ ...p, ...patch } as GraphPlot) : p)) });
  };
  const removePlot = (id: string) => up({ plots: props.plots.filter((p) => p.id !== id) });

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

      <details open className={styles.section}>
        <summary>プロット</summary>
        <div className={styles.row}>
          <button
            type="button"
            title="関数のグラフを追加"
            onClick={() => up({ plots: [...props.plots, createFunctionPlot(props.plots.length)] })}
          >
            ＋関数
          </button>
          <button
            type="button"
            title="散布図(データ点)を追加"
            onClick={() => up({ plots: [...props.plots, createScatterPlot(props.plots.length)] })}
          >
            ＋データ点
          </button>
        </div>
        {props.plots.map((plot, i) =>
          plot.kind === 'function' ? (
            <FunctionCard
              key={plot.id}
              plot={plot}
              index={i}
              defaultDomain={{ min: props.xMin, max: props.xMax }}
              onChange={patchPlot}
              onRemove={removePlot}
            />
          ) : (
            <ScatterCard
              key={plot.id}
              plot={plot}
              index={i}
              onChange={patchPlot}
              onRemove={removePlot}
            />
          ),
        )}
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
