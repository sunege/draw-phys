import { describe, expect, it } from 'vitest';
import { inclineGeometry } from '../inclineMath';

describe('inclineGeometry', () => {
  it('右上がり: 高さ=底辺×tanθ、頂上が右上', () => {
    const { vertices, height } = inclineGeometry(180, 30, 'right');
    expect(height).toBeCloseTo(180 * Math.tan(Math.PI / 6), 10);
    const [a, b, c] = vertices;
    expect(a).toEqual({ x: -90, y: height / 2 }); // 底角θ側(左下)
    expect(b).toEqual({ x: 90, y: height / 2 }); // 直角(右下)
    expect(c).toEqual({ x: 90, y: -height / 2 }); // 頂上(右上)
  });

  it('左上がりはxが反転した鏡像', () => {
    const r = inclineGeometry(100, 45, 'right');
    const l = inclineGeometry(100, 45, 'left');
    expect(l.height).toBeCloseTo(r.height, 10);
    for (let i = 0; i < 3; i++) {
      expect(l.vertices[i].x).toBeCloseTo(-r.vertices[i].x, 10);
      expect(l.vertices[i].y).toBeCloseTo(r.vertices[i].y, 10);
    }
  });

  it('45°では高さ=底辺', () => {
    expect(inclineGeometry(100, 45, 'right').height).toBeCloseTo(100, 10);
  });
});
