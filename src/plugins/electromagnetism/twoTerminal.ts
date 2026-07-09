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
 *
 * sizeKeys には本体寸法を表す数値propのキーを渡す(抵抗なら bodyLength/bodyHeight 等)。
 * 単一選択では端点ドラッグで長さのみを変えるが(scalable:'none')、複数選択の
 * グループ拡大縮小では applyScale が呼ばれ、length・ラベルのfontSize・sizeKeys を
 * 一括で相似に拡大する(線幅 strokeWidth や loops/cells 等の個数は変えない=方式A)。
 */
export function twoTerminalScaffold<P extends TangentProps>(
  sizeKeys: (keyof P)[] = [],
): Pick<
  PhysicsObjectPlugin<P>,
  | 'getSnapPoints'
  | 'getSegments'
  | 'getEndpoints'
  | 'setFromEndpoints'
  | 'applyRefs'
  | 'getAnchorPoint'
  | 'dragEndpointConstrained'
  | 'applyScale'
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
    applyScale(props, fx) {
      // グループ拡大縮小用。全長・ラベル文字・本体寸法を等比で拡大(線幅は不変)
      const scaled = { ...props } as Record<string, unknown>;
      scaled.length = props.length * fx;
      if (typeof scaled.fontSize === 'number') scaled.fontSize = scaled.fontSize * fx;
      for (const key of sizeKeys) {
        const value = (props as Record<string, unknown>)[key as string];
        if (typeof value === 'number') scaled[key as string] = value * fx;
      }
      return scaled as unknown as P;
    },
    applyRefs: applyTangent,
    getAnchorPoint: tangentAnchorPoint,
    dragEndpointConstrained: dragTangentEndpoint,
    capabilities: { rotatable: true, scalable: 'none' },
    placement: 'drag-line',
  };
}
