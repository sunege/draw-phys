import type { Point } from '../../core/types';
import { axisPositions, isValidRange, niceStep, type GraphView } from './graphMath';
import type { GraphProps } from './graphTypes';

/** 矢印表示時の軸の箱外への延長(px) */
export const ARROW_EXT = 12;
/** 軸矢印(三角形)の長さ・半幅 */
export const ARROW_LEN = 9;
export const ARROW_HALF = 3.5;

/** 表示範囲が壊れていても描画が破綻しないよう補正した変換文脈を作る */
export function toView(props: GraphProps): GraphView {
  const r = isValidRange(props) ? props : { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
  return {
    xMin: r.xMin,
    xMax: r.xMax,
    yMin: r.yMin,
    yMax: r.yMax,
    width: Math.max(props.width, 10),
    height: Math.max(props.height, 10),
  };
}

/** 目盛りの刻み(0は自動 = 1-2-5系列) */
export function steps(props: GraphProps, v: GraphView): { stepX: number; stepY: number } {
  return {
    stepX: props.xStep > 0 ? props.xStep : niceStep(v.xMax - v.xMin),
    stepY: props.yStep > 0 ? props.yStep : niceStep(v.yMax - v.yMin),
  };
}

/** x軸ラベルの基準位置(矢印先端の右下) */
export function xLabelAnchor(props: GraphProps, v: GraphView): Point {
  const a = axisPositions(v);
  const ext = props.showArrows ? ARROW_EXT : 0;
  return { x: v.width / 2 + ext + 10, y: a.xAxisY + 10 };
}

/** y軸ラベルの基準位置(矢印先端の右) */
export function yLabelAnchor(props: GraphProps, v: GraphView): Point {
  const a = axisPositions(v);
  const ext = props.showArrows ? ARROW_EXT : 0;
  return { x: a.yAxisX + 12, y: -v.height / 2 - ext - 4 };
}
