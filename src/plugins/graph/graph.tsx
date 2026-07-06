import { rotateVec, unionRects, worldToLocal } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';
import { ObjectLabel } from '../basic/LabelView';
import { buildKatexExportCss } from '../basic/latex';
import { isLabelEmpty, labelLocalBounds } from '../basic/objectLabel';
import { GraphAxes, GraphGrid } from './GraphLayers';
import { GraphPanel } from './GraphPanel';
import {
  ARROW_EXT,
  ARROW_HALF,
  steps,
  toView,
  xLabelAnchor,
  yLabelAnchor,
} from './graphLayout';
import { axisPositions, formatTick, originLocal, tickValues } from './graphMath';
import { defaultGraphProps, type GraphProps } from './graphTypes';

export const graphPlugin: PhysicsObjectPlugin<GraphProps> = {
  id: 'core.graph',
  version: 1,
  name: 'グラフ',
  category: 'グラフ',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.6" />
      <line x1="5" y1="21" x2="5" y2="3" stroke="currentColor" strokeWidth="1.6" />
      <polygon points="23,18 19.5,16.5 19.5,19.5" fill="currentColor" />
      <polygon points="5,1 3.5,4.5 6.5,4.5" fill="currentColor" />
      <path
        d="M5 14 Q 8.5 5 11.5 11 T 21 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  defaultProps: defaultGraphProps,
  defaultSize: { width: 320, height: 240 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 40, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 40, step: 10 },
  ],
  PanelExtra: GraphPanel,
  Renderer: ({ props, transform, objectId, interactive }) => {
    const v = toView(props);
    const { stepX, stepY } = steps(props, v);
    const hw = v.width / 2;
    const hh = v.height / 2;
    const rotation = transform?.rotation ?? 0;
    return (
      <g>
        {/* 全域の当たり判定(書き出しには出さない) */}
        {interactive && (
          <rect x={-hw} y={-hh} width={v.width} height={v.height} fill="transparent" />
        )}
        <GraphGrid props={props} v={v} stepX={stepX} stepY={stepY} />
        {props.showAxes && <GraphAxes props={props} v={v} stepX={stepX} stepY={stepY} />}
        {props.showAxes && (
          <>
            <ObjectLabel
              anchor={xLabelAnchor(props, v)}
              dx={props.xLabelDx}
              dy={props.xLabelDy}
              rotation={rotation}
              content={props.xLabel}
              fontSize={props.labelFontSize}
              color={props.axisColor}
              bg={false}
              italic
              fontFamily='"Times New Roman", serif'
              objectId={objectId}
              interactive={interactive}
            />
            <ObjectLabel
              anchor={yLabelAnchor(props, v)}
              dx={props.yLabelDx}
              dy={props.yLabelDy}
              rotation={rotation}
              content={props.yLabel}
              fontSize={props.labelFontSize}
              color={props.axisColor}
              bg={false}
              italic
              fontFamily='"Times New Roman", serif'
              objectId={objectId}
              interactive={interactive}
            />
          </>
        )}
      </g>
    );
  },
  getBounds: (props) => {
    const v = toView(props);
    const { stepY } = steps(props, v);
    const hw = v.width / 2;
    const hh = v.height / 2;
    const rects: Rect[] = [{ x: -hw, y: -hh, width: v.width, height: v.height }];
    if (props.showAxes) {
      const a = axisPositions(v);
      const ext = props.showArrows ? ARROW_EXT : 0;
      // 軸の箱外延長+矢印
      rects.push({
        x: hw,
        y: a.xAxisY - ARROW_HALF - 2,
        width: ext + 2,
        height: ARROW_HALF * 2 + 4,
      });
      rects.push({
        x: a.yAxisX - ARROW_HALF - 2,
        y: -hh - ext - 2,
        width: ARROW_HALF * 2 + 4,
        height: ext + 2,
      });
      // 軸ラベル
      const xl = labelLocalBounds(
        xLabelAnchor(props, v),
        { labelBg: false, labelDx: props.xLabelDx, labelDy: props.xLabelDy },
        props.xLabel,
        props.labelFontSize,
      );
      if (xl) rects.push(xl);
      const yl = labelLocalBounds(
        yLabelAnchor(props, v),
        { labelBg: false, labelDx: props.yLabelDx, labelDy: props.yLabelDy },
        props.yLabel,
        props.labelFontSize,
      );
      if (yl) rects.push(yl);
      // 目盛り数値のはみ出し(軸が箱端にクランプされたときに箱外へ出る)
      if (props.showTickLabels) {
        rects.push({
          x: -hw,
          y: a.xAxisY + props.tickLength,
          width: v.width,
          height: props.tickFontSize * 1.5 + 3,
        });
        const maxLen = Math.max(
          1,
          ...tickValues(v.yMin, v.yMax, stepY)
            .filter((t) => t !== 0)
            .map((t) => formatTick(t, stepY, props.tickDecimals).length),
        );
        const labelW = maxLen * props.tickFontSize * 0.62 + props.tickLength + 4;
        rects.push({ x: a.yAxisX - labelW, y: -hh, width: labelW, height: v.height });
      }
    }
    return unionRects(rects)!;
  },
  getSnapPoints: (props) => {
    const v = toView(props);
    const hw = v.width / 2;
    const hh = v.height / 2;
    return [
      { x: 0, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
      originLocal(v),
    ];
  },
  getSegments: (props) => {
    const hw = Math.max(props.width, 10) / 2;
    const hh = Math.max(props.height, 10) / 2;
    return [
      [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
      [{ x: hw, y: -hh }, { x: hw, y: hh }],
      [{ x: hw, y: hh }, { x: -hw, y: hh }],
      [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
    ];
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  moveLabel: (props, transform, fromWorld, toWorld) => {
    // x/y軸ラベルのうちドラッグ開始点に近い方を動かす
    const v = toView(props);
    const d = rotateVec(
      { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y },
      -transform.rotation,
    );
    const from = worldToLocal(fromWorld, transform);
    const dist = (anchor: Point, dx: number, dy: number) =>
      Math.hypot(from.x - (anchor.x + dx), from.y - (anchor.y + dy));
    const distX = isLabelEmpty(props.xLabel)
      ? Infinity
      : dist(xLabelAnchor(props, v), props.xLabelDx, props.xLabelDy);
    const distY = isLabelEmpty(props.yLabel)
      ? Infinity
      : dist(yLabelAnchor(props, v), props.yLabelDx, props.yLabelDy);
    if (distX <= distY) {
      return { ...props, xLabelDx: props.xLabelDx + d.x, xLabelDy: props.xLabelDy + d.y };
    }
    return { ...props, yLabelDx: props.yLabelDx + d.x, yLabelDy: props.yLabelDy + d.y };
  },
  capabilities: { rotatable: false, scalable: 'both' },
  placement: 'click',
  exportStyles: buildKatexExportCss,
};
