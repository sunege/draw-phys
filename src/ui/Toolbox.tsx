import { OPERATION_TOOLS } from '../canvas/tools';
import { pluginRegistry } from '../core/registry';
import { useToolStore } from '../state/toolStore';
import styles from './Toolbox.module.css';

/** 選択ツールのアイコン */
function SelectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M6 3 L18 13 L12.5 13.8 L15.5 20 L13 21 L10 15 L6 18 Z" fill="currentColor" />
    </svg>
  );
}

/** 登録済みプラグインからカテゴリごとに自動生成されるツールボックス */
export function Toolbox() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const categories = pluginRegistry.byCategory();

  return (
    <aside className={styles.toolbox}>
      <div className={styles.section}>
        <button
          type="button"
          className={activeTool === 'select' ? styles.toolActive : styles.tool}
          onClick={() => setActiveTool('select')}
        >
          <SelectIcon />
          <span>選択</span>
        </button>
      </div>
      {[...categories.entries()].map(([category, plugins]) => (
        <div key={category} className={styles.section}>
          <h3 className={styles.heading}>{category}</h3>
          {plugins.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              className={activeTool === plugin.id ? styles.toolActive : styles.tool}
              onClick={() => setActiveTool(plugin.id)}
            >
              <plugin.Icon />
              <span>{plugin.name}</span>
            </button>
          ))}
        </div>
      ))}
      <div className={styles.section}>
        <h3 className={styles.heading}>拘束</h3>
        {OPERATION_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={activeTool === tool.id ? styles.toolActive : styles.tool}
            onClick={() => setActiveTool(tool.id)}
          >
            <tool.Icon />
            <span>{tool.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
