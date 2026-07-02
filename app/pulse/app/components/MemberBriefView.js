'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LENSES, DEFAULT_LENS } from './briefLens';
import BriefDocument from './BriefDocument';
import ViewOnlyBadge from './ViewOnlyBadge';
import brief from './Brief.module.css';
import styles from './MemberBriefView.module.css';

/**
 * MemberBriefView - the read-only Project Brief a member sees.
 *
 * Project Initiation is an authoring flow: every step writes. A member cannot
 * author, so rather than the wizard with its controls stripped (which would
 * read as a broken form), they see the clean record: the version-locked Brief
 * document, under a selectable audience lens, with a PDF download. The lens and
 * the download are read-only and stay available to everyone. When no baseline
 * is locked yet, a sparse line explains that only an admin can set it up.
 *
 * This is presentation. The database already denies a member's writes; the
 * admin path (the wizard) is unchanged.
 *
 * Props:
 *   latestBrief  the latest LOCKED brief, { version, content, generatedAt }, or
 *                null when none is locked yet.
 */
export default function MemberBriefView({
  projectName,
  workspaceHref,
  latestBrief,
  adminContact,
}) {
  const [lens, setLens] = useState(DEFAULT_LENS);

  // Export the current lens as a PDF via the browser's print-to-PDF, the same
  // read-only action the wizard offers. document.title is set first so the
  // saved file gets a sensible name, then restored after.
  const handleDownloadPdf = () => {
    if (typeof window === 'undefined') return;
    const lensLabel = LENSES.find((l) => l.key === lens)?.label ?? 'Brief';
    const name = (
      latestBrief?.content?.identity?.name ||
      projectName ||
      'PULSE brief'
    ).trim();
    const previousTitle = document.title;
    document.title = `${name}, ${lensLabel} brief`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const Header = (
    <>
      <Link href={workspaceHref} className={styles.backLink}>
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
        Back to the project
      </Link>
      <p className={styles.eyebrow}>Project Brief</p>
      <h1 className={styles.title}>{projectName}</h1>
      <div className={styles.viewOnly}>
        <ViewOnlyBadge adminContact={adminContact} />
      </div>
    </>
  );

  // No locked baseline yet: nothing to render read-only. A sparse line, not a
  // broken document.
  if (!latestBrief) {
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <div className={`${styles.placeholder} riseIn`}>
          <p className={styles.placeholderLead}>
            The Brief has not been locked yet. Only an admin can set up the
            Brief.
          </p>
          <Link href={workspaceHref} className={styles.cta}>
            Back to the project
          </Link>
        </div>
      </main>
    );
  }

  const lockState = {
    locked: true,
    version: latestBrief.version,
    generatedAt: latestBrief.generatedAt,
  };

  return (
    <main className={`container ${styles.page}`} id="main-content">
      {Header}

      <div className={brief.controlBar}>
        <div className={brief.lens}>
          <span className={brief.lensLabel}>View as</span>
          <div className={brief.seg} role="group" aria-label="Brief audience">
            {LENSES.map((l) => (
              <button
                key={l.key}
                type="button"
                className={`${brief.segBtn} ${lens === l.key ? brief.segBtnActive : ''}`}
                aria-pressed={lens === l.key}
                onClick={() => setLens(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={brief.downloadBtn}
            onClick={handleDownloadPdf}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2.5v6.5M5 6l3 3 3-3M3.5 13h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      <div className={brief.scroll}>
        <BriefDocument model={latestBrief.content} lens={lens} lockState={lockState} />
      </div>
    </main>
  );
}
