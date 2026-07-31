import PageHeader from '../components/PageHeader';
import { SEMANTIC_MAPPINGS } from '../../../../lib/design/semantics';
import styles from './Design.module.css';

/**
 * The review surface's content (Session K): presentational only, so the
 * authed route renders it inside the shell. Review-only for the Note 15
 * sweep; the last sub-step removes this directory.
 */

// The palette, grouped by job. Names only: the colour itself comes from the
// live cascade, so this page can never disagree with globals.css.
const PALETTE = [
  {
    title: 'Ground and surfaces',
    note: 'The graphite ground; panels seat on it with hairlines, never float.',
    tokens: [
      ['--app-ground', 'the work canvas'],
      ['--app-surface', 'seated panels'],
      ['--app-surface-raised', 'menus, popovers, the pinned band'],
      ['--app-surface-sunken', 'wells, read-only fields, attention bands'],
      ['--app-console', 'the app chrome bar'],
    ],
  },
  {
    title: 'Ink',
    note: 'Body sets in ink or ink-secondary. Muted is non-essential metadata only.',
    tokens: [
      ['--app-ink', 'body and headings'],
      ['--app-ink-secondary', 'supporting text, placeholders'],
      ['--app-ink-muted', 'non-essential metadata'],
    ],
  },
  {
    title: 'Lines and fills',
    note: 'One translucent-light ramp, one alpha per job. No off-ramp values.',
    tokens: [
      ['--app-hairline', 'dividers'],
      ['--app-border', 'control borders'],
      ['--app-border-strong', 'hover and emphasis borders'],
      ['--app-hover', 'row and item hover tint'],
      ['--app-fill-faint', 'disabled and resting tiles'],
      ['--app-fill', 'neutral chip and pill fill'],
      ['--app-active', 'the press state'],
      ['--app-fill-strong', 'the mid intensity fill'],
    ],
  },
  {
    title: 'Signal: amber is criticality, only',
    note: 'Not status, not progress, not decoration, not chrome (the pulse-line mark excepted).',
    tokens: [
      ['--app-signal', 'the amber mark'],
      ['--app-signal-ink', 'amber as text on dark'],
      ['--app-signal-ink-dim', 'the dimmed amber voice (At risk)'],
      ['--app-signal-wash', 'the criticality wash'],
      ['--app-critical-border', 'the criticality border'],
    ],
  },
  {
    title: 'Action and states',
    note: 'The primary action is structural white, never honey. Red is breach or a failed write. Green is a recorded fact.',
    tokens: [
      ['--app-primary', 'the primary action'],
      ['--app-focus', 'the focus ring, white everywhere'],
      ['--app-danger', 'failure and breach'],
      ['--app-success', 'recorded facts: met, ahead'],
      ['--app-warning', 'reserved'],
    ],
  },
];

const TYPE_ROLES = [
  ['Page title', styles.specPageTitle, 'sans 600, xl, lh 1.15, ls -0.02em'],
  ['Section title', styles.specSectionTitle, 'sans 600, md'],
  ['Card title', styles.specCardTitle, 'sans 600, base'],
  ['Body', styles.specBody, 'sans 400, base, lh 1.55'],
  ['Caption', styles.specCaption, 'sans 400, sm, ink-secondary'],
  ['Micro label', styles.specMicro, 'mono 500, 2xs, uppercase, tracked'],
  ['Data', styles.specData, 'mono, tabular numerals: 23 Jul 2026 · 614,632.69'],
];

const SPACES = [1, 2, 3, 4, 5, 6, 7, 8];

// A semantic swatch renders exactly what the mapping dictates, by plumbing
// the appearance's token NAMES into custom properties the stylesheet
// consumes. No colour is picked on this page.
function SemanticChip({ appearance }) {
  const a = appearance;
  const vars = {
    '--sw-ink': `var(${a.ink})`,
    '--sw-fill': a.fill ? `var(${a.fill})` : 'transparent',
    '--sw-border': a.border ? `var(${a.border})` : 'transparent',
    '--sw-border-style': a.borderStyle ?? 'solid',
    '--sw-weight': a.weight,
    '--sw-mark': a.markFill ? `var(${a.markFill})` : `var(${a.ink})`,
  };
  const shapeClass =
    a.shape === 'tag' ? styles.chipTag : a.shape === 'pill' ? styles.chipPill : styles.chipPlain;
  return (
    <span className={`${styles.chip} ${shapeClass}`} style={vars}>
      {a.mark === 'ring' && <span className={styles.markRing} aria-hidden="true" />}
      {a.mark === 'disc' && <span className={styles.markDisc} aria-hidden="true" />}
      {a.mark === 'bullseye' && (
        <span className={styles.markBullseye} aria-hidden="true" />
      )}
      {a.label}
    </span>
  );
}

