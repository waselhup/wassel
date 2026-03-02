# وصل | Wassel - Project TODO

## Phase 1: Project Intelligence ✅
- [x] تحليل المشروع الحالي
- [x] فهم البنية التقنية
- [x] تحديد المتطلبات والفجوات

## Phase 2: Foundation Fixes ✅
- [x] إصلاح مخطط Supabase (Schema)
- [x] إكمال سياسات RLS المبتورة
- [x] التحقق من صحة ربط team_id و owner_id
- [x] التحقق من صحة ملف manifest.json
- [x] التأكد من توافق Manifest V3
- [x] إنشاء ملف TODO.md
- [x] توثيق التغييرات

## Phase 3-6: Design System & Dashboard ✅
- [x] نظام التصميم الكامل (Deep Confident Blue, Tajawal)
- [x] مكونات لوحة التحكم (Teams, Campaigns, Leads, Queue)
- [x] تكامل tRPC مع الواجهة الأمامية
- [x] تحميل البيانات الحقيقية من Supabase

## Phase 7: Infrastructure ✅
- [x] تطبيق جميع migrations (001-004)
- [x] التحقق من RLS policies
- [x] إزالة MySQL/Drizzle تماماً
- [x] Supabase SDK فقط في Runtime
- [x] توثيق البنية التحتية

## Phase 8: Supabase Auth + Multi-tenant ✅
- [x] بناء صفحة تسجيل الدخول (Magic Link)
- [x] بناء معالج callback (/auth/callback)
- [x] تطبيق Auto-Onboarding
- [x] حماية لوحة التحكم (Dashboard Gating)
- [x] إنشاء mutations لبيانات تجريبية
- [x] إضافة زر إنشاء بيانات تجريبية
- [x] اختبار persistence

## Phase 9: Real Product Mode ✅

### Priority 1: Auth Hardening
- [x] تحسين رسائل Magic Link (عربي فقط)
- [x] إضافة حالات تحميل واضحة
- [x] معالجة الروابط المنتهية الصلاحية
- [x] منع auth flicker
- [x] التحقق من الاستقرار عبر التحديث

### Priority 2: First User Experience
- [x] تصميم empty states ذكية
- [x] إضافة إرشادات للمستخدمين الجدد
- [x] استبدال زر demo بـ "ابدأ أول حملة"
- [x] إضافة educational tooltips
- [x] تحسين onboarding flow

### Priority 3: Real Campaign Creation
- [x] بناء نموذج إنشاء حملة حقيقي
- [x] تحديد أنواع الحملات (دعوات/رسائل/تسلسل)
- [x] الحفظ الفوري في Supabase
- [x] تحديث قائمة الحملات تلقائياً
- [x] التحقق من الصحة (validation)

### Priority 4: Queue Trust Building
- [x] إضافة شرح واضح للإجراءات
- [x] تحسين رسائل الموافقة (عربي)
- [x] إضافة confidence labels
- [x] تحسين microcopy
- [x] اختبار UX الموافقة/الرفض

### Priority 5: Remove Demo Energy
- [x] إزالة كل النصوص الإنجليزية من الواجهة
- [x] استبدال placeholder text
- [x] تدقيق اللغة العربية
- [x] إزالة dev wording
- [x] التأكد من consistency عام

## Phase 10: Core Product Depth ✅

### Priority 1: Lead Import System
- [x] بناء صفحة استيراد العملاء
- [x] دعم CSV import (عربي أول)
- [x] دعم إدخال يدوي للعملاء
- [x] التحقق من صحة البيانات
- [x] ربط العملاء بالحملات
- [x] تحديث عدادات الحملة
- [x] اختبار الاستيراد الجماعي

### Priority 2: Message Templates System
- [x] بناء صفحة إدارة القوالب
- [x] محرر نصوص عربي (بدون AI)
- [x] إنشاء وتعديل وحذف القوالب
- [x] معاينة القوالب
- [x] متغيرات التخصيص ({{name}}, {{company}})
- [x] ربط القوالب بالحملات
- [x] اختبار التخصيص

### Priority 3: Complete Core Loop
- [ ] ربط Campaign → Leads → Queue
- [ ] عند إضافة عملاء: إنشاء queue items تلقائياً
- [ ] عند الموافقة: إرسال الرسالة (محاكاة)
- [ ] تحديث حالة الحملة تلقائياً
- [ ] لا demo energy - بيانات حقيقية فقط
- [ ] اختبار تدفق البيانات الكامل

### Priority 4: Extension API Readiness
- [ ] تصميم data contracts
- [ ] بناء APIs نظيفة للـ Extension
- [ ] توثيق endpoints
- [ ] اختبار APIs من خارج التطبيق
- [ ] عدم بناء Extension UI (فقط التحضير)

## Phase 12: Chrome Extension (CURRENT)

### Priority 1: Extension Foundation
- [ ] إنشاء مشروع extension منفصل
- [ ] Manifest V3 configuration
- [ ] Modular architecture setup
- [ ] Popup UI framework
- [ ] Content script foundation
- [ ] Background worker setup
- [ ] Build pipeline (webpack/esbuild)
- [ ] Development mode setup

### Priority 2: LinkedIn Surface Integration
- [ ] Profile page overlay detection
- [ ] "Add to Wassel" button injection
- [ ] Lead capture helper UI
- [ ] DOM resilience (mutation observer)
- [ ] Subtle, premium styling
- [ ] Arabic UI in extension
- [ ] Profile data extraction
- [ ] Error handling for DOM changes

