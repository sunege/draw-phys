import {
  PATTERN_SIZES,
  patternId,
  patternLines,
  resolvePatternSize,
  type FillPattern,
  type PatternFillProps,
} from './fillPattern';

function PatternShapes({
  pattern,
  stroke,
  spacing,
  lineWidth,
}: {
  pattern: FillPattern;
  stroke: string;
  spacing: number;
  lineWidth: number;
}) {
  if (pattern === 'dots') {
    return <circle cx={spacing / 2} cy={spacing / 2} r={lineWidth * 1.3} fill={stroke} />;
  }
  return (
    <>
      {patternLines(pattern, spacing, lineWidth).map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={stroke}
          strokeWidth={lineWidth}
          strokeLinecap="butt"
        />
      ))}
    </>
  );
}

/**
 * 塗りパターンの `<defs>`。パターン使用時のみ描画する。
 * 背景は塗り色(通常は白)、模様は線色で描くのでモノクロでも識別できる。
 * userSpaceOnUse なのでオブジェクトの回転・移動にパターンも追従する。
 * タイルは境界でクリップされるため、斜線は角にかかる隣の線の断片も描いて
 * つなぎ目で細くならないようにしている(`patternLines`)。
 */
export function PatternDefs({ props }: { props: PatternFillProps }) {
  const pattern = props.fillPattern ?? 'none';
  if (pattern === 'none') return null;
  const size = resolvePatternSize(props);
  const { spacing, lineWidth } = PATTERN_SIZES[size];
  const id = patternId(pattern, props.fill, props.stroke, size);
  return (
    <defs>
      <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
        <rect width={spacing} height={spacing} fill={props.fill} />
        <PatternShapes pattern={pattern} stroke={props.stroke} spacing={spacing} lineWidth={lineWidth} />
      </pattern>
    </defs>
  );
}
