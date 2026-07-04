import type { AnyPlugin } from './plugin';
import type { PluginRegistry } from './registry';
import { identityTransform, type ObjectRef, type Transform } from './types';

/** キャンバス上の1オブジェクト */
export interface SceneObject {
  id: string;
  pluginId: string;
  /** 保存時のプラグインバージョン */
  version: number;
  transform: Transform;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  groupId?: string;
  /** 他オブジェクトへの参照(拘束)。ソルバが対象位置から transform/props を再構築する */
  refs?: ObjectRef[];
  /** プラグイン固有のプロパティ */
  props: Record<string, unknown>;
}

/** 保存形式(JSON)。オブジェクト配列として保存する */
export interface SceneDocumentJson {
  schemaVersion: 1;
  objects: SceneObject[];
}

/** メモリ上のドキュメント表現。ID引きできるようMapで持つ */
export type SceneObjects = Record<string, SceneObject>;

export function createSceneObject(
  plugin: AnyPlugin,
  position: { x: number; y: number },
  zIndex: number,
): SceneObject {
  return {
    id: crypto.randomUUID(),
    pluginId: plugin.id,
    version: plugin.version,
    transform: identityTransform(position.x, position.y),
    zIndex,
    locked: false,
    visible: true,
    props: structuredClone(plugin.defaultProps) as Record<string, unknown>,
  };
}

/** zIndex順のオブジェクト配列(描画・保存用) */
export function sortedObjects(objects: SceneObjects): SceneObject[] {
  return Object.values(objects).sort((a, b) => a.zIndex - b.zIndex);
}

export function serializeDocument(objects: SceneObjects): SceneDocumentJson {
  return {
    schemaVersion: 1,
    objects: sortedObjects(objects).map((obj) => structuredClone(obj)),
  };
}

/**
 * JSONからドキュメントを再構築する。
 * 旧バージョンのpropsはプラグインの migrate() で移行し、
 * 未知のプラグインIDのオブジェクトは読み飛ばす(データは壊さない方針で警告のみ)。
 */
export function deserializeDocument(
  json: SceneDocumentJson,
  registry: PluginRegistry,
): SceneObjects {
  const objects: SceneObjects = {};
  for (const raw of json.objects) {
    const plugin = registry.get(raw.pluginId);
    if (!plugin) {
      console.warn(`未知のプラグイン "${raw.pluginId}" のオブジェクトを読み飛ばしました`);
      continue;
    }
    const obj = structuredClone(raw);
    if (obj.version !== plugin.version && plugin.migrate) {
      obj.props = plugin.migrate(obj.version, obj.props) as Record<string, unknown>;
      obj.version = plugin.version;
    }
    objects[obj.id] = obj;
  }
  return objects;
}
