import type { PropertyField } from '../../core/plugin';

/** 重心表示の共通プロパティ(円・長方形・円弧で共有) */
export const centerFields: PropertyField[] = [
  { key: 'showCenter', label: '重心を表示', type: 'boolean' },
  {
    key: 'centerStyle',
    label: '重心マーク',
    type: 'select',
    options: [
      { value: 'cross', label: '十字' },
      { value: 'dot', label: '点' },
    ],
  },
  { key: 'centerSize', label: '重心サイズ', type: 'number', min: 1, step: 1 },
];

/** 重心の既定プロパティ */
export const centerDefaults = { showCenter: false, centerStyle: 'cross' as const, centerSize: 5 };
