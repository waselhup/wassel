import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';

/**
 * Signup now redirects to /login — single LinkedIn-only flow.
 */
export default function Signup() {
  const { user } = useAuth();

  if (user) {
    return <Redirect to="/app" />;
  }

  return <Redirect to="/login" />;
}
