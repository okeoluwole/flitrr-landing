const TITLE = 'PULSE by Flitrr. Project delivery and programme management';
const DESCRIPTION =
  'PULSE is project delivery and programme management for independent and SME property developers. Run your development like you have a programme office, because a programme director is built in.';
const URL = 'https://flitrr.com/pulse';

// The one metadata source for the /pulse subtree; the landing page.js does
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
        url: '/og-pulse.jpg',
        width: 1200,
        height: 630,
        alt: 'PULSE by Flitrr. Run your development like you have a programme office.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-pulse.jpg'],
  },
};

export default function PulseLayout({ children }) {
  return children;
}
