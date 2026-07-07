import { createClient } from '../lib/supabase/server';
import HomeMain from './HomeMain';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <HomeMain user={navUser} />;
}
