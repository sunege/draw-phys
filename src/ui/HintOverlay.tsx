import { useHintStore } from '../state/hintStore';
import styles from './HintOverlay.module.css';

/**
 * キャンバス上部中央に浮かぶ操作ガイド。
 * hintStore に載ったヒントを表示するだけの汎用オーバーレイ。
 * pointer-events を無効化しキャンバス操作を邪魔しない。
 */
export function HintOverlay() {
  const hint = useHintStore((s) => s.hint);
  if (!hint) return null;
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.pill}>
        {hint.step && (
          <span className={styles.step}>
            {hint.step.current}/{hint.step.total}
          </span>
        )}
        {hint.title && <span className={styles.title}>{hint.title}</span>}
        <span className={styles.message}>{hint.message}</span>
      </div>
    </div>
  );
}
