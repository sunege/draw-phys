import { useEffect, useRef, type ReactNode } from 'react';
import { fromDisplayAngle, toDisplayAngle } from '../canvas/transformMath';
import { isLengthConstrained, isRotationConstrained } from '../core/constraints';
import type { SceneObject } from '../core/document';
import type { PropertyField } from '../core/plugin';
import { pluginRegistry } from '../core/registry';
import {
  useDocumentStore,
  type AlignMode,
  type DistributeMode,
  type ReorderMode,
} from '../state/documentStore';
import { RIGHT_CFG, RIGHT_NARROW_BELOW, useLayoutStore } from '../state/layoutStore';
import { computeCommonFields } from './commonPropertyFields';
import styles from './PropertyPanel.module.css';

/** パネル幅・折りたたみ・2行化(狭幅reflow)をまとめて適用する共通の外枠 */
function PanelFrame({ children }: { children?: ReactNode }) {
  const rightWidth = useLayoutStore((s) => s.rightWidth);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const narrow = !rightCollapsed && rightWidth < RIGHT_NARROW_BELOW;
  return (
    <aside
      className={styles.panel}
      data-collapsed={rightCollapsed}
      data-narrow={narrow}
      style={{ width: rightCollapsed ? RIGHT_CFG.collapsedSize : rightWidth }}
    >
      {!rightCollapsed && children}
    </aside>
  );
}

const ALIGN_ACTIONS: { mode: AlignMode; label: string; title: string }[] = [
  { mode: 'left', label: '⇤', title: '左揃え' },
  { mode: 'centerX', label: '⇹', title: '左右中央揃え' },
  { mode: 'right', label: '⇥', title: '右揃え' },
  { mode: 'top', label: '⤒', title: '上揃え' },
  { mode: 'centerY', label: '⇳', title: '上下中央揃え' },
  { mode: 'bottom', label: '⤓', title: '下揃え' },
];

const DISTRIBUTE_ACTIONS: { mode: DistributeMode; label: string; title: string }[] = [
  { mode: 'horizontal', label: '⇔', title: '左右に等間隔（3個以上）' },
  { mode: 'vertical', label: '⇕', title: '上下に等間隔（3個以上）' },
];

const REORDER_ACTIONS: { mode: ReorderMode; label: string; title: string }[] = [
  { mode: 'front', label: '⏫', title: '最前面へ (f / Ctrl+Shift+])' },
  { mode: 'forward', label: '🔼', title: '前面へ (Ctrl+])' },
  { mode: 'backward', label: '🔽', title: '背面へ (Ctrl+[)' },
  { mode: 'back', label: '⏬', title: '最背面へ (b / Ctrl+Shift+[)' },
];

