import { describe, expect, it } from 'vitest';
import { helixEndpoints, helixLength, helixPaths, helixPoint, type HelixShape } from '../helixMath';

const base: HelixShape = { length: 120, radius: 20, radiusX: 10, turns: 3 };

describe('helixPoint', () => {
  it('φ=0は左端の輪の頂点(-L/2, -radius)', () => {
    const p = helixPoint(base, 0);
    expect(p.x).toBeCloseTo(-60);
    expect(p.y).toBeCloseTo(-20);
  });

  it('最終位相(2π·turns)は右端の頂点(L/2, -radius)', () => {
    const p = helixPoint(base, 2 * Math.PI * base.turns);
    expect(p.x).toBeCloseTo(60);
    expect(p.y).toBeCloseTo(-20);
  });

  it('φ=π/2で奥行き成分が手前(+radiusX)側へ張り出す', () => {
    const p = helixPoint(base, Math.PI / 2);
    const a = base.length * (Math.PI / 2) / (2 * Math.PI * base.turns) - base.length / 2;
    expect(p.x).toBeCloseTo(a + base.radiusX);
    expect(p.y).toBeCloseTo(0);
  });

  it('flip=trueは奥行き成分の符号を反転する(鏡像=逆巻き)', () => {
    const p = helixPoint({ ...base, flip: true }, Math.PI / 2);
    const a = base.length * (Math.PI / 2) / (2 * Math.PI * base.turns) - base.length / 2;
    expect(p.x).toBeCloseTo(a - base.radiusX);
  });
});

describe('helixPaths', () => {
  it('手前・奥ともに巻き数と同じ数のサブパス(M命令)に分かれる', () => {
    const { front, back } = helixPaths(base);
    const countM = (d: string) => (d.match(/M/g) ?? []).length;
    expect(countM(front)).toBe(base.turns);
    expect(countM(back)).toBe(base.turns);
  });

  it('前後のサブパスは境界点(輪の頂点)を共有して途切れない', () => {
    // φ=π(輪の底)は前後の境界。手前・奥どちらのパスにも同じ点が現れる
    const bottom = helixPoint(base, Math.PI);
    const token = `${Math.round(bottom.x * 100) / 100} ${Math.round(bottom.y * 100) / 100}`;
    const { front, back } = helixPaths(base);
    expect(front).toContain(token);
    expect(back).toContain(token);
  });

  it('巻き数は整数へ丸められる(前後境界をサンプル点に合わせるため)', () => {
    const { front } = helixPaths({ ...base, turns: 2.4 });
    const countM = (d: string) => (d.match(/M/g) ?? []).length;
    expect(countM(front)).toBe(2);
  });
});

describe('helixLength / 始点・終点の角度', () => {
  // ピッチ = length/turns = 120/3 = 40
  const pitch = base.length / base.turns;

  it('角度未指定(既定)は実効長 = length で両端が輪の頂点', () => {
    expect(helixLength(base)).toBeCloseTo(120);
    const { start, end } = helixEndpoints(base);
    expect(start.x).toBeCloseTo(-60);
    expect(start.y).toBeCloseTo(-20);
    expect(end.x).toBeCloseTo(60);
    expect(end.y).toBeCloseTo(-20);
  });

  it('終点の角度=180(半周)分だけ螺旋が伸び、実効長が pitch/2 増える', () => {
    // 半周 = pitch/2 = 20 の軸方向の伸び
    expect(helixLength({ ...base, endAngle: 180 })).toBeCloseTo(120 + pitch / 2);
    const { end } = helixEndpoints({ ...base, endAngle: 180 });
    expect(end.y).toBeCloseTo(20); // 終点が輪の底へ移る
  });

  it('始点の角度=-360(1巻き追加)分だけ螺旋が伸び、実効長が pitch 増える', () => {
    expect(helixLength({ ...base, startAngle: -360 })).toBeCloseTo(120 + pitch);
  });

  it('ピッチは角度を変えても一定(隣り合う頂点間の軸方向距離)', () => {
    // 頂点 φ=0 と φ=2π の軸位置差 = pitch。角度指定の有無で変わらない
    const axial = (shape: HelixShape, phi: number) =>
      helixPoint(shape, phi).x - base.radiusX * Math.sin(phi);
    const plain = axial(base, 2 * Math.PI) - axial(base, 0);
    const withAngle = (() => {
      const s = { ...base, startAngle: 45, endAngle: -30 };
      return axial(s, 2 * Math.PI) - axial(s, 0);
    })();
    expect(plain).toBeCloseTo(pitch);
    expect(withAngle).toBeCloseTo(pitch);
  });

  it('始点の角度=90は輪の高さが軸中心(y=0)になる', () => {
    const { start } = helixEndpoints({ ...base, startAngle: 90 });
    expect(start.y).toBeCloseTo(0);
  });
});
