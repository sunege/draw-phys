import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  applyTangent,
  dragTangentEndpoint,
  segmentEndpoints,
  segmentFromEndpoints,
  tangentAnchorPoint,
  type TangentProps,
} from '../basic/lineUtils';

/**
 * 導線上に置く2端子インライン記号(抵抗・コンデンサ・コイル・電源・計器…)が
 * 共通して持つプラグイン断片。x軸方向・原点中心の線分として振る舞い、
 * 端点ドラッグでの長さ変更・接線拘束・スナップを既存の線分系基盤で賄う。
 *
 * 各プラグインは Renderer / getBounds / propertySchema / defaultProps / Icon /
 * id / name と、3行の createFromDrag のみを個別に定義すればよい。
 */
export function twoTerminalScaffold<P extends TangentProps>(): Pick<
  PhysicsObjectPlugin<P>,
  | 'getSnapPoints'
  | 'getSegments'
  | 'getEndpoints'
  | 'setFromEndpoints'
  | 'applyRefs'
  | 'getAnchorPoint'
  | 'dragEndpointConstrained'
  | 'capabilities'
  | 'placement'
> {
  return {
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
    capabilities: { rotatable: true, scalable: 'none' },
    placement: 'drag-line',
  };
}
