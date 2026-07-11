import { describe, expect, it } from 'vitest';
import { sineWavePoints, waveNodePositions } from '../waveMath';

describe('sineWavePoints', () => {
  it('両端が±length/2で、位相0なら左端の変位は0', () => {
    const pts = sineWavePoints(240, 30, 120, 0);
    expect(pts[0].x).toBeCloseTo(-120, 10);
    expect(pts[pts.length - 1].x).toBeCloseTo(120, 10);
    expect(pts[0].y).toBeCloseTo(0, 10);
  });

  it('最大変位は振幅に一致し、最初の山は画面上向き(-y)', () => {
    const pts = sineWavePoints(120, 30, 120, 0, 0.5);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(-30, 3);
    expect(Math.max(...ys)).toBeCloseTo(30, 3);
    // x=λ/4(左端から1/4波長)で山
    const quarter = pts.find((p) => Math.abs(p.x - (-60 + 30)) < 0.3)!;
    expect(quarter.y).toBeCloseTo(-30, 2);
  });

  it('位相90°で左端が山になる', () => {
    const pts = sineWavePoints(120, 30, 120, 90);
    expect(pts[0].y).toBeCloseTo(-30, 10);
  });
});

describe('waveNodePositions', () => {
  it('位相0・長さ2λ → 節は半波長ごとに5個', () => {
    const xs = waveNodePositions(240, 120, 0);
    expect(xs).toEqual([-120, -60, 0, 60, 120]);
  });

  it('位相90° → 節が1/4波長ずれる', () => {
    const xs = waveNodePositions(240, 120, 90);
    for (const x of xs) {
      // 左端から見た節位置: λ/4 + kλ/2 → ローカルでは -120+30+k·60
      expect((x + 90) % 60).toBeCloseTo(0, 6);
    }
    expect(xs.length).toBe(4);
  });
});
