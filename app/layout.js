import { Montserrat, Inter } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  // 700 and 800 are both used (800 for the landing and panel headings, 700
  // across the PULSE brief and wizard). Loading both avoids faux-bold 700.
  weight: ['700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const SITE_TITLE = 'Flitrr. One platform for property development';
const SITE_DESCRIPTION =
  'Flitrr is building products for every stage of a property development project, from planning to handover. Built for independent and SME real estate developers. PULSE is our first product.';
const SITE_URL = 'https://flitrr.com';

// themeColor belongs on the viewport export in Next 14 (on metadata it warns).
export const viewport = {
  themeColor: '#F4C031',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
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
        alt: 'Flitrr. One platform for property development.',
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

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Flitrr',
  url: SITE_URL,
  email: 'hello@flitrr.com',
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
