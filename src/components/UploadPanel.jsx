import { useRef, useState } from 'react';

export default function UploadPanel({ uploads, onFiles, onStart, onDemo }) {
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const [dragging, setDragging] = useState(false);

  const drop = (event) => {
    event.preventDefault();
    setDragging(false);
    onFiles(event.dataTransfer.files);
  };

  return (
    <div className="upload-card">
      <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={drop}>
        <div className="upload-icon"><span>↗</span></div>
        <h2>拖入分子图片、PDF 或文件夹</h2>
        <p>文件只在浏览器中预览；当前演示版不会上传到服务器。</p>
        <div className="upload-actions">
          <button className="primary-btn" onClick={() => fileInput.current?.click()}>选择文件</button>
          <button className="secondary-btn" onClick={() => folderInput.current?.click()}>选择文件夹</button>
        </div>
        <input ref={fileInput} hidden type="file" accept=".png,.jpg,.jpeg,.pdf" multiple onChange={(event) => onFiles(event.target.files)} />
        <input ref={folderInput} hidden type="file" accept=".png,.jpg,.jpeg,.pdf" multiple webkitdirectory="" onChange={(event) => onFiles(event.target.files)} />
      </div>

      {uploads.length > 0 && <div className="upload-selection">
        <div><strong>已选择 {uploads.length} 个文件</strong><span>{uploads.slice(0, 2).map((item) => item.name).join('、')}{uploads.length > 2 ? '…' : ''}</span></div>
        <button className="primary-btn" onClick={onStart}>开始转换 <span>→</span></button>
      </div>}
      <button className="demo-link" onClick={onDemo}>暂时没有文件？查看交互演示</button>
    </div>
  );
}
