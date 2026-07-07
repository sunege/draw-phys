import { describe, expect, it } from 'vitest';
import type { SceneObject, SceneObjects } from '../../core/document';
import type { AnyPlugin } from '../../core/plugin';
import { PluginRegistry } from '../../core/registry';
import type { Transform } from '../../core/types';
import { arcPlugin } from '../../plugins/basic/arc';
import { circlePlugin } from '../../plugins/basic/circle';
import { ellipsePlugin } from '../../plugins/basic/ellipse';
import { linePlugin } from '../../plugins/basic/line';
import { computeTrimKeeps } from '../trim';

const registry = new PluginRegistry();
registry.register(linePlugin as AnyPlugin);
registry.register(circlePlugin as AnyPlugin);
registry.register(arcPlugin as AnyPlugin);
registry.register(ellipsePlugin as AnyPlugin);

function tf(x: number, y: number, rotation = 0): Transform {
  return { x, y, rotation, scaleX: 1, scaleY: 1 };
}

function lineObj(id: string, length: number, transform: Transform): SceneObject {
  return {
    id,
    pluginId: 'core.line',
    version: 1,
    transform,
    zIndex: 1,
    locked: false,
    visible: true,
    props: { ...linePlugin.defaultProps, length },
  };
}

function circleObj(id: string, radius: number, transform: Transform): SceneObject {
  return {
    id,
    pluginId: 'core.circle',
    version: 1,
    transform,
    zIndex: 1,
    locked: false,
    visible: true,
    props: { ...circlePlugin.defaultProps, radius },
  };
}

function ellipseObj(id: string, radiusX: number, radiusY: number, transform: Transform): SceneObject {
  return {
    id,
    pluginId: 'core.ellipse',
    version: 1,
    transform,
    zIndex: 1,
    locked: false,
    visible: true,
    props: { ...ellipsePlugin.defaultProps, radiusX, radiusY },
  };
}

describe('computeTrimKeeps + line.trim', () => {
  it('1本の切断線で端まで短縮(残り1本)', () => {
    // 水平線 L(-50..50) を、中央(x=0)を横切る縦線 C で切る。右側(x=20)をクリック
    const objects: SceneObjects = {
      L: lineObj('L', 100, tf(0, 0)),
      C: lineObj('C', 100, tf(0, 0, 90)),
    };
    const keeps = computeTrimKeeps(objects, registry, 'L', { x: 20, y: 0 }, {
      kind: 'segment',
      targetId: 'L',
      segIndex: 0,
    });
    expect(keeps).toEqual([{ kind: 'segment', from: 0, to: 0.5 }]);

    const pieces = (linePlugin as AnyPlugin).trim!(objects.L.props, objects.L.transform, keeps!);
    expect(pieces).toHaveLength(1);
    expect((pieces![0].props as { length: number }).length).toBeCloseTo(50);
    expect(pieces![0].transform.x).toBeCloseTo(-25);
  });

  it('2本の切断線の間をクリックすると分割(残り2本)', () => {
    const objects: SceneObjects = {
      L: lineObj('L', 100, tf(0, 0)),
      A: lineObj('A', 100, tf(-20, 0, 90)),
      B: lineObj('B', 100, tf(20, 0, 90)),
    };
    const keeps = computeTrimKeeps(objects, registry, 'L', { x: 0, y: 0 }, {
      kind: 'segment',
      targetId: 'L',
      segIndex: 0,
    });
    expect(keeps).toEqual([
      { kind: 'segment', from: 0, to: 0.3 },
      { kind: 'segment', from: 0.7, to: 1 },
    ]);

    const pieces = (linePlugin as AnyPlugin).trim!(objects.L.props, objects.L.transform, keeps!);
    expect(pieces).toHaveLength(2);
    expect((pieces![0].props as { length: number }).length).toBeCloseTo(30);
    expect((pieces![1].props as { length: number }).length).toBeCloseTo(30);
    expect(pieces![0].transform.x).toBeCloseTo(-35);
    expect(pieces![1].transform.x).toBeCloseTo(35);
  });

  it('切断相手が無ければ null(no-op)', () => {
    const objects: SceneObjects = { L: lineObj('L', 100, tf(0, 0)) };
    const keeps = computeTrimKeeps(objects, registry, 'L', { x: 20, y: 0 }, {
      kind: 'segment',
      targetId: 'L',
      segIndex: 0,
    });
    expect(keeps).toBeNull();
  });
});

