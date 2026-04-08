import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

export async function createContext({ req }: CreateExpressContextOptions) {
  let user: User | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser(token);
      user = authUser;
    } catch (err) {
      console.error('Token verification failed:', err);
    }
  }

  return {
    user,
    supabase,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;