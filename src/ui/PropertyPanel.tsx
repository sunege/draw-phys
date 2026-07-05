import { fromDisplayAngle, toDisplayAngle } from '../canvas/transformMath';
import { findRotationLock } from '../core/constraints';
import type { PropertyField } from '../core/plugin';
import { pluginRegistry } from '../core/registry';
import { useDocumentStore, type AlignMode, type ReorderMode } from '../state/documentStore';
import styles from './PropertyPanel.module.css';

const ALIGN_ACTIONS: { mode: AlignMode; label: string; title: string }[] = [
  { mode: 'left', label: '⇤', title: '左揃え' },
  { mode: 'centerX', label: '⇹', title: '左右中央揃え' },
  { mode: 'right', label: '⇥', title: '右揃え' },
  { mode: 'top', label: '⤒', title: '上揃え' },
  { mode: 'centerY', label: '⇳', title: '上下中央揃え' },
  { mode: 'bottom', label: '⤓', title: '下揃え' },
];

const REORDER_ACTIONS: { mode: ReorderMode; label: string; title: string }[] = [
  { mode: 'front', label: '⏫', title: '最前面へ (Ctrl+Shift+])' },
  { mode: 'forward', label: '🔼', title: '前面へ (Ctrl+])' },
  { mode: 'backward', label: '🔽', title: '背面へ (Ctrl+[)' },
  { mode: 'back', label: '⏬', title: '最背面へ (Ctrl+Shift+[)' },
];

