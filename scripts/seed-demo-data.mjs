#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');

  try {
    // Create a demo auth user
    const demoEmail = `demo-${Date.now()}@wassel.app`;
    
    console.log(`🔐 Creating Supabase Auth user...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: 'DemoPassword123!@#',
      email_confirm: true,
      user_metadata: {
        full_name: 'Demo User',
      },
    });

    if (authError) {
      console.log(`  ❌ Auth user creation failed: ${authError.message}`);
      process.exit(1);
    }

    const userId = authData.user.id;
    console.log(`  ✅ Auth user created (${userId})`);

    // Create profile linked to auth user
    console.log(`\n📝 Creating profile...`);
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      email: demoEmail,
      full_name: 'Demo User',
      company_name: 'Demo Company',
      job_title: 'Marketing Manager',
      linkedin_url: 'https://linkedin.com/in/demo',
      timezone: 'Asia/Riyadh',
      locale: 'ar',
      subscription_tier: 'pro',
      subscription_status: 'active',
      credits_remaining: 100,
      monthly_credits: 100,
    });

    if (profileError) {
      console.log(`  ❌ Profile creation failed: ${profileError.message}`);
      process.exit(1);
    }
    console.log(`  ✅ Profile created`);

    // Create a demo team
    const teamId = randomUUID();
    console.log(`\n👥 Creating demo team...`);

    const { error: teamError } = await supabase.from('teams').insert({
      id: teamId,
      name: 'Demo Team',
      slug: `demo-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'pro',
      credits_remaining: 100,
    });

    if (teamError) {
      console.log(`  ❌ Team creation failed: ${teamError.message}`);
      process.exit(1);
    }
    console.log(`  ✅ Team created`);

    // Add user to team
    console.log(`\n🔗 Adding user to team...`);
    const { error: memberError } = await supabase.from('team_members').insert({
      id: randomUUID(),
      team_id: teamId,
      user_id: userId,
      role: 'owner',
    });

    if (memberError) {
      console.log(`  ❌ Member creation failed: ${memberError.message}`);
      process.exit(1);
    }
    console.log(`  ✅ User added to team`);

    // Create a demo campaign
    const campaignId = randomUUID();
    console.log(`\n📢 Creating demo campaign...`);

    const { error: campaignError } = await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'LinkedIn Outreach - Q1 2026',
      description: 'Reaching out to decision makers in tech',
      status: 'active',
      type: 'invitation_message',
      configuration: {
        target_industry: 'Technology',
        target_title: 'CTO, VP Engineering',
        message_template: 'Hi {{firstName}}, I noticed your work at {{company}}...',
      },
      stats: {
        total_leads: 3,
        completed: 1,
        pending: 2,
        failed: 0,
      },
      created_by: userId,
    });

    if (campaignError) {
      console.log(`  ❌ Campaign creation failed: ${campaignError.message}`);
      process.exit(1);
    }
    console.log(`  ✅ Campaign created`);

    // Create demo leads
    console.log(`\n👤 Creating demo leads...`);
    const leadIds = [];
    const leads = [
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_id: `lead-001-${Date.now()}`,
        linkedin_url: 'https://linkedin.com/in/lead-001',
        first_name: 'أحمد',
        last_name: 'محمد',
        headline: 'CTO at TechCorp',
        company: 'TechCorp',
        industry: 'Technology',
        location: 'Riyadh, Saudi Arabia',
        email: 'ahmad@techcorp.com',
        status: 'new',
        priority: 8,
        profile_data: {
          connections: 500,
          followers: 1200,
          endorsements: ['Leadership', 'Technology'],
        },
      },
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_id: `lead-002-${Date.now()}`,
        linkedin_url: 'https://linkedin.com/in/lead-002',
        first_name: 'فاطمة',
        last_name: 'علي',
        headline: 'VP Engineering at InnovateLabs',
        company: 'InnovateLabs',
        industry: 'Technology',
        location: 'Dubai, UAE',
        email: 'fatima@innovatelabs.com',
        status: 'in_progress',
        priority: 9,
        profile_data: {
          connections: 800,
          followers: 2100,
          endorsements: ['Engineering', 'Product Management'],
        },
      },
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_id: `lead-003-${Date.now()}`,
        linkedin_url: 'https://linkedin.com/in/lead-003',
        first_name: 'محمد',
        last_name: 'سالم',
        headline: 'Engineering Manager at CloudFirst',
        company: 'CloudFirst',
        industry: 'Cloud Computing',
        location: 'Jeddah, Saudi Arabia',
        email: 'mohammad@cloudfirst.com',
        status: 'completed',
        priority: 7,
        profile_data: {
          connections: 650,
          followers: 1500,
          endorsements: ['Cloud Architecture', 'Team Management'],
        },
      },
    ];

    for (const lead of leads) {
      const { error: leadError } = await supabase.from('leads').insert(lead);
      if (leadError) {
        console.log(`  ⚠️  Lead ${lead.first_name} failed: ${leadError.message}`);
      } else {
        leadIds.push(lead.id);
        console.log(`  ✅ Lead created: ${lead.first_name} ${lead.last_name}`);
      }
    }

    // Create demo queue items
    console.log(`\n⏳ Creating demo queue items...`);
    const queueItems = [
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        lead_id: leadIds[0],
        step_id: null,
        action_type: 'send_message',
        content: 'مرحباً أحمد، لاحظت عملك الممتاز في TechCorp...',
        priority: 'important',
        confidence: 'high',
        status: 'pending',
      },
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        lead_id: leadIds[1],
        step_id: null,
        action_type: 'send_invitation',
        content: 'إضافة فاطمة كمتابع على LinkedIn',
        priority: 'normal',
        confidence: 'medium',
        status: 'pending',
      },
      {
        id: randomUUID(),
        team_id: teamId,
        campaign_id: campaignId,
        lead_id: leadIds[2],
        step_id: null,
        action_type: 'send_message',
        content: 'متابعة مع محمد بخصوص فرصة تعاون',
        priority: 'normal',
        confidence: 'high',
        status: 'pending',
      },
    ];

    for (const item of queueItems) {
      const { error: queueError } = await supabase.from('action_queue').insert(item);
      if (queueError) {
        console.log(`  ⚠️  Queue item failed: ${queueError.message}`);
      } else {
        console.log(`  ✅ Queue item created: ${item.action_type}`);
      }
    }

    console.log('\n✅ Demo data seeded successfully!');
    console.log(`\nDemo credentials for testing:`);
    console.log(`  Email: ${demoEmail}`);
    console.log(`  Password: DemoPassword123!@#`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Team ID: ${teamId}`);
    console.log(`  Campaign ID: ${campaignId}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDemoData();
