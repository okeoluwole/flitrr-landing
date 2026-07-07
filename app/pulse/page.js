import { createClient } from '../../lib/supabase/server';
import PulseMain from './PulseMain';

export const metadata = {
  title: 'PULSE by Flitrr. Project delivery and programme management',
  description:
    'PULSE is project delivery and programme management for independent and SME property developers. Run your development like you have a programme office, because a programme director is built in.',
};

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <PulseMain user={navUser} />;
}
