'use client';

import { useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import styles from './considered.module.css';

/**
 * The design-partner request form, shared by the home, PULSE and STACK pages.
 * `sourcePage` is the analytics discriminator written to
 * design_partner_submissions ('flitrr_com' | 'pulse_page' | 'stack_page');
 * keep the existing values stable.
 */
export default function DesignPartnerForm({ sourcePage }) {
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
    const { error: insertError } = await supabase.from('design_partner_submissions').insert({
      email,
      company_name: company.trim(),
      portfolio_size: portfolio,
      primary_market: market,
      source_page: sourcePage,
    });
    setBusy(false);
    if (insertError) {
      setError('Something went wrong. Please try again or email hello@flitrr.com.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className={styles.done} role="status">
        <span className={styles.tk}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <strong>Request received.</strong> We will be in touch within 48 hours.
        </span>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.flab} htmlFor="dp-email">Email address</label>
        <input
          className={styles.in}
          id="dp-email"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.flab} htmlFor="dp-company">Company name</label>
        <input
          className={styles.in}
          id="dp-company"
          type="text"
          placeholder="e.g. Northpoint Developments"
          autoComplete="organization"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div className={styles.frow}>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="dp-portfolio">Portfolio size</label>
          <select
            className={styles.in}
            id="dp-portfolio"
            value={portfolio}
            onChange={(e) => {
              setPortfolio(e.target.value);
              if (error) setError(null);
            }}
          >
            <option value="">Select...</option>
            <option value="1">1 project</option>
            <option value="2_to_3">2 to 3 projects</option>
            <option value="4_plus">4 plus projects</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="dp-market">Primary market</label>
          <select
            className={styles.in}
            id="dp-market"
            value={market}
            onChange={(e) => {
              setMarket(e.target.value);
              if (error) setError(null);
            }}
          >
            <option value="">Select...</option>
            <option value="uk">UK</option>
            <option value="nigeria">Nigeria</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>
      {error && <p className={styles.err} role="alert">{error}</p>}
      <button type="submit" className={`${styles.btn} ${styles.btnWarm} ${styles.submit}`} disabled={busy}>
        {busy ? 'Sending...' : 'Become a design partner'}
      </button>
    </form>
  );
}
