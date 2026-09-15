import type { PhysicsObjectPlugin } from '../../core/plugin';
import { mapRegion, regionBounds, regionPathData, type RegionLoop } from '../../core/regionPath';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from './fillPattern';
import { PatternDefs } from './PatternDefs';

/**
 * 塗り領域(バケツツールの結果)。線・円弧などで囲まれた領域の輪郭を
 * 直線+円弧の列(ローカル座標)で持ち、evenodd で穴をくり抜いて塗る。
 * 作った時点の形のスナップショットで、境界図形を動かしても追従しない。
 */
export interface FillRegionProps {
  loops: RegionLoop[];
  fill: string;
  fillOpacity: number;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  /** 輪郭線とパターンの色 */
  stroke: string;
  /** 輪郭線の太さ(0=輪郭なし。境界は元の線が描くので既定は0) */
  strokeWidth: number;
}

export const fillRegionPlugin: PhysicsObjectPlugin<FillRegionProps> = {
  id: 'core.fillRegion',
  version: 1,
  name: '塗り領域',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M4 18 A9 9 0 0 1 20 18 Z" fill="currentColor" opacity="0.5" />
    </svg>
  ),
  // 塗るための図形なので、他の図形の「塗り白・不透明度0」規則の例外として薄い灰色で見える既定にする
  defaultProps: {
    loops: [],
    fill: '#d9d9d9',
    fillOpacity: 1,
    fillPattern: 'none',
    patternSize: 'medium',
    stroke: '#000000',
    strokeWidth: 0,
  },
  defaultSize: { width: 0, height: 0 },
  propertySchema: [
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    fillPatternField,
    patternSizeField,
    { key: 'stroke', label: '線色(パターン色)', type: 'color' },
    { key: 'strokeWidth', label: '輪郭線の太さ', type: 'number', min: 0, step: 0.5 },
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <path
        d={regionPathData(props.loops)}
        fillRule="evenodd"
        fill={resolveFill(props)}
        fillOpacity={resolveFillOpacity(props)}
        stroke={props.strokeWidth > 0 ? props.stroke : 'none'}
        strokeWidth={props.strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  ),
  getBounds: (props) => regionBounds(props.loops),
  // 原点=外接矩形の中心で作るので、原点まわりの一様拡縮で中心が保たれる
  applyScale: (props, fx) => ({ ...props, loops: mapRegion(props.loops, 0, 0, fx) }),
  capabilities: { rotatable: true, scalable: 'uniform', hiddenInToolbox: true },
  placement: 'click',
};
