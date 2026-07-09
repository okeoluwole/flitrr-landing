import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COL, EASE, fadeOut, rise, TNUM } from '../theme';
import { Kicker, PhotoBg, Stage, useU } from '../components';
import { SCRIPT, SIGNATURE } from '../data';

const DUR = 240;

/* Beat 1 · What Flitrr is (~8s).
   The discipline arrives; the 8-6-4 signature resolves. Four mandates named,
   8-6-4 held as the visual signature. Cream + ink only — amber rests here. */
export const Framework: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, width } = useU();

  const leadOp = Math.min(
    interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
    fadeOut(frame, 60, 74)
  );
  const leadY = interpolate(frame, [8, 22], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

  return (
    <Stage dur={DUR}>
      <PhotoBg src="images/hero-aerial-aylesbury-dusk.jpg" dur={DUR} darken={0.68} from={1.04} to={1.1} />

      {/* Phase A — the discipline line */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: u * 10,
          opacity: leadOp,
          transform: `translateY(${leadY}px)`,
        }}
      >
        <div style={{ maxWidth: width * 0.82, textAlign: 'center', fontSize: u * 5.6, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          Flitrr brings that <span style={{ color: COL.cream, fontWeight: 700 }}>discipline</span> to independent development.
        </div>
      </div>

      {/* Phase B — Built on the Flitrr Framework + 8-6-4 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: u * 5,
          padding: u * 8,
        }}
      >
        <div style={{ ...rise(frame, 76), textAlign: 'center', display: 'flex', flexDirection: 'column', gap: u * 1.6, alignItems: 'center' }}>
          <Kicker size={u * 1.6} color={COL.onInkFaint}>The 8&#8209;6&#8209;4 method</Kicker>
          <div style={{ fontSize: u * 4.4, fontWeight: 600, letterSpacing: '-0.02em', color: COL.onInk }}>
            {SCRIPT.framework.built}
          </div>
        </div>

        <div style={{ display: 'flex', gap: u * 4, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          {SIGNATURE.map((s, i) => (
            <div
              key={s.n}
              style={{
                ...rise(frame, 86 + i * 12),
                flex: '1 1 0',
                maxWidth: width * 0.26,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: u * 0.9,
              }}
            >
              <span style={{ ...TNUM, fontSize: u * 12, fontWeight: 600, lineHeight: 1, color: COL.cream }}>{s.n}</span>
              <span style={{ fontSize: u * 2.2, fontWeight: 600, color: COL.onInk, letterSpacing: '-0.01em' }}>{s.label}</span>
              <span style={{ fontSize: u * 1.55, fontWeight: 400, color: COL.onInk2, lineHeight: 1.35 }}>{s.gloss}</span>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
};
