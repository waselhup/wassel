/**
 * LinkedIn Voyager API — Cloud automation without DOM clicking.
 * Uses stored li_at + JSESSIONID cookies to call LinkedIn's internal REST API.
 * Same approach as Waalaxy, Dripify, etc.
 */

export interface LinkedInSession {
  liAt: string;
  jsessionId: string;
  userAgent?: string;
}

function makeHeaders(session: LinkedInSession) {
  return {
    'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
    'csrf-token': session.jsessionId.replace(/"/g, ''),
    'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
    'x-li-track': '{"clientVersion":"1.13.8860","mpVersion":"1.13.8860","osName":"web","timezoneOffset":3,"timezone":"Asia/Riyadh","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
  };
}

// ─── Visit Profile ────────────────────────────────────────────
export async function visitProfile(
  session: LinkedInSession,
  profileSlug: string
): Promise<{ success: boolean; name?: string; profileId?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}`,
      { headers: makeHeaders(session) }
    );

    if (res.ok) {
      const data: any = await res.json();
      const firstName = data?.firstName || data?.miniProfile?.firstName || '';
      const lastName = data?.lastName || data?.miniProfile?.lastName || '';
      const entityUrn = data?.entityUrn || data?.miniProfile?.entityUrn || '';
      const profileId = entityUrn.split(':').pop() || '';

      return {
        success: true,
        name: `${firstName} ${lastName}`.trim(),
        profileId,
      };
    }

    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Send Connection Invite ───────────────────────────────────
export async function sendInvite(
  session: LinkedInSession,
  profileId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: any = {
      invitee: {
        'com.linkedin.voyager.growth.invitation.InviteeProfile': {
          profileId,
        },
      },
    };

    if (note && note.trim()) {
      body.message = note.trim();
    }

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/growth/normInvitations',
      {
        method: 'POST',
        headers: {
          ...makeHeaders(session),
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    const errText = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Send Message ─────────────────────────────────────────────
export async function sendMessage(
  session: LinkedInSession,
  profileUrn: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
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
        headers: {
          ...makeHeaders(session),
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Publish Post ─────────────────────────────────────────────
export async function publishPost(
  session: LinkedInSession,
  content: string,
  authorUrn: string
): Promise<{ success: boolean; error?: string }> {
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
        headers: {
          ...makeHeaders(session),
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
