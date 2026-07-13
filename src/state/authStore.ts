import { create } from 'zustand';
import { isDriveConfigured } from '../integrations/googleDrive/config';
import { createTokenProvider, fetchUserInfo, requestToken } from '../integrations/googleDrive/gis';
import { GoogleDriveAdapter } from '../integrations/googleDrive/googleDriveAdapter';
import { IndexedDbAdapter } from '../persistence/indexedDbAdapter';
import { useWorkspaceStore } from './workspaceStore';

/** ログイン済みアカウントの表示用ヒント(非機密) */
export interface DriveAccount {
  email: string;
  name: string;
}

/** ワークスペースのデータ元 */
export type StorageSource = { kind: 'local' } | { kind: 'drive'; email: string };

const ACCOUNTS_KEY = 'draw-phys.auth.accounts';
const SOURCE_KEY = 'draw-phys.auth.source';

function loadAccounts(): DriveAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as DriveAccount[]) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: DriveAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function loadSource(): StorageSource {
  try {
    const raw = localStorage.getItem(SOURCE_KEY);
    if (raw) return JSON.parse(raw) as StorageSource;
  } catch {
    /* ignore */
  }
  return { kind: 'local' };
}

function saveSource(source: StorageSource): void {
  localStorage.setItem(SOURCE_KEY, JSON.stringify(source));
}

// ローカル(IndexedDB)アダプタはアプリで1つだけ使い回す
let localAdapter: IndexedDbAdapter | null = null;
function getLocalAdapter(): IndexedDbAdapter {
  localAdapter ??= new IndexedDbAdapter();
  return localAdapter;
}

interface AuthState {
  accounts: DriveAccount[];
  source: StorageSource;
  /** ソース切替/ログインの実行中フラグ(UIのローディング表示用) */
  busy: boolean;
  error: string | null;

  /** 起動時: 前回のソースを復元(Driveはサイレント。失敗時はローカルへフォールバック) */
  restore(): Promise<void>;
  /** 新しいGoogleアカウントを追加してそのDriveへ切替(要ユーザー操作) */
  login(): Promise<void>;
  /** データ元を切り替える */
  switchTo(source: StorageSource): Promise<void>;
  /** アカウントを一覧から削除。現在ソースが該当アカウントならローカルへ戻す */
  logout(email: string): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  async function activateLocal(): Promise<void> {
    await useWorkspaceStore.getState().init(getLocalAdapter());
    set({ source: { kind: 'local' } });
    saveSource({ kind: 'local' });
  }

  async function activateDrive(email: string, seedToken?: string): Promise<void> {
    const provider = seedToken
      ? createTokenProvider(email, { token: seedToken, expiresAt: Date.now() + 55 * 60_000 })
      : createTokenProvider(email);
    // 疎通確認(サイレント取得。セッション切れ等はここで例外)
    await provider();
    await useWorkspaceStore.getState().init(new GoogleDriveAdapter(provider));
    set({ source: { kind: 'drive', email } });
    saveSource({ kind: 'drive', email });
  }

  return {
    accounts: loadAccounts(),
    source: { kind: 'local' },
    busy: false,
    error: null,

    async restore() {
      const target = loadSource();
      if (target.kind === 'local' || !isDriveConfigured()) {
        await activateLocal();
        return;
      }
      set({ busy: true });
      try {
        await activateDrive(target.email);
      } catch {
        // サイレント復元に失敗(セッション切れ等) → ローカルへ。アカウントヒントは残す
        await activateLocal();
      } finally {
        set({ busy: false });
      }
    },

    async login() {
      if (!isDriveConfigured()) {
        set({ error: 'Google連携が設定されていません' });
        return;
      }
      set({ busy: true, error: null });
      try {
        const access = await requestToken({ prompt: 'select_account' });
        const info = await fetchUserInfo(access.token);
        if (!info.email) throw new Error('メールアドレスを取得できませんでした');
        const accounts = [
          { email: info.email, name: info.name },
          ...get().accounts.filter((a) => a.email !== info.email),
        ];
        saveAccounts(accounts);
        set({ accounts });
        await activateDrive(info.email, access.token);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
        throw e;
      } finally {
        set({ busy: false });
      }
    },

    async switchTo(source) {
      set({ busy: true, error: null });
      try {
        if (source.kind === 'local') {
          await activateLocal();
        } else {
          await activateDrive(source.email);
        }
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
        throw e;
      } finally {
        set({ busy: false });
      }
    },

    async logout(email) {
      const accounts = get().accounts.filter((a) => a.email !== email);
      saveAccounts(accounts);
      set({ accounts });
      const current = get().source;
      if (current.kind === 'drive' && current.email === email) {
        await activateLocal();
      }
    },
  };
});
