import { findTangentAnchor, isRotationConstrained } from '../core/constraints';
import type { SceneObject } from '../core/document';
import { unionRects, worldBounds } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import type { Rect } from '../core/types';
import { useKatexFontsTick } from '../plugins/basic/katexFonts';
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

/** 複数選択の等比スケール用ハンドル(角のみ)。対角を固定して相似に拡大縮小する */
const CORNER_HANDLES: HandleDir[] = [
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: 1, sy: 1 },
  { sx: -1, sy: 1 },
];

const STROKE = '#2b7de9';

function cursorFor(dir: HandleDir): string {
  if (dir.sx === 0) return 'ns-resize';
  if (dir.sy === 0) return 'ew-resize';
  return dir.sx === dir.sy ? 'nwse-resize' : 'nesw-resize';
}

/**
 * 移動用ハンドル(四方向矢印)。選択枠の中央に置き、細い線などカーソルを
 * 本体に合わせにくいオブジェクトでもドラッグ移動できるようにする。
 */
function MoveHandle({ cx, cy, zoom }: { cx: number; cy: number; zoom: number }) {
  const r = 8.5 / zoom;
  const p = 6 / zoom; // 矢先までの距離
  const t = 3 / zoom; // 矢先の長さ
  const w = 2.6 / zoom; // 矢先の半幅
  const arrows = [
    `${cx},${cy - p} ${cx - w},${cy - p + t} ${cx + w},${cy - p + t}`, // 上
    `${cx},${cy + p} ${cx - w},${cy + p - t} ${cx + w},${cy + p - t}`, // 下
    `${cx - p},${cy} ${cx - p + t},${cy - w} ${cx - p + t},${cy + w}`, // 左
    `${cx + p},${cy} ${cx + p - t},${cy - w} ${cx + p - t},${cy + w}`, // 右
  ];
  return (
    <g data-handle="move" style={{ cursor: 'move' }}>
      <circle cx={cx} cy={cy} r={r} fill={STROKE} stroke="#ffffff" strokeWidth={1.5 / zoom} />
      <line x1={cx - t} y1={cy} x2={cx + t} y2={cy} stroke="#ffffff" strokeWidth={1 / zoom} />
      <line x1={cx} y1={cy - t} x2={cx} y2={cy + t} stroke="#ffffff" strokeWidth={1 / zoom} />
      {arrows.map((points) => (
        <polygon key={points} points={points} fill="#ffffff" />
      ))}
    </g>
  );
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
  // 平行/垂直・一致×2・一致+接線で回転が拘束されるため、回転ハンドルは出さない
  const rotationBound = isRotationConstrained(obj.refs);
  const rotatable = (plugin.capabilities?.rotatable ?? true) && !rotationBound;
  const rotHandleOffset = 20 / zoom;
  const centerX = box.x + box.width / 2;
  // 接線拘束された線の接点(ローカル位置)。接続点ハンドルと端点重なり判定に使う。
  // 円周への一致拘束(role:'coincident', kind:'circle')は接線ではないので除外する
  const anchorLocal = findTangentAnchor(obj.refs)
    ? plugin.getAnchorPoint?.(obj.props) ?? { x: 0, y: 0 }
    : null;

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
      {/* 移動ハンドル。小さい図形でも隠れないよう枠の少し下(外側)に置く */}
      {!obj.locked && (
        <MoveHandle cx={centerX} cy={box.y + box.height + 22 / zoom} zoom={zoom} />
      )}
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
      {/* 端点編集ハンドル(線・矢印・バネ・ベクトル・床など)。接点に重なる場合はずらして表示 */}
      {plugin.getEndpoints?.(obj.props).map((p, i) => {
        const overlap =
          anchorLocal && Math.hypot(p.x - anchorLocal.x, p.y - anchorLocal.y) < 12 / zoom;
        const hy = overlap ? p.y + 18 / zoom : p.y;
        return (
          <g key={`ep${i}`}>
            {overlap && (
              <line x1={p.x} y1={p.y} x2={p.x} y2={hy} stroke={STROKE} strokeWidth={1 / zoom} />
            )}
            <circle
              data-handle={`endpoint:${i}`}
              cx={p.x}
              cy={hy}
              r={5.5 / zoom}
              fill="#ffffff"
              stroke={STROKE}
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'move' }}
            />
          </g>
        );
      })}
      {/* プラグイン定義のパーツハンドル(グラフの原点など)。movePartでドラッグ */}
      {plugin.movePart &&
        plugin.getParts?.(obj.props).map((part) => (
          <circle
            key={part.id}
            data-handle={`part:${part.id}`}
            cx={part.local.x * t.scaleX}
            cy={part.local.y * t.scaleY}
            r={6 / zoom}
            fill="rgba(43,125,233,0.15)"
            stroke={STROKE}
            strokeWidth={1.5 / zoom}
            style={{ cursor: 'move' }}
          >
            {part.title && <title>{part.title}</title>}
          </circle>
        ))}
      {/* 接続点ハンドル(接線拘束された線の接点。円周上をスライドする) */}
      {anchorLocal && (
        <circle
          data-handle="anchor"
          cx={anchorLocal.x}
          cy={anchorLocal.y}
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
  // 数式のバウンディングはフォント実寸に依存するため、ロード完了後に選択枠を測り直す
  useKatexFontsTick();

  if (selection.length === 0) return null;

  if (selection.length === 1) {
    const obj = objects[selection[0]];
    if (!obj) return null;
    return <SingleSelection obj={obj} zoom={zoom} />;
  }

  // 複数選択: 結合AABBの枠＋角の等比スケールハンドル(移動・グループ拡大縮小に対応)
  const rects: Rect[] = [];
  let hasScalable = false;
  let hasMovable = false;
  for (const id of selection) {
    const obj = objects[id];
    if (!obj) continue;
    const plugin = pluginRegistry.get(obj.pluginId);
    if (!plugin) continue;
    rects.push(worldBounds(plugin.getBounds(obj.props), obj.transform));
    if (!obj.locked) {
      hasMovable = true;
      if (!plugin.capabilities?.printFrame) hasScalable = true;
    }
  }
  const union = unionRects(rects);
  if (!union) return null;
  const handleSize = 8 / zoom;

  return (
    <g>
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
      {/* 移動ハンドル。選択枠の少し下(外側)に置き、複数オブジェクトの隙間を狙わなくても移動できるようにする */}
      {hasMovable && (
        <MoveHandle
          cx={union.x + union.width / 2}
          cy={union.y + union.height + 22 / zoom}
          zoom={zoom}
        />
      )}
      {hasScalable &&
        CORNER_HANDLES.map((dir) => (
          <rect
            key={`${dir.sx},${dir.sy}`}
            data-handle={`groupScale:${dir.sx},${dir.sy}`}
            x={union.x + ((dir.sx + 1) / 2) * union.width - handleSize / 2}
            y={union.y + ((dir.sy + 1) / 2) * union.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke={STROKE}
            strokeWidth={1.5 / zoom}
            style={{ cursor: cursorFor(dir) }}
          />
        ))}
    </g>
  );
}
