/**
 * Google Drive 連携の設定。
 * クライアントIDは公開値(SPA=publicクライアント)なのでフロントに埋め込んでよい。
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/**
 * 要求スコープ。
 * - drive.appdata: アプリ専用の隠しフォルダのみ(ユーザーの他ファイルには触れない)
 * - openid / email: ログイン中アカウントのメール取得(表示・切替用)
 */
export const DRIVE_SCOPES = 'openid email https://www.googleapis.com/auth/drive.appdata';

/** クライアントIDが設定されているか(未設定ならDrive機能を出さない) */
export function isDriveConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}
