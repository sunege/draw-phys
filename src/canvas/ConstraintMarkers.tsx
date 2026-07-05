import type { ReactNode } from 'react';
import { resolveRef } from '../core/constraints';
import type { SceneObjects } from '../core/document';
import { angleOfVector, localToWorld } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import type { ObjectRef, Point } from '../core/types';
import { useConstraintStore } from '../state/constraintStore';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';

const COLOR = '#e0457b';

/**
 * 平行拘束を表す「>>」シェブロン。基準の向き(+x)に沿って描く。
 * data-constraint/data-constraint-role 付きでクリック可能(拘束へアクセスする)。
 */
function ParallelGlyph({
  at,
  angle,
  zoom,
  objectId,
}: {
  at: Point;
  angle: number;
  zoom: number;
  objectId: string;
}) {
  const s = 5 / zoom; // シェブロンの半径
  const gap = 4.5 / zoom; // 2本のシェブロン間隔
  const sw = 2 / zoom;
  const chevron = (ox: number) => `M ${ox - s} ${-s} L ${ox} 0 L ${ox - s} ${s}`;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="parallel"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {/* クリック当たり判定を広げる透明な下敷き */}
      <rect
        x={-s - gap - sw}
        y={-s - sw * 2}
        width={s + gap * 2 + sw * 2}
        height={s * 2 + sw * 4}
        fill="transparent"
      />
      <path d={chevron(0)} fill="none" stroke={COLOR} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d={chevron(gap)} fill="none" stroke={COLOR} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * 一致/接続拘束を表す接続点(リング+中央ドット)。基準点に置く。
 * クリックで拘束へアクセスする。
 */
function CoincidentGlyph({ at, zoom, objectId }: { at: Point; zoom: number; objectId: string }) {
  const r = 5.5 / zoom;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="coincident"
      transform={`translate(${at.x} ${at.y})`}
      style={{ cursor: 'pointer' }}
    >
      <circle cx={0} cy={0} r={r + 2 / zoom} fill="transparent" />
      <circle cx={0} cy={0} r={r} fill="#ffffff" stroke={COLOR} strokeWidth={1.8 / zoom} />
      <circle cx={0} cy={0} r={2.2 / zoom} fill={COLOR} />
    </g>
  );
}

/** アクセス中の拘束に出す解除ピル(SVG内で完結・クリックでその拘束を外す) */
function RemovePill({
  at,
  zoom,
  objectId,
  role,
}: {
  at: Point;
  zoom: number;
  objectId: string;
  role: string;
}) {
  const w = 40 / zoom;
  const h = 18 / zoom;
  const x = at.x + 8 / zoom;
  const y = at.y - h - 8 / zoom;
  return (
    <g data-constraint-remove={objectId} data-constraint-role={role} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={w} height={h} rx={4 / zoom} fill={COLOR} />
      <text
        x={x + w / 2}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11 / zoom}
        fill="#ffffff"
      >
        解除
      </text>
    </g>
  );
}

/** 平行拘束の向き(基準線分の接線角度)。解決できなければ null */
function referenceMarker(ref: ObjectRef, objects: SceneObjects): { at: Point; angle: number } | null {
  const resolved = resolveRef(ref, objects, pluginRegistry);
  if (!resolved?.tangent) return null;
  return { at: resolved.point, angle: angleOfVector(resolved.tangent) };
}

/**
 * 拘束を持つ全オブジェクトへマークを常時表示するオーバーレイ。
 * - 平行(parallel): 自エッジと基準線分に「>>」
 * - 一致/接続(coincident): 基準点に接続点リング
 * マーカークリックで constraintStore.focused にセットし、解除ピルを出す。
 */
export function ConstraintMarkers() {
  const objects = useDocumentStore((s) => s.objects);
  const zoom = useViewportStore((s) => s.zoom);
  const focused = useConstraintStore((s) => s.focused);

  const markers: ReactNode[] = [];
  for (const obj of Object.values(objects)) {
    if (!obj.visible || !obj.refs?.length) continue;
    const plugin = pluginRegistry.get(obj.pluginId);
    if (!plugin) continue;

    const parallel = obj.refs.find((r) => r.role === 'parallel');
    if (parallel) {
      // 自オブジェクト側: 局所バウンディング上辺の中点(=局所x方向=平行方向のエッジ)
      const b = plugin.getBounds(obj.props);
      const objAt = localToWorld({ x: b.x + b.width / 2, y: b.y }, obj.transform);
      markers.push(
        <ParallelGlyph key={`${obj.id}-p`} at={objAt} angle={obj.transform.rotation} zoom={zoom} objectId={obj.id} />,
      );
      const rm = referenceMarker(parallel, objects);
      if (rm) {
        markers.push(
          <ParallelGlyph key={`${obj.id}-pr`} at={rm.at} angle={rm.angle} zoom={zoom} objectId={obj.id} />,
        );
      }
      if (focused?.objectId === obj.id && focused.role === 'parallel') {
        markers.push(<RemovePill key={`${obj.id}-pp`} at={objAt} zoom={zoom} objectId={obj.id} role="parallel" />);
      }
    }

    const coincident = obj.refs.find((r) => r.role === 'coincident');
    if (coincident) {
      const resolved = resolveRef(coincident, objects, pluginRegistry);
      if (resolved) {
        markers.push(<CoincidentGlyph key={`${obj.id}-c`} at={resolved.point} zoom={zoom} objectId={obj.id} />);
        if (focused?.objectId === obj.id && focused.role === 'coincident') {
          markers.push(
            <RemovePill key={`${obj.id}-cp`} at={resolved.point} zoom={zoom} objectId={obj.id} role="coincident" />,
          );
        }
      }
    }
  }

  if (markers.length === 0) return null;
  return <g>{markers}</g>;
}
