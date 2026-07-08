import { describe, expect, it } from 'vitest';
import { dpiToScale, mmToUnits, unitsToMm, unitsToPt } from '../units';

describe('units', () => {
  it('1単位 = 0.75pt(書き出しのpx→ptに一致)', () => {
    expect(unitsToPt(1)).toBeCloseTo(0.75, 10);
    expect(unitsToPt(2)).toBeCloseTo(1.5, 10);
  });

  it('A4(210×297mm)は約794×1123内部単位', () => {
    expect(mmToUnits(210)).toBeCloseTo(793.7, 1);
    expect(mmToUnits(297)).toBeCloseTo(1122.5, 1);
  });

  it('mm↔単位は往復で元に戻る', () => {
    for (const mm of [1, 15, 210, 297, 420]) {
      expect(unitsToMm(mmToUnits(mm))).toBeCloseTo(mm, 10);
    }
  });

  it('dpiToScale: 96dpiで等倍、300dpiで約3.125倍', () => {
    expect(dpiToScale(96)).toBeCloseTo(1, 10);
    expect(dpiToScale(300)).toBeCloseTo(3.125, 10);
  });

  it('A4を300dpiでラスタライズすると約2480px幅', () => {
    expect(mmToUnits(210) * dpiToScale(300)).toBeCloseTo(2480, 0);
  });
});
