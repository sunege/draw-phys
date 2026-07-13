import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDriveConfigured } from '../integrations/googleDrive/config';
import { useAuthStore, type StorageSource } from '../state/authStore';
import { useToastStore } from '../state/toastStore';
import styles from './WorkspaceSourceSelector.module.css';

/** ワークスペースのデータ元(ローカル/Googleアカウント)を切り替えるドロップダウン */
export function WorkspaceSourceSelector() {
  const source = useAuthStore((s) => s.source);
  const accounts = useAuthStore((s) => s.accounts);
  const busy = useAuthStore((s) => s.busy);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const isCurrent = (target: StorageSource): boolean =>
    target.kind === 'local'
      ? source.kind === 'local'
      : source.kind === 'drive' && source.email === target.email;

  const label =
    source.kind === 'local' ? 'ローカル' : source.email;

  const doSwitch = async (target: StorageSource) => {
    setOpen(false);
    if (isCurrent(target)) return;
    try {
      await useAuthStore.getState().switchTo(target);
      navigate('/');
    } catch (e) {
      useToastStore
        .getState()
        .showToast(e instanceof Error ? e.message : '切り替えに失敗しました', 'error');
    }
  };

  const doLogin = async () => {
    setOpen(false);
    try {
      await useAuthStore.getState().login();
      navigate('/');
    } catch (e) {
      useToastStore
        .getState()
        .showToast(e instanceof Error ? e.message : 'ログインに失敗しました', 'error');
    }
  };

  const doLogout = async (email: string) => {
    setOpen(false);
    await useAuthStore.getState().logout(email);
    navigate('/');
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="データの保存先"
      >
        <span className={styles.icon}>{source.kind === 'local' ? '💾' : '☁'}</span>
        <span className={styles.label}>{busy ? '読み込み中…' : label}</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div className={styles.menu}>
          <button
            type="button"
            className={isCurrent({ kind: 'local' }) ? styles.itemActive : styles.item}
            onClick={() => void doSwitch({ kind: 'local' })}
          >
            💾 ローカル
          </button>
          {accounts.map((a) => {
            const active = source.kind === 'drive' && source.email === a.email;
            return (
              <div key={a.email} className={active ? styles.rowActive : styles.row}>
                <button
                  type="button"
                  className={styles.itemMain}
                  onClick={() => void doSwitch({ kind: 'drive', email: a.email })}
                  title={a.email}
                >
                  ☁ {a.email}
                </button>
                <button
                  type="button"
                  className={styles.logout}
                  onClick={() => void doLogout(a.email)}
                  title="このアカウントからログアウト"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {isDriveConfigured() && (
            <button type="button" className={styles.add} onClick={() => void doLogin()}>
              ＋ Googleアカウントを追加
            </button>
          )}
        </div>
      )}
    </div>
  );
}
