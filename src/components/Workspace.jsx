import { useMemo, useState } from 'react';
import { resolveArtifactUrl } from '../api.js';

const STATUS_LABELS = {
  PROCESSING: '处理中', PASS: 'PASS', REVIEW: 'REVIEW', PROVISIONAL_PASS: '暂定通过', FAILED: '失败',
};

const JOB_STATUS_LABELS = {
  QUEUED: '任务排队中', PROCESSING: '后端正在处理', COMPLETED: '任务已完成',
  COMPLETED_WITH_ERRORS: '任务完成，部分样本失败', FAILED: '任务执行失败',
};

const CONNECTION_LABELS = {
  uploading: '正在上传', connecting: '正在连接进度流', live: '实时进度已连接',
  reconnecting: '进度流重连中', polling: '定时查询进度', complete: '处理已结束',
  demo: '浏览器演示数据', error: '后端连接失败',
};

function StatusBadge({ status = 'PROCESSING' }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

function formatEventTime(value) {
  if (!value || value === '刚刚') return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}

function MoleculeSketch({ sketch }) {
  if (!sketch) return <div className="pending-artifact"><span>⌁</span><p>结构渲染产物尚未生成</p></div>;
  const points = sketch.rings === 2
    ? '36,90 72,68 108,90 108,132 72,154 36,132 108,90 144,68 180,90 180,132 144,154 108,132'
    : '48,88 88,64 128,88 128,134 88,158 48,134 128,88 174,108';
  return <svg className="molecule-sketch" viewBox="0 0 220 210" role="img" aria-label="分子结构示意图">
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="36" cy="90" r="6" fill={sketch.accent} /><circle cx="180" cy="132" r="6" fill={sketch.accent} />
    <text x="72" y="58" fill={sketch.accent}>N</text><text x="183" y="96" fill={sketch.accent}>OH</text>
  </svg>;
}

function StructurePanel({ title, sample, original = false, mode }) {
  const resultUrl = sample.renderSvgUrl || sample.renderPngUrl;
  const imageUrl = original ? sample.previewUrl : resultUrl;
  const resolvedImageUrl = imageUrl ? resolveArtifactUrl(imageUrl) : null;
  const label = original ? '输入预览' : (sample.renderSvgUrl ? 'RDKit SVG' : sample.renderPngUrl ? 'RDKit PNG' : '等待产物');

  return <section className="structure-panel">
    <header><h3>{title}</h3><span>{label}</span></header>
    <div className="structure-canvas">
      {resolvedImageUrl
        ? <a className="artifact-image-link" href={resolvedImageUrl} target="_blank" rel="noreferrer" title="在新标签页查看完整图片">
          <img src={resolvedImageUrl} alt={`${sample.name} ${original ? '原始结构' : '最终渲染'}`} />
        </a>
        : original && sample.type === 'PDF'
          ? <div className="pdf-placeholder"><b>PDF</b><span>等待 Stage B 提取分子截图</span></div>
          : mode === 'demo'
            ? <MoleculeSketch sketch={sample.sketch} />
            : <div className="pending-artifact"><span>⌁</span><p>{original ? '输入预览准备中' : '结构渲染产物尚未生成'}</p></div>}
    </div>
  </section>;
}

function EmptyWorkspace({ job, connectionState, error, onBack }) {
  const progress = job?.progress ?? 0;
  const isPdfDiscovery = job?.totalSamples == null && job?.currentStage === 'input';
  return <main className="empty-workspace">
    <button className="back-button" onClick={onBack}>← 返回上传</button>
    <section>
      <div className={`empty-spinner ${error ? 'has-error' : ''}`}><span /></div>
      <span className="eyebrow">{error ? 'BACKEND ERROR' : 'JOB STARTED'}</span>
      <h1>{error ? '暂时无法继续处理' : isPdfDiscovery ? '正在从 PDF 发现分子图片' : '任务已提交，正在准备样本'}</h1>
      <p>{error || '后端会先保存输入并建立隔离任务目录；首个样本出现后，工作台会自动刷新。'}</p>
      <div className="empty-progress"><i style={{ width: `${progress}%` }} /></div>
      <div className="empty-meta">
        <span>{JOB_STATUS_LABELS[job?.status] || CONNECTION_LABELS[connectionState] || '准备连接'}</span>
        <strong>{progress}%</strong>
      </div>
      {error && <button className="secondary-btn" onClick={onBack}>返回并重新提交</button>}
    </section>
  </main>;
}

export default function Workspace({ samples, activeId, onSelect, running, onBack, job, mode, connectionState, error }) {
  const [tab, setTab] = useState('smiles');
  const sample = useMemo(() => samples.find((item) => item.id === activeId) || samples[0], [samples, activeId]);
  if (!sample) return <EmptyWorkspace job={job} connectionState={connectionState} error={error} onBack={onBack} />;

  const completed = job?.completedSamples ?? samples.filter((item) => item.status !== 'PROCESSING').length;
  const total = job?.totalSamples ?? samples.length;
  const value = tab === 'smiles' ? sample.smiles : sample.molfile;
  const reason = sample.reason || (sample.status === 'PROCESSING'
    ? '识别与校验仍在进行，结论会随后端事件自动更新。'
    : sample.status === 'FAILED'
      ? '该样本未能生成有效结构，请查看处理记录或后端日志。'
      : '后端没有提供额外说明。');

  return <main className="workspace">
    <aside className="sample-sidebar">
      <button className="back-button" onClick={onBack}>← 新建任务</button>
      <div className="batch-summary"><span>当前批次</span><strong>{completed} / {total}</strong><div><i style={{ width: `${job?.progress ?? (total ? completed / total * 100 : 0)}%` }} /></div></div>
      <div className={`connection-state connection-${connectionState}`}><span />{CONNECTION_LABELS[connectionState] || connectionState}</div>
      {mode === 'real' && <div className={`processing-mode-note mode-${job?.processingMode?.toLowerCase() || 'direct'}`}>
        {job?.processingMode === 'AI' ? 'AI 视觉校验与纠正' : '直接识别 · 未启用大模型'}
      </div>}
      <div className="sample-list">
        {samples.map((item, index) => <button key={item.id} className={item.id === sample.id ? 'active' : ''} onClick={() => onSelect(item.id)}>
          <span className="sample-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="sample-name"><strong>{item.name}</strong><small>{item.currentStage}</small></span>
          <StatusBadge status={item.status} />
        </button>)}
      </div>
    </aside>

    <section className="result-area">
      {error && <div className="workspace-error" role="alert">{error}</div>}
      <header className="result-header">
        <div><span className="eyebrow">SAMPLE RESULT</span><h1>{sample.name}</h1></div>
        <div className="header-status"><StatusBadge status={sample.status} /><span>{running ? `处理进度 ${sample.progress}%` : JOB_STATUS_LABELS[job?.status] || '批次处理已停止'}</span></div>
      </header>

      <div className="comparison-grid"><StructurePanel title="原始输入" sample={sample} original mode={mode} /><StructurePanel title="最终渲染" sample={sample} mode={mode} /></div>

      <section className="data-card">
        <div className="data-tabs"><button className={tab === 'smiles' ? 'active' : ''} onClick={() => setTab('smiles')}>SMILES</button><button className={tab === 'molfile' ? 'active' : ''} onClick={() => setTab('molfile')}>Molfile</button></div>
        <pre className={!value ? 'data-empty' : ''}>{value || `${tab === 'smiles' ? 'SMILES' : 'Molfile'} 尚未生成`}</pre>
        <button className="copy-button" disabled={!value} onClick={() => value && navigator.clipboard?.writeText(value)}>复制</button>
      </section>

      <section className="audit-card">
        <div><span className={`audit-dot audit-${sample.status.toLowerCase()}`} /><div><h3>{sample.status === 'REVIEW' ? '需要人工复核' : sample.status === 'FAILED' ? '样本处理失败' : sample.status === 'PROCESSING' ? '正在生成结论' : '校验结论'}</h3><p>{reason}</p></div></div>
        <ol>{(sample.events || []).slice(-5).map((event, index) => <li key={event.id || `${event.label}-${index}`}><span>{event.label}</span><time>{formatEventTime(event.time)}</time></li>)}</ol>
      </section>
    </section>
  </main>;
}
