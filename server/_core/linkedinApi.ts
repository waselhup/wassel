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

function getProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.LINKEDIN_PROXY_URL;
  if (!proxyUrl) {
    console.warn('[LinkedIn] No LINKEDIN_PROXY_URL set — requests will come from datacenter IP (may be blocked)');
    return undefined;
  }
  return new HttpsProxyAgent(proxyUrl);
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
    'x-li-track': '{"clientVersion":"1.13.8806","mpVersion":"1.13.8806","osName":"web","timezoneOffset":3,"timezone":"Asia/Riyadh","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
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

function isSessionExpired(status: number): boolean {
  return status >= 300 && status < 400 || status === 401 || status === 403;
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

    if (isSessionExpired(res.status)) {
      return { success: false, error: 'session_expired: LinkedIn redirected (li_at cookie invalid)' };
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

// ─── SEND CONNECTION REQUEST (INVITE) ──────────────────────

export async function sendInvite(
  session: LinkedInSession,
  profileId: string,
  note?: string
) {
  try {
    // Method 1: normInvitations (classic, still works in 2026)
    const body: any = {
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

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/growth/normInvitations',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status)) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    const errText = await res.text().catch(() => '');

    // If normInvitations fails with 422, try the newer endpoint
    if (res.status === 422 || res.status === 400) {
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
    const entityUrn = profileId.startsWith('urn:')
      ? profileId
      : `urn:li:fsd_profile:${profileId}`;

    const body: any = {
      invitee: {
        inviteeUnion: {
          memberProfile: entityUrn,
        },
      },
    };

    if (note && note.trim()) {
      body.customMessage = note.trim().slice(0, 300);
    }

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate',
      {
        method: 'POST',
        headers: getHeaders(session, 'application/json'),
        body: JSON.stringify(body),
        redirect: 'manual',
        ...getFetchOpts(),
      }
    );

    if (isSessionExpired(res.status)) {
      return { success: false, error: 'session_expired' };
    }

    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }

    const errText = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status} (v2): ${errText.slice(0, 300)}` };
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

    if (isSessionExpired(res.status)) {
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

    if (isSessionExpired(res.status)) {
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

    if (isSessionExpired(res.status)) {
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

    if (isSessionExpired(res.status)) {
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

    if (isSessionExpired(res.status)) {
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
