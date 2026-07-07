import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { identityTransform, type Rect } from '../../core/types';
import {
  computeRotationAboutPivot,
  computeRotationDrag,
  computeScaleDrag,
  computeScaleToProps,
  fromDisplayAngle,
  normalizeAngle,
  projectOntoFixedRadius,
  toDisplayAngle,
} from '../transformMath';

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

describe('computeRotationAboutPivot', () => {
  it('ピボット=中心なら向きだけ変わり中心は動かない', () => {
    const before = identityTransform(0, 0);
    // つかんだ点=右(0°)、ポインタ=下(90°) → 90度回転
    const next = computeRotationAboutPivot(before, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 50 });
    expect(next.rotation).toBeCloseTo(90);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(0);
  });

  it('ピボットが中心から離れていると中心もピボットまわりに移動する', () => {
    const before = identityTransform(100, 0);
    // 原点まわりに90度回転 → 中心(100,0)は(0,100)へ(画面Y下向きで時計回りが正)
    const next = computeRotationAboutPivot(before, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 50 });
    expect(next.rotation).toBeCloseTo(90);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(100);
  });

  it('スナップ指定で結果の回転角が刻みに丸まる', () => {
    const before = identityTransform(0, 0);
    const next = computeRotationAboutPivot(before, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 40, y: 7 }, 15);
    expect(next.rotation % 15).toBe(0);
  });
});

describe('角度の正規化と表示変換', () => {
  it('normalizeAngle は範囲外を畳み込む', () => {
    expect(normalizeAngle(370)).toBeCloseTo(10);
    expect(normalizeAngle(-370)).toBeCloseTo(-10);
    expect(normalizeAngle(0)).toBe(0);
  });

  it('表示角は反時計回り正(内部の符号反転)', () => {
    // 内部+90(画面時計回り) → 表示 -90(反時計回り正)
    expect(toDisplayAngle(90)).toBeCloseTo(-90);
    expect(toDisplayAngle(-90)).toBeCloseTo(90);
    expect(toDisplayAngle(0)).toBe(0);
  });

  it('表示角↔内部回転は往復で一致する', () => {
    for (const deg of [0, 30, 45, -60, 120, -170]) {
      expect(fromDisplayAngle(toDisplayAngle(deg))).toBeCloseTo(deg);
    }
  });
});

describe('projectOntoFixedRadius', () => {
  it('targetの方向へ、anchorからlength離れた点を返す(長さは変わらない)', () => {
    const p = projectOntoFixedRadius({ x: 0, y: 0 }, 100, { x: 50, y: 50 });
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100);
    expect(p.x).toBeCloseTo(p.y); // 方向は保たれる(45度)
    expect(p.x).toBeGreaterThan(0);
  });

  it('targetがanchorより近くても遠くても距離は常にlengthになる', () => {
    const near = projectOntoFixedRadius({ x: 10, y: 10 }, 40, { x: 12, y: 10 });
    expect(Math.hypot(near.x - 10, near.y - 10)).toBeCloseTo(40);
    const far = projectOntoFixedRadius({ x: 10, y: 10 }, 40, { x: 1000, y: 10 });
    expect(Math.hypot(far.x - 10, far.y - 10)).toBeCloseTo(40);
  });

  it('targetがanchorと一致する退化ケースは水平(角度0)にフォールバックする', () => {
    const p = projectOntoFixedRadius({ x: 5, y: 5 }, 30, { x: 5, y: 5 });
    expect(p).toEqual({ x: 35, y: 5 });
  });
});
