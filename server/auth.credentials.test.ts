import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Supabase Auth Credentials', () => {
  it('should have valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(supabaseUrl).toBeDefined();
    expect(supabaseServiceKey).toBeDefined();
    expect(supabaseUrl).toMatch(/^https:\/\//);
    expect(supabaseServiceKey).toBeTruthy();
  });

  it('should be able to connect to Supabase with service role key', async () => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to fetch profiles table (should be accessible with service role)
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should have valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY', () => {
    const viteSupabaseUrl = process.env.VITE_SUPABASE_URL;
    const viteSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    expect(viteSupabaseUrl).toBeDefined();
    expect(viteSupabaseAnonKey).toBeDefined();
    expect(viteSupabaseUrl).toMatch(/^https:\/\//);
    expect(viteSupabaseAnonKey).toBeTruthy();
  });

  it('should be able to connect to Supabase with anon key', async () => {
    const viteSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const viteSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    const supabase = createClient(viteSupabaseUrl, viteSupabaseAnonKey);

    // Try to check auth status (should work with anon key)
    const { data, error } = await supabase.auth.getSession();

    // We don't expect a session, but the call should not error
    expect(error).toBeNull();
  });
});
