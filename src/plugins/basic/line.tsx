import { localToWorld } from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import {
  applyTangent,
  dashArray,
  dragTangentEndpoint,
  hitStrokeWidth,
  lineFromDrag,
  lineStyleField,
  segmentEndpoints,
  segmentFromEndpoints,
  tangentAnchorPoint,
  type LineStyle,
} from './lineUtils';

interface LineProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  /**
   * 接線拘束時の、線中心から接点までの符号付き距離(線方向)。
   * 0(既定)は接点=中点。端点ドラッグで片側長さを変えるとずれる。プラグインの内部状態。
   */
  tangentOffset?: number;
  /** ONで端点ドラッグ時に長さを固定し角度のみ変える(該当端点はグリッドスナップ無効) */
  lengthLocked?: boolean;
}

export const linePlugin: PhysicsObjectPlugin<LineProps> = {
  id: 'core.line',
  version: 1,
  name: '線',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="4" y1="19" x2="20" y2="5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    stroke: '#333333',
    strokeWidth: 2,
    lineStyle: 'solid',
    lengthLocked: false,
  },
  defaultSize: { width: 100, height: 2 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    { key: 'lengthLocked', label: '長さ固定', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
    return (
      <g>
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke="transparent"
          strokeWidth={hitStrokeWidth(props.strokeWidth)}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const h = Math.max(props.strokeWidth, 8);
    return { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
  },
  getSnapPoints: (props) => [
    { x: -props.length / 2, y: 0 },
    { x: 0, y: 0 },
    { x: props.length / 2, y: 0 },
  ],
  getSegments: (props) => [segmentEndpoints(props.length)],
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  applyRefs: applyTangent,
  getAnchorPoint: tangentAnchorPoint,
  dragEndpointConstrained: dragTangentEndpoint,
  isLengthLocked: (props) => !!props.lengthLocked,
  // トリム: 残す各区間[from,to]を新しい線分として作り直す(端の短縮=1本, 中間削除=2本に分割)
  trim(props, transform, keeps) {
    const L = props.length;
    const pieces: TrimPiece[] = [];
    for (const keep of keeps) {
      if (keep.kind !== 'segment') continue;
      const x0 = -L / 2 + keep.from * L;
      const x1 = -L / 2 + keep.to * L;
      if (Math.abs(x1 - x0) < 1) continue; // 1px未満は捨てる
      const a = localToWorld({ x: x0, y: 0 }, transform);
      const b = localToWorld({ x: x1, y: 0 }, transform);
      const seg = segmentFromEndpoints(a, b);
      pieces.push({
        pluginId: 'core.line',
        props: { ...props, length: seg.length, tangentOffset: 0 },
        transform: seg.transform,
      });
    }
    return pieces;
  },
  capabilities: { rotatable: true, scalable: 'none', construction: true },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 100);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
