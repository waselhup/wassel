import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { decrypt } from './encryption.js';
import { launchBrowser, createPageWithCookies, randomDelay } from './browser.js';
import { automationQueue } from './queue.js';
import { visitProfile } from './actions/visit.js';
import { sendInvite } from './actions/connect.js';
import { sendMessage } from './actions/message.js';
import { publishPost } from './actions/post.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Daily limit tracking (in-memory, resets on restart — use Redis in production)
const dailyCounts = {};

function getDailyKey(userId, type) {
  const today = new Date().toDateString();
  return `${userId}:${type}:${today}`;
}

function checkLimit(userId, type) {
  const key = getDailyKey(userId, type);
  const count = dailyCounts[key] || 0;
  const limit = config.dailyLimits[type] || 50;
  return count < limit;
}

function incrementCount(userId, type) {
  const key = getDailyKey(userId, type);
  dailyCounts[key] = (dailyCounts[key] || 0) + 1;
}

// Process queue — 1 concurrent job (sequential to avoid detection)
automationQueue.process('linkedin-action', 1, async (job) => {
  const { type, userId, teamId, prospectStepId, linkedinUrl, name, message, campaignId } = job.data;

  console.log(`[Worker] Processing: ${type} for ${name} (${linkedinUrl})`);

  // Rate limit check
  if (!checkLimit(userId, type)) {
    console.warn(`[Worker] Daily limit reached for ${type}`);
    // Revert to pending so it can be retried tomorrow
    if (prospectStepId) {
      await supabase
        .from('prospect_step_status')
        .update({ status: 'pending' })
        .eq('id', prospectStepId);
    }
    return { ok: false, error: 'daily_limit_reached' };
  }

  // Get user's encrypted cookies
  const { data: session } = await supabase
    .from('linkedin_sessions')
    .select('li_at, jsessionid, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!session) {
    if (prospectStepId) {
      await supabase
        .from('prospect_step_status')
        .update({ status: 'failed', error_message: 'No active LinkedIn session' })
        .eq('id', prospectStepId);
    }
    throw new Error('No active LinkedIn session');
  }

  // Decrypt cookies
  let liAt, jsessionId;
  try {
    liAt = decrypt(session.li_at);
    jsessionId = session.jsessionid ? decrypt(session.jsessionid) : null;
  } catch (e) {
    throw new Error('Failed to decrypt cookies: ' + e.message);
  }

  // Launch browser and execute action
  let browser;
  try {
    browser = await launchBrowser();
    const page = await createPageWithCookies(browser, liAt, jsessionId);

    let result;
    switch (type) {
      case 'visit':
        result = await visitProfile(page, linkedinUrl);
        break;
      case 'connect':
        result = await sendInvite(page, linkedinUrl, message);
        break;
      case 'message':
        result = await sendMessage(page, linkedinUrl, message);
        break;
      case 'post':
        result = await publishPost(page, message);
        break;
      default:
        result = { ok: false, error: 'unknown_action_type' };
    }

    // Update prospect_step_status
    if (prospectStepId) {
      await supabase
        .from('prospect_step_status')
        .update({
          status: result.ok ? 'completed' : 'failed',
          executed_at: new Date().toISOString(),
          error_message: result.error || null,
        })
        .eq('id', prospectStepId);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: type,
      status: result.ok ? 'success' : 'failed',
      prospect_name: name || result.name || '',
      linkedin_url: linkedinUrl,
      campaign_id: campaignId || null,
      error_message: result.error || null,
    });

    // Update session last used
    await supabase
      .from('linkedin_sessions')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('user_id', userId);

    // Increment daily count
    if (result.ok) {
      incrementCount(userId, type);
    }

    // Random delay between actions (45-90s) to mimic human behavior
    await randomDelay(45000, 90000);

    return result;
  } finally {
    if (browser) await browser.close();
  }
});

console.log('[Worker] LinkedIn automation worker started');
