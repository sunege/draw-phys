import { measureMath, renderMathHtml } from './mathLabel';

export type LabelMode = 'value' | 'latex' | 'none';

/**
 * 注釈マークのラベル。中心座標(x,y)にテキストまたはKaTeX数式を描く。
 * value/text は SVG text、latex は foreignObject(KaTeX)で描画する。
 */
export function MarkLabel({
  x,
  y,
  mode,
  text,
  latex,
  fontSize,
  color,
}: {
  x: number;
  y: number;
  mode: LabelMode;
  /** value モードで表示する文字列(実測値+単位など) */
  text: string;
  latex: string;
  fontSize: number;
  color: string;
}) {
  if (mode === 'none') return null;
  if (mode === 'latex') {
    const { width, height } = measureMath(latex, fontSize);
    return (
      <foreignObject x={x - width / 2} y={y - height / 2} width={width} height={height}>
        <div
          {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
          style={{ fontSize, color, whiteSpace: 'nowrap', lineHeight: 1 }}
          dangerouslySetInnerHTML={{ __html: renderMathHtml(latex) }}
        />
      </foreignObject>
    );
  }
  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      fill={color}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {text}
    </text>
  );
}
