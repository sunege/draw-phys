import { describe, expect, it } from 'vitest';
import { sineWavePoints, waveFrontLines, waveNodePositions } from '../waveMath';

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

describe('waveFrontLines', () => {
  // 引数順: (base, spacing, phaseDeg, alternate, count)
  it('位相0: 波源(base)から count 本が等間隔に並ぶ(非alternateは全て実線)', () => {
    const lines = waveFrontLines(16, 20, 0, false, 4);
    expect(lines.map((l) => l.offset)).toEqual([16, 36, 56, 76]);
    expect(lines.every((l) => l.crest)).toBe(true);
  });

  it('alternate: 波源から山→谷が交互(先頭=山)', () => {
    const lines = waveFrontLines(0, 10, 0, true, 4);
    expect(lines.map((l) => l.crest)).toEqual([true, false, true, false]);
  });

  it('時間発展: 位相を進めると全波面が外へ動き、先頭波面は外縁を越えると消える', () => {
    const p0 = waveFrontLines(16, 16, 0, false, 5); // 16,32,48,64,80
    expect(p0.map((l) => l.offset)).toEqual([16, 32, 48, 64, 80]);
    const p90 = waveFrontLines(16, 16, 90, false, 5); // frac=0.25 → 20,36,52,68,(84>80で消滅)
    expect(p90.map((l) => l.offset)).toEqual([20, 36, 52, 68]);
    // 1周期(360°)で位相0に戻る(周期的)
    expect(waveFrontLines(16, 16, 360, false, 5).map((l) => l.offset)).toEqual([16, 32, 48, 64, 80]);
  });

  it('波源から新しい波面が生まれる(alternateは半周期ごと、交互の山/谷)', () => {
    // 位相0: 波源(0)に実線が生まれている
    expect(waveFrontLines(0, 16, 0, true, 5)[0]).toEqual({ offset: 0, crest: true });
    // 位相180°(半周期): 波源に新しい波面が生まれ、今度は破線(波源が山→谷へ振動)
    expect(waveFrontLines(0, 16, 180, true, 5)[0]).toEqual({ offset: 0, crest: false });
  });

  it('バグ修正: 伝搬しても各波面の実線/破線は入れ替わらない', () => {
    // 位相0で offset=16 の破線波面を、位相を進めて追跡(旧実装は位相90でround境界を跨ぎ実線化した)
    const track = (ph: number) => {
      const lines = waveFrontLines(0, 16, ph, true, 5);
      // 16 から外へ動いた最初の波面(2番目)を拾う
      return lines[1];
    };
    for (const ph of [0, 30, 60, 90, 120, 150]) {
      const l = track(ph);
      expect(l.crest).toBe(false); // 破線のまま
      expect(l.offset).toBeGreaterThanOrEqual(16); // 外へ伝搬
    }
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
