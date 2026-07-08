import { useMemo, useState, type ComponentType } from 'react';
import { OPERATION_TOOLS } from '../canvas/tools';
import { TOOL_SHORTCUTS } from '../canvas/toolShortcuts';
import { pluginRegistry } from '../core/registry';
import { useToolStore } from '../state/toolStore';
import styles from './Toolbox.module.css';

/** ツールボックスに並ぶ1項目(プラグイン図形・操作ツール共通の最小情報) */
type ToolItem = { id: string; name: string; Icon: ComponentType };

/**
 * カテゴリの表示順(プラグイン登録順に依らず固定)。
 * ここに無いカテゴリは末尾に登録順で続く。
 */
const CATEGORY_ORDER = [
  '基本図形',
  '注釈',
  '編集',
  '拘束',
  'グラフ',
  'レイアウト',
  '力学',
  '電磁気',
];

/** プラグイン図形と操作ツールをカテゴリ別に統合し、CATEGORY_ORDER 順で返す */
function toolsByCategory(): [string, ToolItem[]][] {
  const map = new Map<string, ToolItem[]>();
  const add = (category: string, item: ToolItem) => {
    const list = map.get(category);
    if (list) list.push(item);
    else map.set(category, [item]);
  };
  for (const [category, plugins] of pluginRegistry.byCategory()) {
    for (const p of plugins) add(category, { id: p.id, name: p.name, Icon: p.Icon });
  }
  for (const t of OPERATION_TOOLS) add(t.category, { id: t.id, name: t.name, Icon: t.Icon });

  // CATEGORY_ORDER に載っているものを先に、載っていないものは末尾へ(挿入順を維持)
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

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
  const categories = useMemo(() => toolsByCategory(), []);
  const [query, setQuery] = useState('');
  // 折りたたみ中のカテゴリ名。既定は全展開
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // 検索時は名前・カテゴリ名で絞り込み、該当0件のカテゴリは隠す
  const visible = categories
    .map(([category, items]): [string, ToolItem[]] => {
      if (!searching) return [category, items];
      if (category.toLowerCase().includes(q)) return [category, items];
      return [category, items.filter((it) => it.name.toLowerCase().includes(q))];
    })
    .filter(([, items]) => items.length > 0);

  const toggle = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

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

      <div className={styles.search}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="ツールを検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {visible.length === 0 && <p className={styles.empty}>該当するツールがありません</p>}

      {visible.map(([category, items]) => {
        // 検索中は結果が隠れないよう常に展開
        const open = searching || !collapsed.has(category);
        return (
          <div key={category} className={styles.section}>
            <button
              type="button"
              className={styles.heading}
              onClick={() => !searching && toggle(category)}
              aria-expanded={open}
            >
              <span className={styles.chevron} data-open={open}>
                ▾
              </span>
              <span className={styles.headingText}>{category}</span>
              <span className={styles.count}>{items.length}</span>
            </button>
            {open &&
              items.map((item) => {
                const shortcut = TOOL_SHORTCUTS[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={activeTool === item.id ? styles.toolActive : styles.tool}
                    // 事前選択を1つ目のピックに使うか解除するかは、ツール切替時に CanvasStage が判断する
                    onClick={() => setActiveTool(item.id)}
                  >
                    <item.Icon />
                    <span>
                      {item.name}
                      {shortcut && <span className={styles.shortcutHint}>({shortcut})</span>}
                    </span>
                  </button>
                );
              })}
          </div>
        );
      })}
    </aside>
  );
}
