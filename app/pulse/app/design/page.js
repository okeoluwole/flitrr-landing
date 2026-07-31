import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import DashboardShell from '../../../components/DashboardShell';
import DesignLanguage from './DesignLanguage';

/**
 * /pulse/app/design - the design language review surface (Session K, Note 15
 * sub-step 1).
 *
 * A review surface for the duration of the Note 15 sweep, NOT a product
 * feature: it renders the language so the palette, the type roles, the
 * spacing rhythm and every semantic mapping can be judged before the content
 * surfaces convert onto them. It is deliberately linked from no navigation,
 * and the last sub-step of the sweep REMOVES it (delete this directory).
 */

export const metadata = {
  title: 'Design language, PULSE',
  robots: { index: false, follow: false },
};

export default async function DesignLanguagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  return (
    <DashboardShell user={navUser}>
      <DesignLanguage />
    </DashboardShell>
  );
}
