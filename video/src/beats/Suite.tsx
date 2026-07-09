import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COL, EASE, rise } from '../theme';
import { Kicker, Stage, useU } from '../components';
import { SCRIPT, SUITE } from '../data';

const DUR = 240;

/* Beat 2 · The suite (~8s).
   One suite, PULSE leading it. PULSE lit and Live; STACK / ROUTE outlined
   and In design. Amber marks only the live product. */
export const Suite: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, width } = useU();
  const lit = interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

  return (
    <Stage dur={DUR} style={{ justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: u * 4.5, width: '100%', maxWidth: width * 0.82, margin: '0 auto', justifyContent: 'center', height: '100%' }}>
        {/* Header */}
        <div style={{ ...rise(frame, 8), display: 'flex', flexDirection: 'column', gap: u * 1.4 }}>
          <Kicker size={u * 1.55}>The suite</Kicker>
          <div style={{ fontSize: u * 5.4, fontWeight: 600, letterSpacing: '-0.02em', color: COL.onInk }}>
            {SCRIPT.suite.head}
          </div>
          <div style={{ fontSize: u * 2.3, fontWeight: 400, color: COL.onInk2, letterSpacing: '-0.005em' }}>
            {SCRIPT.suite.sub}
          </div>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: u * 1.6 }}>
          {SUITE.map((row, i) => {
            const live = row.live;
            return (
              <div
                key={row.name}
                style={{
                  ...rise(frame, 40 + i * 16),
                  display: 'flex',
                  alignItems: 'center',
                  gap: u * 2.4,
                  padding: `${u * 2.2}px ${u * 2.6}px`,
                  borderRadius: u * 1.4,
                  border: `1px solid ${live ? `rgba(244,192,49,${0.35 * lit})` : COL.hair}`,
                  background: live ? `rgba(244,192,49,${0.1 * lit})` : 'transparent',
                  borderLeft: live ? `${u * 0.5}px solid rgba(244,192,49,${0.6 * lit + 0.15})` : `1px solid ${COL.hair}`,
                }}
              >
                <span
                  style={{
                    width: u * 1.3,
                    height: u * 1.3,
                    borderRadius: '50%',
                    background: live ? COL.amber : COL.onInkFaint,
                    boxShadow: live ? `0 0 ${u * 1.6}px rgba(244,192,49,${0.7 * lit})` : 'none',
                    transform: live ? `scale(${0.7 + 0.3 * lit})` : 'none',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: u * 3, fontWeight: 600, letterSpacing: '0.01em', color: live ? COL.cream : COL.onInk, width: u * 12, flexShrink: 0 }}>
                  {row.name}
                </span>
                <span style={{ flex: 1, fontSize: u * 2, fontWeight: 400, color: COL.onInk2 }}>{row.desc}</span>
                <span
                  style={{
                    fontSize: u * 1.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: live ? COL.amber : COL.onInkFaint,
                    padding: `${u * 0.7}px ${u * 1.4}px`,
                    borderRadius: 999,
                    border: `1px solid ${live ? `rgba(244,192,49,${0.4 * lit})` : COL.hair}`,
                    background: live ? `rgba(244,192,49,${0.08 * lit})` : 'transparent',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {row.status}
                </span>
              </div>
            );
          })}

          <div style={{ ...rise(frame, 90), paddingLeft: u * 2.6, fontSize: u * 1.75, color: COL.onInkFaint, fontWeight: 400 }}>
            {SCRIPT.suite.more}
          </div>
        </div>
      </div>
    </Stage>
  );
};
