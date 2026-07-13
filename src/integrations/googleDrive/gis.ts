import { DRIVE_SCOPES, GOOGLE_CLIENT_ID } from './config';

/**
 * Google Identity Services (GIS) の token モデルによる認証。
 * - クライアントシークレット不要(publicクライアント)
 * - トークンはメモリのみ(保存しない)。有効期限は約1時間
 * - ログイン保持は prompt:'' のサイレント再取得(Googleセッション頼み)で実現
 */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
  requestAccessToken: (opts?: { prompt?: string; hint?: string }) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: TokenResponse) => void;
}

interface GsiOAuth2 {
  initTokenClient: (config: TokenClientConfig) => TokenClient;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GsiOAuth2 } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise: Promise<void> | null = null;

/** GISスクリプトを一度だけ読み込む */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Google認証ライブラリの読み込みに失敗しました'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

let tokenClient: TokenClient | null = null;

async function getTokenClient(): Promise<TokenClient> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google認証ライブラリが利用できません');
  tokenClient ??= oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPES,
    callback: () => {
      /* リクエストごとに差し替える */
    },
  });
  return tokenClient;
}

export interface AccessToken {
  token: string;
  /** 有効期限(epoch ms) */
  expiresAt: number;
}

export type TokenPrompt = '' | 'consent' | 'select_account';

/**
 * アクセストークンを要求する。prompt='' はサイレント(UI無し)。
 * select_account/consent はポップアップを開くため、ユーザー操作(クリック)から呼ぶこと。
 */
export async function requestToken(opts: {
  prompt: TokenPrompt;
  hint?: string;
}): Promise<AccessToken> {
  const client = await getTokenClient();
  return new Promise<AccessToken>((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error_description || resp.error || 'トークンの取得に失敗しました'));
        return;
      }
      resolve({
        token: resp.access_token,
        expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
      });
    };
    client.error_callback = (err) => {
      reject(new Error(err.message || err.type || 'ログインがキャンセルされました'));
    };
    client.requestAccessToken({ prompt: opts.prompt, hint: opts.hint });
  });
}

/** userinfo からアカウントのメール・表示名を取得する */
export async function fetchUserInfo(token: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('アカウント情報の取得に失敗しました');
  const data = (await res.json()) as { email?: string; name?: string };
  const email = data.email ?? '';
  return { email, name: data.name || email };
}

/** 指定アカウント用のトークン供給関数。期限内はキャッシュ、失効時はサイレント再取得。 */
export type TokenProvider = (opts?: { force?: boolean }) => Promise<string>;

export function createTokenProvider(email: string, seed?: AccessToken): TokenProvider {
  let cached: AccessToken | null = seed ?? null;
  let inflight: Promise<string> | null = null;
  return async ({ force } = {}) => {
    if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    if (force) cached = null;
    if (!inflight) {
      inflight = requestToken({ prompt: '', hint: email })
        .then((t) => {
          cached = t;
          return t.token;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };
}
