import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ARCHIVO, COL, fadeIn, fadeOut } from './theme';

/** Layout unit: 1% of composition height, so 1:1 / 16:9 / 4:5 stay in sync. */
export const useU = () => {
  const { height, width } = useVideoConfig();
  return { u: height / 100, height, width, portrait: height > width };
};

/** A beat surface: ink ground, consistent padding, a clean top/tail dissolve. */
export const Stage: React.FC<{
  dur: number;
  pad?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ dur, pad, children, style }) => {
  const frame = useCurrentFrame();
  const { u } = useU();
  const opacity = Math.min(fadeIn(frame, 0, 8), fadeOut(frame, dur - 12, dur));
  return (
    <AbsoluteFill
      style={{
        fontFamily: ARCHIVO,
        color: COL.onInk,
        padding: pad ?? u * 9,
        opacity,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Full-bleed photograph under the same dusk grade the site uses. */
export const PhotoBg: React.FC<{
  src: string;
  dur: number;
  from?: number;
  to?: number;
  darken?: number;
}> = ({ src, dur, from = 1.06, to = 1.16, darken = 0 }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, dur], [from, to], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COL.gradeTop} 0%, rgba(11,20,30,0.40) 48%, ${COL.gradeBottom} 100%)`,
        }}
      />
      {darken > 0 ? <AbsoluteFill style={{ background: COL.ink950, opacity: darken }} /> : null}
    </AbsoluteFill>
  );
};

export const Wordmark: React.FC<{ size: number; color?: string }> = ({ size, color = COL.cream }) => (
  <span style={{ fontFamily: ARCHIVO, fontWeight: 600, fontSize: size, letterSpacing: '-0.02em', color }}>
    Flitrr
  </span>
);

export const Kicker: React.FC<{
  children: React.ReactNode;
  size: number;
  color?: string;
}> = ({ children, size, color = COL.onInkFaint }) => (
  <span
    style={{
      fontFamily: ARCHIVO,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.16em',
      fontSize: size,
      color,
    }}
  >
    {children}
  </span>
);

/** A faint amber hairline that drifts — the "cost line off baseline" motif. */
export const DriftLine: React.FC<{ dur: number; y: string; opacity?: number }> = ({
  dur,
  y,
  opacity = 0.22,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, dur], [-6, 6], { extrapolateRight: 'clamp' });
  const rot = interpolate(frame, [0, dur], [-1.4, -3.2], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        top: y,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COL.amber}, transparent)`,
        opacity,
        transform: `translateX(${x}%) rotate(${rot}deg)`,
      }}
    />
  );
};
