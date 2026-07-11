import { saveAs } from 'file-saver';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { StorageAdapter, WorkspaceNode } from '../persistence/types';
import { buildWorkspaceZip, isSceneDocument, parseWorkspaceZip } from '../persistence/zip';
import { useLayoutStore } from '../state/layoutStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import styles from './WorkspacePanel.module.css';

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path d="M3 5 H9 L11 8 H21 V19 H3 Z" fill="#f0c66a" stroke="#c99b3f" strokeWidth="1" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path d="M6 3 H14 L18 7 V21 H6 Z" fill="#ffffff" stroke="#8a919c" strokeWidth="1.4" />
      <path d="M14 3 L14 7 H18" fill="none" stroke="#8a919c" strokeWidth="1.4" />
    </svg>
  );
}

interface RowProps {
  node: WorkspaceNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
}

function NodeRow({ node, depth, expanded, toggle }: RowProps) {
  const navigate = useNavigate();
  const { fileId } = useParams();
  const nodes = useWorkspaceStore((s) => s.nodes);
  const store = useWorkspaceStore.getState();

  const children = Object.values(nodes)
    .filter((n) => n.parentId === node.id)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ja') : a.type === 'folder' ? -1 : 1));

  const onRename = () => {
    const name = window.prompt('新しい名前', node.name);
    if (name?.trim()) void store.rename(node.id, name.trim());
  };

  const onDownload = async () => {
    const adapter = useWorkspaceStore.getState().adapter;
    if (!adapter) return;
    const doc = (await adapter.readDocument(node.id)) ?? { schemaVersion: 1 as const, objects: [] };
    saveAs(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
      `${node.name}.json`,
    );
  };

  const onDelete = () => {
    const label = node.type === 'folder' ? 'フォルダ(中身ごと)' : 'ファイル';
    if (window.confirm(`「${node.name}」を削除しますか?(${label})`)) {
      void store.remove(node.id).then(() => {
        if (node.id === fileId || (node.type === 'folder' && !useWorkspaceStore.getState().nodes[fileId ?? ''])) {
          navigate('/');
        }
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('application/x-node-id');
    if (draggedId && node.type === 'folder') void store.move(draggedId, node.id);
  };

  return (
    <>
      <div
        className={node.id === fileId ? styles.rowActive : styles.row}
        style={{ paddingLeft: 8 + depth * 16 }}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('application/x-node-id', node.id)}
        onDragOver={(e) => node.type === 'folder' && e.preventDefault()}
        onDrop={onDrop}
        onClick={() => {
          if (node.type === 'folder') {
            toggle(node.id);
          } else {
            navigate(`/edit/${node.id}`);
          }
        }}
      >
        {node.type === 'folder' && (
          <span className={styles.chevron}>{expanded.has(node.id) ? '▾' : '▸'}</span>
        )}
        {node.type === 'folder' ? <FolderIcon /> : <FileIcon />}
        <span className={styles.name}>{node.name}</span>
        <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
          {node.type === 'file' && (
            <button type="button" title="ダウンロード(JSON)" onClick={() => void onDownload()}>
              ⬇
            </button>
          )}
          <button type="button" title="名前を変更" onClick={onRename}>
            ✎
          </button>
          <button type="button" title="コピー" onClick={() => void store.copy(node.id)}>
            ⧉
          </button>
          <button type="button" title="削除" onClick={onDelete}>
            🗑
          </button>
        </span>
      </div>
      {node.type === 'folder' &&
        expanded.has(node.id) &&
        children.map((child) => (
          <NodeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
        ))}
    </>
  );
}

export function WorkspacePanel() {
  const navigate = useNavigate();
  const nodes = useWorkspaceStore((s) => s.nodes);
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement>(null);
  const bottomHeight = useLayoutStore((s) => s.bottomHeight);
  const bottomCollapsed = useLayoutStore((s) => s.bottomCollapsed);

  const store = useWorkspaceStore.getState();

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const roots = Object.values(nodes)
    .filter((n) => n.parentId === null)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ja') : a.type === 'folder' ? -1 : 1));

  const matches = searchQuery.trim()
    ? Object.values(nodes).filter(
        (n) => n.type === 'file' && n.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : null;

  const onNewFile = () => {
    const name = window.prompt('ファイル名', '新しい図');
    if (name?.trim()) {
      void store.createFile(null, name.trim()).then((id) => navigate(`/edit/${id}`));
    }
  };

  const onNewFolder = () => {
    const name = window.prompt('フォルダ名', '新しいフォルダ');
    if (name?.trim()) void store.createFolder(null, name.trim());
  };

  const onExport = async () => {
    const adapter = requireAdapterSafe();
    if (!adapter) return;
    const blob = await buildWorkspaceZip(useWorkspaceStore.getState().nodes, (id) =>
      adapter.readDocument(id),
    );
    saveAs(blob, `workspace-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const requireAdapterSafe = (): StorageAdapter | null => useWorkspaceStore.getState().adapter;

  // ZIPを展開し、ZIP名のフォルダ配下へ復元する(既存データとの衝突を避ける)。復元件数を返す
  const importZip = async (file: File, adapter: StorageAdapter): Promise<number> => {
    const entries = await parseWorkspaceZip(file);
    if (entries.length === 0) return 0;
    const rootName = file.name.replace(/\.zip$/i, '') || 'インポート';
    const rootId = await store.createFolder(null, rootName);
    const folderIds = new Map<string, string>();
    for (const entry of entries) {
      let parentId = rootId;
      let pathKey = '';
      for (const segment of entry.folders) {
        pathKey += `/${segment}`;
        let folderId = folderIds.get(pathKey);
        if (!folderId) {
          folderId = await store.createFolder(parentId, segment);
          folderIds.set(pathKey, folderId);
        }
        parentId = folderId;
      }
      const fileId = await store.createFile(parentId, entry.name);
      await adapter.writeDocument(fileId, entry.doc);
    }
    return entries.length;
  };

  // 単一の図JSONをルート直下へ復元する。妥当なドキュメントでなければ0を返す
  const importJson = async (file: File, adapter: StorageAdapter): Promise<number> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return 0;
    }
    if (!isSceneDocument(parsed)) return 0;
    const name = file.name.replace(/\.json$/i, '') || 'インポート';
    const fileId = await store.createFile(null, name);
    await adapter.writeDocument(fileId, parsed);
    return 1;
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const adapter = requireAdapterSafe();
    if (!adapter) return;

    let imported = 0;
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.zip')) {
        imported += await importZip(file, adapter);
      } else if (lower.endsWith('.json')) {
        imported += await importJson(file, adapter);
      }
    }
    if (imported === 0) {
      window.alert('復元できるファイル(.json / .zip)が見つかりませんでした');
    }
  };

  const onRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('application/x-node-id');
    if (draggedId) void store.move(draggedId, null);
  };

  return (
    <aside
      className={styles.panel}
      data-collapsed={bottomCollapsed}
      style={{ height: bottomCollapsed ? undefined : bottomHeight }}
    >
      <div className={styles.toolbar}>
        <span className={styles.heading}>ワークスペース</span>
        <button type="button" onClick={onNewFile} title="新規ファイル">
          +ファイル
        </button>
        <button type="button" onClick={onNewFolder} title="新規フォルダ">
          +フォルダ
        </button>
        <button type="button" onClick={() => void onExport()} title="ワークスペース全体をZIPで書き出し">
          ZIP出力
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          title="図JSON(個別) / ZIP(一括)から読込"
        >
          読込
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip,.json"
          multiple
          hidden
          onChange={(e) => void onImportFile(e)}
        />
        <input
          className={styles.search}
          type="search"
          placeholder="検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      {!bottomCollapsed && (
        <div className={styles.tree} onDragOver={(e) => e.preventDefault()} onDrop={onRootDrop}>
          {matches ? (
            matches.length > 0 ? (
              matches.map((node) => (
                <NodeRow key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} />
              ))
            ) : (
              <p className={styles.empty}>「{searchQuery}」に一致するファイルはありません</p>
            )
          ) : roots.length > 0 ? (
            roots.map((node) => (
              <NodeRow key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} />
            ))
          ) : (
            <p className={styles.empty}>ファイルがありません。「+ファイル」で作成してください</p>
          )}
        </div>
      )}
    </aside>
  );
}
