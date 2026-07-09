import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COL, countUp, EASE, fadeIn, rise, SHADOW_INK, TNUM } from '../theme';
import { Kicker, Stage, useU } from '../components';
import { GATES, NOW_STAGE, OBJ, PROJECT, SCRIPT, SPARK_PTS } from '../data';

const DUR = 240;

// The spark path, built exactly as the live instrument builds it.
function buildSpark() {
  const w = 320, h = 46, n = SPARK_PTS.length, min = 60, max = 90;
  const xs = (i: number) => (i / (n - 1)) * w;
  const ys = (v: number) => h - ((v - min) / (max - min)) * (h - 6) - 3;
  let d = `M${xs(0)},${ys(SPARK_PTS[0])}`;
  for (let i = 1; i < n; i++) {
    const xc = (xs(i - 1) + xs(i)) / 2;
    d += ` C${xc},${ys(SPARK_PTS[i - 1])} ${xc},${ys(SPARK_PTS[i])} ${xs(i)},${ys(SPARK_PTS[i])}`;
  }
  return { d, w, h, ex: xs(n - 1), ey: ys(SPARK_PTS[n - 1]) };
}
const SPARK = buildSpark();

const CAP_WINDOWS: [number, number][] = [
  [14, 62],
  [64, 112],
  [114, 168],
  [170, 236],
];

