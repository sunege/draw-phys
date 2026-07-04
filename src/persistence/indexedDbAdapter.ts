import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SceneDocumentJson } from '../core/document';
import type { StorageAdapter, WorkspaceNode } from './types';

interface DrawPhysDb extends DBSchema {
  nodes: { key: string; value: WorkspaceNode };
  documents: { key: string; value: SceneDocumentJson };
}

export class IndexedDbAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBPDatabase<DrawPhysDb>>;

  constructor(dbName = 'draw-phys') {
    this.dbPromise = openDB<DrawPhysDb>(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('nodes', { keyPath: 'id' });
        db.createObjectStore('documents');
      },
    });
  }

  async listNodes(): Promise<WorkspaceNode[]> {
    return (await this.dbPromise).getAll('nodes');
  }

  async putNode(node: WorkspaceNode): Promise<void> {
    await (await this.dbPromise).put('nodes', node);
  }

  async deleteNode(id: string): Promise<void> {
    await (await this.dbPromise).delete('nodes', id);
  }

  async readDocument(fileId: string): Promise<SceneDocumentJson | null> {
    return (await (await this.dbPromise).get('documents', fileId)) ?? null;
  }

  async writeDocument(fileId: string, doc: SceneDocumentJson): Promise<void> {
    await (await this.dbPromise).put('documents', doc, fileId);
  }

  async deleteDocument(fileId: string): Promise<void> {
    await (await this.dbPromise).delete('documents', fileId);
  }
}
