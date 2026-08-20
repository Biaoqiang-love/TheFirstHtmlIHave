import { useEffect, useRef, useState } from 'react';
import Aurora from './components/Aurora.jsx';
import DecryptedText from './components/DecryptedText.jsx';
import PixelTrail from './components/PixelTrail.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import Workspace from './components/Workspace.jsx';
import { buildMockSamples, MOCK_PIPELINE_STAGES } from './mockPipeline.js';
import {
  createJob,
  getJob,
  getSamples,
  isTerminalJob,
  openJobEvents,
} from './api.js';

function revokePreviews(items) {
  items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
}

export default function App() {
  const [view, setView] = useState('home');
  const [uploads, setUploads] = useState([]);
  const [samples, setSamples] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [job, setJob] = useState(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [apiError, setApiError] = useState(null);
  const runToken = useRef(0);
  const eventSource = useRef(null);
  const pollTimer = useRef(null);

  useEffect(() => () => revokePreviews(uploads), [uploads]);
  useEffect(() => () => {
    runToken.current += 1;
    eventSource.current?.close();
    if (pollTimer.current) window.clearInterval(pollTimer.current);
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = null;
  };

  const stopTransport = () => {
    eventSource.current?.close();
    eventSource.current = null;
    stopPolling();
  };

  const replaceSamples = (next) => {
    const ordered = [...next].sort((left, right) => left.index - right.index);
    setSamples(ordered);
    setActiveId((current) => (
      ordered.some((item) => item.id === current) ? current : ordered[0]?.id ?? null
    ));
  };

  const upsertSample = (nextSample) => {
    setSamples((current) => {
      const exists = current.some((item) => item.id === nextSample.id);
      const next = exists
        ? current.map((item) => (item.id === nextSample.id ? nextSample : item))
        : [...current, nextSample];
      return next.sort((left, right) => left.index - right.index);
    });
    setActiveId((current) => current || nextSample.id);
  };

  const refreshRealJob = async (jobId, token) => {
    const nextJob = await getJob(jobId);
    const collection = await getSamples(nextJob);
    if (runToken.current !== token) return nextJob;
    setJob(nextJob);
    replaceSamples(collection.samples);
    setRunning(!isTerminalJob(nextJob));
    return nextJob;
  };

  const startPolling = (jobId, token) => {
    if (pollTimer.current) return;
    const poll = async () => {
      try {
        const nextJob = await refreshRealJob(jobId, token);
        if (runToken.current !== token) return;
        setConnectionState('polling');
        if (isTerminalJob(nextJob)) {
          stopTransport();
          setConnectionState('complete');
        }
      } catch (error) {
        if (runToken.current === token) setApiError(error.message);
      }
    };
    poll();
    pollTimer.current = window.setInterval(poll, 3000);
  };

  const connectToEvents = (createdJob, token) => {
    let finished = false;
    const finish = async (eventJob) => {
      if (finished || runToken.current !== token) return;
      finished = true;
      setJob(eventJob);
      setRunning(false);
      stopTransport();
      try {
        await refreshRealJob(eventJob.id, token);
      } catch (error) {
        if (runToken.current === token) setApiError(error.message);
      }
      if (runToken.current === token) setConnectionState('complete');
    };

    eventSource.current = openJobEvents(createdJob, {
      onOpen: () => {
        if (runToken.current !== token || finished) return;
        stopPolling();
        setConnectionState('live');
      },
      onEvent: (eventName, payload) => {
        if (runToken.current !== token) return;
        if (payload.sample) upsertSample(payload.sample);
        if (payload.job) {
          setJob(payload.job);
          setRunning(!isTerminalJob(payload.job));
          if (isTerminalJob(payload.job)) {
            finish(payload.job);
            return;
          }
        }
        if (eventName === 'stream.reset') {
          refreshRealJob(createdJob.id, token).catch((error) => setApiError(error.message));
        }
        if ((eventName === 'job.completed' || eventName === 'job.failed') && payload.job) {
          finish(payload.job);
        }
      },
      onMalformedEvent: () => {
        setApiError('收到无法解析的进度事件，已改用定时查询。');
        eventSource.current?.close();
        eventSource.current = null;
        startPolling(createdJob.id, token);
      },
      onError: () => {
        if (runToken.current !== token || finished) return;
        setConnectionState('reconnecting');
        startPolling(createdJob.id, token);
      },
    });
  };

  const receiveFiles = (files) => {
    const accepted = [...files].filter((file) => /\.(png|jpe?g|pdf)$/i.test(file.name));
    revokePreviews(uploads);
    setApiError(null);
    setUploads(accepted.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      name: file.webkitRelativePath || file.name,
      type: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'PNG',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    })));
  };

  const startRealJob = async (runtimeConfig = { processingMode: 'DIRECT' }) => {
    if (uploads.length === 0) return;
    const token = ++runToken.current;
    stopTransport();
    setMode('real');
    setJob(null);
    setSamples([]);
    setActiveId(null);
    setApiError(null);
    setConnectionState('uploading');
    setRunning(true);
    setView('workspace');
    window.location.hash = 'workspace';

    try {
      const createdJob = await createJob(uploads, runtimeConfig);
      if (runToken.current !== token) return;
      setJob(createdJob);
      setConnectionState('connecting');
      const collection = await getSamples(createdJob);
      if (runToken.current !== token) return;
      replaceSamples(collection.samples);
      connectToEvents(createdJob, token);
    } catch (error) {
      if (runToken.current !== token) return;
      setApiError(error.message);
      setConnectionState('error');
      setRunning(false);
    }
  };

  const startDemo = () => {
    const token = ++runToken.current;
    stopTransport();
    const next = buildMockSamples([], true);
    const now = new Date().toISOString();
    setMode('demo');
    setApiError(null);
    setConnectionState('demo');
    setSamples(next);
    setActiveId(next[0]?.id ?? null);
    setJob({
      id: 'demo-job',
      status: 'PROCESSING',
      progress: 4,
      currentStage: 'input',
      totalSamples: next.length,
      completedSamples: 0,
      createdAt: now,
      updatedAt: now,
    });
    setRunning(true);
    setView('workspace');
    window.location.hash = 'workspace';

    MOCK_PIPELINE_STAGES.forEach((stage, stageIndex) => {
      window.setTimeout(() => {
        if (runToken.current !== token) return;
        setSamples((current) => current.map((sample, sampleIndex) => {
          if (sampleIndex > stageIndex || sample.status !== 'PROCESSING') return sample;
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
        setJob((current) => ({
          ...current,
          status: stageIndex === MOCK_PIPELINE_STAGES.length - 1 ? 'COMPLETED' : 'PROCESSING',
          progress: (stageIndex + 1) * 20,
          currentStage: stage.key,
          completedSamples: stageIndex === MOCK_PIPELINE_STAGES.length - 1 ? next.length : 0,
          updatedAt: new Date().toISOString(),
        }));
        if (stageIndex === MOCK_PIPELINE_STAGES.length - 1) {
          setRunning(false);
          setConnectionState('complete');
        }
      }, 650 * (stageIndex + 1));
    });
  };

  const goHome = () => {
    runToken.current += 1;
    stopTransport();
    setRunning(false);
    setApiError(null);
    setConnectionState('idle');
    setMode(null);
    setJob(null);
    setSamples([]);
    setActiveId(null);
    setView('home');
    window.location.hash = '';
  };

  return (
    <div className="app-shell">
      <div className="ambient"><Aurora colorStops={['#0ed4a8', '#2478ff', '#7657ff']} amplitude={1} blend={0.6} /></div>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="返回首页"><span className="brand-mark" /><span>MolWeave</span></button>
        <nav><a href="#workflow">工作流</a><a href="#about">关于项目</a><span className="prototype-pill">{mode === 'real' ? `本地后端 · ${job?.processingMode === 'AI' ? 'AI 校验' : '直接识别'}` : mode === 'demo' ? '演示模式' : '本地联调版'}</span></nav>
      </header>

      {view === 'home' ? (
        <main className="landing">
          <section className="hero">
            <div className="eyebrow">PNG / PDF → Molecular Structure</div>
            <h1>
              {/* 乱码动效参数:
                  speed           未落定字符的乱码跳动频率(每帧间隔 ms;80 = 比 50 慢一点)
                  revealInterval  逐字落定间隔 ms;每个字落定后经过该时长出现下一个字 */}
              <DecryptedText
                text="让化学结构识别过程真正可见"
                animateOn="view"
                speed={80}
                revealInterval={80}
              />
            </h1>
            <p>上传分子结构图片或 PDF，逐步查看 MolScribe 识别、SMILES、Molfile、RDKit 渲染和视觉校验结果。</p>
            <UploadPanel uploads={uploads} onFiles={receiveFiles} onStart={startRealJob} onDemo={startDemo} error={apiError} />
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
            <div><span className="eyebrow">CURRENT SCOPE</span><h2>本地前后端已经接通，同时保留无后端演示</h2></div>
            <p>文件可直接使用 MolScribe 与 RDKit 识别渲染，也可为单次任务临时提供兼容 API 配置，启用大模型视觉校验与纠正；临时 Key 不会保存到任务文件。“交互演示”继续使用浏览器 mock。</p>
          </section>
          <PixelTrail gridSize={48} trailSize={0.08} maxAge={280} interpolate={3} color="#38e0bc" gooeyFilter={{ id: 'mol-goo', strength: 2 }} />
        </main>
      ) : <Workspace
        samples={samples}
        activeId={activeId}
        onSelect={setActiveId}
        running={running}
        onBack={goHome}
        job={job}
        mode={mode}
        connectionState={connectionState}
        error={apiError}
      />}
    </div>
  );
}
