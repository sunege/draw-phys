import { useEffect } from 'react';
import { deserializeDocument, serializeDocument } from '../core/document';
import { pluginRegistry } from '../core/registry';
import { useDocumentStore } from '../state/documentStore';
import { useToastStore } from '../state/toastStore';
import { useWorkspaceStore } from '../state/workspaceStore';

const AUTOSAVE_DELAY_MS = 800;

/**
 * ファイルの読み込みとデバウンス自動保存をまとめて扱う。
 *
 * 重要: **初回読み込みが成功するまでは保存しない**。読み込みが失敗した(接続断・
 * ログイン切れ等)ファイルを開いたとき、空のキャンバスを自動保存で書き戻して
 * 保存先(特にGoogle Drive)のデータを消してしまうのを防ぐため。
 */
export function useDocumentIO(fileId: string | undefined): void {
  useEffect(() => {
    if (!fileId) return;
    const adapter = useWorkspaceStore.getState().adapter;
    if (!adapter) return;

    let cancelled = false;
    let ready = false; // 初回読み込み成功後のみ保存を許可
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    // 連続失敗でトーストを出し続けないよう、直近が失敗中かを覚えておく
    let errored = false;

    const save = () => {
      if (!ready) return; // 読み込めていないファイルは保存しない(空上書き防止)
      dirty = false;
      void adapter
        .writeDocument(fileId, serializeDocument(useDocumentStore.getState().objects))
        .then(() => {
          errored = false;
        })
        .catch(() => {
          if (!errored) {
            errored = true;
            useToastStore
              .getState()
              .showToast('保存に失敗しました（接続やログイン状態を確認してください）', 'error');
          }
        });
    };

    // 読み込み(fileId切り替え時)
    adapter
      .readDocument(fileId)
      .then((json) => {
        if (cancelled) return;
        useDocumentStore
          .getState()
          .loadObjects(json ? deserializeDocument(json, pluginRegistry) : {});
        ready = true; // ここから先の変更のみ保存対象にする
      })
      .catch(() => {
        if (cancelled) return;
        // 読み込み失敗: 保存を有効化しない(=空上書きしない)。ユーザーに通知する
        useToastStore
          .getState()
          .showToast(
            'ファイルの読み込みに失敗しました（接続やログイン状態を確認してください）',
            'error',
          );
      });

    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.objects === prev.objects) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      clearTimeout(timer);
      // 未保存の変更はアンマウント時に確実に書き出す(ready=false なら save 内で弾かれる)
      if (dirty) save();
    };
  }, [fileId]);
}
