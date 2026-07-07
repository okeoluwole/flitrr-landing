import { createClient } from '../../lib/supabase/server';
import FrameworkMain from './FrameworkMain';

export const metadata = {
  title: 'The Flitrr Framework',
  description:
    'The Flitrr Framework: the 8-6-4 method for running a property development the way an institution would, from land acquisition to delivery and sales. Eight stages, six principles, four mandates.',
};

export default async function FrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <FrameworkMain user={navUser} />;
}
