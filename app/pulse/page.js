import { createClient } from '../../lib/supabase/server';
import PulseMain from './PulseMain';

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <PulseMain user={navUser} />;
}
