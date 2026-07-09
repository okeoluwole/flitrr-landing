import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { COL } from './theme';
import { Hook } from './beats/Hook';
import { Framework } from './beats/Framework';
import { Suite } from './beats/Suite';
import { Pulse } from './beats/Pulse';
import { Cta } from './beats/Cta';

// Muted-first: kinetic type carries all meaning; audio is an additive slot.
// Drop a commercially-cleared track at public/audio/track.mp3 and flip this on.
const HAS_AUDIO = false;

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

      {/* Audio slot (see HAS_AUDIO above).
      {HAS_AUDIO ? <Audio src={staticFile('audio/track.mp3')} volume={0.7} /> : null} */}
    </AbsoluteFill>
  );
};
