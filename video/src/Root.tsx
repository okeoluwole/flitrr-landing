import React from 'react';
import { Composition } from 'remotion';
import { Marketing } from './Marketing';

// 30fps. Beats: 6 + 8 + 8 + 8 + 8 = 38s.
export const FPS = 30;
export const DURATION = 1140;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* LinkedIn-feed primary. */}
      <Composition
        id="Marketing-1x1"
        component={Marketing}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      {/* 16:9 master (YouTube / landscape / site embed). */}
      <Composition
        id="Marketing-16x9"
        component={Marketing}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 4:5 portrait — trivial add, same component. */}
      <Composition
        id="Marketing-4x5"
        component={Marketing}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1350}
      />
    </>
  );
};
