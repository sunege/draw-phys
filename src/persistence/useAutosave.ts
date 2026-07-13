import { useEffect } from 'react';
import { serializeDocument } from '../core/document';
import { useDocumentStore } from '../state/documentStore';
import { useToastStore } from '../state/toastStore';
import { useWorkspaceStore } from '../state/workspaceStore';

const AUTOSAVE_DELAY_MS = 800;

/** ドキュメントの変更を監視してデバウンス保存する */
export function useAutosave(fileId: string | undefined): void {
  useEffect(() => {
    if (!fileId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    // 連続失敗でトーストを出し続けないよう、直近が失敗中かを覚えておく
    let errored = false;

    const save = () => {
      dirty = false;
      const adapter = useWorkspaceStore.getState().adapter;
      if (!adapter) return;
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

    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.objects === prev.objects) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
      // 未保存の変更はアンマウント時に確実に書き出す
      if (dirty) save();
    };
  }, [fileId]);
}
