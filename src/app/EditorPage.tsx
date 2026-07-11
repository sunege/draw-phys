import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CanvasStage } from '../canvas/CanvasStage';
import { deserializeDocument } from '../core/document';
import { pluginRegistry } from '../core/registry';
import { useAutosave } from '../persistence/useAutosave';
import { useDocumentStore } from '../state/documentStore';
import { useLayoutStore } from '../state/layoutStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { EditorModalHost } from '../ui/EditorModalHost';
import { HintOverlay } from '../ui/HintOverlay';
import { MenuBar } from '../ui/MenuBar';
import { PropertyPanel } from '../ui/PropertyPanel';
import { ResizeHandle } from '../ui/ResizeHandle';
import { ToastOverlay } from '../ui/ToastOverlay';
import { Toolbox } from '../ui/Toolbox';
import { WorkspacePanel } from '../ui/WorkspacePanel';
import styles from './EditorPage.module.css';

export function EditorPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const fileNode = useWorkspaceStore((s) => (fileId ? s.nodes[fileId] : undefined));

  // ファイルの読み込み(fileId切り替え時)
  useEffect(() => {
    if (!fileId) return;
    const adapter = useWorkspaceStore.getState().adapter;
    if (!adapter) return;
    let cancelled = false;
    void adapter.readDocument(fileId).then((json) => {
      if (cancelled) return;
      useDocumentStore
        .getState()
        .loadObjects(json ? deserializeDocument(json, pluginRegistry) : {});
    });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useAutosave(fileId);

  // ファイルが存在しない(削除された等)場合はホームへ
  useEffect(() => {
    if (fileId && !fileNode) navigate('/', { replace: true });
  }, [fileId, fileNode, navigate]);

  const leftCollapsed = useLayoutStore((s) => s.leftCollapsed);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const bottomCollapsed = useLayoutStore((s) => s.bottomCollapsed);
  const { resizeLeft, resizeRight, resizeBottom, toggleLeft, toggleRight, toggleBottom } =
    useLayoutStore.getState();

  if (!fileNode) return null;

  return (
    <div className={styles.page}>
      <MenuBar fileName={fileNode.name} />
      <div className={styles.main}>
        <Toolbox />
        <ResizeHandle
          orientation="vertical"
          sign={1}
          collapsed={leftCollapsed}
          onResize={resizeLeft}
          onToggle={toggleLeft}
          glyphWhenExpanded="◂"
          glyphWhenCollapsed="▸"
          label="ツールボックス"
        />
        <div className={styles.canvasArea}>
          <CanvasStage />
          <HintOverlay />
          <ToastOverlay />
        </div>
        <ResizeHandle
          orientation="vertical"
          sign={-1}
          collapsed={rightCollapsed}
          onResize={resizeRight}
          onToggle={toggleRight}
          glyphWhenExpanded="▸"
          glyphWhenCollapsed="◂"
          label="プロパティ"
        />
        <PropertyPanel />
      </div>
      <ResizeHandle
        orientation="horizontal"
        sign={-1}
        collapsed={bottomCollapsed}
        onResize={resizeBottom}
        onToggle={toggleBottom}
        glyphWhenExpanded="▾"
        glyphWhenCollapsed="▴"
        label="ワークスペース"
      />
      <WorkspacePanel />
      <EditorModalHost />
    </div>
  );
}
