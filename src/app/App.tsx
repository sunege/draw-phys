import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { IndexedDbAdapter } from '../persistence/indexedDbAdapter';
import { useWorkspaceStore } from '../state/workspaceStore';
import { EditorPage } from './EditorPage';

/**
 * 初期ファイル作成の実行中プロミス。
 * StrictModeのeffect二重実行や連続マウントでも1回しか作成しないための共有状態。
 */
let initialFileCreation: Promise<string> | null = null;

/** 開くべきファイルIDを返す。無ければ1つ作成する(冪等) */
async function ensureFileToOpen(): Promise<string> {
  const files = Object.values(useWorkspaceStore.getState().nodes)
    .filter((n) => n.type === 'file')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (files.length > 0) return files[0].id;
  initialFileCreation ??= useWorkspaceStore.getState().createFile(null, '新しい図');
  const id = await initialFileCreation;
  if (!useWorkspaceStore.getState().nodes[id]) {
    // 作成済みIDが削除済み(全削除後の再訪など)なら作り直す
    initialFileCreation = null;
    return ensureFileToOpen();
  }
  return id;
}

/** 最後に更新したファイルを開く。無ければ作成する */
function HomeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void ensureFileToOpen().then((id) => {
      if (!cancelled) navigate(`/edit/${id}`, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}

export function App() {
  const loaded = useWorkspaceStore((s) => s.loaded);

  useEffect(() => {
    if (!useWorkspaceStore.getState().loaded) {
      void useWorkspaceStore.getState().init(new IndexedDbAdapter());
    }
  }, []);

  if (!loaded) return null;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/edit/:fileId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
