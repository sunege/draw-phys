import type { Point } from '../../core/types';
import { ObjectLabel } from '../basic/LabelView';
import { dashArray, hitStrokeWidth, type LineStyle } from '../basic/lineUtils';
import { circuitLabelContent, type CircuitLabelProps } from './circuitLabel';
import { leadLines, resistorZigzagPath } from './circuitMath';

/** 2端子記号の左右リード導線(端点から本体端まで) */
export function Leads({
  length,
  bodyLength,
  stroke,
  strokeWidth,
  lineStyle,
}: {
  length: number;
  bodyLength: number;
  stroke: string;
  strokeWidth: number;
  lineStyle?: LineStyle;
}) {
  const { left, right } = leadLines(length, bodyLength);
  const dash = dashArray(lineStyle, strokeWidth);
  return (
    <>
      <line
        x1={left[0].x}
        y1={0}
        x2={left[1].x}
        y2={0}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
      <line
        x1={right[0].x}
        y1={0}
        x2={right[1].x}
        y2={0}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
    </>
  );
}

/** 抵抗本体(箱□ or ギザギザ)。抵抗・可変抵抗から再利用する */
export function ResistorBody({
  bodyLength,
  bodyHeight,
  style,
  stroke,
  strokeWidth,
  lineStyle,
}: {
  bodyLength: number;
  bodyHeight: number;
  style: 'box' | 'zigzag';
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}) {
  if (style === 'zigzag') {
    return (
      <path
        d={resistorZigzagPath(bodyLength, bodyHeight)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray(lineStyle, strokeWidth)}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <rect
      x={-bodyLength / 2}
      y={-bodyHeight / 2}
      width={bodyLength}
      height={bodyHeight}
      fill="#ffffff"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArray(lineStyle, strokeWidth)}
    />
  );
}

/** 全長にわたる透明な当たり判定線(細い記号でもクリックしやすく) */
export function HitLine({ length, height }: { length: number; height: number }) {
  return (
    <line
      x1={-length / 2}
      y1={0}
      x2={length / 2}
      y2={0}
      stroke="transparent"
      strokeWidth={hitStrokeWidth(height)}
    />
  );
}

/**
 * 電磁気記号共通のラベル描画。ObjectLabel を serif・斜体で包み、
 * 本体上など任意の anchor(局所座標)に正立表示する。
 */
export function CircuitLabel({
  anchor,
  props,
  color,
  rotation,
  objectId,
  interactive,
}: {
  anchor: Point;
  props: CircuitLabelProps;
  color: string;
  rotation: number;
  objectId?: string;
  interactive?: boolean;
}) {
  return (
    <ObjectLabel
      anchor={anchor}
      dx={props.labelDx}
      dy={props.labelDy}
      rotation={rotation}
      content={circuitLabelContent(props)}
      fontSize={props.fontSize}
      color={color}
      bg={props.labelBg}
      italic
      fontFamily='"Times New Roman", serif'
      objectId={objectId}
      interactive={interactive}
    />
  );
}
