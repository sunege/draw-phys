import { describe, expect, it } from 'vitest';
import type { SceneDocumentJson } from '../../core/document';
import type { WorkspaceNode } from '../types';
import { buildWorkspaceZip, isSceneDocument, parseWorkspaceZip } from '../zip';

function node(partial: Partial<WorkspaceNode> & Pick<WorkspaceNode, 'id' | 'name' | 'type'>): WorkspaceNode {
  return { parentId: null, updatedAt: 0, ...partial };
}

const doc = (n: number): SceneDocumentJson => ({
  schemaVersion: 1,
  objects: Array.from({ length: n }, (_, i) => ({
    id: `obj${i}`,
    pluginId: 'core.rect',
    version: 1,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    zIndex: i + 1,
    locked: false,
    visible: true,
    props: {},
  })),
});

describe('workspace zip', () => {
  it('フォルダ構造を保ってZIP往復できる', async () => {
    const nodes: Record<string, WorkspaceNode> = {
      f1: node({ id: 'f1', name: '力学', type: 'folder' }),
      d1: node({ id: 'd1', name: '斜面', type: 'file', parentId: 'f1' }),
      d2: node({ id: 'd2', name: 'ルート図', type: 'file' }),
    };
    const docs: Record<string, SceneDocumentJson> = { d1: doc(2), d2: doc(1) };

    const blob = await buildWorkspaceZip(nodes, async (id) => docs[id] ?? null);
    const entries = await parseWorkspaceZip(await blob.arrayBuffer());

    expect(entries).toHaveLength(2);
    const nested = entries.find((e) => e.name === '斜面');
    expect(nested?.folders).toEqual(['力学']);
    expect(nested?.doc.objects).toHaveLength(2);
    const root = entries.find((e) => e.name === 'ルート図');
    expect(root?.folders).toEqual([]);
  });

  it('isSceneDocumentは保存形式のみを妥当と判定する(個別読込のバリデーション)', () => {
    expect(isSceneDocument(doc(1))).toBe(true);
    expect(isSceneDocument({ schemaVersion: 1, objects: [] })).toBe(true);
    expect(isSceneDocument({ hello: 1 })).toBe(false);
    expect(isSceneDocument({ schemaVersion: 2, objects: [] })).toBe(false);
    expect(isSceneDocument({ schemaVersion: 1 })).toBe(false);
    expect(isSceneDocument(null)).toBe(false);
    expect(isSceneDocument('文字列')).toBe(false);
  });

  it('不正なJSONエントリは読み飛ばす', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('壊れた.json', '{not json');
    zip.file('別物.json', JSON.stringify({ hello: 1 }));
    zip.file('正常.json', JSON.stringify(doc(1)));
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const entries = await parseWorkspaceZip(data);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('正常');
  });
});
