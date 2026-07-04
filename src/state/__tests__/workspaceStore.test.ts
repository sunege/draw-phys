import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryAdapter } from '../../persistence/memoryAdapter';
import { canMove, descendantIds, useWorkspaceStore } from '../workspaceStore';

let adapter: MemoryAdapter;

beforeEach(async () => {
  adapter = new MemoryAdapter();
  await useWorkspaceStore.getState().init(adapter);
});

const store = () => useWorkspaceStore.getState();

describe('workspaceStore', () => {
  it('フォルダとファイルを作成できる', async () => {
    const folderId = await store().createFolder(null, '力学');
    const fileId = await store().createFile(folderId, '斜面の問題');
    const { nodes } = store();
    expect(nodes[folderId]?.type).toBe('folder');
    expect(nodes[fileId]?.parentId).toBe(folderId);
    // ファイル作成時に空ドキュメントが書かれる
    expect(await adapter.readDocument(fileId)).toEqual({ schemaVersion: 1, objects: [] });
  });

  it('名前変更が永続化される', async () => {
    const id = await store().createFile(null, '旧名');
    await store().rename(id, '新名');
    expect(store().nodes[id]?.name).toBe('新名');
    const listed = await adapter.listNodes();
    expect(listed.find((n) => n.id === id)?.name).toBe('新名');
  });

  it('フォルダ削除は配下のファイルとドキュメントも消す', async () => {
    const folderId = await store().createFolder(null, '親');
    const subId = await store().createFolder(folderId, '子');
    const fileId = await store().createFile(subId, '図');
    await store().remove(folderId);
    expect(Object.keys(store().nodes)).toHaveLength(0);
    expect(await adapter.readDocument(fileId)).toBeNull();
  });

  it('フォルダを自身の子孫へは移動できない', async () => {
    const a = await store().createFolder(null, 'A');
    const b = await store().createFolder(a, 'B');
    await store().move(a, b);
    expect(store().nodes[a]?.parentId).toBeNull();
    expect(canMove(store().nodes, a, b)).toBe(false);
    expect(canMove(store().nodes, b, null)).toBe(true);
  });

  it('ファイルコピーはドキュメントも複製する', async () => {
    const fileId = await store().createFile(null, '図');
    await adapter.writeDocument(fileId, {
      schemaVersion: 1,
      objects: [
        {
          id: 'o1',
          pluginId: 'core.rect',
          version: 1,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          zIndex: 1,
          locked: false,
          visible: true,
          props: {},
        },
      ],
    });
    const copyId = await store().copy(fileId);
    expect(copyId).not.toBeNull();
    expect(store().nodes[copyId!]?.name).toBe('図 のコピー');
    const copiedDoc = await adapter.readDocument(copyId!);
    expect(copiedDoc?.objects).toHaveLength(1);
  });

  it('フォルダコピーは配下を再帰的に複製する', async () => {
    const folderId = await store().createFolder(null, '教材');
    await store().createFile(folderId, '図1');
    await store().createFile(folderId, '図2');
    const copyId = await store().copy(folderId);
    const children = descendantIds(store().nodes, copyId!);
    expect(children).toHaveLength(2);
  });
});
