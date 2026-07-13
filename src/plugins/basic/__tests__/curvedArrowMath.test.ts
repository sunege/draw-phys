import { describe, expect, it } from 'vitest';
import { normalizeAngle180 } from '../../../core/geometry';
import {
  arrowHeadPoints,
  clampSweep,
  curvedArrowBounds,
  curvedArrowDragEnd,
  curvedArrowPaths,
  dirSign,
  ellipseTangentAt,
  endAngleOf,
  type CurvedArrowShape,
} from '../curvedArrowMath';
import { ellipsePointAt } from '../ellipseMath';

const cw: CurvedArrowShape = { radiusX: 50, radiusY: 30, startAngle: 45, sweep: 270, ccw: false };
const ccw: CurvedArrowShape = { radiusX: 50, radiusY: 30, startAngle: -45, sweep: 270, ccw: true };

describe('dirSign / endAngleOf', () => {
  it('時計回りは角度が増加、反時計回りは減少する(y下向き座標)', () => {
    expect(dirSign(false)).toBe(1);
    expect(dirSign(true)).toBe(-1);
    expect(endAngleOf(cw)).toBeCloseTo(45 + 270);
    expect(endAngleOf(ccw)).toBeCloseTo(-45 - 270);
  });
});

describe('clampSweep', () => {
  it('[1,360] にクランプし、非数は1', () => {
    expect(clampSweep(0)).toBe(1);
    expect(clampSweep(400)).toBe(360);
    expect(clampSweep(NaN)).toBe(1);
    expect(clampSweep(120)).toBe(120);
  });
});

describe('ellipseTangentAt', () => {
  it('単位ベクトルを返す(楕円は速さが一定でないため正規化)', () => {
    const t = ellipseTangentAt(50, 30, 37, 1);
    expect(Math.hypot(t.x, t.y)).toBeCloseTo(1);
  });

  it('接ベクトルは半径(法線)ベクトルと直交する', () => {
    const deg = 37;
    const rx = 50;
    const ry = 30;
    // 楕円周の点(法線方向ではないが、接線 dP/dt と半径ベクトルの直交ではなく
    // 接線同士の向き確認として dP/dt と (rx cos, ry sin) の勾配関係を確認する)
    const p = ellipsePointAt(rx, ry, deg);
    const t = ellipseTangentAt(rx, ry, deg, 1);
    // 楕円 (x/rx)^2+(y/ry)^2=1 の勾配 (x/rx^2, y/ry^2) は接線と直交する
    const grad = { x: p.x / (rx * rx), y: p.y / (ry * ry) };
    expect(grad.x * t.x + grad.y * t.y).toBeCloseTo(0);
  });

  it('時計回りの右端(0°)では下向き、反時計回りでは上向き', () => {
    const cwT = ellipseTangentAt(50, 30, 0, 1);
    expect(cwT.x).toBeCloseTo(0);
    expect(cwT.y).toBeCloseTo(1);
    const ccwT = ellipseTangentAt(50, 30, 0, -1);
    expect(ccwT.x).toBeCloseTo(0);
    expect(ccwT.y).toBeCloseTo(-1);
  });
});

describe('curvedArrowPaths', () => {
  it('片矢印は矢先1つ、両端矢印は2つ', () => {
    expect(curvedArrowPaths(cw, 9, false).heads).toHaveLength(1);
    expect(curvedArrowPaths(cw, 9, true).heads).toHaveLength(2);
  });

  it('弧パスは半径X/Yを楕円弧(A rx ry)として出力する', () => {
    expect(curvedArrowPaths(cw, 9, false).arc).toContain('A 50 30 0');
  });

  it('時計回りは弧が角度増加方向(sweep-flag=1)で描かれる', () => {
    expect(curvedArrowPaths(cw, 9, false).arc).toContain(' 0 1 1 ');
  });

  it('反時計回りは弧が角度減少方向(sweep-flag=0)で描かれる', () => {
    expect(curvedArrowPaths(ccw, 9, false).arc).toContain('0 1 0');
  });

  it('矢先の先端は終了角の楕円周上に一致する', () => {
    const tip = ellipsePointAt(cw.radiusX, cw.radiusY, endAngleOf(cw));
    const head = curvedArrowPaths(cw, 9, false).heads[0];
    const first = head.split(' ')[0];
    expect(first).toBe(`${Math.round(tip.x * 1000) / 1000},${Math.round(tip.y * 1000) / 1000}`);
  });
});

describe('arrowHeadPoints', () => {
  it('先端・翼2点の3点を返し、先端は tip に一致する', () => {
    const s = arrowHeadPoints({ x: 10, y: 0 }, { x: 1, y: 0 }, 10);
    const pts = s.split(' ');
    expect(pts).toHaveLength(3);
    expect(pts[0]).toBe('10,0');
  });
});

describe('curvedArrowDragEnd', () => {
  it('endドラッグ: 始端を固定し、掃引角だけ変える', () => {
    // ccw(dir=-1) startAngle=-45。終点を -45-90=-135 の位置へ動かす
    const r = curvedArrowDragEnd(ccw, 'end', -135);
    expect(r.startAngle).toBe(-45);
    expect(r.sweep).toBeCloseTo(90);
    // 動かした終点が実際に狙った角度になる
    expect(endAngleOf({ ...ccw, ...r })).toBeCloseTo(-135);
  });

  it('startドラッグ: 終端を固定し、開始角を変える', () => {
    const endBefore = endAngleOf(cw); // 45+270 = 315
    const r = curvedArrowDragEnd(cw, 'start', 90);
    expect(r.startAngle).toBe(90);
    // 終点(絶対位置)は変わらない: 90 + 225 = 315
    expect(normalizeAngle180(endAngleOf({ ...cw, ...r }))).toBeCloseTo(
      normalizeAngle180(endBefore),
    );
  });

  it('掃引角は[1,360]にクランプされる', () => {
    // 終点に一致させると掃引0→360扱い
    const r = curvedArrowDragEnd(cw, 'end', cw.startAngle);
    expect(r.sweep).toBe(360);
  });
});

describe('curvedArrowBounds', () => {
  it('楕円弧上の点と矢先先端を包含する', () => {
    const b = curvedArrowBounds(cw, 9, 1);
    for (const deg of [90, 180, 270]) {
      const p = ellipsePointAt(cw.radiusX, cw.radiusY, deg);
      expect(p.x).toBeGreaterThanOrEqual(b.x);
      expect(p.x).toBeLessThanOrEqual(b.x + b.width);
      expect(p.y).toBeGreaterThanOrEqual(b.y);
      expect(p.y).toBeLessThanOrEqual(b.y + b.height);
    }
  });
});
