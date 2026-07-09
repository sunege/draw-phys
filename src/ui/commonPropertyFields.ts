import type { SceneObject } from '../core/document';
import type { AnyPlugin, PropertyField } from '../core/plugin';
import type { PluginRegistry } from '../core/registry';

/** 複数選択の一括編集パネルの1行分。共通項目のフィールド定義+現在値の状態 */
export interface CommonPropertyField {
  field: PropertyField;
  /** 選択中の全対象オブジェクトで値が一致しない場合 true */
  mixed: boolean;
  /** mixed=false のときの共通値。mixed=true のときは代表値(先頭)で表示には使わない */
  value: unknown;
}

/**
 * 選択中オブジェクト群から、一括編集できる「共通プロパティ項目」を抽出する。
 * - ロック中オブジェクトは対象から除外する(alignSelection等の既存操作と同じ扱い)
 * - 除外後に2個未満なら空配列(単一選択の編集は通常のプロパティパネル側が担当)
 * - pluginId がレジストリに見つからないオブジェクトは無視する
 * - key と type が全対象プラグインで一致するフィールドだけを共通項目とする
 *   (select型は options の値集合も一致必須。順序は問わない)
 * - number型は min/max を交差(制約が一番厳しい範囲)させて返す
 */
export function computeCommonFields(
  selectedObjects: SceneObject[],
  registry: PluginRegistry,
): CommonPropertyField[] {
  const targets = selectedObjects.filter((obj) => !obj.locked);
  if (targets.length < 2) return [];

  const resolved = targets
    .map((obj) => ({ obj, plugin: registry.get(obj.pluginId) }))
    .filter((r): r is { obj: SceneObject; plugin: AnyPlugin } => !!r.plugin);
  if (resolved.length < 2) return [];

  const [first, ...rest] = resolved;
  const result: CommonPropertyField[] = [];

  for (const field of first.plugin.propertySchema) {
    const matches: PropertyField[] = [field];
    let ok = true;
    for (const r of rest) {
      const counterpart = r.plugin.propertySchema.find((f) => f.key === field.key);
      if (!counterpart || counterpart.type !== field.type) {
        ok = false;
        break;
      }
      if (field.type === 'select' && counterpart.type === 'select') {
        if (!sameOptionSet(field.options, counterpart.options)) {
          ok = false;
          break;
        }
      }
      matches.push(counterpart);
    }
    if (!ok) continue;

    const mergedField = mergeFieldDefinitions(matches);
    const values = resolved.map((r) => r.obj.props[field.key]);
    const mixed = values.some((v) => !Object.is(v, values[0]));
    result.push({ field: mergedField, mixed, value: values[0] });
  }

  return result;
}

function sameOptionSet(a: { value: string }[], b: { value: string }[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map((o) => o.value));
  return a.every((o) => setB.has(o.value));
}

/** number型のみ min/max を交差させる。それ以外は先頭の定義をそのまま使う */
function mergeFieldDefinitions(fields: PropertyField[]): PropertyField {
  const first = fields[0];
  if (first.type !== 'number') return first;
  const numberFields = fields.filter((f): f is PropertyField & { type: 'number' } => f.type === 'number');
  const mins = numberFields.map((f) => f.min).filter((v): v is number => v !== undefined);
  const maxs = numberFields.map((f) => f.max).filter((v): v is number => v !== undefined);
  return {
    ...first,
    min: mins.length ? Math.max(...mins) : undefined,
    max: maxs.length ? Math.min(...maxs) : undefined,
  };
}
