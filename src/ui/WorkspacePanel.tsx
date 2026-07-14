import { saveAs } from 'file-saver';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SceneDocumentJson } from '../core/document';
import type { StorageAdapter, WorkspaceNode } from '../persistence/types';
import { buildWorkspaceZip, isSceneDocument, parseWorkspaceZip, type ZipEntry } from '../persistence/zip';
import { useLayoutStore } from '../state/layoutStore';
import { useToastStore } from '../state/toastStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import styles from './WorkspacePanel.module.css';
import { WorkspaceSourceSelector } from './WorkspaceSourceSelector';

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

/** 解析済みの読み込み単位。この時点ではまだノードを作らない(総数を数えてから書き込む) */
type ImportJob =
  | { kind: 'zip'; rootName: string; entries: ZipEntry[] }
  | { kind: 'json'; name: string; doc: SceneDocumentJson };

/** 読み込みの進捗。total=0 は総数集計前(不定) */
interface ImportProgress {
  done: number;
  total: number;
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
  const [importing, setImporting] = useState<ImportProgress | null>(null);
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

  // 中身を書き込む。失敗したら空ファイルを残さず取り消して false を返す
  const writeOrRollback = async (
    adapter: StorageAdapter,
    fileId: string,
    doc: SceneDocumentJson,
  ): Promise<boolean> => {
    try {
      await adapter.writeDocument(fileId, doc);
      return true;
    } catch {
      // 中身が書けなかったファイルは空のまま残さない(白紙ファイルを作らない)
      await store.remove(fileId).catch(() => {});
      return false;
    }
  };

  // 入力ファイルを解析して読み込み単位の一覧にする(ノードはまだ作らない=先に総数を数えるため)
  const parseImports = async (files: File[]): Promise<ImportJob[]> => {
    const jobs: ImportJob[] = [];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.zip')) {
        const entries = await parseWorkspaceZip(file);
        if (entries.length > 0) {
          jobs.push({ kind: 'zip', rootName: file.name.replace(/\.zip$/i, '') || 'インポート', entries });
        }
      } else if (lower.endsWith('.json')) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          continue;
        }
        if (!isSceneDocument(parsed)) continue;
        jobs.push({ kind: 'json', name: file.name.replace(/\.json$/i, '') || 'インポート', doc: parsed });
      }
    }
    return jobs;
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const adapter = requireAdapterSafe();
    if (!adapter) return;
    const toast = useToastStore.getState();

    setImporting({ done: 0, total: 0 }); // 解析中は total=0(不定表示)
    let imported = 0;
    const failed: string[] = [];
    try {
      const jobs = await parseImports(files);
      const total = jobs.reduce((n, j) => n + (j.kind === 'zip' ? j.entries.length : 1), 0);
      let done = 0;
      setImporting({ done, total });
      const step = () => setImporting({ done: (done += 1), total });

      for (const job of jobs) {
        if (job.kind === 'json') {
          const fileId = await store.createFile(null, job.name);
          if (await writeOrRollback(adapter, fileId, job.doc)) imported += 1;
          else failed.push(job.name);
          step();
        } else {
          const rootId = await store.createFolder(null, job.rootName);
          const folderIds = new Map<string, string>();
          for (const entry of job.entries) {
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
            if (await writeOrRollback(adapter, fileId, entry.doc)) imported += 1;
            else failed.push(entry.name);
            step();
          }
        }
      }
    } catch (err) {
      toast.showToast(
        `読み込み中にエラーが発生しました（${(err as Error)?.message ?? '接続やログイン状態を確認してください'}）`,
        'error',
      );
      return;
    } finally {
      setImporting(null);
    }

    if (imported === 0 && failed.length === 0) {
      toast.showToast('復元できるファイル（.json / .zip）が見つかりませんでした', 'error');
    } else if (failed.length > 0) {
      const head = failed.slice(0, 3).join('、');
      const more = failed.length > 3 ? ' ほか' : '';
      toast.showToast(
        `${imported}件を読み込みました。${failed.length}件は読み込めませんでした（${head}${more}）`,
        'error',
      );
    } else {
      toast.showToast(`${imported}件のファイルを読み込みました`, 'success');
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
        <WorkspaceSourceSelector />
        <button type="button" onClick={onNewFile} title="新規ファイル" disabled={importing !== null}>
          +ファイル
        </button>
        <button type="button" onClick={onNewFolder} title="新規フォルダ" disabled={importing !== null}>
          +フォルダ
        </button>
        <button
          type="button"
          onClick={() => void onExport()}
          title="ワークスペース全体をZIPで書き出し"
          disabled={importing !== null}
        >
          ZIP出力
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          title="図JSON(個別) / ZIP(一括)から読込"
          disabled={importing !== null}
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
        {importing && (
          <span className={styles.importing} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            {importing.total > 0 ? `読み込み中… ${importing.done} / ${importing.total}` : '読み込み中…'}
          </span>
        )}
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
