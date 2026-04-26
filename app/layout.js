import { Montserrat, Inter } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const SITE_TITLE = 'Flitrr — Monitoring What Matters';
const SITE_DESCRIPTION =
  'Flitrr builds programme delivery tools for SME real estate developers. Our first product, PULSE, gives you the discipline the big consultancies sell for £50K — starting with the document every project should begin with.';
const SITE_URL = 'https://flitrr.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  themeColor: '#F4C031',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'Flitrr',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Flitrr — Monitoring What Matters',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
