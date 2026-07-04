import type { SceneDocumentJson } from '../core/document';
import type { WorkspaceNode } from './types';

/** ノードのフルパス(フォルダ区切り "/")。ファイルは拡張子.jsonを付ける */
function nodePath(nodes: Record<string, WorkspaceNode>, node: WorkspaceNode): string {
  const parts = [node.type === 'file' ? `${node.name}.json` : node.name];
  let parent = node.parentId ? nodes[node.parentId] : undefined;
  while (parent) {
    parts.unshift(parent.name);
    parent = parent.parentId ? nodes[parent.parentId] : undefined;
  }
  return parts.join('/');
}

/** ワークスペース全体をZIP化する。フォルダ構造をそのままZIP内パスへ写す */
export async function buildWorkspaceZip(
  nodes: Record<string, WorkspaceNode>,
  readDocument: (fileId: string) => Promise<SceneDocumentJson | null>,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedPaths = new Set<string>();
  for (const node of Object.values(nodes)) {
    let path = nodePath(nodes, node);
    // 同名衝突はID先頭を付けて回避する
    if (usedPaths.has(path)) {
      const suffix = ` (${node.id.slice(0, 8)})`;
      path =
        node.type === 'file' ? path.replace(/\.json$/, `${suffix}.json`) : `${path}${suffix}`;
    }
    usedPaths.add(path);
    if (node.type === 'folder') {
      zip.folder(path);
    } else {
      const doc = (await readDocument(node.id)) ?? { schemaVersion: 1 as const, objects: [] };
      zip.file(path, JSON.stringify(doc, null, 2));
    }
  }
  return zip.generateAsync({ type: 'blob' });
}

export interface ZipEntry {
  /** フォルダ部分のパスセグメント */
  folders: string[];
  /** 拡張子を除いたファイル名 */
  name: string;
  doc: SceneDocumentJson;
}

function isSceneDocument(value: unknown): value is SceneDocumentJson {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SceneDocumentJson).schemaVersion === 1 &&
    Array.isArray((value as SceneDocumentJson).objects)
  );
}

/** ZIPを解析して復元可能なエントリ一覧を返す。不正なJSONは読み飛ばす */
export async function parseWorkspaceZip(data: Blob | ArrayBuffer): Promise<ZipEntry[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const entries: ZipEntry[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(await entry.async('text'));
      if (!isSceneDocument(parsed)) continue;
      const segments = entry.name.split('/').filter((s) => s.length > 0);
      const fileName = segments.pop()!.replace(/\.json$/i, '');
      entries.push({ folders: segments, name: fileName, doc: parsed });
    } catch {
      console.warn(`ZIP内の "${entry.name}" を読み飛ばしました(不正なJSON)`);
    }
  }
  return entries;
}