describe('computeTrimKeeps + circle.trim', () => {
  it('円は交点間を切り、残りの補角を持つ円弧へ種別変更する', () => {
    // 半径40の円を、中心を通る縦線(交点 90°/-90°)で切る。右(角度0°)をクリック
    const objects: SceneObjects = {
      O: circleObj('O', 40, tf(0, 0)),
      C: lineObj('C', 100, tf(0, 0, 90)),
    };
    const keeps = computeTrimKeeps(objects, registry, 'O', { x: 40, y: 0 }, {
      kind: 'circle',
      targetId: 'O',
      t: 0,
    });
    expect(keeps).toEqual([{ kind: 'arc', fromDeg: 90, toDeg: 270 }]);

    const pieces = (circlePlugin as AnyPlugin).trim!(objects.O.props, objects.O.transform, keeps!);
    expect(pieces).toHaveLength(1);
    expect(pieces![0].pluginId).toBe('core.arc');
    const p = pieces![0].props as { startAngle: number; endAngle: number; radius: number };
    expect(p.radius).toBe(40);
    expect(p.startAngle).toBeCloseTo(90);
    expect(p.endAngle).toBeCloseTo(-90);
  });

  it('交点が2未満の円は null(no-op)', () => {
    const objects: SceneObjects = { O: circleObj('O', 40, tf(0, 0)) };
    const keeps = computeTrimKeeps(objects, registry, 'O', { x: 40, y: 0 }, {
      kind: 'circle',
      targetId: 'O',
      t: 0,
    });
    expect(keeps).toBeNull();
  });
});

describe('computeTrimKeeps + ellipse.trim', () => {
  it('楕円は横切る線で切ると残りの補角を持つ楕円弧へ種別変更する(軸並行)', () => {
    // rx=40,ry=20の楕円を、中心を通る縦線(交点 (0,20)/(0,-20))で切る。右端(媒介変数角度0°)をクリック
    const objects: SceneObjects = {
      O: ellipseObj('O', 40, 20, tf(0, 0)),
      C: lineObj('C', 100, tf(0, 0, 90)),
    };
    const keeps = computeTrimKeeps(objects, registry, 'O', { x: 40, y: 0 }, {
      kind: 'ellipse',
      targetId: 'O',
      t: 0,
    });
    expect(keeps).toEqual([{ kind: 'arc', fromDeg: 90, toDeg: 270 }]);

    const pieces = (ellipsePlugin as AnyPlugin).trim!(objects.O.props, objects.O.transform, keeps!);
    expect(pieces).toHaveLength(1);
    expect(pieces![0].pluginId).toBe('core.ellipseArc');
    const p = pieces![0].props as { startAngle: number; endAngle: number; radiusX: number; radiusY: number };
    expect(p.radiusX).toBe(40);
    expect(p.radiusY).toBe(20);
    expect(p.startAngle).toBeCloseTo(90);
    expect(p.endAngle).toBeCloseTo(-90);
  });

  it('回転+非対称半径の楕円でも横切る線で正しく切れる', () => {
    // rx=2,ry=1,rotation=90°の楕円(長軸がワールドy軸に一致)を、中心を通る水平線(交点(±1,0))で切る。
    // 長軸端(ワールド(0,2)=媒介変数角度0°)をクリック
    const objects: SceneObjects = {
      O: ellipseObj('O', 2, 1, tf(0, 0, 90)),
      C: lineObj('C', 100, tf(0, 0)),
    };
    const keeps = computeTrimKeeps(objects, registry, 'O', { x: 0, y: 2 }, {
      kind: 'ellipse',
      targetId: 'O',
      t: 0,
    });
    expect(keeps).toEqual([{ kind: 'arc', fromDeg: 90, toDeg: 270 }]);

    const pieces = (ellipsePlugin as AnyPlugin).trim!(objects.O.props, objects.O.transform, keeps!);
    expect(pieces).toHaveLength(1);
    expect(pieces![0].transform.rotation).toBeCloseTo(90);
    const p = pieces![0].props as { startAngle: number; endAngle: number };
    expect(p.startAngle).toBeCloseTo(90);
    expect(p.endAngle).toBeCloseTo(-90);
  });

  it('切断相手が無ければ null(no-op)', () => {
    const objects: SceneObjects = { O: ellipseObj('O', 40, 20, tf(0, 0)) };
    const keeps = computeTrimKeeps(objects, registry, 'O', { x: 40, y: 0 }, {
      kind: 'ellipse',
      targetId: 'O',
      t: 0,
    });
    expect(keeps).toBeNull();
  });
});