/** 選択オブジェクトへの共通操作(グループ化・整列・重なり順・ロック・非表示) */
function SelectionActions() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const store = useDocumentStore.getState();

  const multi = selection.length >= 2;
  const hasGroup = selection.some((id) => objects[id]?.groupId);

  // コンストラクション(補助線)へ切替可能な選択(capability を持つ 線・円 のみ)
  const constructibleIds = selection.filter(
    (id) => !!pluginRegistry.get(objects[id]?.pluginId ?? '')?.capabilities?.construction,
  );
  const canConstruct = constructibleIds.length > 0 && constructibleIds.length === selection.length;
  const allConstruction = canConstruct && constructibleIds.every((id) => objects[id]?.construction);

  return (
    <div className={styles.actions}>
      {canConstruct && (
        <label
          className={styles.field}
          title="作図補助線。色付き点線で表示し、スナップ・拘束は通常どおり効くが書き出しには含めない"
        >
          <span className={styles.label}>コンストラクション</span>
          <input
            type="checkbox"
            checked={allConstruction}
            onChange={(e) =>
              store.setObjectFlags(constructibleIds, { construction: e.target.checked })
            }
          />
        </label>
      )}
      <div className={styles.actionRow}>
        <button
          type="button"
          disabled={!multi}
          onClick={() => store.groupSelection()}
          title="グループ化 (Ctrl+G)"
        >
          グループ化
        </button>
        <button
          type="button"
          disabled={!hasGroup}
          onClick={() => store.ungroupSelection()}
          title="グループ解除 (Ctrl+Shift+G)"
        >
          解除
        </button>
      </div>
      <div className={styles.actionRow}>
        {ALIGN_ACTIONS.map((a) => (
          <button
            key={a.mode}
            type="button"
            className={styles.iconAction}
            disabled={!multi}
            title={a.title}
            onClick={() => store.alignSelection(a.mode)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className={styles.actionRow}>
        {REORDER_ACTIONS.map((a) => (
          <button
            key={a.mode}
            type="button"
            className={styles.iconAction}
            title={a.title}
            onClick={() => store.reorderSelection(a.mode)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.iconAction}
          title="ロック(選択不可にする)"
          onClick={() => {
            store.setObjectFlags(selection, { locked: true });
            store.clearSelection();
          }}
        >
          🔒
        </button>
        <button
          type="button"
          className={styles.iconAction}
          title="非表示にする"
          onClick={() => {
            store.setObjectFlags(selection, { visible: false });
            store.clearSelection();
          }}
        >
          🙈
        </button>
      </div>
    </div>
  );
}

/** 非表示・ロック中オブジェクトの復帰リスト */
function ManagedObjects() {
  const objects = useDocumentStore((s) => s.objects);
  const store = useDocumentStore.getState();
  const managed = Object.values(objects).filter((o) => o.locked || !o.visible);
  if (managed.length === 0) return null;

  return (
    <div className={styles.managed}>
      <h3 className={styles.heading}>非表示・ロック中</h3>
      {managed.map((obj) => {
        const plugin = pluginRegistry.get(obj.pluginId);
        return (
          <div key={obj.id} className={styles.managedRow}>
            <span className={styles.managedName}>
              {plugin?.name ?? obj.pluginId}
              {obj.locked ? ' 🔒' : ''}
              {!obj.visible ? ' 🙈' : ''}
            </span>
            {obj.locked && (
              <button
                type="button"
                title="ロック解除"
                onClick={() => store.setObjectFlags([obj.id], { locked: false })}
              >
                解除
              </button>
            )}
            {!obj.visible && (
              <button
                type="button"
                title="表示する"
                onClick={() => store.setObjectFlags([obj.id], { visible: true })}
              >
                表示
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PropertyField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
      );
    case 'text':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'multiline':
      return (
        <textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'color':
      return (
        <input
          type="color"
          value={typeof value === 'string' ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
  }
}

/** 選択オブジェクトのプラグインスキーマから自動生成されるプロパティパネル */
export function PropertyPanel() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const updateProps = useDocumentStore((s) => s.updateProps);

  if (selection.length === 0) {
    return (
      <aside className={styles.panel}>
        <p className={styles.empty}>オブジェクトを選択するとプロパティが表示されます</p>
        <ManagedObjects />
      </aside>
    );
  }

  if (selection.length > 1) {
    return (
      <aside className={styles.panel}>
        <p className={styles.empty}>{selection.length}個のオブジェクトを選択中</p>
        <SelectionActions />
        <ManagedObjects />
      </aside>
    );
  }

  const obj = objects[selection[0]];
  const plugin = obj ? pluginRegistry.get(obj.pluginId) : undefined;
  if (!obj || !plugin) return <aside className={styles.panel} />;

  // 回転角の編集(平行/垂直拘束中は回転が固定されるため出さない)
  const rotationBound = !!findRotationLock(obj.refs);
  const rotatable = (plugin.capabilities?.rotatable ?? true) && !rotationBound;
  // 表示は「水平右=0°, 反時計回りが正」。中心まわりに向きだけ変える
  const displayAngle = Math.round(toDisplayAngle(obj.transform.rotation) * 10) / 10;
  const setRotation = (deg: number) => {
    const store = useDocumentStore.getState();
    const before = store.objects[obj.id]?.transform;
    if (!before) return;
    store.setTransformsTransient({ [obj.id]: { ...before, rotation: fromDisplayAngle(deg) } });
    store.commitTransforms({ [obj.id]: before });
  };

  return (
    <aside className={styles.panel}>
      <h3 className={styles.heading}>{plugin.name}</h3>
      {rotatable && (
        <label className={styles.field}>
          <span className={styles.label}>回転角 (°)</span>
          <input
            type="number"
            step={1}
            value={displayAngle}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) setRotation(n);
            }}
          />
        </label>
      )}
      {plugin.propertySchema.map((field) => (
        <label key={field.key} className={styles.field}>
          <span className={styles.label}>{field.label}</span>
          <FieldInput
            field={field}
            value={obj.props[field.key]}
            onChange={(value) => updateProps(obj.id, { [field.key]: value })}
          />
        </label>
      ))}
      {obj.refs && obj.refs.length > 0 && (
        <div className={styles.actionRow}>
          <button
            type="button"
            title="他オブジェクトへの追従を解除する"
            onClick={() => useDocumentStore.getState().setObjectRefs(obj.id, [])}
          >
            追従を解除
          </button>
        </div>
      )}
      <SelectionActions />
      <ManagedObjects />
    </aside>
  );
}
