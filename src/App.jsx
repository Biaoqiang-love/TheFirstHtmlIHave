import { useEffect, useRef, useState } from 'react';
import Aurora from './components/Aurora.jsx';
import DecryptedText from './components/DecryptedText.jsx';
import PixelTrail from './components/PixelTrail.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import Workspace from './components/Workspace.jsx';
import { buildMockSamples, MOCK_PIPELINE_STAGES } from './mockPipeline.js';

function revokePreviews(items) {
  items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
}

export default function App() {
  const [view, setView] = useState('home');
  const [uploads, setUploads] = useState([]);
  const [samples, setSamples] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [running, setRunning] = useState(false);
  const runToken = useRef(0);

  useEffect(() => () => revokePreviews(uploads), [uploads]);

  const receiveFiles = (files) => {
    const accepted = [...files].filter((file) => /\.(png|jpe?g|pdf)$/i.test(file.name));
    revokePreviews(uploads);
    setUploads(accepted.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      name: file.webkitRelativePath || file.name,
      type: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'PNG',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    })));
  };

  const startJob = (useDemo = false) => {
    if (!useDemo && uploads.length === 0) return;
    const token = ++runToken.current;
    const next = buildMockSamples(useDemo ? [] : uploads, useDemo);
    setSamples(next);
    setActiveId(next[0]?.id ?? null);
    setRunning(true);
    setView('workspace');
    window.location.hash = 'workspace';

    MOCK_PIPELINE_STAGES.forEach((stage, stageIndex) => {
      window.setTimeout(() => {
        if (runToken.current !== token) return;
        setSamples((current) => current.map((sample, sampleIndex) => {
          if (sampleIndex > stageIndex || sample.status === 'PASS') return sample;
          return {
            ...sample,
            currentStage: stage.key,
            progress: Math.min(100, (stageIndex + 1) * 20 + sampleIndex * 8),
            events: [...sample.events, { label: stage.label, time: '刚刚' }],
            status: stageIndex === MOCK_PIPELINE_STAGES.length - 1
              ? (sampleIndex % 4 === 3 ? 'REVIEW' : sampleIndex % 5 === 4 ? 'PROVISIONAL_PASS' : 'PASS')
              : 'PROCESSING',
          };
        }));
        if (stageIndex === MOCK_PIPELINE_STAGES.length - 1) setRunning(false);
      }, 650 * (stageIndex + 1));
    });
  };

  const goHome = () => {
    runToken.current += 1;
    setRunning(false);
    setView('home');
    window.location.hash = '';
  };

  return (
    <div className="app-shell">
      <div className="ambient"><Aurora colorStops={['#0ed4a8', '#2478ff', '#7657ff']} amplitude={1} blend={0.6} /></div>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="返回首页"><span className="brand-mark" /><span>MolWeave</span></button>
        <nav><a href="#workflow">工作流</a><a href="#about">关于项目</a><span className="prototype-pill">前端原型</span></nav>
      </header>

      {view === 'home' ? (
        <main className="landing">
          <section className="hero">
            <div className="eyebrow">PNG / PDF → Molecular Structure</div>
            <h1>
              {/* 乱码动效参数:
                  speed           乱码跳动频率(每帧间隔 ms;100 = 比默认 50 慢一半)
                  maxIterations   乱码滚动帧数(滚动结束后进入逐字揭晓)
                  revealInterval  逐字揭晓间隔 ms;每个字落定后 ≤ 该时长出现下一个字 */}
              <DecryptedText
                text="让化学结构识别过程真正可见"
                animateOn="view"
                speed={100}
                maxIterations={10}
                revealInterval={10}
              />
            </h1>
            <p>上传分子结构图片或 PDF，逐步查看 MolScribe 识别、SMILES、Molfile、RDKit 渲染和视觉校验结果。</p>
            <UploadPanel uploads={uploads} onFiles={receiveFiles} onStart={() => startJob(false)} onDemo={() => startJob(true)} />
            <div className="trust-row"><span>支持 PNG / JPG / PDF</span><span>支持文件夹批处理</span><span>逐样本展示 PASS / REVIEW</span></div>
          </section>

          <section id="workflow" className="workflow-section">
            <div className="section-heading"><span>WORKFLOW</span><h2>不是黑盒，而是一条可检查的处理链</h2></div>
            <div className="workflow-grid">
              {[
                ['01', '输入解析', '识别单图、图片文件夹或 PDF，并建立待处理样本。'],
                ['02', '结构识别', 'MolScribe 输出初始 SMILES 与 Molfile。'],
                ['03', '图差异修正', '原图与 RDKit 渲染图对齐，生成并验证 Graph Patch。'],
                ['04', '结果交付', '输出最终结构、状态、原因和可追溯处理记录。'],
              ].map(([n, title, description]) => <article key={n}><b>{n}</b><h3>{title}</h3><p>{description}</p></article>)}
            </div>
          </section>

          <section id="about" className="about-card">
            <div><span className="eyebrow">CURRENT SCOPE</span><h2>页面已经能演示完整交互，后端仍待接入</h2></div>
            <p>当前版本在浏览器内完成文件选择、预览和流程模拟，不会把文件上传到服务器。下一步通过 API 连接 pb_3 的 Stage B PDF 截图与 Stage A PNG→SMILES 管线。</p>
          </section>
          <PixelTrail gridSize={48} trailSize={0.08} maxAge={280} interpolate={3} color="#38e0bc" gooeyFilter={{ id: 'mol-goo', strength: 2 }} />
        </main>
      ) : <Workspace samples={samples} activeId={activeId} onSelect={setActiveId} running={running} onBack={goHome} />}
    </div>
  );
}
