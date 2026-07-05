import { useToastStore } from '../state/toastStore';
import styles from './ToastOverlay.module.css';

/**
 * 画面下部中央に浮かぶ一過性の通知。
 * toastStore に載ったトーストを表示するだけの汎用オーバーレイ。
 */
export function ToastOverlay() {
  const toast = useToastStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      {/* id を key にして、連続表示のたびに入場アニメーションをやり直す */}
      <div
        key={toast.id}
        className={`${styles.toast} ${toast.kind === 'error' ? styles.error : styles.success}`}
      >
        {toast.message}
      </div>
    </div>
  );
}
