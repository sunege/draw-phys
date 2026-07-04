import { ObjectLabel } from '../basic/LabelView';
import type { LabelContent } from '../basic/objectLabel';

export type LabelMode = 'value' | 'latex' | 'none';

/**
 * 注釈マークのラベル。基準点(x,y)にテキスト(実測値)または KaTeX 数式を描く。
 * 表示は共通の {@link ObjectLabel} に委譲し、常に正立・オフセット移動・背景白塗り・
 * ドラッグ当たり判定に対応する。
 */
export function MarkLabel({
  x,
  y,
  dx = 0,
  dy = 0,
  rotation = 0,
  mode,
  text,
  latex,
  fontSize,
  color,
  bg = false,
  objectId,
  interactive = false,
}: {
  x: number;
  y: number;
  /** ラベルのオフセット(局所座標)。ドラッグで動かす */
  dx?: number;
  dy?: number;
  /** オブジェクトのワールド回転(度)。正立表示のため打ち消す */
  rotation?: number;
  mode: LabelMode;
  /** value モードで表示する文字列(実測値+単位など) */
  text: string;
  latex: string;
  fontSize: number;
  color: string;
  bg?: boolean;
  objectId?: string;
  interactive?: boolean;
}) {
  const content: LabelContent = {
    mode: mode === 'value' ? 'text' : mode,
    text,
    latex,
  };
  return (
    <ObjectLabel
      anchor={{ x, y }}
      dx={dx}
      dy={dy}
      rotation={rotation}
      content={content}
      fontSize={fontSize}
      color={color}
      bg={bg}
      objectId={objectId}
      interactive={interactive}
    />
  );
}
