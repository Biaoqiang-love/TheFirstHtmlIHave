import BlurText from './components/BlurText.jsx';

export default function App() {
  return (
    <main style={{ maxWidth: 900, padding: 40 }}>
      <h1 style={{ fontSize: 'clamp(30px, 6vw, 64px)', lineHeight: 1.35, textAlign: 'center', margin: '0 0 24px' }}>
        <BlurText
          text="React Bits 文字动画 · BlurText"
          delay={120}
          animateBy="words"
          direction="top"
        />
      </h1>
      <p style={{ textAlign: 'center', color: '#8b93a7', fontSize: 'clamp(14px, 2.5vw, 18px)' }}>
        刷新页面:每个词会从上方模糊浮现。
        <br />
        组件来源:react-bits / TextAnimations / BlurText
      </p>
    </main>
  );
}
