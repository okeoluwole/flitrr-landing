import { createClient } from '../../lib/supabase/server';
import StackMain from './StackMain';

export default async function StackLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <StackMain user={navUser} />;
}
