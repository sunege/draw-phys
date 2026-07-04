import { rotateVec } from '../../core/geometry';
import type { PropertyField } from '../../core/plugin';
import type { Point, Rect, Transform } from '../../core/types';
import { measureMath } from '../annotation/mathLabel';

/**
 * ラベル付きオブジェクト共通の表示内容。
 * - text: プレーンテキスト
 * - latex: KaTeX 数式
 * - none: 非表示
 */
export interface LabelContent {
  mode: 'text' | 'latex' | 'none';
  text: string;
  latex: string;
}

/**
 * ラベル付きオブジェクトが共通で持つプロパティ断片。
 * - labelBg: 背景を白で塗る(背後の図形と干渉して読みづらいときに使う)
 * - labelDx/labelDy: ラベル基準位置からのオフセット(局所座標)。ドラッグで動かす
 */
export interface LabelDecoProps {
  labelBg: boolean;
  labelDx: number;
  labelDy: number;
}

export const labelDecoDefaults: LabelDecoProps = { labelBg: false, labelDx: 0, labelDy: 0 };

/** プロパティパネルに追加する「ラベル背景」トグル */
export const labelBgField: PropertyField = { key: 'labelBg', label: 'ラベル背景', type: 'boolean' };

/** テキスト/数式ラベルの概寸(背景矩形と当たり判定用)。 */
export function measureLabelSize(
  content: LabelContent,
  fontSize: number,
): { width: number; height: number } {
  if (content.mode === 'latex') return measureMath(content.latex, fontSize);
  const len = Math.max(1, content.text.length);
  return { width: len * fontSize * 0.62, height: fontSize * 1.25 };
}

/** ラベルが空(非表示)かどうか */
export function isLabelEmpty(content: LabelContent): boolean {
  if (content.mode === 'none') return true;
  if (content.mode === 'text') return content.text.trim().length === 0;
  return content.latex.trim().length === 0;
}

/**
 * ラベルの局所バウンディングボックス。回転で常に縦向き(正立)になるため、
 * どの回転でも収まるよう対角長を半径とする正方形で近似する。空なら null。
 */
export function labelLocalBounds(
  anchor: Point,
  props: LabelDecoProps,
  content: LabelContent,
  fontSize: number,
): Rect | null {
  if (isLabelEmpty(content)) return null;
  const { width, height } = measureLabelSize(content, fontSize);
  const half = Math.hypot(width, height) / 2 + 4;
  const cx = anchor.x + props.labelDx;
  const cy = anchor.y + props.labelDy;
  return { x: cx - half, y: cy - half, width: half * 2, height: half * 2 };
}

/**
 * ラベルをワールド上でドラッグしたときの offset(局所座標)更新。
 * ラベルは常に正立で表示されるが、オフセット自体はオブジェクト回転に追従させる
 * ため、ワールド移動量をオブジェクトの逆回転で局所量へ変換して加算する。
 */
export function moveLabelOffset<P extends LabelDecoProps>(
  props: P,
  transform: Transform,
  fromWorld: Point,
  toWorld: Point,
): P {
  const d = rotateVec(
    { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y },
    -transform.rotation,
  );
  return { ...props, labelDx: props.labelDx + d.x, labelDy: props.labelDy + d.y };
}
