import React from 'react';
import { AbsoluteFill, Audio, interpolate, Series, staticFile } from 'remotion';
import { COL } from './theme';
import { Hook } from './beats/Hook';
import { Framework } from './beats/Framework';
import { Suite } from './beats/Suite';
import { Pulse } from './beats/Pulse';
import { Cta } from './beats/Cta';

/* ── Audio ──────────────────────────────────────────────────
   Muted-first: kinetic type carries all meaning. Audio is an
   additive layer added on a machine with normal network access
   (this render container blocks the audio CDN). See VOICEOVER.md.

   MUSIC: drop a commercially-cleared afrobeat / uptempo track at
   public/audio/track.mp3 and set MUSIC = true.
   VOICE: see VOICEOVER.md for the per-beat VO wiring + re-timing.
──────────────────────────────────────────────────────────── */
const MUSIC = false;

const MusicBed: React.FC = () => (
  <Audio
    src={staticFile('audio/track.mp3')}
    // Under a voiceover, duck the base volume to ~0.3.
    volume={(f) =>
      interpolate(f, [0, 24, 1090, 1140], [0, 0.55, 0.55, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    }
  />
);

export const Marketing: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COL.ink950 }}>
      <Series>
        <Series.Sequence durationInFrames={180}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <Framework />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <Suite />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <Pulse />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <Cta />
        </Series.Sequence>
      </Series>

      {MUSIC ? <MusicBed /> : null}
    </AbsoluteFill>
  );
};
