import type { AnyPlugin } from './plugin';

/**
 * プラグインレジストリ。
 * アプリ本体はここを通してのみプラグインへアクセスし、
 * 個々のオブジェクトの種類を意識しない。
 */
export class PluginRegistry {
  private plugins = new Map<string, AnyPlugin>();

  register(plugin: AnyPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`プラグインID "${plugin.id}" は登録済みです`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  get(pluginId: string): AnyPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  all(): AnyPlugin[] {
    return [...this.plugins.values()];
  }

  /** カテゴリ→プラグイン一覧。登録順を保つ(ツールボックス表示用) */
  byCategory(): Map<string, AnyPlugin[]> {
    const result = new Map<string, AnyPlugin[]>();
    for (const plugin of this.plugins.values()) {
      const list = result.get(plugin.category);
      if (list) {
        list.push(plugin);
      } else {
        result.set(plugin.category, [plugin]);
      }
    }
    return result;
  }
}

/** アプリ全体で共有するレジストリ */
export const pluginRegistry = new PluginRegistry();
