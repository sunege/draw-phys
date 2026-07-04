import { useEffect } from 'react';
import { serializeDocument } from '../core/document';
import { useDocumentStore } from '../state/documentStore';
import { useWorkspaceStore } from '../state/workspaceStore';

const AUTOSAVE_DELAY_MS = 800;

/** ドキュメントの変更を監視してデバウンス保存する */
export function useAutosave(fileId: string | undefined): void {
  useEffect(() => {
    if (!fileId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;

    const save = () => {
      dirty = false;
      const adapter = useWorkspaceStore.getState().adapter;
      if (!adapter) return;
      void adapter.writeDocument(
        fileId,
        serializeDocument(useDocumentStore.getState().objects),
      );
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
