import { useMemo, useState } from 'react';

function StatusBadge({ status }) {
  const labels = { PROCESSING: '处理中', PASS: 'PASS', REVIEW: 'REVIEW', PROVISIONAL_PASS: '暂定通过' };
  return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status] || status}</span>;
}

function MoleculeSketch({ sketch }) {
  const points = sketch.rings === 2
    ? '36,90 72,68 108,90 108,132 72,154 36,132 108,90 144,68 180,90 180,132 144,154 108,132'
    : '48,88 88,64 128,88 128,134 88,158 48,134 128,88 174,108';
  return <svg className="molecule-sketch" viewBox="0 0 220 210" role="img" aria-label="分子结构示意图">
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="36" cy="90" r="6" fill={sketch.accent} /><circle cx="180" cy="132" r="6" fill={sketch.accent} />
    <text x="72" y="58" fill={sketch.accent}>N</text><text x="183" y="96" fill={sketch.accent}>OH</text>
  </svg>;
}

function StructurePanel({ title, sample, original = false }) {
  return <section className="structure-panel">
    <header><h3>{title}</h3>{!original && <span>RDKit SVG</span>}</header>
    <div className="structure-canvas">
      {original && sample.previewUrl
        ? <img src={sample.previewUrl} alt={`${sample.name} 原始结构`} />
        : original && sample.type === 'PDF'
          ? <div className="pdf-placeholder"><b>PDF</b><span>后端接入后显示 Stage B 截图</span></div>
          : <MoleculeSketch sketch={sample.sketch} />}
    </div>
  </section>;
}

export default function Workspace({ samples, activeId, onSelect, running, onBack }) {
  const [tab, setTab] = useState('smiles');
  const sample = useMemo(() => samples.find((item) => item.id === activeId) || samples[0], [samples, activeId]);
  if (!sample) return null;
  const done = samples.filter((item) => item.status !== 'PROCESSING').length;

  return <main className="workspace">
    <aside className="sample-sidebar">
      <button className="back-button" onClick={onBack}>← 新建任务</button>
      <div className="batch-summary"><span>当前批次</span><strong>{done} / {samples.length}</strong><div><i style={{ width: `${samples.length ? done / samples.length * 100 : 0}%` }} /></div></div>
      <div className="sample-list">
        {samples.map((item, index) => <button key={item.id} className={item.id === sample.id ? 'active' : ''} onClick={() => onSelect(item.id)}>
          <span className="sample-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="sample-name"><strong>{item.name}</strong><small>{item.currentStage}</small></span>
          <StatusBadge status={item.status} />
        </button>)}
      </div>
    </aside>

    <section className="result-area">
      <header className="result-header">
        <div><span className="eyebrow">SAMPLE RESULT</span><h1>{sample.name}</h1></div>
        <div className="header-status"><StatusBadge status={sample.status} /><span>{running ? `处理进度 ${sample.progress}%` : '批次处理已停止'}</span></div>
      </header>

      <div className="comparison-grid"><StructurePanel title="原始输入" sample={sample} original /><StructurePanel title="最终渲染" sample={sample} /></div>

      <section className="data-card">
        <div className="data-tabs"><button className={tab === 'smiles' ? 'active' : ''} onClick={() => setTab('smiles')}>SMILES</button><button className={tab === 'molfile' ? 'active' : ''} onClick={() => setTab('molfile')}>Molfile</button></div>
        <pre>{tab === 'smiles' ? sample.smiles : sample.molfile}</pre>
        <button className="copy-button" onClick={() => navigator.clipboard?.writeText(tab === 'smiles' ? sample.smiles : sample.molfile)}>复制</button>
      </section>

      <section className="audit-card">
        <div><span className="audit-dot" /><div><h3>{sample.status === 'REVIEW' ? '需要人工复核' : '校验结论'}</h3><p>{sample.reason}</p></div></div>
        <ol>{sample.events.slice(-5).map((event, index) => <li key={`${event.label}-${index}`}><span>{event.label}</span><time>{event.time}</time></li>)}</ol>
      </section>
    </section>
  </main>;
}
