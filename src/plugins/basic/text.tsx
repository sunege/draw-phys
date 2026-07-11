import { useEffect, useRef } from 'react';
import { mirrorKeepUpright } from '../../core/mirror';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Rect, Transform } from '../../core/types';
import { useDocumentStore } from '../../state/documentStore';
import { useInlineTextEditStore } from '../../state/inlineTextEditStore';
import { DEFAULT_FONT_FAMILY, FONT_FAMILY_OPTIONS, resolveFontFamily } from './fontFamilies';

interface TextProps {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  /** 背景を白で塗る(背後の図形と干渉して読みづらいときに使う) */
  bg: boolean;
}

const LINE_HEIGHT = 1.25;

/** 全角≒1em・半角≒0.55emの概算で1行の幅を見積もる */
function estimateLineWidth(line: string, fontSize: number): number {
  let em = 0;
  for (const ch of line) {
    em += ch.codePointAt(0)! > 0xff ? 1 : 0.55;
  }
  return em * fontSize;
}

/** テキストの外接矩形(背景と選択枠で共有)。bg=true のときはパディング分だけ広げる */
function textBounds(props: TextProps): Rect {
  const lines = props.text.split('\n');
  const width = Math.max(...lines.map((l) => estimateLineWidth(l, props.fontSize)), 10);
  const height = lines.length * props.fontSize * LINE_HEIGHT;
  const pad = props.bg ? props.fontSize * 0.2 : 0;
  return {
    x: -width / 2 - pad,
    y: -height / 2 - pad,
    width: width + pad * 2,
    height: height + pad * 2,
  };
}

export const textPlugin: PhysicsObjectPlugin<TextProps> = {
  id: 'core.text',
  version: 1,
  name: 'テキスト',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M5 5 H19 V8 H17 V7 H13 V18 H15 V20 H9 V18 H11 V7 H7 V8 H5 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    text: 'テキスト',
    fontSize: 12,
    fontFamily: DEFAULT_FONT_FAMILY,
    color: '#000000',
    bold: false,
    bg: false,
  },
  defaultSize: { width: 80, height: 25 },
  propertySchema: [
    { key: 'text', label: '内容', type: 'multiline' },
    { key: 'fontSize', label: 'サイズ', type: 'number', min: 6, step: 2 },
    { key: 'fontFamily', label: 'フォント', type: 'select', options: [...FONT_FAMILY_OPTIONS] },
    { key: 'color', label: '色', type: 'color' },
    { key: 'bold', label: '太字', type: 'boolean' },
    { key: 'bg', label: '背景', type: 'boolean' },
  ],
  Renderer: ({ props, objectId, interactive }) => {
    const isInlineTarget = useInlineTextEditStore((s) => s.objectId === objectId);
    const editing = interactive === true && isInlineTarget;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // 編集開始時のスナップショット(キャンセル復元・commit差分の基準)
    const beforeRef = useRef<{ transform: Transform; props: Record<string, unknown> } | null>(null);
    const canceledRef = useRef(false);

    useEffect(() => {
      if (!editing || !objectId) return;
      const obj = useDocumentStore.getState().objects[objectId];
      if (!obj) return;
      beforeRef.current = { transform: obj.transform, props: obj.props };
      canceledRef.current = false;
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, [editing, objectId]);

    const b = textBounds(props);

    if (editing && objectId) {
      const id = objectId;
      const finishEdit = () => {
        const doc = useDocumentStore.getState();
        const before = beforeRef.current;
        if (before) {
          if (canceledRef.current) doc.setObjectTransient(id, { props: before.props });
          else doc.commitObject(id, before);
        }
        useInlineTextEditStore.getState().close();
      };
      return (
        <foreignObject x={b.x} y={b.y} width={b.width} height={b.height} style={{ overflow: 'visible' }}>
          <textarea
            ref={textareaRef}
            {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
            value={props.text}
            wrap="off"
            spellCheck={false}
            onChange={(e) => {
              useDocumentStore
                .getState()
                .setObjectTransient(id, { props: { ...props, text: e.target.value } });
            }}
            onBlur={finishEdit}
            // Escapeで編集前へ復元(IME確定中のEscapeは変換候補の取り消しに使わせる)
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
                canceledRef.current = true;
                e.currentTarget.blur();
              }
              e.stopPropagation();
            }}
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              resize: 'none',
              overflow: 'hidden',
              border: '1px dashed #2b7de9',
              outline: 'none',
              padding: 0,
              margin: 0,
              background: props.bg ? '#ffffff' : 'transparent',
              fontSize: props.fontSize,
              fontFamily: resolveFontFamily(props.fontFamily),
              fontWeight: props.bold ? 700 : 400,
              color: props.color,
              lineHeight: `${props.fontSize * LINE_HEIGHT}px`,
              textAlign: 'center',
            }}
          />
        </foreignObject>
      );
    }

    const lines = props.text.split('\n');
    const lineH = props.fontSize * LINE_HEIGHT;
    return (
      <g>
        {props.bg && (
          <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={2} fill="#ffffff" />
        )}
        <text
          fill={props.color}
          fontSize={props.fontSize}
          fontFamily={resolveFontFamily(props.fontFamily)}
          fontWeight={props.bold ? 700 : 400}
          textAnchor="middle"
        >
          {lines.map((line, i) => (
            <tspan key={i} x={0} y={(i - (lines.length - 1) / 2) * lineH} dominantBaseline="central">
              {line || ' '}
            </tspan>
          ))}
        </text>
      </g>
    );
  },
  getBounds: (props) => textBounds(props),
  getSnapPoints: () => [{ x: 0, y: 0 }],
  applyScale: (props, fx) => ({ ...props, fontSize: props.fontSize * fx }),
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
  // ダブルクリック(および配置直後)でキャンバス上そのまま編集させる
  inlineEdit: true,
  // 鏡像は位置だけ反射し、文字は読める向きのまま(向き反転で読めなくなるのを避ける)
  mirror: mirrorKeepUpright,
};
