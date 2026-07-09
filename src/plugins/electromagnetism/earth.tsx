import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';
import { earthLines } from './circuitMath';

interface EarthProps extends CircuitLabelProps {
  width: number;
  count: number;
  gap: number;
  stub: number;
  stroke: string;
  strokeWidth: number;
}

/** 接地(アース)。接続点=上端、下に幅が減る横線列。1点で導線に接続 */
export const earthPlugin: PhysicsObjectPlugin<EarthProps> = {
  id: 'em.earth',
  version: 1,
  name: 'アース',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="12" y1="3" x2="12" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="19" x2="14" y2="19" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    width: 34,
    count: 3,
    gap: 6,
    stub: 12,
    stroke: '#000000',
    strokeWidth: 1,
    ...circuitLabelDefaults('', 'none'),
  },
  defaultSize: { width: 34, height: 30 },
  propertySchema: [
    { key: 'width', label: '最上段の幅', type: 'number', min: 8, step: 2 },
    { key: 'count', label: '線の本数', type: 'number', min: 1, max: 6, step: 1 },
    { key: 'gap', label: '線の間隔', type: 'number', min: 2, step: 1 },
    { key: 'stub', label: '接続線の長さ', type: 'number', min: 0, step: 2 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const lines = earthLines(props.width, props.count, props.gap);
    const anchor = { x: props.width / 2 + 8, y: props.stub };
    return (
      <g>
        <line x1={0} y1={0} x2={0} y2={props.stub} stroke={props.stroke} strokeWidth={props.strokeWidth} />
        {lines.map((l, i) => (
          <line
            key={i}
            x1={-l.halfW}
            y1={props.stub + l.y}
            x2={l.halfW}
            y2={props.stub + l.y}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        ))}
        <CircuitLabel
          anchor={anchor}
          props={props}
          color={props.stroke}
          rotation={transform?.rotation ?? 0}
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const h = props.stub + (props.count - 1) * props.gap + props.strokeWidth;
    const body = {
      x: -props.width / 2,
      y: -props.strokeWidth,
      width: props.width,
      height: h + props.strokeWidth,
    };
    const label = circuitLabelBounds({ x: props.width / 2 + 8, y: props.stub }, props);
    return label ? unionRects([body, label])! : body;
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  // グループ拡大縮小用。本体寸法とラベル文字を等比で拡大(本数countと線幅は不変)
  applyScale: (props, fx) => ({
    ...props,
    width: props.width * fx,
    gap: props.gap * fx,
    stub: props.stub * fx,
    fontSize: props.fontSize * fx,
  }),
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'click',
};
