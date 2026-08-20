const TITLE = 'STACK by Flitrr. Feasibility, budgets and funding';
const DESCRIPTION =
  'STACK is feasibility, budgets and funding for independent and SME property developers. A guided, deterministic development appraisal and funding model: does this stack up, and how do I fund it.';
const URL = 'https://flitrr.com/stack';

// The one metadata source for the /stack subtree; the landing page.js does
// not re-declare title or description.
export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Flitrr',
    images: [
      {
        url: '/og-stack.jpg',
        width: 1200,
        height: 630,
        alt: 'STACK by Flitrr. Know it stacks up before you commit.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-stack.jpg'],
  },
};

export default function StackLayout({ children }) {
  return children;
}
