import type { PropertyField } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';
import {
  labelBgField,
  labelDecoDefaults,
  labelLocalBounds,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';

/** ラベル(R₁, C, L, E, q…)を持つ電磁気記号共通のprops断片 */
export interface CircuitLabelProps extends LabelDecoProps {
  labelMode: LabelContent['mode'];
  label: string;
  labelLatex: string;
  fontSize: number;
}

/** ラベル関連のデフォルト値(mode 既定は LaTeX) */
export function circuitLabelDefaults(
  label: string,
  mode: LabelContent['mode'] = 'latex',
): CircuitLabelProps {
  return { ...labelDecoDefaults, labelMode: mode, label, labelLatex: label, fontSize: 12 };
}

/** ラベル関連のプロパティスキーマ(パネル末尾へ spread する) */
export const circuitLabelFields: PropertyField[] = [
  {
    key: 'labelMode',
    label: 'ラベル',
    type: 'select',
    options: [
      { value: 'latex', label: 'LaTeX' },
      { value: 'text', label: 'テキスト' },
      { value: 'none', label: 'なし' },
    ],
  },
  { key: 'label', label: 'ラベル文字', type: 'text' },
  { key: 'labelLatex', label: 'LaTeX式', type: 'text' },
  { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 2 },
  labelBgField,
];

export function circuitLabelContent(props: CircuitLabelProps): LabelContent {
  return { mode: props.labelMode, text: props.label, latex: props.labelLatex };
}

/** ラベルの局所バウンディング(getBounds で本体と union する) */
export function circuitLabelBounds(anchor: Point, props: CircuitLabelProps): Rect | null {
  return labelLocalBounds(anchor, props, circuitLabelContent(props), props.fontSize);
}
