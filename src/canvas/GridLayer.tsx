import { useViewportStore } from '../state/viewportStore';

interface Props {
  viewWidth: number;
  viewHeight: number;
}

/** ワールド座標に固定されたグリッド。viewBoxの可視範囲だけ塗る */
export function GridLayer({ viewWidth, viewHeight }: Props) {
  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const gridSize = useViewportStore((s) => s.gridSize);
  const gridVisible = useViewportStore((s) => s.gridVisible);

  if (!gridVisible) return null;

  const majorSize = gridSize * 5;
  const strokeWidth = 1 / zoom;
  const w = viewWidth / zoom;
  const h = viewHeight / zoom;

  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="grid-minor" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="#e4e7ec"
            strokeWidth={strokeWidth}
          />
        </pattern>
        <pattern id="grid-major" width={majorSize} height={majorSize} patternUnits="userSpaceOnUse">
          <rect width={majorSize} height={majorSize} fill="url(#grid-minor)" />
          <path
            d={`M ${majorSize} 0 L 0 0 0 ${majorSize}`}
            fill="none"
            stroke="#cdd3dd"
            strokeWidth={strokeWidth}
          />
        </pattern>
      </defs>
      <rect x={pan.x} y={pan.y} width={w} height={h} fill="url(#grid-major)" />
    </g>
  );
}
