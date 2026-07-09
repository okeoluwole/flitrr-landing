# Voiceover + music — the local finish

The film is **muted‑first** and ships that way. Voiceover and music are an
additive layer that has to be added on a machine with normal network access —
**not** in Claude's cloud render container, which blocks the audio CDN
(`Host not in allowlist … cloudfront`) and where the Higgsfield workspace ran
out of credits. Everything below is the drop‑in.

The VO pipeline is proven: one line was generated in **Imogen** (British female,
Seed Audio) and measured **9.5s** for the hook — that's the timing anchor.

---

## 1. The VO script (TTS‑ready, verbatim)

Dashes are written as commas/periods so TTS phrases them cleanly.

| Beat | File | Line |
|------|------|------|
| Hook | `1-hook.mp3` | "The biggest developers run every scheme with a programme office behind them. Independent developers carry the same risk, with none of the infrastructure." |
| Framework | `2-framework.mp3` | "Flitrr brings that discipline to independent development. Built on the Flitrr Framework. Eight stages. Six principles. Four mandates." |
| Suite | `3-suite.mp3` | "One suite. PULSE leads it, across the development lifecycle." |
| PULSE | `4-pulse.mp3` | "PULSE is live now. Objectives, classified. Programme confidence. The one thing that needs you. Every stage, gated." |
| CTA | `5-cta.mp3` | "We're building PULSE with a small group of developers, to shape it around how you actually deliver. Become a design partner. Flitrr dot com." |

## 2. Voice — recommended + alternatives (female)

Generated with Higgsfield **Seed Audio** (`seed_audio`): `voice_type: 'preset'`,
`format: 'mp3'`, `sample_rate: 44100`, `speech_rate: 0`. Audition the previews in
a browser and pick:

| Voice | `voice_id` | Preview |
|-------|-----------|---------|
| **Imogen** (rec — refined British) | `3811e986-0891-47cf-a1f5-78a1d62a547a` | https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/0112058f-8bd6-423a-aa69-28112d237ac1.mp3 |
| Tallulah | `f32c8f51-449e-4ddf-bdf7-1527e11df917` | https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/6d9fab46-e2ce-481e-8433-9bfdac49dca0.mp3 |
| Sloane | `b57b22a0-f287-405b-bc82-6f08f5e6bb1f` | https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/b504d232-3e67-489d-9b22-0b927caa5926.mp3 |
| Vesper | `c3204739-4084-41a3-9dc5-c805b307ec18` | https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/1f362462-0a34-41c6-ad26-27525eb5a3cd.mp3 |
| Maya (warmer) | `b0f766b7-8703-4bd1-b973-f857c36837b6` | https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/dc8d2759-bb32-4b0e-904d-b8873efc958e.mp3 |

Any TTS works (ElevenLabs, etc.) — Seed Audio is just what's wired to this account.

## 3. Music (afrobeat / uptempo)

There's no music generator available on the connected tools (speech only), so the
track is sourced by you and must be **cleared for commercial social use** — not
merely "free" — or LinkedIn/Meta will mute it on a Content‑ID match. AI‑generated
instrumental (Suno/Udio) or a licensed library (Artlist, Epidemic, Uppbeat) all
work; keep it **instrumental** so it doesn't fight the VO. Save as
`public/audio/track.mp3`.

---

## 4. Wire it up (local machine)

```bash
# 1. Put the five VO clips here:
#    public/audio/vo/1-hook.mp3 … 5-cta.mp3
# 2. Put the cleared music track here:
#    public/audio/track.mp3
npm run studio          # to scrub + re-time (see step 6)
```

**5. VO wiring** — in `src/Marketing.tsx`, add a `VOICE` flag and one `<Audio>`
per beat inside its `Series.Sequence`:

```tsx
import { AbsoluteFill, Audio, Series, staticFile } from 'remotion';
const VOICE = true;

<Series.Sequence durationInFrames={/* re-timed, see below */ 330}>
  <Hook />
  {VOICE && <Audio src={staticFile('audio/vo/1-hook.mp3')} />}
</Series.Sequence>
// …repeat for framework / suite / pulse / cta
```

Set `MUSIC = true` too, and duck the bed under the VO by lowering `MusicBed`'s
base volume from `0.55` to about `0.3`.

**6. Re‑time to the narration.** Each beat's `durationInFrames` must grow to fit
its clip (the hook VO is ~9.5s ≈ 285 frames at 30fps, vs the silent beat's 180).
In Remotion Studio the audio clip's length is visible on the timeline — set each
`Series.Sequence` to `clip length + ~15–30 frames` of tail, and bump the total in
`Root.tsx` (`DURATION`) to the new sum (roughly 48–53s narrated). The beat
*internals* (PULSE caption sync, gates) are tuned to the silent 240‑frame Pulse;
if you stretch Pulse, nudge the caption windows in `beats/Pulse.tsx` to match.

**7. Render** (locally — no proxy flags needed):

```bash
npm run render:1x1 && npm run render:16x9
```

---

### Alternative: do it in the container

Only if you'd rather I finish it here — you'd need to (a) top up the Higgsfield
workspace credits and (b) add the Higgsfield CDN hosts (`*.cloudfront.net`) to the
environment's network‑egress allowlist so the generated audio can be downloaded.
Music would still need to be supplied by you. Local is simpler.
