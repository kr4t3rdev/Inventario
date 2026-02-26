import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMemo } from 'react';

/**
 * @description Composición de animación 404 para la página de error
 * @returns {JSX.Element} Animación del robot 404
 */
export const NotFoundAnimation = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animación de rebote del robot
  const bounce = spring({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  // Animación de rotación sutil
  const rotate = interpolate(
    frame,
    [0, 30, 60, 90, 120],
    [0, 5, 0, -5, 0]
  );

  // Animación de escala
  const scale = interpolate(
    frame,
    [0, 30, 60, 90, 120],
    [0.8, 1, 0.9, 1, 0.95]
  );

  // Opacidad de entrada
  const opacity = interpolate(frame, [0, 20], [0, 1]);

  // Posición Y del robot
  const robotY = height / 2 - 150 + bounce * 30;

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      {/* Fondo con gradiente */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 50% 50%, #16213e 0%, #0f0f23 100%)',
        }}
      />

      {/* Robot 404 */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - 128,
          top: robotY,
          transform: `rotate(${rotate}deg) scale(${scale})`,
          opacity,
        }}
      >
        <Img
          src="/robot-404.png"
          style={{
            width: 256,
            height: 256,
          }}
        />
      </div>

      {/* Texto 404 */}
      <svg
        style={{
          position: 'absolute',
          left: width / 2 - 80,
          top: height / 2 + 80,
        }}
      >
        <text
          x="80"
          y="80"
          textAnchor="middle"
          fontSize="80"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="800"
          fill="#ffffff"
          style={{
            textShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
          }}
        >
          404
        </text>
      </svg>

      {/* Texto de error */}
      <svg
        style={{
          position: 'absolute',
          left: width / 2 - 80,
          top: height / 2 + 180,
        }}
      >
        <text
          x="80"
          y="24"
          textAnchor="middle"
          fontSize="24"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="500"
          fill="#94a3b8"
        >
          Page Not Found
        </text>
      </svg>

      {/* Partículas decorativas */}
      {useMemo(() => {
        return Array.from({ length: 20 }).map((_, i) => {
          const x = (Math.sin(frame * 0.02 + i) * 0.5 + 0.5) * width;
          const y = (Math.cos(frame * 0.03 + i * 0.5) * 0.5 + 0.5) * height;
          const particleOpacity = interpolate(
            frame,
            [0, 50, 100],
            [0.3, 0.8, 0.3]
          );

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: '#6366f1',
                opacity: particleOpacity,
              }}
            />
          );
        });
      }, [frame, width, height])}
    </AbsoluteFill>
  );
};
