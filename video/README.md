# Flitrr / PULSE — marketing film (Remotion)

A ~38s marketing film for Flitrr / PULSE, built in [Remotion](https://remotion.dev)
directly on the live site's design system. Muted‑first (reads with sound off),
rendered to 1:1 / 16:9 / 4:5 from one project.

## The five beats

| # | Beat | Copy spine |
|---|------|------------|
| 0 | **Hook** (6s) | The infrastructure gap: big developers have a programme office; independents carry the same risk with none of the infrastructure. |
| 1 | **Framework** (8s) | "Built on the Flitrr Framework" — the **8‑6‑4** signature (Eight stages · Six principles · Four mandates). |
| 2 | **Suite** (8s) | One suite. PULSE **Live**, STACK / ROUTE **In design**, and more. |
| 3 | **PULSE** (8s) | The real instrument, animated: programme confidence, objectives classified, the one thing that needs you, every stage gated. |
| 4 | **CTA** (8s) | Design‑partner ask → wordmark + `flitrr.com`. |

## Design system — mirrored, not eyeballed

Tokens in `src/theme.ts` are copied 1:1 from the live site so the film and the
site read as one system:

- **Ground:** ink `#0B141E` (the marketing surface, from `app/globals.css`).
- **Type:** Archivo (the `--font-archivo` marketing face), via `@remotion/google-fonts`.
- **Amber means one thing.** Per `globals.css`, amber is reserved for *signal* —
  the pulse line, criticality, the live indicator, the CTA. Everything else is
  ink and cream. Keep it that way when editing.
- **Motion:** the site's `--ease-out-soft` curve and durations.
- **Imagery:** the site's own photography (`public/images/…`) under the same dusk grade.

## Commands

```bash
npm install
npm run studio        # interactive preview (scrub the timeline in a browser)
npm run render:1x1    # 1080×1080  — LinkedIn feed (primary)
npm run render:16x9   # 1920×1080  — landscape / YouTube / site embed
npm run render:4x5    # 1080×1350  — portrait feed
```

### Rendering inside Claude's remote container

The container has no bundled Chrome for Remotion and proxies HTTPS through a
private CA, so a render there needs three extra flags. **On your local machine
none of this is required** — Remotion fetches its own headless shell and fonts
load normally.

```bash
export REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
export NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
npx remotion render src/index.ts Marketing-1x1 out/flitrr-pulse-1x1.mp4 --ignore-certificate-errors
```

## Audio (muted‑first)

The film carries its full meaning with **no sound** and ships that way. Voiceover
(female, Seed Audio) and an afrobeat/uptempo music bed are an additive layer that
must be added on a machine with normal network access — this render container
blocks the audio CDN. The music slot is wired (`MUSIC` flag in `src/Marketing.tsx`
→ drop `public/audio/track.mp3`); the full VO script, voice picks, wiring snippet,
and re‑timing steps are in **[VOICEOVER.md](./VOICEOVER.md)**.

## Structure

```
src/
  index.ts            # registerRoot
  Root.tsx            # the three compositions (1:1, 16:9, 4:5)
  Marketing.tsx       # the master — Series of the five beats + audio slot
  theme.ts            # tokens + fonts + motion helpers (mirrors globals.css)
  data.ts             # all copy + the real PULSE instrument data (verbatim)
  components.tsx      # Stage, PhotoBg, Wordmark, Kicker, DriftLine
  beats/              # Hook, Framework, Suite, Pulse, Cta
public/images/        # the site's own photography (copied)
```
