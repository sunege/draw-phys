import { describe, expect, it } from 'vitest';
import { solveEllipseTangentThroughPoint } from '../ellipseTangent';
import { localToWorld } from '../geometry';
import { identityTransform, type Transform } from '../types';

const idT: Transform = identityTransform();

describe('solveEllipseTangentThroughPoint', () => {
  it('rx=ryの円で従来の接線角へ帰着する(pin原点・中心100右・半径50)', () => {
    // 中心(100,0)半径50の円。pin=原点。d=2 → 接線角±30°、接点は円ローカル±120°
    const ellipse = { center: { x: 0, y: 0 }, radiusX: 50, radiusY: 50 };
    const target: Transform = { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const sol = solveEllipseTangentThroughPoint({ x: 0, y: 0 }, target, ellipse, 0);
    expect(sol).not.toBeNull();
    expect(Math.abs(sol!.rotation)).toBeCloseTo(30);
    expect(Math.abs(sol!.t)).toBeCloseTo(120);
  });

  it('横長楕円(rx100,ry50・中心原点)へpin(200,0)から接線: t=±60°', () => {
    const ellipse = { center: { x: 0, y: 0 }, radiusX: 100, radiusY: 50 };
    // 現回転160に近い枝(163.9°/t=60)を選ぶ
    const sol = solveEllipseTangentThroughPoint({ x: 200, y: 0 }, idT, ellipse, 160);
    expect(sol).not.toBeNull();
    expect(sol!.rotation).toBeCloseTo(163.9, 1);
    expect(sol!.t).toBeCloseTo(60);
    // 接点(楕円ローカル)=(100cos60,50sin60)=(50, 43.3)。pinと接点を結ぶ線が接線角と一致する
    const contact = localToWorld({ x: 100 * Math.cos((60 * Math.PI) / 180), y: 50 * Math.sin((60 * Math.PI) / 180) }, idT);
    const ang = (Math.atan2(contact.y - 0, contact.x - 200) * 180) / Math.PI;
    expect(ang).toBeCloseTo(163.9, 1);
  });

  it('現在の回転で接線の枝(±)を選ぶ', () => {
    const ellipse = { center: { x: 0, y: 0 }, radiusX: 100, radiusY: 50 };
    const up = solveEllipseTangentThroughPoint({ x: 200, y: 0 }, idT, ellipse, 160);
    const down = solveEllipseTangentThroughPoint({ x: 200, y: 0 }, idT, ellipse, -160);
    expect(up!.t).toBeCloseTo(60);
    expect(down!.t).toBeCloseTo(-60);
  });

  it('pinが楕円の内側なら解なし(null)', () => {
    const ellipse = { center: { x: 0, y: 0 }, radiusX: 100, radiusY: 50 };
    expect(solveEllipseTangentThroughPoint({ x: 10, y: 0 }, idT, ellipse, 0)).toBeNull();
    // 楕円の縦は50までしかない: (0,40)は内側
    expect(solveEllipseTangentThroughPoint({ x: 0, y: 40 }, idT, ellipse, 0)).toBeNull();
  });

  it('対象の回転を反映する(楕円を90°回すと長短軸が入れ替わる)', () => {
    const ellipse = { center: { x: 0, y: 0 }, radiusX: 100, radiusY: 50 };
    const rotated: Transform = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    // 回転後、長軸はy方向(±100)、短軸はx方向(±50)。pin(0,200)はワールドで上方=回転後の長軸側
    const sol = solveEllipseTangentThroughPoint({ x: 0, y: 200 }, rotated, ellipse, -110);
    expect(sol).not.toBeNull();
    // 接点ローカルt=60(回転前と同じ媒介変数)。接点ワールドは回転で移る
    expect(Math.abs(sol!.t)).toBeCloseTo(60);
  });
});
