import fetch from 'node-fetch';

interface LinkedInSession {
  liAt: string;
  jsessionId: string;
  userAgent: string;
}

// Visit a profile using Voyager API
export async function visitProfile(session: LinkedInSession, profileSlug: string) {
  try {
    const res = await fetch(
      `https://www.linkedin.com/voyager/api/identity/profiles/${profileSlug}`,
      {
        headers: {
          'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
          'csrf-token': session.jsessionId.replace(/"/g, ''),
          'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-li-lang': 'en_US',
          'x-restli-protocol-version': '2.0.0',
        },
      }
    );
    
    if (res.ok) {
      const data = await res.json();
      return { 
        success: true, 
        name: data?.firstName + ' ' + data?.lastName,
        profileId: data?.entityUrn?.split(':').pop(),
      };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Send connection invite using Voyager API
export async function sendInvite(
  session: LinkedInSession, 
  profileId: string, 
  note?: string
) {
  try {
    const body: any = {
      invitee: {
        'com.linkedin.voyager.growth.invitation.InviteeProfile': {
          profileId: profileId,
        },
      },
    };

    if (note) {
      body.message = note;
    }

    const res = await fetch(
      'https://www.linkedin.com/voyager/api/growth/normInvitations',
      {
        method: 'POST',
        headers: {
          'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
          'csrf-token': session.jsessionId.replace(/"/g, ''),
          'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'content-type': 'application/json',
          'x-li-lang': 'en_US',
          'x-restli-protocol-version': '2.0.0',
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

// Send message using Voyager API
export async function sendMessage(
  session: LinkedInSession,
  profileUrn: string,
  message: string
) {
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
          'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
          'csrf-token': session.jsessionId.replace(/"/g, ''),
          'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'content-type': 'application/json',
          'x-li-lang': 'en_US',
          'x-restli-protocol-version': '2.0.0',
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

// Publish a post using Voyager API
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
        headers: {
          'cookie': `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
          'csrf-token': session.jsessionId.replace(/"/g, ''),
          'user-agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'content-type': 'application/json',
          'x-li-lang': 'en_US',
          'x-restli-protocol-version': '2.0.0',
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