export default function DesignLanguage() {
  return (
      <main className={`container ${styles.page}`} id="main-content">
        <PageHeader
          back={{ href: '/pulse/app', label: 'Back to projects' }}
          eyebrow="Design language"
          eyebrowMark
          title="The Instrument language"
          sub="A review surface for the Note 15 sweep. It renders the tokens, the type roles, the spacing rhythm and the semantic mappings the whole product inherits. Not linked from navigation; the last sub-step removes it."
        />

        {/* ── Palette ── */}
        {PALETTE.map((group) => (
          <section key={group.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{group.title}</h2>
            <p className={styles.sectionNote}>{group.note}</p>
            <ul className={styles.swatchGrid}>
              {group.tokens.map(([token, role]) => (
                <li key={token} className={styles.swatchCard}>
                  <span
                    className={styles.swatch}
                    style={{ '--sw': `var(${token})` }}
                    aria-hidden="true"
                  />
                  <span className={styles.swatchName}>{token}</span>
                  <span className={styles.swatchRole}>{role}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* ── Type roles ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Type roles</h2>
          <p className={styles.sectionNote}>
            Geist carries the voice, Geist Mono the numeric instrument voice.
            A surface consumes a role, never a raw size.
          </p>
          <ul className={styles.specList}>
            {TYPE_ROLES.map(([name, cls, detail]) => (
              <li key={name} className={styles.specRow}>
                <span className={styles.specLabel}>{name}</span>
                <span className={cls}>
                  {name === 'Data'
                    ? '23 Jul 2026 · Stage 5 · 614,632.69'
                    : 'Objectives hold the line'}
                </span>
                <span className={styles.specDetail}>{detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Spacing rhythm ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spacing rhythm</h2>
          <p className={styles.sectionNote}>
            One 4px base, eight steps. Micro gaps take 1 and 2, control padding
            2 and 3, panel padding 4 and 5, block gaps 6, section rhythm 7 and 8.
          </p>
          <ul className={styles.spaceList}>
            {SPACES.map((n) => (
              <li key={n} className={styles.spaceRow}>
                <span className={styles.spaceName}>--app-space-{n}</span>
                <span
                  className={styles.spaceBar}
                  style={{ '--bar': `var(--app-space-${n})` }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* ── Shape, depth, focus ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Radii, elevation, focus</h2>
          <p className={styles.sectionNote}>
            Radii 8, 10, 14. Depth is shadow plus a faint top light, spent on
            seated panels, never stacked. The focus ring is structural white
            everywhere, so it can never be confused with the criticality read.
          </p>
          <div className={styles.shapeRow}>
            <span className={`${styles.shapeCard} ${styles.radiusSm}`}>radius-sm</span>
            <span className={`${styles.shapeCard} ${styles.radiusMd}`}>radius</span>
            <span className={`${styles.shapeCard} ${styles.radiusLg}`}>radius-lg</span>
            <span className={`${styles.shapeCard} ${styles.radiusLg} ${styles.elev}`}>
              elev-1
            </span>
            <span className={`${styles.shapeCard} ${styles.radiusSm} ${styles.focusDemo}`}>
              focus ring
            </span>
          </div>
        </section>

        {/* ── The semantic mappings ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The semantic mappings</h2>
          <p className={styles.sectionNote}>
            Each domain value resolves to tokens through one pure function in
            lib/design/semantics.js and is never re-picked locally. Colour is
            tied to meaning and is never the only carrier: every state also
            reads through its label, shape or weight.
          </p>
          {SEMANTIC_MAPPINGS.map((mapping) => (
            <div key={mapping.id} className={styles.mapping}>
              <h3 className={styles.mappingTitle}>{mapping.name}</h3>
              <p className={styles.mappingNote}>{mapping.note}</p>
              <ul className={styles.mappingList}>
                {mapping.values.map((value) => {
                  const a = mapping.appearance(value);
                  return (
                    <li key={value} className={styles.mappingRow}>
                      <code className={styles.mappingValue}>{value}</code>
                      <SemanticChip appearance={a} />
                      <span className={styles.mappingTokens}>
                        {a.ink}
                        {a.fill ? ` on ${a.fill}` : ''}
                        {a.border ? `, ${a.borderStyle} ${a.border}` : ''}
                        {a.mark ? `, ${a.mark} mark` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Motion ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Motion</h2>
          <p className={styles.sectionNote}>
            150 to 250ms, on state change only: step advance, save, reveal,
            menu. Tokens --dur-press 130 / --dur-fast 180 / --dur-base 240 with
            the --ease-out family. Everything sits behind the reduced-motion
            gate and none of it is decoration a user would notice.
          </p>
        </section>
      </main>
  );
}
