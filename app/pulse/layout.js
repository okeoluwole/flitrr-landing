const TITLE = 'PULSE. Monitoring What Matters';
const DESCRIPTION =
  'PULSE is the project delivery product by Flitrr. Every objective, every project: defined, classified, monitored. Built for independent and SME real estate developers.';
const URL = 'https://flitrr.com/pulse';

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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PULSE. Monitoring What Matters',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function PulseLayout({ children }) {
  return children;
}
