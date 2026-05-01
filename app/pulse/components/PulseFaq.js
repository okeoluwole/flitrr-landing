'use client';

import { useState } from 'react';
import styles from '../page.module.css';

const FAQS = [
  {
    q: "What's the Glass-ball vs Rubber-ball principle?",
    a: "A two-bucket classification of every objective on your project. Glass-ball objectives are critical to project success. Miss one and the project has failed against what it was set up to deliver. Examples include completion date, planning consent retained, and GIA target. Rubber-ball objectives matter to delivery but won't break the project if they slip or change. Examples include supplier choice, fit-out scheduling, and finish specification. PULSE uses your classification to decide what gets flagged, escalated, or quietly tracked.",
  },
  {
    q: 'Why do I have to start with Project Initiation?',
    a: "Because PULSE can only monitor what you've defined. Without a Project Brief, the Action Log doesn't know which actions are critical, the Risk Register doesn't know which risks threaten what, and the Programme Tracker doesn't know which milestones can slip. Project Initiation is a 15-minute flow. It is the discipline that makes everything else work.",
  },
  {
    q: 'Can I use PULSE without doing the Project Initiation flow?',
    a: "Technically yes. You can skip ahead and configure objectives manually for each module. But you'll lose the system-derived suggestions, the over-constraint warnings, and the milestone templates. PULSE works best when you start with Project Initiation. The discipline is what makes the rest of the product powerful.",
  },
  {
    q: 'How is PULSE different from Asana, Monday, or Procore?',
    a: "Generic PM tools treat every task as equal weight. They give you a long list to track, and you decide what's urgent. PULSE is built around a specific classification (glass-ball vs rubber-ball) that determines what gets flagged automatically. That framing doesn't exist in general-purpose tools or in the construction-specific ones. PULSE is the discipline of programme delivery, built into the workflow.",
  },
  {
    q: "My consultants won't adopt a new tool. Then what?",
    a: "The Project Brief output is a PDF and a Word document. Your consultants don't need to use PULSE to read it. For modules that ask consultants to log actions or update risks, the interaction is a single click or a short comment. No training. If using PULSE is harder than sending a WhatsApp message, we've failed.",
  },
  {
    q: "What's live now, and what's coming?",
    a: 'Project Initiation ships first to design partners in Q3 2026. Action Log, Risk Register, and Programme Tracker follow on the roadmap. Executive Dashboard is planned. Design partners get first access to each module as it ships.',
  },
];

export default function PulseFaq() {
  const [openIndex, setOpenIndex] = useState(null);
  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
      <div className="container">
        <div className={styles.faqInner}>
          <h2 id="faq-heading" className={styles.sectionHeading}>
            Questions we get asked.
          </h2>
          <dl className={styles.faqList}>
            {FAQS.map(({ q, a }, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                >
                  <dt>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      aria-controls={`pulse-faq-answer-${i}`}
                    >
                      <span>{q}</span>
                      <span className={styles.faqIcon} aria-hidden="true">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                  </dt>
                  <dd
                    id={`pulse-faq-answer-${i}`}
                    className={styles.faqAnswer}
                    hidden={!isOpen}
                  >
                    <p>{a}</p>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}
