import { createClient } from '../../lib/supabase/server';
import FrameworkMain from './FrameworkMain';

const TITLE = 'The Flitrr Framework';
const DESCRIPTION =
  'The Flitrr Framework: the 8-6-4 method for running a property development the way an institution would, from land acquisition to delivery and sales. Eight stages, six principles, four mandates.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: 'https://flitrr.com/framework',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Flitrr',
    images: [
      {
        url: '/og-framework.jpg',
        width: 1200,
        height: 630,
        alt: 'The Flitrr Framework. Eight stages, six principles, four mandates.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-framework.jpg'],
  },
};

export default async function FrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <FrameworkMain user={navUser} />;
}
