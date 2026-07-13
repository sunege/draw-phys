import { angleOfVector, localToWorld } from '../../core/geometry';
import type { PropertyField, ResolvedRef } from '../../core/plugin';
import type { Point, Transform } from '../../core/types';

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy';

/**
 * 線種→strokeDasharray(実線はundefined)。破線/点線は線幅に比例させる。
 * 二重線・手書き線(wavy)はdasharrayでは描けないのでundefined(=実線)を返す。
 * これらは`<StyledStroke>`が別途特別描画する(dasharray非対応のプラグインへ
 * 値が漏れても実線に劣化するだけで安全)。
 */
export function dashArray(lineStyle: LineStyle | undefined, strokeWidth: number): string | undefined {
  if (lineStyle === 'dashed') return `${strokeWidth * 4} ${strokeWidth * 3}`;
  if (lineStyle === 'dotted') return `${strokeWidth} ${strokeWidth * 2}`;
  return undefined;
}

/** 線種選択のプロパティスキーマ項目(各プラグイン共通・実線/破線/点線) */
export const lineStyleField: PropertyField = {
  key: 'lineStyle',
  label: '線種',
  type: 'select',
  options: [
    { value: 'solid', label: '実線' },
    { value: 'dashed', label: '破線' },
    { value: 'dotted', label: '点線' },
  ],
};

/**
 * 線種選択(拡張)。基本図形のうち線種を持つもの専用に二重線・手書き線を追加する。
 * (手書き線=内部値'wavy'。フィルタで輪郭を揺らす手描き風。周期性は持たない)
 * 二重線・手書き線はstrokeDasharrayでは表現できず`<StyledStroke>`が特別描画するため、
 * その描画に対応した基本図形だけがこの拡張フィールドを使う。回路記号・グラフ・波動など
 * 他プラグインは従来どおり`lineStyleField`(3択)のまま。
 */
export const lineStyleFieldExtended: PropertyField = {
  key: 'lineStyle',
  label: '線種',
  type: 'select',
  options: [
    { value: 'solid', label: '実線' },
    { value: 'dashed', label: '破線' },
    { value: 'dotted', label: '点線' },
    { value: 'double', label: '二重線' },
    { value: 'wavy', label: '手書き線' },
  ],
};

/** ローカル外接矩形(手書き線フィルタの適用領域算出に使う) */
export interface LocalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 手書き線(SVGフィルタ)の見た目パラメータ。全図形で共通・固定(線幅非依存)なので、
 * 円・矩形・直線どれでも一定のゆらぎになる。
 */
export const WAVY_FREQUENCY = 0.08; // feTurbulenceのbaseFrequency(大きいほど細かい波・波長≈12px)
export const WAVY_SCALE = 6; // feDisplacementMapの最大変位≈±WAVY_SCALE/2
const WAVY_PAD = WAVY_SCALE / 2 + 10;

/**
 * 手書き線フィルタの適用領域(userSpaceOnUse)。輪郭の外接矩形を振幅分だけ広げる。
 * 水平/垂直線のように片方が0の矩形でも、パディングで必ず非退化になる
 * (退化した領域だとフィルタが描画されず線が消えるため)。
 */
export function wavyFilterRegion(bounds: LocalRect): LocalRect {
  return {
    x: Math.round(bounds.x - WAVY_PAD),
    y: Math.round(bounds.y - WAVY_PAD),
    width: Math.round(bounds.width + WAVY_PAD * 2),
    height: Math.round(bounds.height + WAVY_PAD * 2),
  };
}

/** 手書き線フィルタの一意id(同一領域なら共有。書き出しSVG内でも重複しても同一定義で無害) */
export function wavyFilterId(region: LocalRect): string {
  const enc = (n: number) => (n < 0 ? `m${-n}` : `${n}`);
  return `wavy-${enc(region.x)}_${enc(region.y)}_${enc(region.width)}_${enc(region.height)}`;
}

