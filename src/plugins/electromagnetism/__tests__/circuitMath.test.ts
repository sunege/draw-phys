import { describe, expect, it } from 'vitest';
import {
  acSinePoints,
  batteryBodyHalf,
  batteryCells,
  bodyHalf,
  capacitorPlates,
  coilLoopsPath,
  diodeShape,
  earthLines,
  leadLines,
  resistorZigzagPath,
} from '../circuitMath';

describe('leadLines / bodyHalf', () => {
  it('リードが端点 ±length/2 に届き、本体端で止まる', () => {
    const { left, right } = leadLines(100, 40);
    expect(left[0]).toEqual({ x: -50, y: 0 });
    expect(left[1]).toEqual({ x: -20, y: 0 });
    expect(right[0]).toEqual({ x: 20, y: 0 });
    expect(right[1]).toEqual({ x: 50, y: 0 });
  });

  it('本体長が総長を超えたらクランプ', () => {
    expect(bodyHalf(30, 100)).toBe(15);
  });
});

describe('resistorZigzagPath', () => {
  it('両端が y=0(リードと連続)', () => {
    const path = resistorZigzagPath(60, 20);
    expect(path.startsWith('M -30 0')).toBe(true);
    expect(path.endsWith('L 30 0')).toBe(true);
  });
});

describe('coilLoopsPath', () => {
  it('こぶの数(円弧コマンド)= loops', () => {
    const path = coilLoopsPath(80, 4);
    const arcs = path.match(/A /g) ?? [];
    expect(arcs.length).toBe(4);
  });

  it('両端が本体端で y=0', () => {
    const path = coilLoopsPath(80, 4);
    expect(path.startsWith('M -40 0')).toBe(true);
    expect(path.trim().endsWith('40 0')).toBe(true);
  });
});

describe('capacitorPlates', () => {
  it('2枚の極板が原点対称', () => {
    const p = capacitorPlates(12, 30);
    expect(p.leftX).toBe(-p.rightX);
    expect(p.halfH).toBe(15);
  });
});

describe('batteryCells', () => {
  it('セル数×2 枚、長短が交互、原点対称', () => {
    const plates = batteryCells(2, 12, 5, 8);
    expect(plates).toHaveLength(4);
    expect(plates[0].short).toBe(false);
    expect(plates[1].short).toBe(true);
    expect(plates[0].x).toBe(-plates[plates.length - 1].x);
  });

  it('本体半幅が端の極板位置に一致', () => {
    const plates = batteryCells(2, 12, 5, 8);
    expect(batteryBodyHalf(2, 8)).toBeCloseTo(plates[plates.length - 1].x);
  });
});

describe('acSinePoints', () => {
  it('端点は中心付近で y≈0、正弦の半周で正負が反転', () => {
    const pts = acSinePoints(20);
    expect(pts[0].x).toBeCloseTo(-12);
    expect(pts[pts.length - 1].x).toBeCloseTo(12);
    expect(Math.abs(pts[0].y)).toBeLessThan(1e-9);
    // 前半は上向き(負y)、後半は下向き(正y)
    expect(pts[4].y).toBeLessThan(0);
    expect(pts[12].y).toBeGreaterThan(0);
  });
});

describe('diodeShape', () => {
  it('三角形の頂点がバー側、reversed で反転', () => {
    const fwd = diodeShape(20, 24, false);
    expect(fwd.triangle[2]).toEqual({ x: 10, y: 0 });
    expect(fwd.barX).toBe(10);
    const rev = diodeShape(20, 24, true);
    expect(rev.triangle[2]).toEqual({ x: -10, y: 0 });
    expect(rev.barX).toBe(-10);
  });
});

describe('earthLines', () => {
  it('横線の幅が上から下へ単調減少', () => {
    const lines = earthLines(30, 3, 5);
    expect(lines).toHaveLength(3);
    expect(lines[0].halfW).toBe(15);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].halfW).toBeLessThan(lines[i - 1].halfW);
      expect(lines[i].y).toBeGreaterThan(lines[i - 1].y);
    }
  });
});
