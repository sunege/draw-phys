import { useEffect } from 'react';
import { pluginRegistry } from '../core/registry';
import { useDocumentStore } from '../state/documentStore';
import { useEditorModalStore } from '../state/editorModalStore';

/**
 * 開いているオブジェクトのプラグイン EditorModal をマウントするホスト。
 * 本体はプラグインが EditorModal を持つかだけを見る(図形種別非依存)。
 */
export function EditorModalHost() {
  const objectId = useEditorModalStore((s) => s.objectId);
  const obj = useDocumentStore((s) => (objectId ? s.objects[objectId] : undefined));
  const plugin = obj ? pluginRegistry.get(obj.pluginId) : undefined;
  const Modal = plugin?.EditorModal;

  // 編集中にオブジェクトが消えた(Undo・削除等)ら自動で閉じる
  useEffect(() => {
    if (objectId && !Modal) useEditorModalStore.getState().close();
  }, [objectId, Modal]);

  if (!objectId || !Modal) return null;
  // key=objectId で編集対象の切り替え時に内部stateをリセットする
  return <Modal key={objectId} objectId={objectId} onClose={() => useEditorModalStore.getState().close()} />;
}
