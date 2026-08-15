import { createClient } from '../../lib/supabase/server';
import StackMain from './StackMain';

export const metadata = {
  title: 'STACK by Flitrr. Feasibility, budgets and funding',
  description:
    'STACK is feasibility, budgets and funding for independent and SME property developers. A guided, deterministic development appraisal and funding model: does this stack up, and how do I fund it.',
};

export default async function StackLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return <StackMain user={navUser} />;
}
