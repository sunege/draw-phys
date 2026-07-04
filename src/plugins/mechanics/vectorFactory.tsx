import type { ComponentType } from 'react';
import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { ObjectLabel } from '../basic/LabelView';
import {
  hitStrokeWidth,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
} from '../basic/lineUtils';
import {
  labelBgField,
  labelLocalBounds,
  moveLabelOffset,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';

export interface VectorProps extends LabelDecoProps {
  length: number;
  color: string;
  strokeWidth: number;
  headSize: number;
  label: string;
  /** ラベルの表示種別 */
  labelMode: LabelContent['mode'];
  /** LaTeX モードのときの数式 */
  labelLatex: string;
  fontSize: number;
  labelPos: 'tip' | 'middle';
  /** 作用点(始点)に点を打つ */
  showPoint: boolean;
}

function vectorLabel(props: VectorProps): LabelContent {
  return { mode: props.labelMode, text: props.label, latex: props.labelLatex };
}

/** ラベル基準位置(局所座標)。labelPos と各寸法から決まる */
function labelAnchor(props: VectorProps): { x: number; y: number } {
  const half = props.length / 2;
  const halfW = props.headSize * 0.4;
  const x = props.labelPos === 'tip' ? half + props.fontSize * 0.8 : 0;
  const y =
    props.labelPos === 'tip'
      ? 0
      : -(Math.max(halfW, props.strokeWidth) + props.fontSize * 0.7);
  return { x, y };
}

/**
 * ベクトル系プラグインの共通実装。
 * 「ベクトル」「力ベクトル」は既定値と作用点表示の有無だけが異なる。
 */
export function makeVectorPlugin(config: {
  id: string;
  name: string;
  Icon: ComponentType;
  defaults: VectorProps;
  /** 作用点の表示切替をプロパティパネルに出すか */
  showPointOption: boolean;
}): PhysicsObjectPlugin<VectorProps> {
  return {
    id: config.id,
    version: 1,
    name: config.name,
    category: '力学',
    Icon: config.Icon,
    defaultProps: config.defaults,
    defaultSize: { width: config.defaults.length, height: config.defaults.headSize },
    propertySchema: [
      { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
      { key: 'color', label: '色', type: 'color' },
      { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
      { key: 'headSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
      {
        key: 'labelMode',
        label: 'ラベル',
        type: 'select',
        options: [
          { value: 'text', label: 'テキスト' },
          { value: 'latex', label: 'LaTeX' },
          { value: 'none', label: 'なし' },
        ],
      },
      { key: 'label', label: 'ラベル文字', type: 'text' },
      { key: 'labelLatex', label: 'LaTeX式', type: 'text' },
      { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 2 },
      {
        key: 'labelPos',
        label: 'ラベル位置',
        type: 'select',
        options: [
          { value: 'tip', label: '先端' },
          { value: 'middle', label: '中央' },
        ],
      },
      labelBgField,
      ...(config.showPointOption
        ? [{ key: 'showPoint', label: '作用点', type: 'boolean' } as const]
        : []),
    ],
    Renderer: ({ props, transform, objectId, interactive }) => {
      const half = props.length / 2;
      const lineEnd = half - props.headSize * 0.8;
      const halfW = props.headSize * 0.4;
      const anchor = labelAnchor(props);
      return (
        <g>
          <line
            x1={-half}
            y1={0}
            x2={lineEnd}
            y2={0}
            stroke={props.color}
            strokeWidth={props.strokeWidth}
          />
          <polygon
            points={`${half},0 ${half - props.headSize},${-halfW} ${half - props.headSize},${halfW}`}
            fill={props.color}
          />
          {props.showPoint && <circle cx={-half} cy={0} r={props.strokeWidth * 1.6} fill={props.color} />}
          <ObjectLabel
            anchor={anchor}
            dx={props.labelDx}
            dy={props.labelDy}
            rotation={transform?.rotation ?? 0}
            content={vectorLabel(props)}
            fontSize={props.fontSize}
            color={props.color}
            bg={props.labelBg}
            italic
            fontFamily='"Times New Roman", serif'
            objectId={objectId}
            interactive={interactive}
          />
          <line
            x1={-half}
            y1={0}
            x2={half}
            y2={0}
            stroke="transparent"
            strokeWidth={hitStrokeWidth(props.headSize)}
          />
        </g>
      );
    },
    getBounds: (props) => {
      const halfH = Math.max(props.headSize * 0.4, props.strokeWidth / 2, 4);
      const shape = {
        x: -props.length / 2,
        y: -halfH,
        width: props.length,
        height: halfH * 2,
      };
      const label = labelLocalBounds(labelAnchor(props), props, vectorLabel(props), props.fontSize);
      return label ? unionRects([shape, label])! : shape;
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
    moveLabel: moveLabelOffset,
    capabilities: { rotatable: false, scalable: 'none' },
    placement: 'drag-line',
    createFromDrag(start, end) {
      const { length, transform } = lineFromDrag(start, end, config.defaults.length);
      return { props: { ...config.defaults, length }, transform };
    },
  };
}