/** 線分系プラグイン共通: 始点→終点のドラッグから中心・長さ・回転を求める */
export function lineFromDrag(
  start: Point,
  end: Point,
  fallbackLength: number,
): { length: number; transform: Transform } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let length = Math.hypot(dx, dy);
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (length < 2) {
    // クリックのみで配置された場合は既定の長さで水平に置く
    length = fallbackLength;
    rotation = 0;
    return {
      length,
      transform: {
        x: start.x + length / 2,
        y: start.y,
        rotation,
        scaleX: 1,
        scaleY: 1,
      },
    };
  }
  return {
    length,
    transform: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      rotation,
      scaleX: 1,
      scaleY: 1,
    },
  };
}

/**
 * 2端点(ワールド座標)から中心・長さ・回転を求める。
 * 端点ドラッグ編集で使う(fallback無し。長さ0付近は最小長でクランプ)。
 */
export function segmentFromEndpoints(
  a: Point,
  b: Point,
): { length: number; transform: Transform } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    length,
    transform: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rotation,
      scaleX: 1,
      scaleY: 1,
    },
  };
}

/** 中心・長さ・回転を持つ線分系プラグインのローカル端点 */
export function segmentEndpoints(length: number): [Point, Point] {
  return [
    { x: -length / 2, y: 0 },
    { x: length / 2, y: 0 },
  ];
}

/** 細い線でもクリックしやすくするためのヒット領域の太さ */
export function hitStrokeWidth(strokeWidth: number): number {
  return Math.max(strokeWidth, 12);
}

/** 主線に沿った斜線ハッチ(床・鏡・斜面の「裏側」表現)のローカルx位置 */
export function hatchPositions(length: number, spacing: number): number[] {
  const half = length / 2;
  const xs: number[] = [];
  for (let x = -half + spacing; x <= half; x += spacing) xs.push(x);
  return xs;
}

/**
 * 接線拘束をもてる線分系プラグイン(線・矢印・ベクトル)の共通props。
 * tangentOffset は線中心から接点までの符号付き距離(線方向)。0で接点=中点、
 * 端点ドラッグで片側長さを変えるとずれる。プラグインの内部状態。
 */
export interface TangentProps {
  length: number;
  tangentOffset?: number;
}

/**
 * 接線拘束の焼き込み(x軸沿い線分系プラグイン共通)。
 * 接点(局所 tangentOffset,0)を円周上のアンカーへ一致させ、接線方向へ回転する。
 * 'anchor' ロールが無ければ何もしない。
 */
export function applyTangent<P extends TangentProps>(
  props: P,
  resolved: ResolvedRef[],
  transform: Transform,
): { props: P; transform: Transform } {
  const anchor = resolved.find((r) => r.role === 'anchor');
  if (!anchor?.tangent) return { props, transform };
  const off = props.tangentOffset ?? 0;
  return {
    props,
    transform: {
      ...transform,
      x: anchor.point.x - anchor.tangent.x * off,
      y: anchor.point.y - anchor.tangent.y * off,
      rotation: angleOfVector(anchor.tangent),
      scaleX: 1,
      scaleY: 1,
    },
  };
}

/** 接点(局所座標)。接続点ハンドル/回転基準に使う */
export function tangentAnchorPoint(props: TangentProps): Point {
  return { x: props.tangentOffset ?? 0, y: 0 };
}

/** 接点と反対側の端点を固定し、ドラッグ端点までの片側長さのみ変更する */
export function dragTangentEndpoint<P extends TangentProps>(
  props: P,
  transform: Transform,
  end: 0 | 1,
  world: Point,
): P {
  const off = props.tangentOffset ?? 0;
  const half = props.length / 2;
  const contact = localToWorld({ x: off, y: 0 }, transform);
  const rad = (transform.rotation * Math.PI) / 180;
  const da = { x: Math.cos(rad), y: Math.sin(rad) };
  // 各端点の接点からの符号付き距離
  let s0 = -half - off;
  let s1 = half - off;
  const s = (world.x - contact.x) * da.x + (world.y - contact.y) * da.y;
  if (end === 1) s1 = Math.max(s, s0 + 1);
  else s0 = Math.min(s, s1 - 1);
  return { ...props, length: s1 - s0, tangentOffset: -(s0 + s1) / 2 };
}
