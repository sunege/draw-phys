import type { Point } from '../../core/types';
import { renderMathHtml } from '../annotation/mathLabel';
import { isLabelEmpty, measureLabelSize, type LabelContent } from './objectLabel';

/**
 * ラベル付きオブジェクト共通のラベル描画。
 *
 * - 常に正立(縦向き)で描く: オブジェクトの回転を打ち消すため rotate(-rotation)。
 * - 基準位置 anchor からの offset(dx,dy)で自由に配置できる(ドラッグで更新)。
 * - bg=true で背景を白塗りし、背後の図形との干渉で読みづらくなるのを防ぐ。
 * - interactive のときはドラッグ用の当たり判定(data-object-label + 透明矩形)を付ける。
 *   書き出し(interactive=false)ではこれらを付けず、純粋な表示のみにする。
 */
export function ObjectLabel({
  anchor,
  dx,
  dy,
  rotation,
  content,
  fontSize,
  color,
  bg,
  bgColor = '#ffffff',
  italic = false,
  fontFamily,
  objectId,
  interactive = false,
}: {
  anchor: Point;
  dx: number;
  dy: number;
  /** オブジェクトのワールド回転(度)。これを打ち消して正立させる */
  rotation: number;
  content: LabelContent;
  fontSize: number;
  color: string;
  bg: boolean;
  bgColor?: string;
  italic?: boolean;
  fontFamily?: string;
  objectId?: string;
  interactive?: boolean;
}) {
  if (isLabelEmpty(content)) return null;

  const cx = anchor.x + dx;
  const cy = anchor.y + dy;
  const { width, height } = measureLabelSize(content, fontSize);
  const padX = fontSize * 0.28;
  const padY = fontSize * 0.16;
  const boxX = -width / 2 - padX;
  const boxY = -height / 2 - padY;
  const boxW = width + padX * 2;
  const boxH = height + padY * 2;

  const hit = interactive && objectId ? { 'data-object-label': objectId } : {};

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${-rotation})`}
      {...hit}
      style={interactive ? { cursor: 'move' } : undefined}
    >
      {bg && <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2} fill={bgColor} />}
      {/* 背景が無いときでもラベル全域を掴めるよう透明な当たり判定を敷く(書き出しには出さない) */}
      {interactive && !bg && (
        <rect x={boxX} y={boxY} width={boxW} height={boxH} fill="transparent" />
      )}
      {content.mode === 'latex' ? (
        <foreignObject
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          style={{ overflow: 'visible' }}
        >
          <div
            {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
            style={{ fontSize, color, whiteSpace: 'nowrap', lineHeight: 1 }}
            dangerouslySetInnerHTML={{ __html: renderMathHtml(content.latex) }}
          />
        </foreignObject>
      ) : (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fill={color}
          fontStyle={italic ? 'italic' : undefined}
          fontFamily={fontFamily}
        >
          {content.text}
        </text>
      )}
    </g>
  );
}
