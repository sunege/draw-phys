import type { SceneObject } from '../core/document';
import { unionRects, worldBounds } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';
import type { HandleDir } from './transformMath';

const HANDLES: HandleDir[] = [
  { sx: -1, sy: -1 },
  { sx: 0, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: 1, sy: 0 },
  { sx: 1, sy: 1 },
  { sx: 0, sy: 1 },
  { sx: -1, sy: 1 },
  { sx: -1, sy: 0 },
];

const STROKE = '#2b7de9';

function cursorFor(dir: HandleDir): string {
  if (dir.sx === 0) return 'ns-resize';
  if (dir.sy === 0) return 'ew-resize';
  return dir.sx === dir.sy ? 'nwse-resize' : 'nesw-resize';
}

/** スケール適用後のローカルバウンディングボックス(負のスケールも正規化) */
function scaledBounds(bounds: Rect, scaleX: number, scaleY: number): Rect {
  const x1 = bounds.x * scaleX;
  const x2 = (bounds.x + bounds.width) * scaleX;
  const y1 = bounds.y * scaleY;
  const y2 = (bounds.y + bounds.height) * scaleY;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** 単一選択: 回転に追従する枠とスケール・回転ハンドル */
function SingleSelection({ obj, zoom }: { obj: SceneObject; zoom: number }) {
  const plugin = pluginRegistry.get(obj.pluginId);
  if (!plugin) return null;

  const t = obj.transform;
  const box = scaledBounds(plugin.getBounds(obj.props), t.scaleX, t.scaleY);
  const handleSize = 8 / zoom;
  const scalable = plugin.capabilities?.scalable ?? 'both';
  const rotatable = plugin.capabilities?.rotatable ?? true;
  const rotHandleOffset = 20 / zoom;
  const centerX = box.x + box.width / 2;

  return (
    <g transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5 / zoom}
        pointerEvents="none"
      />
      {rotatable && (
        <>
          <line
            x1={centerX}
            y1={box.y}
            x2={centerX}
            y2={box.y - rotHandleOffset}
            stroke={STROKE}
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
          <circle
            data-handle="rotate"
            cx={centerX}
            cy={box.y - rotHandleOffset}
            r={5 / zoom}
            fill="#ffffff"
            stroke={STROKE}
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'grab' }}
          />
        </>
      )}
      {scalable !== 'none' &&
        HANDLES.filter((dir) => scalable !== 'x' || (dir.sx !== 0 && dir.sy === 0)).map((dir) => (
          <rect
            key={`${dir.sx},${dir.sy}`}
            data-handle={`scale:${dir.sx},${dir.sy}`}
            x={box.x + ((dir.sx + 1) / 2) * box.width - handleSize / 2}
            y={box.y + ((dir.sy + 1) / 2) * box.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke={STROKE}
            strokeWidth={1.5 / zoom}
            style={{ cursor: cursorFor(dir) }}
          />
        ))}
      {/* 端点編集ハンドル(線・矢印・バネ・ベクトル・床など) */}
      {plugin.getEndpoints?.(obj.props).map((p, i) => (
        <circle
          key={`ep${i}`}
          data-handle={`endpoint:${i}`}
          cx={p.x}
          cy={p.y}
          r={5.5 / zoom}
          fill="#ffffff"
          stroke={STROKE}
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'move' }}
        />
      ))}
      {/* 接続点ハンドル(接線拘束された線の中点。円周上をスライドする) */}
      {obj.refs?.some((r) => r.kind === 'circle') && (
        <circle
          data-handle="anchor"
          cx={0}
          cy={0}
          r={6 / zoom}
          fill="#e0457b"
          stroke="#ffffff"
          strokeWidth={1.5 / zoom}
          style={{ cursor: 'grab' }}
        />
      )}
    </g>
  );
}

/** 選択中オブジェクトの枠と操作ハンドル */
export function SelectionOverlay() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const zoom = useViewportStore((s) => s.zoom);

  if (selection.length === 0) return null;

  if (selection.length === 1) {
    const obj = objects[selection[0]];
    if (!obj) return null;
    return <SingleSelection obj={obj} zoom={zoom} />;
  }

  // 複数選択: 結合AABBの枠のみ(移動のみ対応)
  const rects: Rect[] = [];
  for (const id of selection) {
    const obj = objects[id];
    if (!obj) continue;
    const plugin = pluginRegistry.get(obj.pluginId);
    if (!plugin) continue;
    rects.push(worldBounds(plugin.getBounds(obj.props), obj.transform));
  }
  const union = unionRects(rects);
  if (!union) return null;

  return (
    <g pointerEvents="none">
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="none"
          stroke={STROKE}
          strokeWidth={1 / zoom}
          strokeDasharray={`${3 / zoom} ${3 / zoom}`}
        />
      ))}
      <rect
        x={union.x}
        y={union.y}
        width={union.width}
        height={union.height}
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5 / zoom}
      />
    </g>
  );
}
