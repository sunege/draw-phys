import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { PatternDefs } from '../basic/PatternDefs';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from '../basic/fillPattern';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { prismVertices } from './opticsMath';

interface PrismProps {
  height: number;
  apexAngle: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
}

/** プリズム(頂角を指定できる二等辺三角形)。各辺が光線のスナップ・拘束相手になる */
export const prismPlugin: PhysicsObjectPlugin<PrismProps> = {
  id: 'optics.prism',
  version: 1,
  name: 'プリズム',
  category: '光学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M12 4 L21 20 L3 20 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    height: 100,
    apexAngle: 60,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
  },
  defaultSize: { width: 116, height: 100 },
  propertySchema: [
    { key: 'height', label: '高さ', type: 'number', min: 10, step: 10 },
    { key: 'apexAngle', label: '頂角(°)', type: 'number', min: 10, max: 150, step: 5 },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleField,
    fillPatternField,
    patternSizeField,
  ],
  Renderer: ({ props }) => {
    const [a, b, c] = prismVertices(props.height, props.apexAngle);
    return (
      <g>
        <PatternDefs props={props} />
        <polygon
          points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const [, b] = prismVertices(props.height, props.apexAngle);
    return { x: -b.x, y: -props.height / 2, width: b.x * 2, height: props.height };
  },
  getSnapPoints: (props) => {
    const [a, b, c] = prismVertices(props.height, props.apexAngle);
    const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return [{ x: 0, y: 0 }, a, b, c, mid(a, b), mid(b, c), mid(c, a)];
  },
  getSegments: (props) => {
    const [a, b, c] = prismVertices(props.height, props.apexAngle);
    return [
      [a, b],
      [b, c],
      [c, a],
    ];
  },
  applyScale: (props, fx, fy) => {
    // 高さはfy、底辺半幅はfxで伸びるので頂角を対応する値へ再計算する
    const tanHalf = Math.tan((props.apexAngle / 2) * (Math.PI / 180)) * (fx / fy);
    const apexAngle = Math.min(Math.max((Math.atan(tanHalf) * 360) / Math.PI, 1), 178);
    return { ...props, height: props.height * fy, apexAngle };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
