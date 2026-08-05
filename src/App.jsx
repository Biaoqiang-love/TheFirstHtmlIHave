import Aurora from './components/Aurora.jsx';
import DecryptedText from './components/DecryptedText.jsx';
import PixelTrail from './components/PixelTrail.jsx';

export default function App() {
  return (
    <>
      {/* 全屏极光背景 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Aurora colorStops={['#5227FF', '#7cff67', '#5227FF']} amplitude={1.0} blend={0.5} />
      </div>

      {/* 前景内容 */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 900,
          padding: 40,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(30px, 6vw, 64px)',
            lineHeight: 1.35,
            margin: '0 0 24px',
            fontWeight: 800,
            color: '#ffffff',
            textShadow: '0 2px 24px rgba(0,0,0,0.45)',
          }}
        >
          <DecryptedText
            text="React Bits 文字动画 · DecryptedText"
            animateOn="view"
            sequential
            revealDirection="start"
            speed={60}
            maxIterations={20}
          />
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 'clamp(14px, 2.5vw, 18px)',
            textShadow: '0 1px 12px rgba(0,0,0,0.5)',
          }}
        >
          进入页面:标题从乱码「解密」成文字。
          <br />
          移动鼠标:像素拖尾会跟随你。
        </p>
      </main>

      {/* 鼠标像素拖尾 */}
      <PixelTrail
        gridSize={50}
        trailSize={0.35}
        maxAge={180}
        color="#8be9ff"
        canvasProps={{ style: { position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'auto' } }}
      />
    </>
  );
}
