import Link from 'next/link';
import { stageLabel } from '../../../../lib/engine/stageNames';
import styles from './PageHeader.module.css';

/**
 * The shared page header (Session K, Note 15 sub-step 1). Every authenticated
 * PULSE surface opens with this one component instead of hand-building its
 * own back link, eyebrow, title and project context: before it, the header
 * was re-implemented on thirteen surfaces and the back chevron was pasted
 * into ten files.
 *
 * The canonical order, top to bottom, is fixed so screens read as one
 * product: back link, eyebrow, title row (title, then meta and actions on
 * the right), the stage line, the project name, the view-only badge, the
 * intro line. A surface passes only the slots it has; nothing renders for
 * the rest.
 *
 * Props:
 *   back        { href, label } for the back link, or null.
 *   eyebrow     the mono micro-label above the title.
 *   eyebrowMark true to draw the PULSE pulse-line glyph before the eyebrow
 *               (the product's own mark; it never sits on Flitrr chrome).
 *   title       the h1. Required.
 *   meta        a node seated right of the title (a baseline chip).
 *   actions     a node seated right of the title (the page's primary action).
 *   stage       the project's current stage (0 to 7). Renders the stage
 *               line via the framework's own stage names (Session E's chip);
 *               anything unreadable renders nothing rather than guessing.
 *   stageNote   a quiet fact beside the stage line (a recorded gate decision).
 *   projectName the project context line under the title.
 *   badge       a node for the view-only badge slot.
 *   sub         the intro line.
 */
export default function PageHeader({
  back = null,
  eyebrow = null,
  eyebrowMark = false,
  title,
  meta = null,
  actions = null,
  stage = null,
  stageNote = null,
  projectName = null,
  badge = null,
  sub = null,
}) {
  const stageLine = stage == null ? null : stageLabel(stage);

  return (
    <header className={styles.header}>
      {back && (
        <Link href={back.href} className={styles.backLink}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M9 11L5 7l4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {back.label}
        </Link>
      )}

      {eyebrow && (
        <p className={styles.eyebrow}>
          {eyebrowMark && (
            <svg
              className={styles.eyebrowMark}
              viewBox="0 0 40 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 8 H11 L14 8 L16.5 2 L19.5 14 L22.5 8 H40"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {eyebrow}
        </p>
      )}

      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {(meta || actions) && (
          <div className={styles.titleAside}>
            {meta}
            {actions}
          </div>
        )}
      </div>

      {stageLine && (
        <p className={styles.stageLine}>
          {stageLine}
          {stageNote && <span className={styles.stageNote}>{stageNote}</span>}
        </p>
      )}

      {projectName && <p className={styles.projectName}>{projectName}</p>}

      {badge && <div className={styles.badgeSlot}>{badge}</div>}

      {sub && <p className={styles.sub}>{sub}</p>}
    </header>
  );
}
