import { dashArray } from '../basic/lineUtils';
import { ARROW_EXT, ARROW_HALF, ARROW_LEN } from './graphLayout';
import { axisPositions, formatTick, graphToLocal, tickValues, type GraphView } from './graphMath';
import type { GraphProps } from './graphTypes';

/** 罫線グリッド(副→主の順に重ね描き) */
export function GraphGrid({
  props,
  v,
  stepX,
  stepY,
}: {
  props: GraphProps;
  v: GraphView;
  stepX: number;
  stepY: number;
}) {
  const hw = v.width / 2;
  const hh = v.height / 2;
  const layers: { xs: number[]; ys: number[]; color: string; width: number; dash?: string }[] = [];
  if (props.showMinorGrid && props.minorDivisions >= 2) {
    layers.push({
      xs: tickValues(v.xMin, v.xMax, stepX / props.minorDivisions),
      ys: tickValues(v.yMin, v.yMax, stepY / props.minorDivisions),
      color: props.minorGridColor,
      width: props.minorGridWidth,
      dash: dashArray(props.minorGridStyle, Math.max(props.minorGridWidth, 1)),
    });
  }
  if (props.showMajorGrid) {
    layers.push({
      xs: tickValues(v.xMin, v.xMax, stepX),
      ys: tickValues(v.yMin, v.yMax, stepY),
      color: props.majorGridColor,
      width: props.majorGridWidth,
      dash: dashArray(props.majorGridStyle, Math.max(props.majorGridWidth, 1)),
    });
  }
  if (layers.length === 0) return null;
  return (
    <g>
      {layers.map((layer, li) => (
        <g key={li} stroke={layer.color} strokeWidth={layer.width} strokeDasharray={layer.dash}>
          {layer.xs.map((gx) => {
            const x = graphToLocal({ x: gx, y: 0 }, v).x;
            return <line key={`x${gx}`} x1={x} y1={-hh} x2={x} y2={hh} />;
          })}
          {layer.ys.map((gy) => {
            const y = graphToLocal({ x: 0, y: gy }, v).y;
            return <line key={`y${gy}`} x1={-hw} y1={y} x2={hw} y2={y} />;
          })}
        </g>
      ))}
    </g>
  );
}

/** 座標軸(矢印・目盛り線・目盛り数値・原点O) */
export function GraphAxes({
  props,
  v,
  stepX,
  stepY,
}: {
  props: GraphProps;
  v: GraphView;
  stepX: number;
  stepY: number;
}) {
  const hw = v.width / 2;
  const hh = v.height / 2;
  const a = axisPositions(v);
  const ext = props.showArrows ? ARROW_EXT : 0;
  const xEnd = hw + ext;
  const yEnd = -hh - ext;
  // 0の目盛りは原点(O)に譲って省く
  const xTicks = tickValues(v.xMin, v.xMax, stepX).filter((t) => t !== 0);
  const yTicks = tickValues(v.yMin, v.yMax, stepY).filter((t) => t !== 0);
  return (
    <g stroke={props.axisColor} strokeWidth={props.axisWidth}>
      <line x1={-hw} y1={a.xAxisY} x2={xEnd} y2={a.xAxisY} />
      <line x1={a.yAxisX} y1={hh} x2={a.yAxisX} y2={yEnd} />
      {props.showArrows && (
        <g fill={props.axisColor} stroke="none">
          <polygon
            points={`${xEnd},${a.xAxisY} ${xEnd - ARROW_LEN},${a.xAxisY - ARROW_HALF} ${xEnd - ARROW_LEN},${a.xAxisY + ARROW_HALF}`}
          />
          <polygon
            points={`${a.yAxisX},${yEnd} ${a.yAxisX - ARROW_HALF},${yEnd + ARROW_LEN} ${a.yAxisX + ARROW_HALF},${yEnd + ARROW_LEN}`}
          />
        </g>
      )}
      {props.showTicks && (
        <g strokeWidth={Math.min(props.axisWidth, 1.2)}>
          {xTicks.map((t) => {
            const x = graphToLocal({ x: t, y: 0 }, v).x;
            return (
              <line
                key={t}
                x1={x}
                y1={a.xAxisY - props.tickLength}
                x2={x}
                y2={a.xAxisY + props.tickLength}
              />
            );
          })}
          {yTicks.map((t) => {
            const y = graphToLocal({ x: 0, y: t }, v).y;
            return (
              <line
                key={t}
                x1={a.yAxisX - props.tickLength}
                y1={y}
                x2={a.yAxisX + props.tickLength}
                y2={y}
              />
            );
          })}
        </g>
      )}
      {props.showTickLabels && (
        <g stroke="none" fill={props.axisColor} fontSize={props.tickFontSize}>
          {xTicks.map((t) => (
            <text
              key={t}
              x={graphToLocal({ x: t, y: 0 }, v).x}
              y={a.xAxisY + props.tickLength + 3}
              textAnchor="middle"
              dominantBaseline="hanging"
            >
              {formatTick(t, stepX, props.tickDecimals)}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={t}
              x={a.yAxisX - props.tickLength - 4}
              y={graphToLocal({ x: 0, y: t }, v).y}
              textAnchor="end"
              dominantBaseline="central"
            >
              {formatTick(t, stepY, props.tickDecimals)}
            </text>
          ))}
        </g>
      )}
      {props.showOrigin && !a.xClamped && !a.yClamped && (
        <text
          x={a.yAxisX - 5}
          y={a.xAxisY + 5}
          textAnchor="end"
          dominantBaseline="hanging"
          stroke="none"
          fill={props.axisColor}
          fontSize={props.tickFontSize + 3}
          fontStyle="italic"
          fontFamily='"Times New Roman", serif'
        >
          {props.originText}
        </text>
      )}
    </g>
  );
}
