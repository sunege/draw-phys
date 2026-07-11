import type { ReactNode } from 'react';
import {
  findRotationLock,
  findTangentAnchor,
  resolveCoincidentAnchor,
  resolveRef,
} from '../core/constraints';
import type { SceneObjects } from '../core/document';
import { angleOfVector, localToWorld } from '../core/geometry';
import { pluginRegistry } from '../core/registry';
import type { ObjectRef, Point } from '../core/types';
import { useConstraintStore } from '../state/constraintStore';
import { useDocumentStore } from '../state/documentStore';
import { useViewportStore } from '../state/viewportStore';

const COLOR = '#e0457b';
/** 解けない拘束(過剰拘束)のマーカー色 */
const ERROR_COLOR = '#d32f2f';

/**
 * 拘束マークを幾何点の真上でなく脇へずらす距離(Fusion風)。
 * 点そのものを端点ハンドルのドラッグ対象として空けるため、引き出し線で結ぶ。
 */
const OFFSET = 14; // 一致・接線(端点に重なるマーク)
const OFFSET_LINE = 9; // 平行・垂直(辺の途中に乗るマーク)

/** at から angleDeg 方向へ dist だけ離した点(ズーム非依存の画面距離) */
function offsetAlong(at: Point, angleDeg: number, dist: number): Point {
  const r = (angleDeg * Math.PI) / 180;
  return { x: at.x + Math.cos(r) * dist, y: at.y + Math.sin(r) * dist };
}

/** ずらしたマークと真の拘束点を結ぶ引き出し線(+点位置の小ドット) */
function Leader({ from, to, zoom }: { from: Point; to: Point; zoom: number }) {
  return (
    <g pointerEvents="none">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={COLOR} strokeWidth={1 / zoom} opacity={0.45} />
      <circle cx={from.x} cy={from.y} r={1.6 / zoom} fill={COLOR} />
    </g>
  );
}

/** エラー時の色と理由ツールチップ(全グリフ共通の追加プロパティ) */
interface GlyphIssueProps {
  error?: boolean;
  /** エラー理由(SVGの<title>=ホバーで表示) */
  title?: string;
}

/**
 * 平行拘束を表す「>>」シェブロン。基準の向き(+x)に沿って描く。
 * data-constraint/data-constraint-role 付きでクリック可能(拘束へアクセスする)。
 */
