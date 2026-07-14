import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driveFetch, DriveHttpError } from '../driveClient';

/** driveFetch が使う最小限の Response もどきを作る */
function fakeRes(status: number, body = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
  } as unknown as Response;
}

const token = async () => 'tok';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * バックオフの待機(setTimeout)を進めつつ driveFetch を解決させる。
 * タイマーを進める前にハンドラを付けておき、失敗系テストでも unhandled rejection を出さない。
 */
async function resolveWithTimers<T>(promise: Promise<T>): Promise<T> {
  const guard = promise.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.advanceTimersByTimeAsync(60_000);
  const r = await guard;
  if (r.ok) return r.v;
  throw r.e;
}

describe('driveFetch のリトライ', () => {
  it('503 を数回返した後 200 になれば成功する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(503))
      .mockResolvedValueOnce(fakeRes(503))
      .mockResolvedValueOnce(fakeRes(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resolveWithTimers(driveFetch(token, '/x'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('429 も再試行する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(429))
      .mockResolvedValueOnce(fakeRes(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resolveWithTimers(driveFetch(token, '/x'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('404 は再試行せず即座に失敗する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeRes(404, 'not found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveWithTimers(driveFetch(token, '/x'))).rejects.toBeInstanceOf(DriveHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('403 レート制限は再試行、403 権限エラーは再試行しない', async () => {
    const rateLimited = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(403, 'userRateLimitExceeded'))
      .mockResolvedValueOnce(fakeRes(200, 'ok'));
    vi.stubGlobal('fetch', rateLimited);
    expect((await resolveWithTimers(driveFetch(token, '/x'))).status).toBe(200);
    expect(rateLimited).toHaveBeenCalledTimes(2);

    const forbidden = vi.fn().mockResolvedValue(fakeRes(403, 'insufficientPermissions'));
    vi.stubGlobal('fetch', forbidden);
    await expect(resolveWithTimers(driveFetch(token, '/x'))).rejects.toBeInstanceOf(DriveHttpError);
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it('401 は1回だけトークンを強制更新して再試行する', async () => {
    const getToken = vi.fn(async () => 'tok');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(401))
      .mockResolvedValueOnce(fakeRes(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resolveWithTimers(driveFetch(getToken, '/x'));
    expect(res.status).toBe(200);
    expect(getToken).toHaveBeenNthCalledWith(1, { force: false });
    expect(getToken).toHaveBeenNthCalledWith(2, { force: true });
  });

  it('ネットワーク断もバックオフして再試行する', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(fakeRes(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resolveWithTimers(driveFetch(token, '/x'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('再試行を尽くしても回復しなければ失敗する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeRes(503, 'busy'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveWithTimers(driveFetch(token, '/x'))).rejects.toBeInstanceOf(DriveHttpError);
    // 初回 + 最大4回の再試行 = 5回
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
