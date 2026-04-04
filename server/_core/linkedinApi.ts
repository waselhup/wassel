/**
 * LinkedIn Voyager API — Server-side LinkedIn actions
 * Uses li_at + JSESSIONID cookies for authentication
 * All actions go through LinkedIn's internal Voyager REST API
 *
 * IMPORTANT: LinkedIn blocks datacenter IPs (AWS/Vercel).
 * Set LINKEDIN_PROXY_URL env var to a residential proxy to avoid blocks.
 * Format: http://user:pass@host:port
 */

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface LinkedInSession {
  liAt: string;
  jsessionId: string;
  userAgent: string;
}

// ─── Proxy Agent ──────────────────────────────────────────
// NOTE: Bright Data residential proxy blocks LinkedIn (policy_20090).
// Authenticated Voyager API calls with li_at cookie work fine without proxy.
// Only enable proxy if using a proper Web Unlocker zone.

function getProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.LINKEDIN_PROXY_URL;
  if (!proxyUrl) {
    return undefined;
  }
  // Check if it's a Web Unlocker zone (port 33335 is residential, not unlocker)
  try {
    const pu = new URL(proxyUrl);
    // Web Unlocker typically uses port 24000 or specific zone names
    // Regular residential (33335) blocks LinkedIn — skip it
    if (pu.port === '33335' || pu.port === '22225') {
      console.warn('[LinkedIn] Proxy port suggests residential/datacenter zone — LinkedIn blocked. Skipping proxy.');
      return undefined;
    }
  } catch {}
  return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
}

// Cache the agent so we don't create a new one per request
let _cachedAgent: HttpsProxyAgent<string> | undefined | null = null;
function getAgent(): HttpsProxyAgent<string> | undefined {
  if (_cachedAgent === null) {
    _cachedAgent = getProxyAgent();
  }
  return _cachedAgent;
}

// ─── Helpers ───────────────────────────────────────────────

