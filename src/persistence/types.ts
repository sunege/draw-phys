import type { SceneDocumentJson } from '../core/document';

/** ワークスペースのフォルダ/ファイルノード */
export interface WorkspaceNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  /** null はルート直下 */
  parentId: string | null;
  updatedAt: number;
}

/**
 * 永続化の抽象。現在はIndexedDB実装のみだが、
 * 将来OPFS実装へ差し替えられるようインターフェースで切る。
 */
export interface StorageAdapter {
  listNodes(): Promise<WorkspaceNode[]>;
  putNode(node: WorkspaceNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
  readDocument(fileId: string): Promise<SceneDocumentJson | null>;
  writeDocument(fileId: string, doc: SceneDocumentJson): Promise<void>;
  deleteDocument(fileId: string): Promise<void>;
}
