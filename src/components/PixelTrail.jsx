/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { shaderMaterial, useTrailTexture } from '@react-three/drei';
import * as THREE from 'three';

import './PixelTrail.css';

const GooeyFilter = ({ id = 'goo-filter', strength = 10 }) => {
  return (
    <svg className="goo-filter-container">
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={strength} result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
};

const DotMaterial = shaderMaterial(
  {
    resolution: new THREE.Vector2(),
    mouseTrail: null,
    gridSize: 100,
    pixelColor: new THREE.Color('#ffffff')
  },
  `
    varying vec2 vUv;
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  `
    uniform vec2 resolution;
    uniform sampler2D mouseTrail;
    uniform float gridSize;
    uniform vec3 pixelColor;

    vec2 coverUv(vec2 uv) {
      vec2 s = resolution.xy / max(resolution.x, resolution.y);
      vec2 newUv = (uv - 0.5) * s + 0.5;
      return clamp(newUv, 0.0, 1.0);
    }

    float sdfCircle(vec2 p, float r) {
        return length(p - 0.5) - r;
    }

    void main() {
      vec2 screenUv = gl_FragCoord.xy / resolution;
      vec2 uv = coverUv(screenUv);

      vec2 gridUv = fract(uv * gridSize);
      vec2 gridUvCenter = (floor(uv * gridSize) + 0.5) / gridSize;

      float trail = texture2D(mouseTrail, gridUvCenter).r;

      // premultiply color by alpha: canvas is premultipliedAlpha, so trail=0 must output (0,0,0,0) to be transparent
      gl_FragColor = vec4(pixelColor * trail, trail);
    }
  `
);

function Scene({ gridSize, trailSize, maxAge, interpolate, easingFunction, pixelColor }) {
  const size = useThree(s => s.size);
  const viewport = useThree(s => s.viewport);
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);

  const meshRef = useRef(null);
  // 独立的 raycast,避免和 r3f 事件系统共用一个 raycaster
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const dotMaterial = useMemo(() => new DotMaterial(), []);
  dotMaterial.uniforms.pixelColor.value = new THREE.Color(pixelColor);

  const [trail, onMove] = useTrailTexture({
    size: 512,
    radius: trailSize,
    maxAge: maxAge,
    interpolate: interpolate || 0.1,
    ease: easingFunction || (x => x)
  });

  if (trail) {
    trail.minFilter = THREE.NearestFilter;
    trail.magFilter = THREE.NearestFilter;
    trail.wrapS = THREE.ClampToEdgeWrapping;
    trail.wrapT = THREE.ClampToEdgeWrapping;
  }

  const scale = Math.max(viewport.width, viewport.height) / 2;

  // 画布设了 pointer-events:none(否则全屏 canvas 会拦截所有点击,盖住按钮),
  // 所以改在 window 上监听 pointermove,用射线求交把鼠标位置转成 uv 喂给拖尾纹理。
  useEffect(() => {
    const handle = (e) => {
      if (!meshRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      if (hits.length && hits[0].uv) {
        onMove({ uv: hits[0].uv });
      }
    };
    window.addEventListener('pointermove', handle);
    return () => window.removeEventListener('pointermove', handle);
  }, [onMove, raycaster, camera, gl]);

  return (
    <mesh ref={meshRef} scale={[scale, scale, 1]}>
      <planeGeometry args={[2, 2]} />
      <primitive
        object={dotMaterial}
        gridSize={gridSize}
        resolution={[size.width * viewport.dpr, size.height * viewport.dpr]}
        mouseTrail={trail}
      />
    </mesh>
  );
}

export default function PixelTrail({
  gridSize = 40,
  trailSize = 0.1,
  maxAge = 250,
  interpolate = 5,
  easingFunction = x => x,
  canvasProps = {},
  glProps = {
    antialias: false,
    powerPreference: 'high-performance',
    alpha: true
  },
  gooeyFilter,
  color = '#ffffff',
  className = ''
}) {
  return (
    <>
      {gooeyFilter && <GooeyFilter id={gooeyFilter.id} strength={gooeyFilter.strength} />}
      <Canvas
        {...canvasProps}
        gl={glProps}
        className={`pixel-canvas ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          // r3f 的 wrapper 默认内联 pointer-events:auto,会拦截所有点击(盖住按钮)。
          // 这里显式改成 none:canvas 层整体点击穿透,拖尾改由 window 级监听驱动。
          pointerEvents: 'none',
          ...(gooeyFilter ? { filter: `url(#${gooeyFilter.id})` } : {}),
        }}
      >
        <Scene
          gridSize={gridSize}
          trailSize={trailSize}
          maxAge={maxAge}
          interpolate={interpolate}
          easingFunction={easingFunction}
          pixelColor={color}
        />
      </Canvas>
    </>
  );
}
