'use client';

import { useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import styles from '../page.module.css';

const DESIGN_PARTNER_BLOCKS = [
  {
    heading: 'What it is.',
    body: 'A 90-day programme. Working sessions while we build PULSE module by module. First access on every release. A direct say in what gets built next.',
  },
  {
    heading: 'What you give.',
    body: 'Two real projects, two hours a week, honest feedback. A willingness to shape PULSE before it is finished.',
  },
  {
    heading: 'What you get.',
    body: 'Lifetime founding-member pricing on PULSE. Priority access to every module as it ships. A direct line to the team building the product.',
  },
];

export default function PulseDesignPartner() {
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
        source_page: 'pulse_page',
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
      className={styles.designPartner}
      aria-labelledby="design-partner-heading"
    >
      <div className="container">
        <h2
          id="design-partner-heading"
          className={styles.sectionHeading}
        >
          Be a PULSE design partner.
        </h2>
        <p className={styles.designPartnerSub}>
          Ten developers. Direct input into PULSE before it launches.
          First access to Project Initiation the moment it ships.
        </p>

        <div className={styles.designPartnerBlocks}>
          {DESIGN_PARTNER_BLOCKS.map(({ heading, body }) => (
            <div key={heading} className={styles.designPartnerBlock}>
              <h3 className={styles.designPartnerBlockHeading}>{heading}</h3>
              <p className={styles.designPartnerBlockBody}>{body}</p>
            </div>
          ))}
        </div>

        <div className={styles.designPartnerFormWrap}>
          <div className={styles.designPartnerFormCard}>
            {done ? (
              <div
                className={styles.successState}
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
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                  />
                  <path
                    d="M11 20.5l6 6 12-12"
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className={styles.successHeading}>Request received</h3>
                <p className={styles.successBody}>
                  We will be in touch within 48 hours. In the meantime,
                  keep an eye on your inbox.
                </p>
              </div>
            ) : (
              <form
                className={styles.designPartnerForm}
                onSubmit={handleSubmit}
                noValidate
              >
                <input type="hidden" name="source_page" value="pulse_page" />

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-p-email" className={styles.formLabel}>
                    Email address
                  </label>
                  <input
                    id="dp-p-email"
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
                  <label htmlFor="dp-p-company" className={styles.formLabel}>
                    Company / practice name
                  </label>
                  <input
                    id="dp-p-company"
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
                  <label htmlFor="dp-p-portfolio" className={styles.formLabel}>
                    Portfolio size
                  </label>
                  <select
                    id="dp-p-portfolio"
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
                  <label htmlFor="dp-p-market" className={styles.formLabel}>
                    Primary market
                  </label>
                  <select
                    id="dp-p-market"
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
                  {busy ? 'Sending…' : 'Request a design partner spot'}
                </button>
              </form>
            )}
            <p className={styles.formNote}>
              No payment. No commitment beyond the design partner programme.
              Ten spots total.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
