import type { PhysicsObjectPlugin } from '../../core/plugin';
import { CenterMark } from '../basic/CenterMark';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';

interface WavefrontProps {
  count: number;
  spacing: number;
  startRadius: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

/** 波面(同心円)。波源から広がる波を等間隔の円で表す(間隔=波長) */
export const wavefrontPlugin: PhysicsObjectPlugin<WavefrontProps> = {
  id: 'wave.wavefront',
  version: 1,
  name: '波面',
  category: '波動',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    count: 4,
    spacing: 18,
    startRadius: 18,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    showCenter: true,
    centerStyle: 'dot',
    centerSize: 4,
  },
  defaultSize: { width: 144, height: 144 },
  propertySchema: [
    { key: 'count', label: '本数', type: 'number', min: 1, max: 30, step: 1 },
    { key: 'spacing', label: '間隔(波長)', type: 'number', min: 2, step: 2 },
    { key: 'startRadius', label: '最内半径', type: 'number', min: 2, step: 2 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    { key: 'showCenter', label: '波源を表示', type: 'boolean' },
    {
      key: 'centerStyle',
      label: '波源マーク',
      type: 'select',
      options: [
        { value: 'dot', label: '点' },
        { value: 'cross', label: '十字' },
      ],
    },
    { key: 'centerSize', label: '波源サイズ', type: 'number', min: 1, step: 1 },
  ],
  Renderer: ({ props }) => {
    const radii: number[] = [];
    for (let i = 0; i < props.count; i++) radii.push(props.startRadius + i * props.spacing);
    return (
      <g>
        {radii.map((r) => (
          <g key={r}>
            <circle
              r={r}
              fill="none"
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
            />
            <circle r={r} fill="none" stroke="transparent" strokeWidth={8} />
          </g>
        ))}
        {props.showCenter && (
          <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
        )}
      </g>
    );
  },
  getBounds: (props) => {
    const r = props.startRadius + (props.count - 1) * props.spacing + props.strokeWidth;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  },
  getSnapPoints: (props) => {
    const r = props.startRadius + (props.count - 1) * props.spacing;
    return [
      { x: 0, y: 0 },
      { x: r, y: 0 },
      { x: -r, y: 0 },
      { x: 0, y: r },
      { x: 0, y: -r },
    ];
  },
  applyScale: (props, fx) => ({
    ...props,
    startRadius: props.startRadius * fx,
    spacing: props.spacing * fx,
  }),
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'click',
};
