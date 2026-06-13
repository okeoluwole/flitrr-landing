'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '../../lib/supabase/client';
import styles from '../page.module.css';

/* The design partner close. Heading and line are verbatim from the
   agreed copy; the form is the working submission path into the
   design_partner_submissions table and must keep its shape. */

export default function HomeDesignPartner() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [market, setMarket] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !company.trim() ||
      !portfolio ||
      !market
    ) {
      setError('Please complete every field with a valid value.');
      return;
    }

    setBusy(true);
    const { error: insertError } = await supabase
      .from('design_partner_submissions')
      .insert({
        email,
        company_name: company.trim(),
        portfolio_size: portfolio,
        primary_market: market,
        source_page: 'flitrr_com',
      });
    setBusy(false);

    if (insertError) {
      setError(
        'Something went wrong. Please try again or email hello@flitrr.com.'
      );
      return;
    }

    setDone(true);
  };

  return (
    <section
      id="design-partner"
      className={styles.pilot}
      aria-labelledby="design-partner-heading"
    >
      <div className={styles.pilotMedia} aria-hidden="true">
        <Image
          src="/images/texture-site-overview.jpg"
          alt=""
          fill
          sizes="100vw"
          className={styles.pilotImg}
        />
      </div>
      <div className={`container ${styles.pilotInner}`}>
        <div className={styles.pilotSplit}>
          <div className={styles.pilotLeft} data-reveal>
            <h2 id="design-partner-heading" className={styles.sectionHeading}>
              Built with developers, not just for them.
            </h2>
            <p className={styles.pilotSub}>
              Flitrr is being shaped with a small group of working developers.
              If you want the infrastructure before everyone else has it, talk
              to us.
            </p>
            <p className={styles.pilotReassure}>
              Prefer email? Reach us directly at{' '}
              <a href="mailto:hello@flitrr.com" className={styles.pilotReassureLink}>
                hello@flitrr.com
              </a>
              .
            </p>
          </div>

          <div className={styles.pilotRight} data-reveal>
            {done ? (
              <div
                className={`${styles.successMsg} riseInSm`}
                role="status"
                aria-live="polite"
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="var(--color-signal-amber)"
                    strokeWidth="2"
                  />
                  <path
                    d="M11 20.5l6 6 12-12"
                    stroke="var(--color-signal-amber)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  <strong>Request received.</strong> We will be in touch
                  within 48 hours.
                </span>
              </div>
            ) : (
              <form
                className={styles.pilotForm}
                onSubmit={handleSubmit}
                noValidate
              >
                <input type="hidden" name="source_page" value="flitrr_com" />

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-h-email" className={styles.formLabel}>
                    Email address
                  </label>
                  <input
                    id="dp-h-email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className={styles.textInput}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-h-company" className={styles.formLabel}>
                    Company / practice name
                  </label>
                  <input
                    id="dp-h-company"
                    name="company"
                    type="text"
                    placeholder="e.g. Northpoint Developments"
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      if (error) setError(null);
                    }}
                    className={styles.textInput}
                    required
                    autoComplete="organization"
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-h-portfolio" className={styles.formLabel}>
                    Portfolio size
                  </label>
                  <select
                    id="dp-h-portfolio"
                    name="portfolio_size"
                    value={portfolio}
                    onChange={(e) => {
                      setPortfolio(e.target.value);
                      if (error) setError(null);
                    }}
                    className={styles.textInput}
                    required
                  >
                    <option value="">Select…</option>
                    <option value="1">1 project</option>
                    <option value="2_to_3">2 to 3 projects</option>
                    <option value="4_plus">4 plus projects</option>
                  </select>
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-h-market" className={styles.formLabel}>
                    Primary market
                  </label>
                  <select
                    id="dp-h-market"
                    name="primary_market"
                    value={market}
                    onChange={(e) => {
                      setMarket(e.target.value);
                      if (error) setError(null);
                    }}
                    className={styles.textInput}
                    required
                  >
                    <option value="">Select…</option>
                    <option value="uk">UK</option>
                    <option value="nigeria">Nigeria</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {error && (
                  <p className={styles.errorMsg} role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className={`${styles.btnPrimary} ${styles.btnFullWidth}`}
                  disabled={busy}
                >
                  {busy ? 'Sending…' : 'Become a design partner'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