function getHeaders(session: LinkedInSession, contentType?: string) {
  const csrfToken = session.jsessionId.replace(/"/g, '');
  const headers: Record<string, string> = {
    'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
    'csrf-token': csrfToken,
    'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
    'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;',
    'x-li-track': '{"clientVersion":"1.13.8806","mpVersion":"1.13.8806","osName":"web","timezoneOffset":3,"timezone":"Asia/Riyadh","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'origin': 'https://www.linkedin.com',
    'referer': 'https://www.linkedin.com/',
  };
  if (contentType) {
    headers['content-type'] = contentType;
  }
  return headers;
}

/** Get fetch options with proxy agent if configured */
function getFetchOpts(extra?: Record<string, any>): Record<string, any> {
  const agent = getAgent();
  return { ...(agent ? { agent } : {}), ...extra };
}

/**
 * Check if a response indicates the LinkedIn session is expired.
 * Only 401 and 403 are definitive session failures.
 * For 3xx redirects, check the Location header and Set-Cookie —
 * LinkedIn sends "li_at=delete me" when actively invalidating a session.
 */
function isSessionExpired(status: number, locationHeader?: string | null, setCookieHeader?: string | null): boolean {
  // LinkedIn actively invalidating session cookie
  if (setCookieHeader && setCookieHeader.includes('li_at=delete me')) {
    console.error('[LinkedIn] Session INVALIDATED by LinkedIn (li_at=delete me). User must re-login.');
    return true;
  }
  if (status === 401 || status === 403) return true;
  if (status >= 300 && status < 400) {
    // Check location for login/auth redirects
    if (locationHeader) {
      const loc = locationHeader.toLowerCase();
      if (loc.includes('login') || loc.includes('authwall') || loc.includes('checkpoint') || loc.includes('uas/login')) {
        return true;
      }
    }
    // 302 redirect to itself or to the same Voyager API = session issue ONLY IF it's a login challenge
    // (LinkedIn returns 301/308 simply to normalize URLs from some datacenters)
    if (locationHeader && locationHeader.includes('/voyager/api/') && status === 302) {
      console.warn('[LinkedIn] 302 Redirect to Voyager API — likely session issue');
      return true;
    }
    // Other redirects (301, 308, profile moved, etc.) are NOT session expiry
    return false;
  }
  return false;
}

/**
 * Extract profile slug from a LinkedIn URL
 * e.g. "https://www.linkedin.com/in/john-doe/" → "john-doe"
 */
export function extractSlug(linkedinUrl: string): string {
  const match = linkedinUrl.match(/\/in\/([^/?#]+)/);
  return match ? match[1].replace(/\/$/, '') : '';
}

// ─── VISIT PROFILE ─────────────────────────────────────────

export async function visitProfile(session: LinkedInSession, profileSlug: string) {
  try {
    const res = await fetch(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}`,
      {
        headers: getHeaders(session),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    const location = res.headers.get('location');

    if (isSessionExpired(res.status, location, res.headers.get('set-cookie'))) {
      return { success: false, error: `session_expired: HTTP ${res.status} → ${location || 'no location'}` };
    }

    // Handle non-login redirects (profile moved, etc.) — follow them
    if (res.status >= 300 && res.status < 400 && location) {
      console.log(`[LinkedIn] Profile ${profileSlug} redirected (${res.status}) to: ${location}`);
      // Try following the redirect manually
      try {
        const res2 = await fetch(location.startsWith('http') ? location : `https://www.linkedin.com${location}`, {
          headers: getHeaders(session),
          redirect: 'manual',
          ...getFetchOpts(),
        });
        if (res2.ok) {
          const data: any = await res2.json();
          const firstName = data?.firstName || data?.miniProfile?.firstName || '';
          const lastName = data?.lastName || data?.miniProfile?.lastName || '';
          const name = `${firstName} ${lastName}`.trim();
          const profileId = data?.entityUrn?.split(':').pop() ||
                            data?.miniProfile?.entityUrn?.split(':').pop() ||
                            data?.profileId ||
                            profileSlug;
          return { success: true, name, profileId, entityUrn: data?.entityUrn || `urn:li:fsd_profile:${profileId}` };
        }
        return { success: false, error: `HTTP ${res.status}→${res2.status}: redirect not resolved` };
      } catch (e2: any) {
        return { success: false, error: `redirect_follow_failed: ${e2.message}` };
      }
    }

    if (res.ok) {
      const data: any = await res.json();
      const firstName = data?.firstName || data?.miniProfile?.firstName || '';
      const lastName = data?.lastName || data?.miniProfile?.lastName || '';
      const name = `${firstName} ${lastName}`.trim();
      const profileId = data?.entityUrn?.split(':').pop() ||
                        data?.miniProfile?.entityUrn?.split(':').pop() ||
                        data?.profileId ||
                        profileSlug;

      return {
        success: true,
        name,
        profileId,
        entityUrn: data?.entityUrn || `urn:li:fsd_profile:${profileId}`,
      };
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── SEND CONNECTION REQUEST (INVITE) ──────────────────────────

/** Generate a trackingId matching LinkedIn's format (base64 of 16 random bytes) */
function generateTrackingId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export async function sendInvite(
  session: LinkedInSession,
  profileId: string,
  note?: string
) {
  try {
    const trackingId = generateTrackingId();

    // Method 1: normInvitations (classic, still works in 2026)
    const body: any = {
      trackingId,
      invitee: {
        'com.linkedin.voyager.growth.invitation.InviteeProfile': {
          profileId: profileId,
        },
      },
    };

    // Only include message if provided and non-empty (max 300 chars)
    if (note && note.trim()) {
      body.message = note.trim().slice(0, 300);
    }

    let res = await fetch(
      'https://www.linkedin.com/voyager/api/growth/normInvitations',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const loc = res.headers.get('location')!;
      res = await fetch(loc.startsWith('http') ? loc : `https://www.linkedin.com${loc}`, {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      });
    }

    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }

    // 422/409 = already invited — treat as success
    if (res.status === 422 || res.status === 409) {
      return { success: true, alreadyInvited: true };
    }

    const errText = await res.text().catch(() => '');

    // If normInvitations fails with 400, try the newer endpoint
    if (res.status === 400) {
      return await sendInviteV2(session, profileId, note);
    }

    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fallback invite endpoint (newer LinkedIn API)
 * Uses voyagerRelationshipsDashMemberRelationships
 */
async function sendInviteV2(
  session: LinkedInSession,
  profileId: string,
  note?: string
) {
  try {
    const trackingId = generateTrackingId();
    const entityUrn = profileId.startsWith('urn:')
      ? profileId
      : `urn:li:fsd_profile:${profileId}`;

    const body: any = {
      trackingId,
      invitee: {
        inviteeUnion: {
          memberProfile: entityUrn,
        },
      },
    };

    if (note && note.trim()) {
      body.customMessage = note.trim().slice(0, 300);
    }

    let res = await fetch(
      'https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const loc = res.headers.get('location')!;
      res = await fetch(loc.startsWith('http') ? loc : `https://www.linkedin.com${loc}`, {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      });
    }

    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }

    // 422/409 = already invited — treat as success
    if (res.status === 422 || res.status === 409) {
      return { success: true, alreadyInvited: true };
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (err: any) {
    return { success: false, error: `v2_invite_error: ${err.message}` };
  }
}

// ─── SEND MESSAGE ──────────────────────────────────────────

export async function sendMessage(
  session: LinkedInSession,
  profileUrn: string,
  message: string
) {
  try {
    // Method 1: Legacy conversations endpoint
    const body = {
      keyVersion: 'LEGACY_INBOX',
      conversationCreate: {
        eventCreate: {
          value: {
            'com.linkedin.voyager.messaging.create.MessageCreate': {
              attributedBody: { text: message, attributes: [] },
              attachments: [],
            },
          },
        },
        recipients: [profileUrn],
        subtype: 'MEMBER_TO_MEMBER',
      },
    };

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/messaging/conversations',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    // If legacy fails, try v2 messaging endpoint
    if (res.status === 422 || res.status === 400) {
      return await sendMessageV2(session, profileUrn, message);
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fallback message endpoint (newer LinkedIn messaging API)
 */
async function sendMessageV2(
  session: LinkedInSession,
  profileUrn: string,
  message: string
) {
  try {
    const body = {
      message: {
        body: {
          text: message,
        },
      },
      mailboxUrn: profileUrn,
      trackingId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status} (v2): ${errText.slice(0, 300)}` };
  } catch (err: any) {
    return { success: false, error: `v2_message_error: ${err.message}` };
  }
}

// ─── FOLLOW PROFILE ────────────────────────────────────────

export async function followProfile(session: LinkedInSession, profileSlug: string) {
  try {
    // First get profile to find entityUrn
    const profile = await visitProfile(session, profileSlug);
    if (!profile.success || !profile.profileId) {
      return { success: false, error: 'profile_not_found_for_follow' };
    }

    const entityUrn = profile.entityUrn || `urn:li:fsd_profile:${profile.profileId}`;

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/feed/follows',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify({ urn: entityUrn }),
        redirect: 'manual',
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true, name: profile.name };
    }

    // Try alternative follow endpoint
    const res2 = await fetch(
      `https://www.linkedin.com/voyager/api/voyagerRelationshipsDashFollows?action=followByEntityUrn`,
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify({ entityUrn }),
        redirect: 'manual',
      }
    );

    if (res2.ok || res2.status === 201 || res2.status === 200) {
      return { success: true, name: profile.name };
    }

    return { success: false, error: `HTTP ${res.status} / ${res2.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── CHECK CONNECTION STATUS ───────────────────────────────

/**
 * Check if a prospect accepted our connection request
 * Returns: 'connected' | 'pending' | 'not_connected' | 'error'
 */
export async function checkConnectionStatus(
  session: LinkedInSession,
  profileSlug: string
): Promise<{ status: string; error?: string }> {
  try {
    const res = await fetch(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}/networkinfo`,
      {
        headers: getHeaders(session),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { status: 'error', error: 'session_expired' };
    }

    if (res.ok) {
      const data: any = await res.json();
      // distance: SELF=0, FIRST_DEGREE=connected, SECOND_DEGREE/THIRD_DEGREE=not connected
      const distance = data?.distance?.value || data?.followingInfo?.distance?.value || '';

      if (distance === 'DISTANCE_1' || distance === 'FIRST_DEGREE') {
        return { status: 'connected' };
      }

      // Check if we have a pending invite
      const pendingInvite = data?.pendingInvitation || data?.entityUrn;
      if (pendingInvite) {
        // Check invitation status from relationships endpoint
        return { status: 'pending' };
      }

      return { status: 'not_connected' };
    }

    return { status: 'error', error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Alternative: Check connection via the relationship endpoint
 */
export async function getConnectionDegree(
  session: LinkedInSession,
  profileSlug: string
): Promise<string> {
  try {
    const profile = await visitProfile(session, profileSlug);
    if (!profile.success) return 'unknown';

    const res = await fetch(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}/networkinfo`,
      {
        headers: getHeaders(session),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (!res.ok) return 'unknown';

    const data: any = await res.json();
    const distance = data?.distance?.value || '';

    if (distance === 'DISTANCE_1') return 'connected';
    if (distance === 'DISTANCE_2') return 'second_degree';
    if (distance === 'DISTANCE_3') return 'third_degree';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── PUBLISH POST ──────────────────────────────────────────

export async function publishPost(
  session: LinkedInSession,
  content: string,
  authorUrn: string
) {
  try {
    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/contentcreation/normShares',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status, res.headers.get('location'), res.headers.get('set-cookie'))) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
