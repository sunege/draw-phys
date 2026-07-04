import type { SceneDocumentJson } from '../core/document';
import type { StorageAdapter, WorkspaceNode } from './types';

/** テスト・フォールバック用のインメモリ実装 */
export class MemoryAdapter implements StorageAdapter {
  private nodes = new Map<string, WorkspaceNode>();
  private documents = new Map<string, SceneDocumentJson>();

  async listNodes(): Promise<WorkspaceNode[]> {
    return [...this.nodes.values()].map((n) => ({ ...n }));
  }

  async putNode(node: WorkspaceNode): Promise<void> {
    this.nodes.set(node.id, { ...node });
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes.delete(id);
  }

  async readDocument(fileId: string): Promise<SceneDocumentJson | null> {
    const doc = this.documents.get(fileId);
    return doc ? structuredClone(doc) : null;
  }

  async writeDocument(fileId: string, doc: SceneDocumentJson): Promise<void> {
    this.documents.set(fileId, structuredClone(doc));
  }

  async deleteDocument(fileId: string): Promise<void> {
    this.documents.delete(fileId);
  }
}
