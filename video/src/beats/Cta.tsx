import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { COL, EASE, fadeOut, rise } from '../theme';
import { PhotoBg, Stage, useU } from '../components';
import { SCRIPT } from '../data';

const DUR = 240;

/* Beat 4 · CTA (~8s).
   The design-partner ask, then everything clears to the wordmark and URL.
   Amber returns once, as the CTA — its third sanctioned meaning. */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, width } = useU();

  const aOp = Math.min(
    interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
    fadeOut(frame, 58, 72)
  );

  return (
    <Stage dur={DUR}>
      <PhotoBg src="images/lifecycle/cranes.jpg" dur={DUR} darken={0.72} from={1.05} to={1.12} />

      {/* Phase A — the ask */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: u * 2.6, padding: u * 10, opacity: aOp }}>
        <div style={{ maxWidth: width * 0.8, fontSize: u * 5, fontWeight: 500, lineHeight: 1.16, letterSpacing: '-0.02em', color: COL.onInk }}>
          {SCRIPT.cta.l1}
        </div>
        <div style={{ maxWidth: width * 0.72, fontSize: u * 2.5, fontWeight: 400, color: COL.onInk2 }}>
          {SCRIPT.cta.l2}
        </div>
      </div>

      {/* Phase B — the real wordmark, CTA, URL. Amber = the brand mark. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: u * 4 }}>
        <Img src={staticFile('brand/wordmark-tight.svg')} style={{ ...rise(frame, 80), width: u * 40, height: 'auto' }} />
        <div style={{ ...rise(frame, 104), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 1.3 }}>
          <span style={{ fontSize: u * 2.5, fontWeight: 600, color: COL.cream, letterSpacing: '-0.005em' }}>{SCRIPT.cta.action}</span>
          <span style={{ fontSize: u * 2, fontWeight: 500, color: COL.onInk2, letterSpacing: '0.04em' }}>{SCRIPT.cta.url}</span>
        </div>
      </div>
    </Stage>
  );
};
