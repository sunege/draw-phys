import { describe, expect, it } from 'vitest';
import type { WorkspaceNode } from '../../../persistence/types';
import {
  driveFileToNode,
  nodeToAppProperties,
  NODE_ID_KEY,
  NODE_TYPE_KEY,
  PARENT_ID_KEY,
  type DriveFile,
} from '../driveMapping';

function node(partial: Partial<WorkspaceNode> & Pick<WorkspaceNode, 'id' | 'name' | 'type'>): WorkspaceNode {
  return { parentId: null, updatedAt: 0, ...partial };
}

describe('nodeToAppProperties', () => {
  it('親ありノードを appProperties に変換する', () => {
    const props = nodeToAppProperties(node({ id: 'a', name: '図1', type: 'file', parentId: 'p' }));
    expect(props).toEqual({ [NODE_ID_KEY]: 'a', [PARENT_ID_KEY]: 'p', [NODE_TYPE_KEY]: 'file' });
  });

  it('ルート直下(parentId=null)は空文字にする', () => {
    const props = nodeToAppProperties(node({ id: 'a', name: 'x', type: 'folder', parentId: null }));
    expect(props[PARENT_ID_KEY]).toBe('');
  });
});

describe('driveFileToNode', () => {
  it('appProperties + name から WorkspaceNode を復元する', () => {
    const file: DriveFile = {
      id: 'drive-1',
      name: '長い日本語のファイル名でも大丈夫',
      appProperties: { [NODE_ID_KEY]: 'a', [PARENT_ID_KEY]: 'p', [NODE_TYPE_KEY]: 'file' },
      modifiedTime: '2026-07-14T00:00:00.000Z',
    };
    expect(driveFileToNode(file)).toEqual({
      id: 'a',
      name: '長い日本語のファイル名でも大丈夫',
      type: 'file',
      parentId: 'p',
      updatedAt: Date.parse('2026-07-14T00:00:00.000Z'),
    });
  });

  it('空の親IDは null に戻す(往復整合)', () => {
    const original = node({ id: 'a', name: 'x', type: 'folder', parentId: null });
    const restored = driveFileToNode({
      id: 'd',
      name: 'x',
      appProperties: nodeToAppProperties(original),
      modifiedTime: '2026-07-14T00:00:00.000Z',
    });
    expect(restored?.parentId).toBeNull();
  });

  it('appProperties が無いファイルは null(読み飛ばす)', () => {
    expect(driveFileToNode({ id: 'd', name: 'x' })).toBeNull();
  });

  it('nodeType が不正なファイルは null', () => {
    expect(
      driveFileToNode({
        id: 'd',
        name: 'x',
        appProperties: { [NODE_ID_KEY]: 'a', [NODE_TYPE_KEY]: 'bogus' },
      }),
    ).toBeNull();
  });

  it('nodeId が無いファイルは null', () => {
    expect(
      driveFileToNode({ id: 'd', name: 'x', appProperties: { [NODE_TYPE_KEY]: 'file' } }),
    ).toBeNull();
  });
});
