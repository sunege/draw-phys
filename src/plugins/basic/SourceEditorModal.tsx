import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Transform } from '../../core/types';
import { useDocumentStore } from '../../state/documentStore';
import { useEditorModalStore } from '../../state/editorModalStore';
import styles from './SourceEditorModal.module.css';

/**
 * ソース文字列(LaTeX文章・数式)を大きなtextarea＋ライブプレビューで編集する
 * 汎用モーダル。プラグインは config を渡す薄いラッパで EditorModal に載せる。
 *
 * 編集はドラッグ操作と同じ transient → commit の2段で反映する:
 * 入力はdebounce付き setObjectTransient でキャンバスへライブ反映(履歴に残らない)、
 * 保存で commitObject(履歴1エントリ)、キャンセルで編集前スナップショットへ復元。
 */
export interface SourceEditorConfig {
  title: string;
  /** textarea下に表示する入力ヒント */
  hint?: string;
  placeholder?: string;
  /** props からエディタに載せるソース文字列を取り出す */
  getDraft(props: Record<string, unknown>): string;
  /** 編集中のソースを props へ反映する */
  applyDraft(props: Record<string, unknown>, draft: string): Record<string, unknown>;
  /** プレビューのHTMLとコンテナスタイル(キャンバスと同じ見た目にする) */
  renderPreview(
    draft: string,
    props: Record<string, unknown>,
  ): { html: string; style: CSSProperties };
}

/** ライブ反映のdebounce間隔(ms)。巨大文章でも1キーごとの実測を避ける */
const LIVE_UPDATE_MS = 200;

export function SourceEditorModal({
  objectId,
  onClose,
  config,
}: {
  objectId: string;
  onClose(): void;
  config: SourceEditorConfig;
}) {
  const obj = useDocumentStore((s) => s.objects[objectId]);
  // 編集前スナップショット(キャンセル復元・commit差分の基準)。マウント時に1度だけ取る
  const beforeRef = useRef<{ transform: Transform; props: Record<string, unknown> } | null>(null);
  if (!beforeRef.current && obj) {
    beforeRef.current = { transform: obj.transform, props: obj.props };
  }
  const [draft, setDraft] = useState(() => (obj ? config.getDraft(obj.props) : ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // textarea内でドラッグ選択しマウスがbackdropへ出てからボタンを離すと、
  // click イベントは mousedown/mouseup の共通祖先=backdrop で発火する。
  // mousedown自体がbackdrop直上で始まった場合のみ「外側クリック」として保存扱いにする。
  const mouseDownOnBackdropRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // キャンバスへのライブ反映(履歴に残さない)
  useEffect(() => {
    const timer = setTimeout(() => {
      const doc = useDocumentStore.getState();
      const cur = doc.objects[objectId];
      if (!cur || config.getDraft(cur.props) === draft) return;
      doc.setObjectTransient(objectId, { props: config.applyDraft(cur.props, draft) });
    }, LIVE_UPDATE_MS);
    return () => clearTimeout(timer);
  }, [draft, objectId, config]);

  if (!obj) return null;

  const save = () => {
    const doc = useDocumentStore.getState();
    const cur = doc.objects[objectId];
    if (cur && beforeRef.current) {
      // debounce未反映分も含めて確定してから履歴1エントリで記録する
      doc.setObjectTransient(objectId, { props: config.applyDraft(cur.props, draft) });
      doc.commitObject(objectId, beforeRef.current);
    }
    onClose();
  };

  const cancel = () => {
    const doc = useDocumentStore.getState();
    if (doc.objects[objectId] && beforeRef.current) {
      doc.setObjectTransient(objectId, { props: beforeRef.current.props });
    }
    onClose();
  };

  const preview = config.renderPreview(draft, obj.props);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      // 編集内容を失わないよう、backdropクリックは保存扱いにする(textarea内のドラッグ選択が
      // backdropまではみ出して終わるケースは除く)
      onClick={(e) => {
        if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) save();
      }}
      // CanvasStageのwindowショートカット(Ctrl+Z等)へキー入力が届かないようにする
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel();
        else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
        e.stopPropagation();
      }}
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{config.title}</h2>
        <div className={styles.panes}>
          <div className={styles.editorPane}>
            <textarea
              ref={textareaRef}
              value={draft}
              placeholder={config.placeholder}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
            {config.hint && <p className={styles.hint}>{config.hint}</p>}
          </div>
          <div className={styles.previewPane}>
            <div
              style={preview.style}
              // エスケープ済みテキストとKaTeX生成HTMLのみを流し込む
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
        <div className={styles.buttons}>
          <span className={styles.shortcutNote}>Ctrl(⌘)+Enter: 保存 / Esc: キャンセル</span>
          <div className={styles.buttonsRight}>
            <button type="button" onClick={cancel}>
              キャンセル
            </button>
            <button type="button" className={styles.primary} onClick={save}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** プロパティパネル(PanelExtra)に置く「エディタで編集…」ボタン */
export function EditorOpenButton({ objectId }: { objectId: string }) {
  return (
    <button
      type="button"
      className={styles.editButton}
      onClick={() => useEditorModalStore.getState().open(objectId)}
    >
      エディタで編集…
    </button>
  );
}
