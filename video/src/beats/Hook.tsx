import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COL, rise } from '../theme';
import { DriftLine, PhotoBg, Stage, useU } from '../components';
import { SCRIPT } from '../data';

const DUR = 180;

/* Beat 0 · Hook (~6s).
   Ink field, a scheme in the dusk. The infrastructure gap, stated plainly.
   Amber shows only as one drifting line — the thing that matters, adrift. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, width } = useU();
  const [l1, l2] = SCRIPT.hook;

  return (
    <Stage dur={DUR} pad={u * 8.5}>
      <PhotoBg src="images/hero-crane-dusk.jpg" dur={DUR} darken={0.32} />
      <DriftLine dur={DUR} y="30%" />

      <div
        style={{
          position: 'absolute',
          inset: `auto ${u * 8.5}px ${u * 12}px ${u * 8.5}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: u * 3.2,
          maxWidth: width * 0.84,
        }}
      >
        <div
          style={{
            ...rise(frame, 10),
            fontSize: u * 5.4,
            fontWeight: 500,
            lineHeight: 1.16,
            letterSpacing: '-0.018em',
            color: COL.onInk,
          }}
        >
          {l1}
        </div>
        <div
          style={{
            ...rise(frame, 74),
            fontSize: u * 5.4,
            fontWeight: 500,
            lineHeight: 1.16,
            letterSpacing: '-0.018em',
            color: COL.onInk2,
          }}
        >
          Independent developers carry the same risk —{' '}
          <span style={{ color: COL.cream, fontWeight: 700 }}>with none of the infrastructure.</span>
        </div>
      </div>
    </Stage>
  );
};
