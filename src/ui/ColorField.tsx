import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ColorField.module.css';

/** 物理図でよく使う色のプリセット(5列×3行) */
const PRESET_COLORS = [
  '#000000', '#555555', '#999999', '#cccccc', '#ffffff',
  '#e03131', '#f76707', '#f2b100', '#2f9e44', '#0c8599',
  '#1971c2', '#4263eb', '#7048e8', '#c2255c', '#a56a2b',
];

/** ポップオーバーの概算高さ。画面下端に近いとき上向きに開くかの判定に使う */
const POPOVER_HEIGHT = 190;

const isHex6 = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * 色プロパティ用の入力。スウォッチをクリックすると自前のポップオーバーが開き、
 * プリセット・任意色・「閉じる」ボタンを提供する。OS標準のカラーピッカー(閉じづらい)を
 * 主導線から外し、ポップオーバーは body へポータルしてパネルの overflow クリップと
 * キャンバスへのクリック伝播(=選択解除)を避ける。
 */
export function ColorField({
  value,
  onChange,
  mixed = false,
}: {
  value: string;
  onChange: (color: string) => void;
  /** 複数選択の一括編集で選択オブジェクト間の色が食い違う場合 true */
  mixed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // スウォッチ直下(はみ出すときは直上)へポップオーバーを合わせ、スクロール・リサイズに追従
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = r.bottom + 4 + POPOVER_HEIGHT <= window.innerHeight;
      const top = below ? r.bottom + 4 : Math.max(8, r.top - 4 - POPOVER_HEIGHT);
      setPos({ top, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // 外側クリック / Esc で閉じる(スウォッチ・ポップオーバー内クリックは維持)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.swatch}
        style={mixed ? undefined : { background: value || '#000000' }}
        data-mixed={mixed}
        title={mixed ? '(複数の値)' : value}
        onClick={() => setOpen((o) => !o)}
      >
        {mixed && '—'}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className={styles.popover}
            style={{ top: pos.top, right: pos.right }}
          >
            <div className={styles.presets}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.preset}
                  style={{ background: c }}
                  data-selected={!mixed && c.toLowerCase() === value.toLowerCase()}
                  title={c}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
            <label className={styles.customRow}>
              <span>その他</span>
              <input
                type="color"
                value={isHex6(value) ? value : '#000000'}
                onChange={(e) => onChange(e.target.value)}
              />
              <input
                type="text"
                className={styles.hexInput}
                value={mixed ? '' : value}
                placeholder={mixed ? '(複数の値)' : undefined}
                onChange={(e) => onChange(e.target.value)}
              />
            </label>
            <button type="button" className={styles.close} onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>,
          document.body,
        )}
    </span>
  );
}
