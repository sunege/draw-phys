import type { TokenProvider } from './gis';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class DriveHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveHttpError';
    this.status = status;
  }
}

/**
 * Driveへの認証付きfetch。
 * 401(トークン失効)時は1回だけサイレントでトークンを更新して再試行する。
 */
export async function driveFetch(
  getToken: TokenProvider,
  path: string,
  init: RequestInit = {},
  opts: { base?: 'api' | 'upload'; retried?: boolean } = {},
): Promise<Response> {
  const base = opts.base === 'upload' ? DRIVE_UPLOAD : DRIVE_API;
  const token = await getToken({ force: opts.retried });
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(base + path, { ...init, headers });
  if (res.status === 401 && !opts.retried) {
    return driveFetch(getToken, path, init, { ...opts, retried: true });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DriveHttpError(res.status, `Drive API エラー (${res.status}): ${text.slice(0, 200)}`);
  }
  return res;
}
