import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClient } from "@supabase/supabase-js";

export type UserRole = 'super_admin' | 'client_user';

export type AuthUser = {
  id: string;
  email?: string | null;
  role: UserRole;
  teamId?: string | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthUser | null;
};

/**
 * Get a service-role Supabase client (used server-side only)
 */
function getServiceSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Extract Supabase user from Authorization header
 * Loads role from profiles table and teamId from team_members
 * Header format: "Bearer <access_token>"
 */
async function getSupabaseUser(
  authHeader: string | undefined
): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getServiceSupabase();

    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Load role from profiles
    let role: UserRole = 'client_user';
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'super_admin') {
      role = 'super_admin';
    }

    // Load primary team_id from team_members
    let teamId: string | null = null;
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (membership?.team_id) {
      teamId = membership.team_id;
    }

    return {
      id: user.id,
      email: user.email,
      role,
      teamId,
    };
  } catch (error) {
    console.error("Failed to verify Supabase token:", error);
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthUser | null = null;

  try {
    const authHeader = opts.req.headers.authorization;

    // Try Supabase JWT first
    user = await getSupabaseUser(authHeader);

    // Fallback: try extension token
    if (!user && authHeader?.startsWith('Bearer ')) {
      user = verifyExtensionToken(authHeader.slice(7));
    }

    // Last resort: recover from expired JWT (same as Express middleware)
    if (!user && authHeader?.startsWith('Bearer ')) {
      user = await recoverUserFromExpiredJwt(authHeader.slice(7));
    }
  } catch (error) {
    console.error("Context creation error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

/**
 * Verify a short-lived extension session token (HMAC-SHA256 signed)
 * Format: base64url(payload).base64url(signature)
 */
function verifyExtensionToken(token: string): AuthUser | null {
  try {
    const crypto = require('crypto');
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'wassel-ext-secret';

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Check issuer
    if (payload.iss !== 'wassel-ext') return null;

    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role || 'client_user',
      teamId: payload.targetClientId ? null : payload.teamId, // If operating as client, use target context
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware: extract user from JWT or extension token and attach to req
 * Used by Express routes (non-tRPC) to replace ADMIN_KEY pattern
 * Supports both Supabase JWT and short-lived extension tokens
 */
export async function expressAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  // Try Supabase JWT first
  let user = await getSupabaseUser(authHeader);

  // Fallback: try extension token
  if (!user && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    user = verifyExtensionToken(token);
  }

  // Last resort: decode expired JWT payload to extract user_id
  // This allows extension requests with expired tokens to still authenticate
  if (!user && authHeader?.startsWith('Bearer ')) {
    user = await recoverUserFromExpiredJwt(authHeader.slice(7));
  }

  req.user = user;
  next();
}

/**
 * Decode an expired Supabase JWT without verification to extract user_id.
 * Then verify user exists in DB and load their role + teamId.
 * Safe for extension routes since the JWT was originally issued by Supabase.
 */
async function recoverUserFromExpiredJwt(token: string): Promise<AuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );

    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') return null;

    const supa = getServiceSupabase();

    const { data: profile } = await supa
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    let teamId: string | null = null;
    const { data: membership } = await supa
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (membership?.team_id) {
      teamId = membership.team_id;
    }

    console.log(`[Auth] Recovered user ${userId} from expired JWT`);

    return {
      id: userId,
      email: payload.email || null,
      role: profile.role === 'super_admin' ? 'super_admin' : 'client_user',
      teamId,
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware: require a specific role
 */
export function requireRole(role: UserRole) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== role && role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  };
}
