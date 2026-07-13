import { cloneElement, type ReactElement } from 'react';
import {
  dashArray,
  wavyFilterId,
  wavyFilterRegion,
  WAVY_FREQUENCY,
  WAVY_SCALE,
  type LineStyle,
  type LocalRect,
} from './lineUtils';

/** 二重線の中央を抜く色(用紙の白) */
const GAP_COLOR = '#ffffff';

type StrokeChild = ReactElement<{
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  strokeDasharray?: string;
  filter?: string;
}>;

/**
 * 線種に応じて輪郭要素を描き分ける共有ラッパー(基本図形専用)。
 * children は stroke/strokeWidth を持つ単一のSVG要素
 * (line / rect / circle / ellipse / path / polygon)。cloneElement で属性を
 * 差し替えるので、図形の幾何を知らずに種別非依存で扱える。
 * - solid / dashed / dotted: strokeDasharray を付けるだけ
 * - double(二重線): 同じ要素を「線色の太帯」+「中央を白で抜く細線」の2枚重ねで二重に見せる
 * - wavy(手書き線): SVGフィルタ(feTurbulence + feDisplacementMap)で輪郭を揺らす手描き風
 *
 * bounds はローカル外接矩形。手書き線フィルタの適用領域算出に使う
 * (省略時は実線として描く)。
 */
export function StyledStroke({
  lineStyle,
  bounds,
  children,
}: {
  lineStyle: LineStyle | undefined;
  bounds?: LocalRect;
  children: StrokeChild;
}) {
  const style = lineStyle ?? 'solid';
  const sw = Number(children.props.strokeWidth ?? 1);

  if (style === 'double') {
    // 帯幅=線幅の3倍(最低3px)にし、中央1/3を白で抜くと線幅ぶんの2本線に見える
    const band = Math.max(sw * 3, 3);
    return (
      <>
        {cloneElement(children, { strokeWidth: band, strokeDasharray: undefined })}
        {cloneElement(children, {
          strokeWidth: band / 3,
          stroke: GAP_COLOR,
          fill: 'none',
          strokeDasharray: undefined,
        })}
      </>
    );
  }

  if (style === 'wavy' && bounds) {
    const region = wavyFilterRegion(bounds);
    const id = wavyFilterId(region);
    return (
      <>
        <defs>
          <filter
            id={id}
            filterUnits="userSpaceOnUse"
            x={region.x}
            y={region.y}
            width={region.width}
            height={region.height}
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={WAVY_FREQUENCY}
              numOctaves={1}
              seed={7}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={WAVY_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        {cloneElement(children, { filter: `url(#${id})`, strokeDasharray: undefined })}
      </>
    );
  }

  return cloneElement(children, { strokeDasharray: dashArray(style, sw) });
}
