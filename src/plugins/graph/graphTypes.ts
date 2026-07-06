import type { LineStyle } from '../basic/lineUtils';
import type { LabelContent } from '../basic/objectLabel';

/** グラフ内部の表示範囲(グラフ座標) */
export interface GraphRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 関数プロット(自由式)。式は exprParser でコンパイルする */
export interface FunctionPlot {
  id: string;
  kind: 'function';
  /** x の式(例 "2*sin(x)")。無効な式のプロットは描画されない */
  expression: string;
  color: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  /** 定義域(グラフ座標)。null は表示範囲全体 */
  domain: { min: number; max: number } | null;
}

/** 散布図マーカーの種類 */
export type ScatterMarker = 'circle' | 'circleOpen' | 'cross' | 'square';

/** 近似直線の種類。linear=y=ax+b / proportional=y=ax(原点固定) */
export type FitKind = 'none' | 'linear' | 'proportional';

/** 散布図(データ点列+近似直線) */
export interface ScatterPlot {
  id: string;
  kind: 'scatter';
  points: { x: number; y: number }[];
  marker: ScatterMarker;
  /** マーカー半径(px) */
  markerSize: number;
  color: string;
  fit: FitKind;
  fitColor: string;
  fitLineStyle: LineStyle;
  fitStrokeWidth: number;
  /** 求めた式(係数)をグラフ上に表示する */
  showFitEq: boolean;
  /** 係数表示の小数桁 */
  fitDecimals: number;
}

export type GraphPlot = FunctionPlot | ScatterPlot;

export interface GraphProps extends GraphRange {
  /** 箱サイズ(px)。拡大縮小は applyScale で焼き込む(線幅・文字サイズ不変) */
  width: number;
  height: number;
  /** 「範囲をリセット」の戻り先。「現在の範囲を既定にする」で更新できる */
  defaultRange: GraphRange;
  // ── 軸 ──
  showAxes: boolean;
  axisColor: string;
  axisWidth: number;
  /** 軸端の矢印 */
  showArrows: boolean;
  xLabel: LabelContent;
  yLabel: LabelContent;
  labelFontSize: number;
  /** 軸ラベルの基準位置からのオフセット(ローカルpx)。ドラッグでも更新 */
  xLabelDx: number;
  xLabelDy: number;
  yLabelDx: number;
  yLabelDy: number;
  /** 原点ラベル(通常 "O") */
  showOrigin: boolean;
  originText: string;
  // ── 目盛りの刻み(グラフ座標)。0 = 自動(1-2-5系列) ──
  xStep: number;
  yStep: number;
  /** 主目盛り1区間の副分割数。1 = 副目盛りなし */
  minorDivisions: number;
  // ── 罫線グリッド(主・副で独立スタイル) ──
  showMajorGrid: boolean;
  majorGridColor: string;
  majorGridWidth: number;
  majorGridStyle: LineStyle;
  showMinorGrid: boolean;
  minorGridColor: string;
  minorGridWidth: number;
  minorGridStyle: LineStyle;
  // ── 軸上の短い目盛り線と数値 ──
  showTicks: boolean;
  /** 目盛り線の長さ(軸から片側へのpx) */
  tickLength: number;
  showTickLabels: boolean;
  tickFontSize: number;
  /** 目盛り数値の小数桁。-1 = 刻みから自動 */
  tickDecimals: number;
  /** プロット。空 = 座標系のみ(問題用紙用途) */
  plots: GraphPlot[];
}

export const defaultGraphProps: GraphProps = {
  width: 320,
  height: 240,
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  defaultRange: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
  showAxes: true,
  axisColor: '#333333',
  axisWidth: 1.5,
  showArrows: true,
  xLabel: { mode: 'text', text: 'x', latex: 'x' },
  yLabel: { mode: 'text', text: 'y', latex: 'y' },
  labelFontSize: 16,
  xLabelDx: 0,
  xLabelDy: 0,
  yLabelDx: 0,
  yLabelDy: 0,
  showOrigin: true,
  originText: 'O',
  xStep: 0,
  yStep: 0,
  minorDivisions: 1,
  showMajorGrid: true,
  majorGridColor: '#d0d0d0',
  majorGridWidth: 1,
  majorGridStyle: 'solid',
  showMinorGrid: false,
  minorGridColor: '#e6e6e6',
  minorGridWidth: 0.5,
  minorGridStyle: 'dotted',
  showTicks: true,
  tickLength: 4,
  showTickLabels: true,
  tickFontSize: 11,
  tickDecimals: -1,
  plots: [],
};

/** 関数プロットのテンプレ(パネルの式挿入ボタン) */
export const GRAPH_TEMPLATES: { label: string; expression: string }[] = [
  { label: '正弦波', expression: '2*sin(x)' },
  { label: '余弦波', expression: '2*cos(x)' },
  { label: '放物線', expression: '0.5*x^2' },
  { label: '直線', expression: 'x' },
  { label: '反比例', expression: '1/x' },
  { label: '平方根', expression: 'sqrt(x)' },
  { label: '指数', expression: 'exp(x)' },
  { label: '対数', expression: 'log(x)' },
];

/** プロット色の初期候補(追加順に巡回) */
const PLOT_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf'];

export function nextPlotColor(index: number): string {
  return PLOT_COLORS[index % PLOT_COLORS.length];
}

export function createFunctionPlot(index: number): FunctionPlot {
  return {
    id: crypto.randomUUID(),
    kind: 'function',
    expression: 'sin(x)',
    color: nextPlotColor(index),
    strokeWidth: 2,
    lineStyle: 'solid',
    domain: null,
  };
}

export function createScatterPlot(index: number): ScatterPlot {
  return {
    id: crypto.randomUUID(),
    kind: 'scatter',
    points: [],
    marker: 'circle',
    markerSize: 3,
    color: nextPlotColor(index),
    fit: 'none',
    fitColor: '#d62728',
    fitLineStyle: 'solid',
    fitStrokeWidth: 1.5,
    showFitEq: false,
    fitDecimals: 2,
  };
}
