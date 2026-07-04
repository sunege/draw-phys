import type { PhysicsObjectPlugin } from '../../core/plugin';

interface TextProps {
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
}

const LINE_HEIGHT = 1.25;

/** 全角≒1em・半角≒0.55emの概算で1行の幅を見積もる */
function estimateLineWidth(line: string, fontSize: number): number {
  let em = 0;
  for (const ch of line) {
    em += ch.codePointAt(0)! > 0xff ? 1 : 0.55;
  }
  return em * fontSize;
}

export const textPlugin: PhysicsObjectPlugin<TextProps> = {
  id: 'core.text',
  version: 1,
  name: 'テキスト',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M5 5 H19 V8 H17 V7 H13 V18 H15 V20 H9 V18 H11 V7 H7 V8 H5 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    text: 'テキスト',
    fontSize: 20,
    color: '#333333',
    bold: false,
  },
  defaultSize: { width: 80, height: 25 },
  propertySchema: [
    { key: 'text', label: '内容', type: 'multiline' },
    { key: 'fontSize', label: 'サイズ', type: 'number', min: 6, step: 2 },
    { key: 'color', label: '色', type: 'color' },
    { key: 'bold', label: '太字', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const lines = props.text.split('\n');
    const lineH = props.fontSize * LINE_HEIGHT;
    return (
      <text
        fill={props.color}
        fontSize={props.fontSize}
        fontWeight={props.bold ? 700 : 400}
        textAnchor="middle"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} y={(i - (lines.length - 1) / 2) * lineH} dominantBaseline="central">
            {line || ' '}
          </tspan>
        ))}
      </text>
    );
  },
  getBounds: (props) => {
    const lines = props.text.split('\n');
    const width = Math.max(...lines.map((l) => estimateLineWidth(l, props.fontSize)), 10);
    const height = lines.length * props.fontSize * LINE_HEIGHT;
    return { x: -width / 2, y: -height / 2, width, height };
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  applyScale: (props, fx) => ({ ...props, fontSize: props.fontSize * fx }),
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
};
