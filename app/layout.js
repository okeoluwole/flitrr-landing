import { Bricolage_Grotesque, Inter, Archivo } from 'next/font/google';
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

// Archivo (variable) is the face for the "Considered" marketing surfaces
// (Flitrr landing, PULSE landing, Framework). Loaded as a variable font so the
// full light-to-bold weight range the design uses (about 250 to 620) renders
// true. Exposed as --font-archivo and consumed only inside the marketing pages.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

// The three faces above are the marketing faces, and they are the only ones
// this layout loads: every route on the site gets them. The Instrument faces
// for the authenticated product (Geist and Geist Mono) used to hang here too,
// which meant the landing pages paid to download a product typeface they never
// set a single character in. They now load from app/appFonts.js, applied by
// the /dashboard, /pulse/app and /stack/app layouts. The Brief document face
// is Georgia via --doc-font-serif (zero-install).

const SITE_TITLE = 'Flitrr. One platform for property development';
const SITE_DESCRIPTION =
  'One platform for the whole property development lifecycle. STACK proves a scheme stacks up; PULSE delivers it. Built for independent and SME property developers, from land acquisition to asset disposal.';
const SITE_URL = 'https://flitrr.com';

// themeColor belongs on the viewport export in Next 14 (on metadata it warns).
// Ink, matching the Considered marketing ground and the dark product app;
// the light legal pages override it with their own viewport export.
export const viewport = {
  themeColor: '#0f1216',
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
        url: '/og-image.jpg',
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
    images: ['/og-image.jpg'],
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
    <html
      lang="en"
      className={`${display.variable} ${inter.variable} ${archivo.variable}`}
    >
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
