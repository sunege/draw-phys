import { labelDecoDefaults } from '../basic/objectLabel';
import { makeVectorPlugin } from './vectorFactory';

/** 汎用ベクトル(速度・加速度など) */
export const vectorPlugin = makeVectorPlugin({
  id: 'mech.vector',
  name: 'ベクトル',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="4" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="2.2" />
      <path d="M20 12 L14 8.5 L14 15.5 Z" fill="currentColor" />
    </svg>
  ),
  defaults: {
    length: 100,
    color: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    headSize: 9,
    label: 'v',
    labelMode: 'text',
    labelLatex: '\\vec{v}',
    fontSize: 12,
    labelPos: 'middle',
    showPoint: false,
    ...labelDecoDefaults,
  },
  showPointOption: false,
});
