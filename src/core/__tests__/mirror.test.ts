import { describe, expect, it } from 'vitest';
import type { SceneObject } from '../document';
import { reflectAngle, reflectPoint } from '../geometry';
import { mirrorKeepUpright, mirrorObject } from '../mirror';
import type { AnyPlugin } from '../plugin';
import { identityTransform } from '../types';
import { makeTestPlugin, type TestProps } from './testPlugin';

function obj(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'o1',
    pluginId: 'test.box',
    version: 2,
    transform: identityTransform(0, 0),
    zIndex: 1,
    locked: false,
    visible: true,
    props: { width: 100, height: 50 },
    ...overrides,
  };
}

describe('reflectPoint', () => {
  it('x軸(y=0)に関して点を反射するとyの符号が反転する', () => {
    const r = reflectPoint({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(r.x).toBeCloseTo(3);
    expect(r.y).toBeCloseTo(-4);
  });

  it('垂直線 x=2 に関して反射すると x=4-x になる', () => {
    const r = reflectPoint({ x: 5, y: 7 }, { x: 2, y: 0 }, { x: 2, y: 9 });
    expect(r.x).toBeCloseTo(-1);
    expect(r.y).toBeCloseTo(7);
  });

  it('軸上の点は動かない', () => {
    const r = reflectPoint({ x: 2, y: 5 }, { x: 2, y: 0 }, { x: 2, y: 9 });
    expect(r.x).toBeCloseTo(2);
    expect(r.y).toBeCloseTo(5);
  });

  it('退化した軸(同一2点)は点対称にフォールバックする', () => {
    const r = reflectPoint({ x: 4, y: 6 }, { x: 1, y: 1 }, { x: 1, y: 1 });
    expect(r.x).toBeCloseTo(-2);
    expect(r.y).toBeCloseTo(-4);
  });
});

describe('reflectAngle', () => {
  it('水平軸(0°)では回転の符号が反転する', () => {
    expect(reflectAngle(30, 0)).toBeCloseTo(-30);
  });

  it('垂直軸(90°)では 180-θ になる', () => {
    expect(reflectAngle(30, 90)).toBeCloseTo(150);
  });
});

describe('mirrorObject', () => {
  const axisA = { x: 0, y: 0 };
  const axisB = { x: 0, y: 1 }; // 垂直軸 x=0

  it('箱型(端点なし)は中心を反射し回転を反転する', () => {
    const plugin = makeTestPlugin() as unknown as AnyPlugin;
    const m = mirrorObject(obj({ transform: { ...identityTransform(20, 5), rotation: 30 } }), plugin, axisA, axisB);
    expect(m.transform.x).toBeCloseTo(-20);
    expect(m.transform.y).toBeCloseTo(5);
    // 垂直軸(90°)なので rotation は 180-30=150
    expect(m.transform.rotation).toBeCloseTo(150);
    expect(m.props).toEqual({ width: 100, height: 50 });
  });

  it('端点系プラグインは両端をワールドで反射して張り直す', () => {
    const captured: { a?: { x: number; y: number }; b?: { x: number; y: number } } = {};
    const plugin = makeTestPlugin({
      getEndpoints: () => [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
      ],
      setFromEndpoints: (props, a, b) => {
        captured.a = a;
        captured.b = b;
        return { props, transform: identityTransform((a.x + b.x) / 2, (a.y + b.y) / 2) };
      },
    }) as unknown as AnyPlugin;
    // 中心(20,0)・回転0 → 端点はワールドで(10,0)と(30,0)
    mirrorObject(obj({ transform: identityTransform(20, 0) }), plugin, axisA, axisB);
    expect(captured.a).toEqual({ x: -10, y: 0 });
    expect(captured.b).toEqual({ x: -30, y: 0 });
  });

  it('mirror フックがあれば委譲する', () => {
    const plugin = makeTestPlugin({
      mirror: (props: TestProps, t) => ({ props: { ...props, width: 999 }, transform: t }),
    }) as unknown as AnyPlugin;
    const m = mirrorObject(obj(), plugin, axisA, axisB);
    expect((m.props as unknown as TestProps).width).toBe(999);
  });
});

describe('mirrorKeepUpright', () => {
  it('位置だけ反射し回転(向き)は保つ', () => {
    const t = { ...identityTransform(20, 5), rotation: 30 };
    const r = mirrorKeepUpright({ text: 'あ' }, t, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(r.transform.x).toBeCloseTo(-20);
    expect(r.transform.y).toBeCloseTo(5);
    expect(r.transform.rotation).toBe(30);
  });
});
