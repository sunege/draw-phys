import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { ImagePanel } from './ImagePanel';
import type { ImageProps } from './imageMath';

/**
 * 画像取込プラグイン。src に画像を data URL で持つ箱型オブジェクト。
 * data URL なので保存・書き出し(ラスタライズ時のcanvas汚染回避)ともにそのまま扱える。
 * サイズは props(width/height, 内部単位)へ焼き込む(applyScale)。
 */

export const imagePlugin: PhysicsObjectPlugin<ImageProps> = {
  id: 'layout.image',
  version: 1,
  name: '画像',
  category: 'レイアウト',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="10" r="1.8" fill="currentColor" />
      <path d="M4 18 L10 12 L14 16 L17 13 L20 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  defaultProps: {
    src: '',
    width: 200,
    height: 150,
    naturalW: 0,
    naturalH: 0,
    opacity: 1,
  },
  defaultSize: { width: 200, height: 150 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 1, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 1, step: 10 },
    { key: 'opacity', label: '不透明度', type: 'number', min: 0, max: 1, step: 0.1 },
  ],
  PanelExtra: ImagePanel,
  Renderer: ({ props, interactive }) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    if (!props.src) {
      // 未設定のプレースホルダはキャンバス上のみ描く(書き出しには出さない)
      if (!interactive) return <g />;
      return (
        <g>
          <rect
            x={-hw}
            y={-hh}
            width={props.width}
            height={props.height}
            fill="#f3f4f6"
            stroke="#9ca3af"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text x={0} y={0} fontSize={14} fill="#6b7280" textAnchor="middle" dominantBaseline="central">
            画像を選択
          </text>
        </g>
      );
    }
    return (
      <image
        href={props.src}
        x={-hw}
        y={-hh}
        width={props.width}
        height={props.height}
        opacity={props.opacity}
        preserveAspectRatio="none"
      />
    );
  },
  getBounds: (props) => ({
    x: -props.width / 2,
    y: -props.height / 2,
    width: props.width,
    height: props.height,
  }),
  getSnapPoints: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      { x: 0, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ] as Point[];
  },
  getSegments: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
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
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
