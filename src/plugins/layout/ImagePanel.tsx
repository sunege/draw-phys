import { useRef } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import styles from './ImagePanel.module.css';
import { readImageBlob } from './imageLoad';
import { aspectHeight, type ImageProps } from './imageMath';

/**
 * 画像プラグインのパネル拡張。ファイル選択での取込と、縦横比の復元を提供する。
 * 取込は readImageBlob(data URL化+実寸測定)で width/height を決めて props へ流し込む。
 */
export function ImagePanel({ objectId, props }: { objectId: string; props: ImageProps }) {
  const updateProps = useDocumentStore((s) => s.updateProps);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルの再選択でも change を発火させる
    if (!file) return;
    void readImageBlob(file).then((img) => updateProps(objectId, { ...img }));
  };

  return (
    <div className={styles.section}>
      <span className={styles.label}>画像</span>
      <div className={styles.row}>
        <button type="button" onClick={() => inputRef.current?.click()}>
          {props.src ? '画像を変更' : '画像を選択'}
        </button>
        <button
          type="button"
          disabled={!props.src || props.naturalW <= 0}
          title="幅を基準に元画像の縦横比へ揃える"
          onClick={() => updateProps(objectId, { height: aspectHeight(props) })}
        >
          縦横比を戻す
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFile}
      />
    </div>
  );
}
