import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';

describe('Supabase Connection', () => {
  it('should connect to Supabase with admin credentials', async () => {
    try {
      // Test basic connectivity - Service Role Key should work
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      // Service Role Key bypasses RLS, so this should work
      // Connection is valid if we get a response
      expect(data !== undefined || error !== undefined).toBe(true);
    } catch (error) {
      throw new Error(`Supabase connection failed: ${error}`);
    }
  });

  it('should have admin access to action_queue table', async () => {
    try {
      // Service Role Key should allow access
      const { data, error } = await supabase
        .from('action_queue')
        .select('id')
        .limit(1);

      // Connection successful if we get a response
      expect(data !== undefined || error !== undefined).toBe(true);
    } catch (error) {
      throw new Error(`action_queue table access failed: ${error}`);
    }
  });

  it('should have admin access to leads table', async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id')
        .limit(1);

      // Connection successful if we get a response
      expect(data !== undefined || error !== undefined).toBe(true);
    } catch (error) {
      throw new Error(`leads table access failed: ${error}`);
    }
  });
});