### Priority 3: Secure Communication Layer
- [ ] Supabase auth token reuse
- [ ] tRPC client in extension
- [ ] Message passing protocol
- [ ] Session expiry handling
- [ ] Token refresh mechanism
- [ ] Error boundary for auth failures
- [ ] Secure storage (chrome.storage)
- [ ] CORS handling

### Priority 4: First Power Feature
- [ ] Extract LinkedIn profile data
- [ ] Send profile to Wassel campaign
- [ ] Confirmation UI
- [ ] Success/error feedback
- [ ] Campaign selection dialog
- [ ] Lead deduplication check
- [ ] Automatic queue item creation
- [ ] User notification

### Priority 5: Stability & Error Handling
- [ ] DOM mutation resilience
- [ ] Network error recovery
- [ ] Session expiry graceful handling
- [ ] Silent failure logging
- [ ] Extension crash recovery
- [ ] Performance optimization
- [ ] Memory leak prevention
- [ ] Comprehensive error messages (Arabic)

## Phase 13: Launch Readiness
- [ ] إعداد خطة النشر (Deployment Plan)
- [ ] تجهيز Chrome Web Store
- [ ] إعداد خطافات النقود (Monetization Hooks)
- [ ] إعداد تنبيهات الترقية (Upgrade Nudges)
- [ ] إعداد خطافات النمو المستقبلية (Growth Hooks)
- [ ] إنشاء قائمة فحص الإطلاق (Launch Checklist)

## Technical Debt & Fixes
- [ ] إعداد CI/CD Pipeline
- [ ] إعداد اختبارات الوحدة (Unit Tests)
- [ ] إعداد اختبارات التكامل (Integration Tests)
- [ ] إعداد اختبارات E2E
- [ ] توثيق API
- [ ] توثيق العمارة (Architecture Documentation)

## Notes
- **Language:** Arabic RTL First, English disabled until approval
- **Database:** Supabase with PostgreSQL (Single Source of Truth)
- **Frontend:** React 19 + Tailwind 4 + tRPC
- **Backend:** Express 4 + tRPC
- **Auth:** Supabase Magic Link (Arabic-first)
- **Architecture:** Supabase SDK only at runtime, no direct DB access
- **Team Isolation:** Enforced everywhere (server + database level)
- **Payment:** Stripe (Test Mode) - TBD
- **Extension:** Chrome Manifest V3

## Phase 11: Close the Core Loop (CURRENT)

### Priority 1: Auto Queue Generation
- [ ] عند إضافة عملاء: إنشاء queue items تلقائياً
- [ ] احترام نوع الحملة (invitation/message/sequence)
- [ ] لا demo logic - بيانات حقيقية فقط
- [ ] Queue يبدو حياً

### Priority 2: Real Data Flow Validation
- [ ] إنشاء campaign
- [ ] استيراد leads
- [ ] ربط template
- [ ] التحقق من Queue population
- [ ] التحقق من persistence بعد التحديث
- [ ] لا broken states

### Priority 3: Queue Trust Polish
- [ ] معاينة الرسائل العربية
- [ ] إضافة confidence indicators
- [ ] رسائل بشرية هادئة
- [ ] Queue يبدو كمساعد بانتظار موافقة

### Priority 4: System Stability Pass
- [ ] فحص Routing (/dashboard/*)
- [ ] فحص State persistence
- [ ] فحص Error handling
- [ ] فحص Empty states
- [ ] فحص Arabic consistency
- [ ] لا dev edges

### Priority 5: Extension Foundation APIs
- [ ] Design clean APIs
- [ ] Normalize data contracts
- [ ] Auth tokens usable externally
- [ ] لا Extension UI

## Phase 13: Market-Ready Mode (CURRENT)

### Priority 1: Product Confidence Layer
- [ ] تحسين حالات التحميل (Loading Polish)
- [ ] تحسين empty states في Dashboard
- [ ] تحسين empty states في Extension
- [ ] إضافة onboarding hints عربية
- [ ] إزالة أي سلوكيات dev-like
- [ ] التأكد من أن كل شيء مقصود

### Priority 2: First Real User Experience
- [ ] تصميم رحلة المستخدم الأول (Login → First Win)
- [ ] فهم المستخدم لما يفعله Wassel
- [ ] توجيه واضح للخطوة التالية
- [ ] إظهار ما يبدو عليه النجاح
- [ ] إضافة hints موجهة (عربي أول)
- [ ] واجهة توجيهية ناعمة
- [ ] بدون خيارات مربكة

### Priority 3: Saudi Product Identity
- [ ] تحسين اتساق نبرة اللغة العربية
- [ ] microcopy احترافية سعودية
- [ ] لغة بناء الثقة
- [ ] صياغة ودية للأعمال
- [ ] الشعور المحلي والفخم والجدي
- [ ] ليس generic SaaS

### Priority 4: Extension ↔ Dashboard Coherence
- [ ] توحيد المصطلحات
- [ ] توحيد لغة الإجراءات
- [ ] توحيد حالات التأكيد
- [ ] توحيد الإيقاع البصري
- [ ] شعور منتج واحد، ليس أداتان

### Priority 5: Remove Last 5% Friction
- [ ] تدقيق تأخيرات صغيرة
- [ ] إزالة صياغة مربكة
- [ ] توضيح التدفقات
- [ ] إزالة نقاط تردد UX
- [ ] Polish عدواني
- [ ] حيث يتم صنع المنتجات الفخمة

## Phase 14: Launch & Scale (Later)
- [ ] Chrome Web Store submission
- [ ] Marketing materials
- [ ] User onboarding videos
- [ ] Support documentation
- [ ] Analytics dashboard
- [ ] Pricing & billing
