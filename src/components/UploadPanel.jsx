import { useRef, useState } from 'react';

const DEFAULT_AI_BASE_URL = 'http://121.89.85.118:8000/v1';
const DEFAULT_AI_MODEL = 'Qwen3.5-397B-A17B-FP8';

export default function UploadPanel({ uploads, onFiles, onStart, onDemo, error }) {
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiBaseUrl, setAiBaseUrl] = useState(DEFAULT_AI_BASE_URL);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL);

  const drop = (event) => {
    event.preventDefault();
    setDragging(false);
    onFiles(event.dataTransfer.files);
  };

  const startDirect = () => {
    setAiApiKey('');
    setShowAiConfig(false);
    onStart({ processingMode: 'DIRECT' });
  };

  const startWithAi = (event) => {
    event.preventDefault();
    const config = {
      processingMode: 'AI',
      aiBaseUrl: aiBaseUrl.trim(),
      aiApiKey: aiApiKey.trim(),
      aiModel: aiModel.trim(),
    };
    onStart(config);
    setAiApiKey('');
  };

  return (
    <div className="upload-card">
      <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={drop}>
        <div className="upload-icon"><span>↗</span></div>
        <h2>拖入分子图片、PDF 或文件夹</h2>
        <p>选择文件后决定是否启用大模型视觉校验；交互演示不会上传文件。</p>
        <div className="upload-actions">
          <button className="primary-btn" onClick={() => fileInput.current?.click()}>选择文件</button>
          <button className="secondary-btn" onClick={() => folderInput.current?.click()}>选择文件夹</button>
        </div>
        <input ref={fileInput} hidden type="file" accept=".png,.jpg,.jpeg,.pdf" multiple onChange={(event) => onFiles(event.target.files)} />
        <input ref={folderInput} hidden type="file" accept=".png,.jpg,.jpeg,.pdf" multiple webkitdirectory="" onChange={(event) => onFiles(event.target.files)} />
      </div>

      {uploads.length > 0 && <div className="selected-processing">
        <div className="upload-selection">
          <div><strong>已选择 {uploads.length} 个文件</strong><span>{uploads.slice(0, 2).map((item) => item.name).join('、')}{uploads.length > 2 ? '…' : ''}</span></div>
        </div>
        <div className="processing-choice" aria-label="选择处理方式">
          <button className="processing-option direct-option" onClick={startDirect}>
            <span>直接识别并渲染</span>
            <small>MolScribe + RDKit，不调用大模型</small>
          </button>
          <button className={`processing-option ai-option ${showAiConfig ? 'active' : ''}`} onClick={() => setShowAiConfig((current) => !current)}>
            <span>使用大模型校验与纠正</span>
            <small>为本次任务临时提供 API 配置</small>
          </button>
        </div>

        {showAiConfig && <form className="ai-config-form" onSubmit={startWithAi}>
          <div className="ai-config-heading"><strong>本次任务的临时 AI 配置</strong><span>不会写入任务文件或浏览器存储</span></div>
          <label>
            <span>访问地址</span>
            <input type="url" value={aiBaseUrl} onChange={(event) => setAiBaseUrl(event.target.value)} placeholder="https://example.com/v1" required />
          </label>
          <label>
            <span>API Key</span>
            <input type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder="仅用于本次任务" autoComplete="off" required />
          </label>
          <label>
            <span>模型名称</span>
            <input type="text" value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="视觉模型名称" required />
          </label>
          <p>Key 提交后会从表单清空；本地后端仅在内存中保存到任务启动，执行结束立即删除。</p>
          <button className="primary-btn" type="submit">使用大模型开始处理 <span>→</span></button>
        </form>}
      </div>}
      {error && <div className="upload-error" role="alert">{error}</div>}
      <button className="demo-link" onClick={onDemo}>暂时没有文件？查看交互演示</button>
    </div>
  );
}