/** 選択オブジェクトへの共通操作(グループ化・整列・重なり順・ロック・非表示) */
function SelectionActions() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const store = useDocumentStore.getState();

  const multi = selection.length >= 2;
  const multi3 = selection.length >= 3;
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
        {DISTRIBUTE_ACTIONS.map((a) => (
          <button
            key={a.mode}
            type="button"
            className={styles.iconAction}
            disabled={!multi3}
            title={a.title}
            onClick={() => store.distributeSelection(a.mode)}
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
  mixed = false,
  disabled = false,
  disabledTitle,
  onChange,
}: {
  field: PropertyField;
  value: unknown;
  /** 複数選択の一括編集で、選択オブジェクト間で値が食い違う場合 true */
  mixed?: boolean;
  /** 拘束で値が確定していて編集できない場合 true(長さの2点拘束など) */
  disabled?: boolean;
  /** disabled のときにホバーで表示する理由 */
  disabledTitle?: string;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case 'number':
      return (
        <input
          type="number"
          value={!mixed && typeof value === 'number' ? value : ''}
          placeholder={mixed ? '(複数の値)' : undefined}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          title={disabled ? disabledTitle : undefined}
          onFocus={(e) => e.currentTarget.select()}
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
          value={!mixed && typeof value === 'string' ? value : ''}
          placeholder={mixed ? '(複数の値)' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'multiline':
      return (
        <textarea
          rows={3}
          value={!mixed && typeof value === 'string' ? value : ''}
          placeholder={mixed ? '(複数の値)' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'color':
      return (
        <span className={styles.colorMixedWrap}>
          <input
            type="color"
            value={typeof value === 'string' ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
          />
          {mixed && <span className={styles.mixedHint}>(複数の値)</span>}
        </span>
      );
    case 'boolean':
      return <BooleanFieldInput checked={value === true} indeterminate={mixed} onChange={onChange} />;
    case 'select':
      return (
        <select
          value={mixed ? '' : typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {mixed && (
            <option value="" disabled hidden>
              (複数の値)
            </option>
          )}
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
  }
}

/** チェックボックスの「不確定」状態(indeterminate)はDOMプロパティであり属性ではないためrefで設定する */
function BooleanFieldInput({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (value: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

/** 複数選択時、選択オブジェクト間で共通するプロパティを一括編集するセクション */
function MultiPropertyFields() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const updatePropsMany = useDocumentStore((s) => s.updatePropsMany);

  const selectedObjects = selection
    .map((id) => objects[id])
    .filter((o): o is SceneObject => !!o);
  const commonFields = computeCommonFields(selectedObjects, pluginRegistry);
  if (commonFields.length === 0) return null;

  const applyToAll = (key: string, value: unknown) => {
    const patches: Record<string, Record<string, unknown>> = {};
    for (const obj of selectedObjects) {
      if (obj.locked) continue;
      patches[obj.id] = { [key]: value };
    }
    if (Object.keys(patches).length > 0) updatePropsMany(patches);
  };

  return (
    <div className={styles.multiFields}>
      <h3 className={styles.heading}>共通プロパティを一括編集</h3>
      {commonFields.map(({ field, mixed, value }) => (
        <label key={field.key} className={styles.field}>
          <span className={styles.label}>{field.label}</span>
          <FieldInput
            field={field}
            value={value}
            mixed={mixed}
            onChange={(next) => applyToAll(field.key, next)}
          />
        </label>
      ))}
    </div>
  );
}

/** 選択オブジェクトのプラグインスキーマから自動生成されるプロパティパネル */
export function PropertyPanel() {
  const objects = useDocumentStore((s) => s.objects);
  const selection = useDocumentStore((s) => s.selection);
  const updateProps = useDocumentStore((s) => s.updateProps);

  if (selection.length === 0) {
    return (
      <PanelFrame>
        <p className={styles.empty}>オブジェクトを選択するとプロパティが表示されます</p>
        <ManagedObjects />
      </PanelFrame>
    );
  }

  if (selection.length > 1) {
    return (
      <PanelFrame>
        <p className={styles.empty}>{selection.length}個のオブジェクトを選択中</p>
        <MultiPropertyFields />
        <SelectionActions />
        <ManagedObjects />
      </PanelFrame>
    );
  }

  const obj = objects[selection[0]];
  const plugin = obj ? pluginRegistry.get(obj.pluginId) : undefined;
  if (!obj || !plugin) return <PanelFrame />;

  // 回転角の編集(平行/垂直・一致×2・一致+接線で回転が固定されるため出さない)
  const rotationBound = isRotationConstrained(obj.refs);
  // 線分系の長さは一致×2(2点拘束)で確定するため、そのときはパネル編集を禁止する
  const lengthBound = !!plugin.getEndpoints && isLengthConstrained(obj.refs);
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
    <PanelFrame>
      <h3 className={styles.heading}>{plugin.name}</h3>
      {rotatable && (
        <label className={styles.field}>
          <span className={styles.label}>回転角 (°)</span>
          <input
            type="number"
            step={1}
            value={displayAngle}
            onFocus={(e) => e.currentTarget.select()}
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
            disabled={field.key === 'length' && lengthBound}
            disabledTitle="2点で拘束されているため長さは固定です"
            onChange={(value) => updateProps(obj.id, { [field.key]: value })}
          />
        </label>
      ))}
      {/* プラグイン独自のパネルUI(グラフのプロット一覧など、スキーマで表せないもの) */}
      {plugin.PanelExtra && <plugin.PanelExtra objectId={obj.id} props={obj.props} />}
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
    </PanelFrame>
  );
}
