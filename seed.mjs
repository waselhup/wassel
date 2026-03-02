#!/usr/bin/env node
/**
 * Wassel Seed Script
 * Creates deterministic test data for development and demos
 * Run: node seed.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Test user ID (use a consistent UUID for demos)
const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEMO_TEAM_ID = '550e8400-e29b-41d4-a716-446655440001';

async function seedDatabase() {
  try {
    console.log('🌱 Starting Wassel seed...\n');

    // 1. Create team
    console.log('📦 Creating team...');
    const { error: teamError } = await supabase
      .from('teams')
      .upsert(
        {
          id: DEMO_TEAM_ID,
          name: 'فريق العرض التوضيحي',
          owner_id: DEMO_USER_ID,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (teamError) {
      console.error('❌ Team error:', teamError);
    } else {
      console.log('✅ Team created\n');
    }

    // 2. Create team member
    console.log('👤 Creating team member...');
    const { error: memberError } = await supabase
      .from('team_members')
      .upsert(
        {
          team_id: DEMO_TEAM_ID,
          user_id: DEMO_USER_ID,
          role: 'owner',
          created_at: new Date().toISOString(),
        },
        { onConflict: ['team_id', 'user_id'] }
      );

    if (memberError) {
      console.error('❌ Team member error:', memberError);
    } else {
      console.log('✅ Team member created\n');
    }

    // 3. Create campaigns
    console.log('📊 Creating campaigns...');
    const campaigns = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        team_id: DEMO_TEAM_ID,
        owner_id: DEMO_USER_ID,
        name: 'حملة نمو LinkedIn Q1',
        type: 'invitation',
        status: 'active',
        description: 'استهداف المديرين التنفيذيين في قطاع التكنولوجيا',
        leads_count: 342,
        response_rate: 32,
        messages_count: 1200,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        team_id: DEMO_TEAM_ID,
        owner_id: DEMO_USER_ID,
        name: 'حملة الشراكات الاستراتيجية',
        type: 'message',
        status: 'draft',
        description: 'التواصل مع الشركات الناشئة للشراكات',
        leads_count: 0,
        response_rate: 0,
        messages_count: 0,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        team_id: DEMO_TEAM_ID,
        owner_id: DEMO_USER_ID,
        name: 'حملة التوظيف الربع الرابع',
        type: 'sequence',
        status: 'paused',
        description: 'البحث عن مهندسي البرمجيات الموهوبين',
        leads_count: 523,
        response_rate: 25,
        messages_count: 890,
      },
    ];

    for (const campaign of campaigns) {
      const { error } = await supabase
        .from('campaigns')
        .upsert(campaign, { onConflict: 'id' });
      if (error) console.error('❌ Campaign error:', error);
    }
    console.log(`✅ ${campaigns.length} campaigns created\n`);

    // 4. Create leads
    console.log('👥 Creating leads...');
    const leads = [
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        owner_id: DEMO_USER_ID,
        name: 'أحمد السالم',
        company: 'شركة الرؤية الرقمية',
        position: 'مدير التسويق الرقمي',
        linkedin_url: 'https://linkedin.com/in/ahmed-alsalem',
        email: 'ahmed@vision-digital.sa',
        status: 'contacted',
        notes: 'مهتم بالحلول التسويقية الذكية',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        owner_id: DEMO_USER_ID,
        name: 'فاطمة العتيبي',
        company: 'منصة التجارة الإلكترونية العربية',
        position: 'مديرة المنتج',
        linkedin_url: 'https://linkedin.com/in/fatima-alotaibi',
        email: 'fatima@ecommerce-arab.com',
        status: 'responded',
        notes: 'ردت بإيجابية، جدولة اجتماع الأسبوع القادم',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440022',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        owner_id: DEMO_USER_ID,
        name: 'محمد الدوسري',
        company: 'مجموعة الدوسري للاستثمارات',
        position: 'رئيس قسم الابتكار',
        linkedin_url: 'https://linkedin.com/in/mohammed-aldosari',
        email: 'mohammed@aldosari-group.sa',
        status: 'new',
        notes: 'جديد، في انتظار الرد',
      },
    ];

    for (const lead of leads) {
      const { error } = await supabase
        .from('leads')
        .upsert(lead, { onConflict: 'id' });
      if (error) console.error('❌ Lead error:', error);
    }
    console.log(`✅ ${leads.length} leads created\n`);

    // 5. Create action queue items
    console.log('📋 Creating action queue items...');
    const queueItems = [
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        lead_id: '550e8400-e29b-41d4-a716-446655440020',
        owner_id: DEMO_USER_ID,
        type: 'invitation',
        content:
          'مرحباً أحمد، لاحظت أن لديك خبرة رائعة في التسويق الرقمي. أود التحدث معك حول فرص التعاون.',
        priority: 'normal',
        confidence: 'high',
        status: 'pending',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440031',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        lead_id: '550e8400-e29b-41d4-a716-446655440021',
        owner_id: DEMO_USER_ID,
        type: 'message',
        content:
          'شكراً على ردك الإيجابي! هل تتاح لك فرصة للاجتماع الأسبوع القادم؟',
        priority: 'important',
        confidence: 'high',
        status: 'pending',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440032',
        team_id: DEMO_TEAM_ID,
        campaign_id: '550e8400-e29b-41d4-a716-446655440010',
        lead_id: '550e8400-e29b-41d4-a716-446655440022',
        owner_id: DEMO_USER_ID,
        type: 'invitation',
        content:
          'مرحباً محمد، أعجبت بعملك في مجال الابتكار. أود مشاركة بعض الأفكار معك.',
        priority: 'normal',
        confidence: 'medium',
        status: 'pending',
      },
    ];

    for (const item of queueItems) {
      const { error } = await supabase
        .from('action_queue')
        .upsert(item, { onConflict: 'id' });
      if (error) console.error('❌ Queue item error:', error);
    }
    console.log(`✅ ${queueItems.length} queue items created\n`);

    console.log('✨ Seed completed successfully!\n');
    console.log('📊 Demo credentials:');
    console.log(`   User ID: ${DEMO_USER_ID}`);
    console.log(`   Team ID: ${DEMO_TEAM_ID}`);
    console.log('\n💡 Tip: Use these IDs for testing and demos.\n');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedDatabase();
