import { localToWorld } from '../core/geometry';
import type { AnyPlugin } from '../core/plugin';
import type { Point, Rect, Transform } from '../core/types';
import type { HandleDir } from './transformMath';

const MIN_SCALE = 0.05;

/** 点 p を anchor 中心に f 倍した位置 */
function scalePoint(p: Point, anchor: Point, f: number): Point {
  return { x: anchor.x + (p.x - anchor.x) * f, y: anchor.y + (p.y - anchor.y) * f };
}

/**
 * グループスケールで固定する不動点(つかんだ角の対角)をワールド座標で返す。
 * union はワールド軸平行の結合バウンディングボックス、handle は角(sx,sy∈{-1,1})。
 */
export function groupScaleAnchor(union: Rect, handle: HandleDir): Point {
  return {
    x: handle.sx > 0 ? union.x : union.x + union.width,
    y: handle.sy > 0 ? union.y : union.y + union.height,
  };
}

/**
 * 角ハンドルのドラッグから等比の拡大率を求める。対角(anchor)を固定したまま、
 * つかんだ角がポインタへ来る倍率を計算し、変化の大きい軸に合わせて等比化する。
 * 反転・潰れを避けるため下限でクランプする(グループ全体の鏡像化は行わない)。
 */
export function computeGroupScaleFactor(
  union: Rect,
  handle: HandleDir,
  worldPoint: Point,
): number {
  const anchor = groupScaleAnchor(union, handle);
  const dx0 = (handle.sx > 0 ? union.x + union.width : union.x) - anchor.x;
  const dy0 = (handle.sy > 0 ? union.y + union.height : union.y) - anchor.y;
  const fx = Math.abs(dx0) > 1e-9 ? (worldPoint.x - anchor.x) / dx0 : 1;
  const fy = Math.abs(dy0) > 1e-9 ? (worldPoint.y - anchor.y) / dy0 : 1;
  const f = Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;
  return Math.max(f, MIN_SCALE);
}

/** グループスケールが1オブジェクトへ与える新しい transform / props */
export interface GroupScaleItem {
  transform: Transform;
  props: Record<string, unknown>;
}

/**
 * 1オブジェクトを anchor 中心に等比 f でスケールする。線幅・文字以外の見た目は保ち、
 * 位置・サイズ(幅/半径/長さ/フォントサイズ)を相似に拡大縮小する(線幅は不変=方式A)。
 * - 線分系(端点編集のみ): 2端点を anchor 中心にスケールして setFromEndpoints で作り直す
 * - 箱型/記号(applyScale): サイズを焼き込み、原点(=transform位置)を anchor 中心へ移す
 * - どちらも無い: 位置だけを anchor 中心にスケール(サイズは変えない)
 * 呼び出し側で legacy な transform.scale は props へ焼き込み済み(scale=1)であることを前提とする。
 */
export function scaleObjectAbout(
  plugin: AnyPlugin,
  transform: Transform,
  props: Record<string, unknown>,
  anchor: Point,
  f: number,
): GroupScaleItem {
  if (plugin.applyScale) {
    // applyScale はローカル座標を原点中心に f 倍する(幅/半径/長さ/本体寸法/文字)。
    // よって原点(=transform位置)を anchor 中心にスケールすれば、端子・本体・ラベルまで
    // 含めて全点が anchor 中心の相似変換になる(ラベル等で bounds が非対称でもズレない)。
    const nextProps = plugin.applyScale(props, f, f) as Record<string, unknown>;
    const p = scalePoint({ x: transform.x, y: transform.y }, anchor, f);
    return {
      props: nextProps,
      transform: { ...transform, scaleX: 1, scaleY: 1, x: p.x, y: p.y },
    };
  }
  if (plugin.getEndpoints && plugin.setFromEndpoints) {
    const [ea, eb] = plugin.getEndpoints(props);
    const wa = scalePoint(localToWorld(ea, transform), anchor, f);
    const wb = scalePoint(localToWorld(eb, transform), anchor, f);
    const r = plugin.setFromEndpoints(props, wa, wb);
    return { transform: r.transform, props: r.props as Record<string, unknown> };
  }
  const p = scalePoint({ x: transform.x, y: transform.y }, anchor, f);
  return { transform: { ...transform, x: p.x, y: p.y }, props };
}
