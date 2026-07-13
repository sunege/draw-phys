import type { SceneDocumentJson } from '../../core/document';
import type { StorageAdapter, WorkspaceNode } from '../../persistence/types';
import { driveFetch } from './driveClient';
import {
  driveFileToNode,
  nodeToAppProperties,
  NODE_ID_KEY,
  type DriveFile,
} from './driveMapping';
import type { TokenProvider } from './gis';

/**
 * Google Drive の appDataFolder を使う StorageAdapter 実装。
 *
 * 各ノード(フォルダ/ファイル)を appDataFolder 直下の1ファイルとして平置きし、
 * 階層(parentId)や種別は appProperties に持たせる(→ driveMapping)。
 * node.id はクライアント採番のUUIDのままで、Drive採番の実fileIDとの対応を idMap に保持する。
 * 各ノードが独立ファイルなので、名前変更/移動は1ファイルのpatchで済み複数端末でも競合しにくい。
 */
export class GoogleDriveAdapter implements StorageAdapter {
  private getToken: TokenProvider;
  /** nodeId(UUID) → Drive実fileID */
  private idMap = new Map<string, string>();

  constructor(getToken: TokenProvider) {
    this.getToken = getToken;
  }

  /** nodeId から Drive実fileID を解決(キャッシュ優先、無ければ appProperties 検索) */
  private async findDriveId(nodeId: string): Promise<string | null> {
    const cached = this.idMap.get(nodeId);
    if (cached) return cached;
    const q = `appProperties has { key='${NODE_ID_KEY}' and value='${nodeId}' } and trashed=false`;
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q,
      fields: 'files(id)',
    });
    const res = await driveFetch(this.getToken, `/files?${params.toString()}`);
    const data = (await res.json()) as { files?: { id: string }[] };
    const id = data.files?.[0]?.id ?? null;
    if (id) this.idMap.set(nodeId, id);
    return id;
  }

  async listNodes(): Promise<WorkspaceNode[]> {
    const nodes: WorkspaceNode[] = [];
    this.idMap.clear();
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: 'trashed=false',
        fields: 'nextPageToken, files(id,name,appProperties,modifiedTime)',
        pageSize: '1000',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await driveFetch(this.getToken, `/files?${params.toString()}`);
      const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
      for (const file of data.files ?? []) {
        const node = driveFileToNode(file);
        if (node) {
          nodes.push(node);
          this.idMap.set(node.id, file.id);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return nodes;
  }

  async putNode(node: WorkspaceNode): Promise<void> {
    const existing = await this.findDriveId(node.id);
    const metadata = {
      name: node.name,
      appProperties: nodeToAppProperties(node),
    };
    if (existing) {
      await driveFetch(this.getToken, `/files/${existing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
    } else {
      const res = await driveFetch(this.getToken, '/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadata, parents: ['appDataFolder'] }),
      });
      const data = (await res.json()) as { id: string };
      this.idMap.set(node.id, data.id);
    }
  }

  async deleteNode(id: string): Promise<void> {
    const driveId = await this.findDriveId(id);
    if (!driveId) return; // 既に無い場合も成功扱い(冪等)
    await driveFetch(this.getToken, `/files/${driveId}`, { method: 'DELETE' });
    this.idMap.delete(id);
  }

  async readDocument(fileId: string): Promise<SceneDocumentJson | null> {
    const driveId = await this.findDriveId(fileId);
    if (!driveId) return null;
    const res = await driveFetch(this.getToken, `/files/${driveId}?alt=media`);
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as SceneDocumentJson;
    } catch {
      return null;
    }
  }

  async writeDocument(fileId: string, doc: SceneDocumentJson): Promise<void> {
    const driveId = await this.findDriveId(fileId);
    // ノードは putNode で先に作られる想定(createFile/copy は putNode→writeDocument の順)
    if (!driveId) return;
    await driveFetch(
      this.getToken,
      `/files/${driveId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      },
      { base: 'upload' },
    );
  }

  async deleteDocument(): Promise<void> {
    // Driveではノード=1ファイルなので、実体の削除は deleteNode が担当する(ここはno-op)。
  }
}
