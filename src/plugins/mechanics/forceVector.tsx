import { makeVectorPlugin } from './vectorFactory';

/** 力ベクトル(作用点付き) */
export const forceVectorPlugin = makeVectorPlugin({
  id: 'mech.force',
  name: '力ベクトル',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="4" cy="12" r="2.2" fill="currentColor" />
      <line x1="4" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="2.2" />
      <path d="M20 12 L14 8.5 L14 15.5 Z" fill="currentColor" />
    </svg>
  ),
  defaults: {
    length: 100,
    color: '#d32f2f',
    strokeWidth: 2.5,
    headSize: 14,
    label: 'F',
    fontSize: 18,
    labelPos: 'middle',
    showPoint: true,
  },
  showPointOption: true,
});
