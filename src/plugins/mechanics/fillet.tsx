import { identityTransform } from '../../core/types';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { CenterMark } from '../basic/CenterMark';
import { centerDefaults, centerFields } from '../basic/centerFields';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';
import {
  filletBounds,
  filletFromPicks,
  filletFromResolved,
  filletGeometry,
  filletPath,
} from './filletMath';

interface FilletProps {
  radius: number;
  /** 腕A・腕Bの外向き角度(度, ワールド基準。transform.rotation は常に0) */
  armA: number;
  armB: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

const DEFAULT_RADIUS = 40;

/**
 * なめらか接続(フィレット)。2本の線分をクリックすると、その2直線に接する円弧で角を丸める。
 * 母線を動かすと交点・接線を解き直して常に接する(applyRefs)。水平面と斜面を滑らかに
 * つなぐ図(力学的エネルギー保存)に使う。getCircle を返すので物体を曲面へスナップできる。
 */
export const filletPlugin: PhysicsObjectPlugin<FilletProps> = {
  id: 'mech.fillet',
  version: 1,
  name: 'なめらか接続',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M3 20 L10 20 A10 10 0 0 1 20 10 L20 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  defaultProps: {
    radius: DEFAULT_RADIUS,
    armA: 180,
    armB: -90,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...centerDefaults,
  },
  defaultSize: { width: 80, height: 80 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 1, step: 5 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...centerFields,
  ],
  Renderer: ({ props }) => {
    const geo = filletGeometry(props.armA, props.armB, props.radius);
    return (
      <g>
        <path
          d={filletPath(geo)}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        {props.showCenter && geo && (
          <g transform={`translate(${geo.center.x} ${geo.center.y})`}>
            <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
          </g>
        )}
      </g>
    );
  },
  getBounds: (props) => filletBounds(filletGeometry(props.armA, props.armB, props.radius)),
  getSnapPoints: (props) => {
    const geo = filletGeometry(props.armA, props.armB, props.radius);
    if (!geo) return [{ x: 0, y: 0 }];
    return [geo.tangentA, geo.tangentB, geo.center];
  },
  getCircle: (props) => {
    const geo = filletGeometry(props.armA, props.armB, props.radius);
    if (!geo) return null;
    return {
      center: geo.center,
      radius: geo.radius,
      startAngle: geo.startDeg,
      endAngle: geo.startDeg + geo.sweepDeg,
    };
  },
  applyScale: (props, fx) => ({ ...props, radius: props.radius * fx }),
  applyRefs: (props, resolved, transform) => {
    const a = resolved.find((r) => r.role === 'a');
    const b = resolved.find((r) => r.role === 'b');
    if (!a?.tangent || !b?.tangent) return { props, transform };
    const solved = filletFromResolved(a.point, a.tangent, b.point, b.tangent);
    if (!solved) return { props, transform };
    return {
      props: { ...props, armA: solved.armA, armB: solved.armB },
      transform: { ...transform, x: solved.vertex.x, y: solved.vertex.y, rotation: 0, scaleX: 1, scaleY: 1 },
    };
  },
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'pick-segments',
  createFromPicks: (picks) => {
    const solved = filletFromPicks(picks, DEFAULT_RADIUS);
    if (!solved) {
      return { props: filletPlugin.defaultProps, transform: identityTransform(), refs: [] };
    }
    return {
      props: { ...filletPlugin.defaultProps, armA: solved.armA, armB: solved.armB, radius: DEFAULT_RADIUS },
      transform: identityTransform(solved.vertex.x, solved.vertex.y),
      refs: solved.refs,
      hostTrims: solved.hostTrims,
    };
  },
};
