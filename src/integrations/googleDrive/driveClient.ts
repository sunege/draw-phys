import type { TokenProvider } from './gis';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

/** レート制限/サーバ側一時エラーの最大再試行回数 */
const MAX_TRANSIENT_RETRIES = 4;

export class DriveHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveHttpError';
    this.status = status;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** そのステータス/本文が一時的エラー(再試行で回復しうる)かどうか */
function isRetriable(status: number, body: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  // 403 はレート制限系のみ再試行する(権限不足などは即座に失敗させる)
  if (status === 403) return /rateLimitExceeded|userRateLimitExceeded/i.test(body);
  return false;
}

/** 指数バックオフの待ち時間(Retry-Afterヘッダがあれば優先。ジッタ付き) */
function backoffMs(attempt: number, res?: Response): number {
  const retryAfter = res?.headers.get('Retry-After');
  if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec)) return Math.min(sec * 1000, 32_000);
  }
  return Math.min(1000 * 2 ** attempt, 16_000) + Math.random() * 250;
}

/**
 * Driveへの認証付きfetch。
 * - 401(トークン失効)時は1回だけサイレントでトークンを更新して再試行する。
 * - 429 / 5xx / 403レート制限 やネットワーク断は指数バックオフで数回まで再試行する
 *   (バースト書き込み時のスロットリングで書き込みが黙って失われるのを防ぐ)。
 */
export async function driveFetch(
  getToken: TokenProvider,
  path: string,
  init: RequestInit = {},
  opts: { base?: 'api' | 'upload' } = {},
): Promise<Response> {
  const base = opts.base === 'upload' ? DRIVE_UPLOAD : DRIVE_API;
  let forcedTokenRefresh = false;
  let transientAttempts = 0;

  for (;;) {
    const token = await getToken({ force: forcedTokenRefresh });
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetch(base + path, { ...init, headers });
    } catch (err) {
      // ネットワーク断など。数回までバックオフして再試行する
      if (transientAttempts < MAX_TRANSIENT_RETRIES) {
        await delay(backoffMs(transientAttempts++));
        continue;
      }
      throw new DriveHttpError(0, `Drive API 接続エラー: ${(err as Error)?.message ?? String(err)}`);
    }

    if (res.ok) return res;

    // トークン失効は1回だけ強制更新して再試行
    if (res.status === 401 && !forcedTokenRefresh) {
      forcedTokenRefresh = true;
      continue;
    }

    const text = await res.text().catch(() => '');

    // 一時的エラーはバックオフして再試行
    if (isRetriable(res.status, text) && transientAttempts < MAX_TRANSIENT_RETRIES) {
      await delay(backoffMs(transientAttempts++, res));
      continue;
    }

    throw new DriveHttpError(res.status, `Drive API エラー (${res.status}): ${text.slice(0, 200)}`);
  }
}
