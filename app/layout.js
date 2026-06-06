import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';

// Display face for headings and the brief. Prototyping a swap away from
// Montserrat to a more distinctive grotesque, kept behind the --font-heading
// variable so every heading picks it up with no per-component change. 700 and
// 800 are both loaded (800 for landing and panel headings, 700 across the
// brief and wizard), so the existing weights render true with no faux-bold.
//
// To try another candidate, swap the import and the call below. These also
// ship 700 and 800: Sora (geometric, serious), Outfit (clean, neutral),
// Schibsted_Grotesk (modern grotesque). Space_Grotesk is a strong option too
// but tops out at 700, so it would need the 800 heading weights dropped to 700.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
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
    <html lang="en" className={`${display.variable} ${inter.variable}`}>
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
