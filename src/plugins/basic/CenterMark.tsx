/**
 * 幾何学的中心(重心)を示すマーカー。局所原点(0,0)に描く。
 * style は十字(cross)または塗り点(dot)。
 * これを使うプラグイン(円・長方形・円弧)はいずれも transform.scale=1(applyScale型)なので、
 * 固定サイズで描いても拡大縮小の影響を受けない。
 */
export function CenterMark({
  size = 5,
  color = '#333333',
  style = 'cross',
}: {
  size?: number;
  color?: string;
  style?: 'cross' | 'dot';
}) {
  if (style === 'dot') {
    return <circle r={size} fill={color} pointerEvents="none" />;
  }
  return (
    <g pointerEvents="none">
      <line x1={-size} y1={0} x2={size} y2={0} stroke={color} strokeWidth={1} />
      <line x1={0} y1={-size} x2={0} y2={size} stroke={color} strokeWidth={1} />
    </g>
  );
}
