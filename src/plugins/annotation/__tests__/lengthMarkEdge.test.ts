import { describe, expect, it } from 'vitest';
import { lengthMarkPlugin } from '../lengthMark';

describe('lengthMark createFromEdge(エッジ直接バインド)', () => {
  it('線分ピックは両端(p0/p1)をその辺に紐付ける', () => {
    const refs = lengthMarkPlugin.createFromEdge!({
      kind: 'segment',
      targetId: 'rect1',
      segIndex: 2,
    });
    expect(refs).toEqual([
      { role: 'p0', targetId: 'rect1', kind: 'segment', segIndex: 2, t: 0 },
      { role: 'p1', targetId: 'rect1', kind: 'segment', segIndex: 2, t: 1 },
    ]);
  });

  it('円ピックは円周(circle)へクリック角度で紐付ける', () => {
    const refs = lengthMarkPlugin.createFromEdge!({
      kind: 'circle',
      targetId: 'c1',
      t: 30,
    });
    expect(refs).toEqual([{ role: 'circle', targetId: 'c1', kind: 'circle', t: 30 }]);
  });
});
