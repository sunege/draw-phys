import { describe, expect, it } from 'vitest';
import { arcPlugin } from '../arc';
import { closeArcPath, closureBounds, closureSegments } from '../arcClosure';

describe('closeArcPath', () => {
  const open = 'M 50 0 A 50 50 0 0 1 0 50';
  it('開いた弧はそのまま', () => {
    expect(closeArcPath(open, 'open')).toBe(open);
  });
  it('弓形は弦で閉じる', () => {
    expect(closeArcPath(open, 'chord')).toBe(`${open} Z`);
  });
  it('扇形は中心から始めて閉じる', () => {
    expect(closeArcPath(open, 'sector')).toBe('M 0 0 L 50 0 A 50 50 0 0 1 0 50 Z');
  });
});

describe('closureBounds', () => {
  const b = { x: 10, y: 10, width: 40, height: 40 };
  it('扇形は中心(原点)を含むよう広がる', () => {
    expect(closureBounds(b, 'sector')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
  it('弓形は変わらない', () => {
    expect(closureBounds(b, 'chord')).toEqual(b);
  });
});

describe('closureSegments', () => {
  const s = { x: 1, y: 0 };
  const e = { x: 0, y: 1 };
  it('開いた弧は辺なし・弓形は弦1本・扇形は半径2本', () => {
    expect(closureSegments(s, e, 'open')).toHaveLength(0);
    expect(closureSegments(s, e, 'chord')).toEqual([[s, e]]);
    expect(closureSegments(s, e, 'sector')).toEqual([
      [{ x: 0, y: 0 }, s],
      [e, { x: 0, y: 0 }],
    ]);
  });
});

describe('円弧プラグインの閉じ方', () => {
  it('半円の弓形は直径を辺に持ち、外接矩形は半円ぶん', () => {
    const props = { ...arcPlugin.defaultProps, radius: 50, startAngle: 0, endAngle: 180, closure: 'chord' as const };
    const segs = arcPlugin.getSegments!(props);
    expect(segs).toHaveLength(1);
    expect(segs[0][0].x).toBeCloseTo(50);
    expect(segs[0][1].x).toBeCloseTo(-50);
    const b = arcPlugin.getBounds(props);
    expect(b.height).toBeCloseTo(50);
  });
  it('旧データ(closure未設定)は開いた弧として扱う', () => {
    const { closure: _c, ...legacy } = arcPlugin.defaultProps;
    expect(arcPlugin.getSegments!(legacy)).toHaveLength(0);
  });
  it('閉じる辺をトリムしようとしても何もしない', () => {
    const props = { ...arcPlugin.defaultProps, closure: 'sector' as const };
    const t = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    expect(arcPlugin.trim!(props, t, [], { kind: 'segment', targetId: 'a', segIndex: 0 })).toBeNull();
  });
});
