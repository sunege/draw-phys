import { createSceneObject, type SceneObject, type SceneObjects } from '../core/document';
import type { PluginRegistry } from '../core/registry';
import { mapRegion, regionBounds } from '../core/regionPath';
import type { Point } from '../core/types';
import { buildArrangement, regionAt, type Arrangement, type OwnedCurve, type RegionResult } from './regionMath';
import { objectWorldCurves } from './worldCurves';

/** 塗りつぶしツールが作る図形のプラグインid */
export const FILL_REGION_PLUGIN_ID = 'core.fillRegion';

/** 作成時に選択中の塗り領域から引き継ぐ見た目のprops */
const STYLE_KEYS = ['fill', 'fillOpacity', 'fillPattern', 'patternSize', 'stroke', 'strokeWidth'] as const;

/**
 * 境界になる曲線を集める。可視オブジェクトの getSegments/getCircle/getEllipse が対象
 * (コンストラクション線も含む=書き出しで消える補助線で囲って塗れる)。
 * 用紙枠は除外する(用紙全体が1つの領域になってしまうため)。
 */
function collectBoundaryCurves(objects: SceneObjects, registry: PluginRegistry): OwnedCurve[] {
  const curves: OwnedCurve[] = [];
  for (const obj of Object.values(objects)) {
    if (!obj.visible) continue;
    const plugin = registry.get(obj.pluginId);
    if (!plugin || plugin.capabilities?.printFrame) continue;
    for (const curve of objectWorldCurves(obj, plugin)) curves.push({ owner: obj.id, curve });
  }
  return curves;
}

/**
 * 平面グラフの構築は重いので、同じ objects 参照(Zustandの不変更新)と許容距離の間は使い回す。
 * ホバープレビューのたびに作り直さない。
 */
export function createRegionFinder(registry: PluginRegistry) {
  let cache: { objects: SceneObjects; tol: number; arr: Arrangement } | null = null;
  return (objects: SceneObjects, world: Point, tol: number): RegionResult | null => {
    if (!cache || cache.objects !== objects || cache.tol !== tol) {
      cache = { objects, tol, arr: buildArrangement(collectBoundaryCurves(objects, registry), tol) };
    }
    return regionAt(cache.arr, world);
  };
}

/**
 * 領域から塗り領域オブジェクトを作る。原点は輪郭の外接矩形の中心(ローカル座標へ平行移動)。
 * styleFrom(選択中の塗り領域)があれば色・パターンを引き継ぐ=続けて同じ色で塗れる。
 */
export function createFillRegionObject(
  registry: PluginRegistry,
  region: RegionResult,
  styleFrom?: SceneObject,
): SceneObject | null {
  const plugin = registry.get(FILL_REGION_PLUGIN_ID);
  if (!plugin) return null;
  const b = regionBounds(region.loops);
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const obj = createSceneObject(plugin, center, 0);
  const style: Record<string, unknown> = {};
  if (styleFrom?.pluginId === FILL_REGION_PLUGIN_ID) {
    for (const k of STYLE_KEYS) if (styleFrom.props[k] !== undefined) style[k] = styleFrom.props[k];
  }
  obj.props = { ...obj.props, ...style, loops: mapRegion(region.loops, -center.x, -center.y) };
  return obj;
}
