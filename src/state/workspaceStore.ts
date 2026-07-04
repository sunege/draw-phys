import { create } from 'zustand';
import type { SceneDocumentJson } from '../core/document';
import type { StorageAdapter, WorkspaceNode } from '../persistence/types';

const EMPTY_DOC: SceneDocumentJson = { schemaVersion: 1, objects: [] };

interface WorkspaceState {
  adapter: StorageAdapter | null;
  nodes: Record<string, WorkspaceNode>;
  loaded: boolean;
  searchQuery: string;

  init(adapter: StorageAdapter): Promise<void>;
  createFolder(parentId: string | null, name: string): Promise<string>;
  createFile(parentId: string | null, name: string): Promise<string>;
  rename(id: string, name: string): Promise<void>;
  move(id: string, parentId: string | null): Promise<void>;
  /** フォルダは配下ごと再帰的に削除する */
  remove(id: string): Promise<void>;
  /** ファイル/フォルダを複製する(フォルダは再帰コピー) */
  copy(id: string): Promise<string | null>;
  setSearchQuery(query: string): void;
}

function requireAdapter(adapter: StorageAdapter | null): StorageAdapter {
  if (!adapter) throw new Error('ワークスペースが初期化されていません');
  return adapter;
}

/** idの子孫ノードID一覧(自身は含まない) */
export function descendantIds(nodes: Record<string, WorkspaceNode>, id: string): string[] {
  const result: string[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const node of Object.values(nodes)) {
      if (node.parentId === current) {
        result.push(node.id);
        stack.push(node.id);
      }
    }
  }
  return result;
}

/** 移動先が自身または自身の子孫でないか(循環防止) */
export function canMove(
  nodes: Record<string, WorkspaceNode>,
  id: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true;
  if (parentId === id) return false;
  return !descendantIds(nodes, id).includes(parentId);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const putNode = async (node: WorkspaceNode) => {
    await requireAdapter(get().adapter).putNode(node);
    set({ nodes: { ...get().nodes, [node.id]: node } });
  };

  return {
    adapter: null,
    nodes: {},
    loaded: false,
    searchQuery: '',

    async init(adapter) {
      const list = await adapter.listNodes();
      const nodes: Record<string, WorkspaceNode> = {};
      for (const node of list) nodes[node.id] = node;
      set({ adapter, nodes, loaded: true });
    },

    async createFolder(parentId, name) {
      const node: WorkspaceNode = {
        id: crypto.randomUUID(),
        name,
        type: 'folder',
        parentId,
        updatedAt: Date.now(),
      };
      await putNode(node);
      return node.id;
    },

    async createFile(parentId, name) {
      const node: WorkspaceNode = {
        id: crypto.randomUUID(),
        name,
        type: 'file',
        parentId,
        updatedAt: Date.now(),
      };
      await requireAdapter(get().adapter).writeDocument(node.id, EMPTY_DOC);
      await putNode(node);
      return node.id;
    },

    async rename(id, name) {
      const node = get().nodes[id];
      if (!node) return;
      await putNode({ ...node, name, updatedAt: Date.now() });
    },

    async move(id, parentId) {
      const node = get().nodes[id];
      if (!node || !canMove(get().nodes, id, parentId)) return;
      await putNode({ ...node, parentId, updatedAt: Date.now() });
    },

    async remove(id) {
      const adapter = requireAdapter(get().adapter);
      const { nodes } = get();
      const targets = [id, ...descendantIds(nodes, id)];
      for (const targetId of targets) {
        const node = nodes[targetId];
        if (!node) continue;
        if (node.type === 'file') await adapter.deleteDocument(targetId);
        await adapter.deleteNode(targetId);
      }
      const next = { ...nodes };
      for (const targetId of targets) delete next[targetId];
      set({ nodes: next });
    },

    async copy(id) {
      const adapter = requireAdapter(get().adapter);
      const { nodes } = get();
      const source = nodes[id];
      if (!source) return null;

      const cloneRecursive = async (
        node: WorkspaceNode,
        parentId: string | null,
        rename: boolean,
      ): Promise<string> => {
        const clone: WorkspaceNode = {
          ...node,
          id: crypto.randomUUID(),
          parentId,
          name: rename ? `${node.name} のコピー` : node.name,
          updatedAt: Date.now(),
        };
        if (node.type === 'file') {
          const doc = await adapter.readDocument(node.id);
          await adapter.writeDocument(clone.id, doc ?? EMPTY_DOC);
        }
        await putNode(clone);
        if (node.type === 'folder') {
          for (const child of Object.values(get().nodes)) {
            if (child.parentId === node.id) await cloneRecursive(child, clone.id, false);
          }
        }
        return clone.id;
      };

      return cloneRecursive(source, source.parentId, true);
    },

    setSearchQuery(query) {
      set({ searchQuery: query });
    },
  };
});