function ParallelGlyph({
  at,
  angle,
  zoom,
  objectId,
  error,
  title,
}: {
  at: Point;
  angle: number;
  zoom: number;
  objectId: string;
} & GlyphIssueProps) {
  const s = 5 / zoom; // シェブロンの半径
  const gap = 4.5 / zoom; // 2本のシェブロン間隔
  const sw = 2 / zoom;
  const color = error ? ERROR_COLOR : COLOR;
  const chevron = (ox: number) => `M ${ox - s} ${-s} L ${ox} 0 L ${ox - s} ${s}`;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="parallel"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {title ? <title>{title}</title> : null}
      {/* クリック当たり判定を広げる透明な下敷き */}
      <rect
        x={-s - gap - sw}
        y={-s - sw * 2}
        width={s + gap * 2 + sw * 2}
        height={s * 2 + sw * 4}
        fill="transparent"
      />
      <path d={chevron(0)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d={chevron(gap)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/**
 * 垂直拘束を表す直角マーク(L字)。基準の向き(+x)に沿って描き、
 * 直角側(-y)が拘束されたオブジェクトの向きを指す。data-constraint 付きでクリック可能。
 */
function PerpendicularGlyph({
  at,
  angle,
  zoom,
  objectId,
  error,
  title,
}: {
  at: Point;
  angle: number;
  zoom: number;
  objectId: string;
} & GlyphIssueProps) {
  const s = 8 / zoom;
  const sw = 2 / zoom;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="perpendicular"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {title ? <title>{title}</title> : null}
      {/* クリック当たり判定を広げる透明な下敷き */}
      <rect x={-sw} y={-s - sw} width={s + sw * 2} height={s + sw * 2} fill="transparent" />
      <path
        d={`M ${s} 0 L ${s} ${-s} L 0 ${-s}`}
        fill="none"
        stroke={error ? ERROR_COLOR : COLOR}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * 一致/接続拘束を表す接続点(リング+中央ドット)。基準点に置く。
 * クリックで拘束へアクセスする。中点拘束(midpoint)は中央を三角マークにして区別する。
 */
function CoincidentGlyph({
  at,
  zoom,
  objectId,
  refIndex,
  midpoint,
  error,
  title,
}: {
  at: Point;
  zoom: number;
  objectId: string;
  /** refs配列上の位置。複数coincidentのドラッグ・解除の対象特定に使う */
  refIndex: number;
  /** 中点拘束(基準=エッジ中点で固定・ドラッグ不可)。中央を三角マークで表す */
  midpoint?: boolean;
} & GlyphIssueProps) {
  const r = 5.5 / zoom;
  const color = error ? ERROR_COLOR : COLOR;
  const tri = 3.2 / zoom;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="coincident"
      data-constraint-index={refIndex}
      transform={`translate(${at.x} ${at.y})`}
      style={{ cursor: 'pointer' }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={0} cy={0} r={r + 2 / zoom} fill="transparent" />
      <circle cx={0} cy={0} r={r} fill="#ffffff" stroke={color} strokeWidth={1.8 / zoom} />
      {midpoint ? (
        <path d={`M ${-tri} ${tri * 0.8} L ${tri} ${tri * 0.8} L 0 ${-tri} Z`} fill={color} />
      ) : (
        <circle cx={0} cy={0} r={2.2 / zoom} fill={color} />
      )}
    </g>
  );
}

/**
 * 接線拘束を表すマーク。接点で「接線+小円」を接線方向に描く。
 * data-constraint 付きでクリック可能(拘束へアクセスする)。
 */
function TangentGlyph({
  at,
  angle,
  zoom,
  objectId,
  error,
  title,
}: {
  at: Point;
  angle: number;
  zoom: number;
  objectId: string;
} & GlyphIssueProps) {
  const s = 7 / zoom; // 接線の半長
  const r = 4 / zoom; // 小円の半径
  const sw = 2 / zoom;
  const color = error ? ERROR_COLOR : COLOR;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="anchor"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {title ? <title>{title}</title> : null}
      {/* クリック当たり判定を広げる透明な下敷き */}
      <rect x={-s - sw} y={-r * 2 - sw} width={(s + sw) * 2} height={r * 2 + sw * 2} fill="transparent" />
      <line x1={-s} y1={0} x2={s} y2={0} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <circle cx={0} cy={-r} r={r} fill="none" stroke={color} strokeWidth={sw} />
    </g>
  );
}

/**
 * 対称拘束を表すマーク。対称軸方向に沿って、軸をはさむ2つの三角形を描く。
 * data-constraint 付きでクリック可能(拘束へアクセスする)。
 */
function SymmetryGlyph({
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
  const s = 6 / zoom;
  const sw = 1.8 / zoom;
  return (
    <g
      data-constraint={objectId}
      data-constraint-role="symmetric"
      transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
      style={{ cursor: 'pointer' }}
    >
      {/* クリック当たり判定を広げる透明な下敷き */}
      <rect x={-s * 1.4} y={-s * 1.3} width={s * 2.8} height={s * 2.6} fill="transparent" />
      {/* 対称軸(破線) */}
      <line
        x1={-s * 1.3}
        y1={0}
        x2={s * 1.3}
        y2={0}
        stroke={COLOR}
        strokeWidth={sw}
        strokeDasharray={`${2 / zoom} ${1.5 / zoom}`}
      />
      {/* 軸をはさんで対称な2つの三角形 */}
      <path d={`M ${-s * 0.7} ${-s} L 0 ${-s * 0.25} L ${s * 0.7} ${-s} Z`} fill="none" stroke={COLOR} strokeWidth={sw} strokeLinejoin="round" />
      <path d={`M ${-s * 0.7} ${s} L 0 ${s * 0.25} L ${s * 0.7} ${s} Z`} fill="none" stroke={COLOR} strokeWidth={sw} strokeLinejoin="round" />
    </g>
  );
}

/** アクセス中の拘束に出す解除ピル(SVG内で完結・クリックでその拘束を外す) */
function RemovePill({
  at,
  zoom,
  objectId,
  role,
  refIndex,
}: {
  at: Point;
  zoom: number;
  objectId: string;
  role: string;
  /** coincidentが複数あるとき、その1本だけを外すためのrefs配列上の位置 */
  refIndex?: number;
}) {
  const w = 40 / zoom;
  const h = 18 / zoom;
  const x = at.x + 8 / zoom;
  const y = at.y - h - 8 / zoom;
  return (
    <g
      data-constraint-remove={objectId}
      data-constraint-role={role}
      data-constraint-index={refIndex}
      style={{ cursor: 'pointer' }}
    >
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
  const issues = useConstraintStore((s) => s.issues);

  // 解けなかった拘束(オブジェクトID+ref位置)→理由。該当マーカーを赤くする
  const issueMap = new Map<string, string>();
  for (const issue of issues) issueMap.set(`${issue.objectId}:${issue.refIndex}`, issue.message);
  const issueFor = (objectId: string, refIndex: number) => issueMap.get(`${objectId}:${refIndex}`);

  const markers: ReactNode[] = [];
  for (const obj of Object.values(objects)) {
    if (!obj.visible || !obj.refs?.length) continue;
    const plugin = pluginRegistry.get(obj.pluginId);
    if (!plugin) continue;

    const rotLock = findRotationLock(obj.refs);
    if (rotLock) {
      // 自オブジェクト側: 局所バウンディング上辺の中点(=局所x方向=向きのエッジ)
      const b = plugin.getBounds(obj.props);
      const objAt = localToWorld({ x: b.x + b.width / 2, y: b.y }, obj.transform);
      // 辺の途中に乗るので、辺と垂直方向へ少しずらして線に被らないようにする
      const objPos = offsetAlong(objAt, obj.transform.rotation + 90, OFFSET_LINE / zoom);
      const rm = referenceMarker(rotLock, objects);
      const rmPos = rm ? offsetAlong(rm.at, rm.angle + 90, OFFSET_LINE / zoom) : null;
      const issue = issueFor(obj.id, obj.refs.indexOf(rotLock));
      const Glyph = rotLock.role === 'perpendicular' ? PerpendicularGlyph : ParallelGlyph;
      markers.push(
        <Glyph
          key={`${obj.id}-r`}
          at={objPos}
          angle={obj.transform.rotation}
          zoom={zoom}
          objectId={obj.id}
          error={!!issue}
          title={issue}
        />,
      );
      if (rm && rmPos) {
        markers.push(
          <Glyph
            key={`${obj.id}-rr`}
            at={rmPos}
            angle={rm.angle}
            zoom={zoom}
            objectId={obj.id}
            error={!!issue}
            title={issue}
          />,
        );
      }
      if (focused?.objectId === obj.id && focused.role === rotLock.role) {
        markers.push(
          <RemovePill key={`${obj.id}-rp`} at={objPos} zoom={zoom} objectId={obj.id} role={rotLock.role} />,
        );
      }
    }

    // 一致拘束は複数持てる(2点拘束)。それぞれのrefs位置つきでマーカーを描く
    obj.refs.forEach((ref, refIndex) => {
      if (ref.role !== 'coincident') return;
      const at = resolveCoincidentAnchor(ref, objects, pluginRegistry);
      if (!at) return;
      // 端点に重なるので、オブジェクトの法線方向へずらして端点ハンドルを空ける。
      // ドラッグ(スライド)は開始点補正で追従するのでマーク位置に依存しない。
      const pos = offsetAlong(at, obj.transform.rotation + 90, OFFSET / zoom);
      const issue = issueFor(obj.id, refIndex);
      markers.push(<Leader key={`${obj.id}-cl${refIndex}`} from={at} to={pos} zoom={zoom} />);
      markers.push(
        <CoincidentGlyph
          key={`${obj.id}-c${refIndex}`}
          at={pos}
          zoom={zoom}
          objectId={obj.id}
          refIndex={refIndex}
          midpoint={ref.midpoint}
          error={!!issue}
          title={issue}
        />,
      );
      if (
        focused?.objectId === obj.id &&
        focused.role === 'coincident' &&
        (focused.refIndex ?? refIndex) === refIndex
      ) {
        markers.push(
          <RemovePill
            key={`${obj.id}-cp${refIndex}`}
            at={pos}
            zoom={zoom}
            objectId={obj.id}
            role="coincident"
            refIndex={refIndex}
          />,
        );
      }
    });

    // 対称拘束: 動かす側と基準側の中点(=対称軸上)に、軸方向へ向けたマークを置く
    const symmetric = obj.refs.find((r) => r.role === 'symmetric');
    if (symmetric) {
      const axisRef = obj.refs.find((r) => r.role === 'symmetricAxis');
      const axis = axisRef ? resolveRef(axisRef, objects, pluginRegistry) : null;
      const source = objects[symmetric.targetId];
      if (axis?.tangent) {
        const at = source
          ? {
              x: (obj.transform.x + source.transform.x) / 2,
              y: (obj.transform.y + source.transform.y) / 2,
            }
          : axis.point;
        const angle = angleOfVector(axis.tangent);
        markers.push(<SymmetryGlyph key={`${obj.id}-s`} at={at} angle={angle} zoom={zoom} objectId={obj.id} />);
        if (focused?.objectId === obj.id && focused.role === 'symmetric') {
          markers.push(
            <RemovePill key={`${obj.id}-sp`} at={at} zoom={zoom} objectId={obj.id} role="symmetric" />,
          );
        }
      }
    }

    // 接線拘束(円周へのanchor): 接点に接線マークを置く
    const tangent = findTangentAnchor(obj.refs);
    if (tangent) {
      const resolved = resolveRef(tangent, objects, pluginRegistry);
      if (resolved?.tangent) {
        const at = resolved.point;
        const angle = angleOfVector(resolved.tangent);
        // 接点(端点)からは接線と垂直方向へずらし、接点ハンドルを空ける
        const pos = offsetAlong(at, angle + 90, OFFSET / zoom);
        const issue = issueFor(obj.id, obj.refs.indexOf(tangent));
        markers.push(<Leader key={`${obj.id}-tl`} from={at} to={pos} zoom={zoom} />);
        markers.push(
          <TangentGlyph
            key={`${obj.id}-t`}
            at={pos}
            angle={angle}
            zoom={zoom}
            objectId={obj.id}
            error={!!issue}
            title={issue}
          />,
        );
        if (focused?.objectId === obj.id && focused.role === 'anchor') {
          markers.push(
            <RemovePill key={`${obj.id}-tp`} at={pos} zoom={zoom} objectId={obj.id} role="anchor" />,
          );
        }
      }
    }
  }

  if (markers.length === 0) return null;
  return <g>{markers}</g>;
}
