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
            className="decrypted-clear"
            encryptedClassName="decrypted-glitch"
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

        {/* 跳转按钮:点击打开抖音(新标签页) */}
        <a
          href="https://www.douyin.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            position: 'relative',
            zIndex: 3,
            marginTop: 32,
            padding: '14px 36px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #25f4ee, #fe2c55)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 'clamp(15px, 2vw, 18px)',
            textDecoration: 'none',
            letterSpacing: 1,
            boxShadow: '0 8px 28px rgba(254, 44, 85, 0.35)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 14px 40px rgba(254, 44, 85, 0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(254, 44, 85, 0.35)';
          }}
        >
          🎵 打开抖音
        </a>
      </main>

      {/* 鼠标像素拖尾:包一层 fixed 容器固定铺满视口(避免 canvas 退化为文档流元素,导致滚动时露出青色色块) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2 }}>
        <PixelTrail gridSize={50} trailSize={0.05} maxAge={180} color="#8be9ff" />
      </div>
    </>
  );
}
