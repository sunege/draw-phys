import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { identityTransform, type Rect } from '../../core/types';
import { computeRotationDrag, computeScaleDrag, computeScaleToProps } from '../transformMath';

// 中心原点の 100x60 バウンディングボックス
const bounds: Rect = { x: -50, y: -30, width: 100, height: 60 };

describe('computeScaleDrag', () => {
  it('右辺ハンドルで幅方向のみ拡大し、左辺が固定される', () => {
    const before = identityTransform(0, 0);
    // 右辺(x=50)を x=100 までドラッグ → 左辺(-50)固定で幅150 → scaleX=1.5
    const next = computeScaleDrag(before, bounds, { sx: 1, sy: 0 }, { x: 100, y: 0 }, false);
    expect(next.scaleX).toBeCloseTo(1.5);
    expect(next.scaleY).toBe(1);
    // 新しい中心 = (-50 + 150/2 * ... ) → 左辺-50固定で幅150なら中心は25
    expect(next.x).toBeCloseTo(25);
    expect(next.y).toBeCloseTo(0);
  });

  it('右下コーナーで両方向に拡大し、左上が固定される', () => {
    const before = identityTransform(0, 0);
    // 右下(50,30)を(150,90)へ → 左上(-50,-30)固定 → 幅200/高さ120 → scale 2
    const next = computeScaleDrag(before, bounds, { sx: 1, sy: 1 }, { x: 150, y: 90 }, false);
    expect(next.scaleX).toBeCloseTo(2);
    expect(next.scaleY).toBeCloseTo(2);
    expect(next.x).toBeCloseTo(50);
    expect(next.y).toBeCloseTo(30);
  });

  it('uniformでは縦横比が保たれる', () => {
    const before = identityTransform(0, 0);
    const next = computeScaleDrag(before, bounds, { sx: 1, sy: 1 }, { x: 150, y: 30 }, true);
    expect(next.scaleX).toBeCloseTo(next.scaleY);
    expect(next.scaleX).toBeCloseTo(2);
  });

  it('90度回転したオブジェクトでもアンカーが固定される', () => {
    const before = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    // ローカル右辺はワールドでは下端(y=+50)。さらに下(y=100)へドラッグ
    const next = computeScaleDrag(before, bounds, { sx: 1, sy: 0 }, { x: 0, y: 100 }, false);
    expect(next.scaleX).toBeCloseTo(1.5);
    // ワールド上端(ローカル左辺 y=-50)が固定 → 新しい中心は y=25
    expect(next.y).toBeCloseTo(25);
    expect(next.x).toBeCloseTo(0);
  });

  it('極小へ潰してもスケールは下限でクランプされる', () => {
    const before = identityTransform(0, 0);
    const next = computeScaleDrag(before, bounds, { sx: 1, sy: 0 }, { x: -49.9, y: 0 }, false);
    expect(Math.abs(next.scaleX)).toBeGreaterThanOrEqual(0.05);
  });
});

describe('computeScaleToProps', () => {
  // 幅・高さをpropsで持ち、applyScaleでサイズを変える箱型プラグイン
  const boxPlugin = makeTestPlugin({
    applyScale: (props, fx, fy) => ({ width: props.width * fx, height: props.height * fy }),
  });

  it('右辺ハンドルで幅propsが増え、線幅相当のscaleは1のまま。左辺が固定される', () => {
    const before = identityTransform(0, 0);
    const props = { width: 100, height: 60 };
    // 右辺(x=50)を x=100 へ → 左辺(-50)固定で幅150
    const res = computeScaleToProps(before, props, boxPlugin, { sx: 1, sy: 0 }, { x: 100, y: 0 }, false);
    expect(res.props.width).toBeCloseTo(150);
    expect(res.props.height).toBeCloseTo(60); // 高さは不変
    expect(res.transform.scaleX).toBe(1);
    expect(res.transform.scaleY).toBe(1);
    // 左辺-50固定・幅150 → 中心x=25
    expect(res.transform.x).toBeCloseTo(25);
    expect(res.transform.y).toBeCloseTo(0);
  });

  it('コーナーで両方向拡大、uniformは縦横比維持', () => {
    const before = identityTransform(0, 0);
    const props = { width: 100, height: 60 };
    const res = computeScaleToProps(before, props, boxPlugin, { sx: 1, sy: 1 }, { x: 150, y: 30 }, true);
    // uniformなので幅の変化率(2倍)が高さにも適用される
    expect(res.props.width).toBeCloseTo(200);
    expect(res.props.height).toBeCloseTo(120);
  });

  it('回転済みでもサイズpropsが変わりscaleは1のまま', () => {
    const before = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    const props = { width: 100, height: 60 };
    const res = computeScaleToProps(before, props, boxPlugin, { sx: 1, sy: 0 }, { x: 0, y: 100 }, false);
    expect(res.props.width).toBeCloseTo(150);
    expect(res.transform.scaleX).toBe(1);
  });
});

describe('computeRotationDrag', () => {
  it('真上へのドラッグは0度', () => {
    const next = computeRotationDrag(identityTransform(100, 100), { x: 100, y: 0 });
    expect(next.rotation).toBeCloseTo(0);
  });

  it('右へのドラッグは90度', () => {
    const next = computeRotationDrag(identityTransform(0, 0), { x: 100, y: 0 });
    expect(next.rotation).toBeCloseTo(90);
  });

  it('スナップ指定で15度刻みになる', () => {
    const next = computeRotationDrag(identityTransform(0, 0), { x: 100, y: 20 }, 15);
    expect(next.rotation % 15).toBe(0);
  });

  it('回転しても位置とスケールは変わらない', () => {
    const before = { x: 10, y: 20, rotation: 0, scaleX: 2, scaleY: 3 };
    const next = computeRotationDrag(before, { x: 100, y: 100 });
    expect(next.x).toBe(10);
    expect(next.y).toBe(20);
    expect(next.scaleX).toBe(2);
    expect(next.scaleY).toBe(3);
  });
});
