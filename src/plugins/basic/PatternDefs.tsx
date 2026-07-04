import {
  PATTERN_LINE_WIDTH as LINE_WIDTH,
  PATTERN_SPACING as SPACING,
  patternId,
  type FillPattern,
  type PatternFillProps,
} from './fillPattern';

function PatternShapes({ pattern, stroke }: { pattern: FillPattern; stroke: string }) {
  const s = SPACING;
  const line = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={LINE_WIDTH} />
  );
  switch (pattern) {
    case 'hatch':
      return line(0, s, s, 0);
    case 'hatchBack':
      return line(0, 0, s, s);
    case 'cross':
      return (
        <>
          {line(0, s, s, 0)}
          {line(0, 0, s, s)}
        </>
      );
    case 'horizontal':
      return line(0, s / 2, s, s / 2);
    case 'vertical':
      return line(s / 2, 0, s / 2, s);
    case 'dots':
      return <circle cx={s / 2} cy={s / 2} r={LINE_WIDTH * 1.3} fill={stroke} />;
    default:
      return null;
  }
}

/**
 * 塗りパターンの `<defs>`。パターン使用時のみ描画する。
 * 背景は塗り色(通常は白)、模様は線色で描くのでモノクロでも識別できる。
 * userSpaceOnUse なのでオブジェクトの回転・移動にパターンも追従する。
 */
export function PatternDefs({ props }: { props: PatternFillProps }) {
  const pattern = props.fillPattern ?? 'none';
  if (pattern === 'none') return null;
  const id = patternId(pattern, props.fill, props.stroke);
  return (
    <defs>
      <pattern id={id} width={SPACING} height={SPACING} patternUnits="userSpaceOnUse">
        <rect width={SPACING} height={SPACING} fill={props.fill} />
        <PatternShapes pattern={pattern} stroke={props.stroke} />
      </pattern>
    </defs>
  );
}