export const Pulse: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, width } = useU();
  const card = Math.min(width * 0.9, u * 66);

  // Reveal order tracks the captions: objectives → confidence → the one that
  // needs you → gated. Caption windows are in CAP_WINDOWS.
  const conf = countUp(frame, 64, 30, PROJECT.confidence);
  const metricOp = fadeIn(frame, 58, 12);
  const draw = interpolate(frame, [70, 112], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
  const costLit = interpolate(frame, [118, 134], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
  const gateDraw = interpolate(frame, [172, 214], [0, 8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Stage dur={DUR} pad={u * 5}>
      {/* Kicker */}
      <div style={{ position: 'absolute', top: u * 6, left: 0, right: 0, textAlign: 'center', ...rise(frame, 4) }}>
        <Kicker size={u * 1.7} color={COL.amber}>{SCRIPT.pulse.kicker}</Kicker>
      </div>

      {/* The instrument card */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            ...rise(frame, 6),
            width: card,
            background: COL.ink800,
            border: `1px solid ${COL.hair}`,
            borderRadius: u * 2,
            boxShadow: SHADOW_INK,
            padding: u * 3,
            display: 'flex',
            flexDirection: 'column',
            gap: u * 2.2,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: u * 0.4 }}>
              <span style={{ fontSize: u * 2.4, fontWeight: 600, color: COL.cream, letterSpacing: '-0.01em' }}>{PROJECT.name}</span>
              <span style={{ fontSize: u * 1.4, fontWeight: 400, color: COL.onInk2 }}>{PROJECT.meta}</span>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: u * 0.8, fontSize: u * 1.4, color: COL.onInkFaint, fontWeight: 500 }}>
              <span style={{ width: u * 0.9, height: u * 0.9, borderRadius: '50%', background: COL.amber }} /> Monitoring
            </span>
          </div>

          <div style={{ height: 1, background: COL.hair }} />

          {/* Metric */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: u * 0.8 }}>
            <span style={{ fontSize: u * 1.3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: COL.onInkFaint }}>
              Programme confidence
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: u * 1.4, opacity: metricOp }}>
              <span style={{ ...TNUM, fontSize: u * 8.4, fontWeight: 600, lineHeight: 1, color: COL.cream }}>{conf}</span>
              <span style={{ fontSize: u * 3, fontWeight: 500, color: COL.onInk2 }}>%</span>
              <span style={{ fontSize: u * 1.5, fontWeight: 400, color: COL.onInk2, marginLeft: 'auto' }}>{PROJECT.delta}</span>
            </div>
            {/* Spark */}
            <svg viewBox={`0 0 ${SPARK.w} ${SPARK.h}`} preserveAspectRatio="none" style={{ width: '100%', height: u * 5, marginTop: u * 0.6 }}>
              <defs>
                <linearGradient id="pulsesg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={COL.amber} stopOpacity="0.34" />
                  <stop offset="1" stopColor={COL.amber} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${SPARK.d} L${SPARK.w},${SPARK.h} L0,${SPARK.h} Z`} fill="url(#pulsesg)" opacity={fadeIn(frame, 84, 24) * 0.9} />
              <path d={SPARK.d} fill="none" stroke={COL.amber} strokeWidth={2} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <circle cx={SPARK.ex} cy={SPARK.ey} r={3} fill={COL.amber} opacity={draw > 0.98 ? 1 : 0} />
            </svg>
          </div>

          {/* Objectives */}
          <div style={{ display: 'flex', gap: u * 1, flexWrap: 'nowrap' }}>
            {OBJ.map((o, i) => {
              const isCost = i === 1;
              const on = rise(frame, 14 + i * 5);
              const amber = isCost ? costLit : 0;
              return (
                <div
                  key={o.k}
                  style={{
                    ...on,
                    flex: '1 1 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: u * 0.7,
                    padding: `${u * 0.9}px ${u * 1}px`,
                    borderRadius: u * 0.9,
                    border: `1px solid ${isCost && amber > 0.02 ? `rgba(244,192,49,${0.2 + 0.4 * amber})` : COL.hair}`,
                    background: isCost && amber > 0.02 ? `rgba(244,192,49,${0.1 * amber})` : COL.ink900,
                  }}
                >
                  <span
                    style={{
                      width: u * 0.9,
                      height: u * 0.9,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: o.prot ? (isCost && amber > 0.4 ? COL.amber : COL.onInk2) : 'transparent',
                      border: o.prot ? 'none' : `1.5px solid ${COL.onInkFaint}`,
                    }}
                  />
                  <span style={{ fontSize: u * 1.45, fontWeight: 500, color: isCost && amber > 0.4 ? COL.amber : COL.onInk }}>{o.k}</span>
                </div>
              );
            })}
          </div>

          {/* Signal — the one thing that needs you */}
          <div
            style={{
              ...rise(frame, 118),
              display: 'flex',
              alignItems: 'center',
              gap: u * 1.4,
              padding: `${u * 1.5}px ${u * 1.8}px`,
              borderRadius: u * 1.1,
              borderLeft: `${u * 0.4}px solid ${COL.amber}`,
              border: `1px solid ${COL.critBorder}`,
              background: COL.amberWash,
            }}
          >
            <span style={{ fontSize: u * 1.35, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: COL.amber, whiteSpace: 'nowrap' }}>
              Needs you
            </span>
            <span style={{ fontSize: u * 1.55, fontWeight: 400, color: COL.onInk, lineHeight: 1.3 }}>{OBJ[1].needs}</span>
          </div>

          {/* Gate timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: u * 1 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {Array.from({ length: 8 }, (_, idx) => {
                const t = idx + 1;
                const shown = gateDraw >= t;
                const done = t < NOW_STAGE;
                const now = t === NOW_STAGE;
                const gate = GATES[t];
                const nodeColor = shown ? (done || now || gate ? COL.amber : COL.onInkFaint) : COL.hair;
                return (
                  <React.Fragment key={t}>
                    <span
                      style={{
                        width: gate ? u * 1.5 : u * 1.1,
                        height: gate ? u * 1.5 : u * 1.1,
                        transform: gate ? 'rotate(45deg)' : 'none',
                        borderRadius: gate ? u * 0.3 : '50%',
                        background: now ? 'transparent' : nodeColor,
                        border: now ? `${u * 0.35}px solid ${COL.amber}` : 'none',
                        flexShrink: 0,
                        opacity: shown ? 1 : 0.4,
                      }}
                    />
                    {t < 8 ? (
                      <span style={{ flex: 1, height: 2, background: gateDraw > t ? COL.amber : COL.hair, opacity: gateDraw > t ? 0.55 : 1 }} />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: u * 1.15, color: COL.onInkFaint, fontWeight: 500 }}>
              <span>Land</span>
              <span>Construction</span>
              <span>Disposal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rotating capability caption */}
      <Caption frame={frame} u={u} />
    </Stage>
  );
};

const Caption: React.FC<{ frame: number; u: number }> = ({ frame, u }) => {
  const caps = SCRIPT.pulse.captions;
  return (
    <div style={{ position: 'absolute', bottom: u * 5, left: 0, right: 0, textAlign: 'center', height: u * 4 }}>
      {caps.map((c, i) => {
        const [s, e] = CAP_WINDOWS[i];
        const op = Math.min(
          interpolate(frame, [s, s + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
          interpolate(frame, [e - 8, e], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        );
        return (
          <span key={c} style={{ position: 'absolute', left: 0, right: 0, opacity: op, fontSize: u * 2.4, fontWeight: 600, letterSpacing: '-0.01em', color: COL.cream }}>
            {c}
          </span>
        );
      })}
    </div>
  );
};
