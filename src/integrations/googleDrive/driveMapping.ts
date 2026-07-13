import type { WorkspaceNode } from '../../persistence/types';

/**
 * Drive上の1ファイル = 1ノード(フラット構造)。
 * 階層情報は appProperties に持たせ、node.id はクライアント採番のUUIDのまま使う。
 * 表示名は Drive の name フィールドに置く(appProperties値は124バイト上限のため)。
 */
export interface DriveFile {
  id: string;
  name?: string;
  appProperties?: Record<string, string>;
  modifiedTime?: string;
}

export const NODE_ID_KEY = 'nodeId';
export const PARENT_ID_KEY = 'parentId';
export const NODE_TYPE_KEY = 'nodeType';

/** WorkspaceNode → Driveに保存する appProperties(短い値のみ) */
export function nodeToAppProperties(node: WorkspaceNode): Record<string, string> {
  return {
    [NODE_ID_KEY]: node.id,
    [PARENT_ID_KEY]: node.parentId ?? '',
    [NODE_TYPE_KEY]: node.type,
  };
}

/** Driveファイル → WorkspaceNode。必須メタが欠ける不正ファイルは null(読み飛ばす)。 */
export function driveFileToNode(file: DriveFile): WorkspaceNode | null {
  const props = file.appProperties;
  if (!props) return null;
  const id = props[NODE_ID_KEY];
  const type = props[NODE_TYPE_KEY];
  if (!id || (type !== 'folder' && type !== 'file')) return null;
  const parent = props[PARENT_ID_KEY];
  return {
    id,
    name: file.name ?? '',
    type,
    parentId: parent ? parent : null,
    updatedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : Date.now(),
  };
}
