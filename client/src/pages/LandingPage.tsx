import { useTranslation } from "react-i18next";
import { WasselLogo } from '../components/WasselLogo';
import VideoDemo from '../components/landing/VideoDemo';
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Linkedin, FileText, Mail, BarChart3, Shield, Check, ArrowRight, Star, Globe2, Users } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const stagger = {
  initial: {},
  whileInView: {},
  viewport: { once: true, margin: "-80px" },
  transition: { staggerChildren: 0.08, delayChildren: 0.1 },
};

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen bg-[#fafafa] text-[#1f2937]"
      style={{ fontFamily: isRTL ? "Cairo, sans-serif" : "Inter, sans-serif" }}
    >
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WasselLogo size={32} />
            <span className="text-xl font-extrabold text-[#064E49]">
              {t("brand.name", "وصّل")}
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6b7280]">
            <a href="#features" className="hover:text-[#064E49] transition">
              {t("nav.features", "المميزات")}
            </a>
            <a href="#how" className="hover:text-[#064E49] transition">
              {t("nav.how", "كيف يعمل")}
            </a>
            <a href="#pricing" className="hover:text-[#064E49] transition">
              {t("nav.pricing", "الأسعار")}
            </a>
            <a href="#faq" className="hover:text-[#064E49] transition">
              {t("nav.faq", "أسئلة شائعة")}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
              className="text-sm font-medium text-[#6b7280] hover:text-[#064E49]"
            >
              {isRTL ? "EN" : "AR"}
            </button>
            <Link
              href="/login"
              className="text-sm font-semibold text-[#064E49] hover:text-[#0A8F84] transition"
            >
              {t("nav.login", "دخول")}
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-[#0A8F84] text-white text-sm font-semibold shadow-md hover:shadow-xl hover:bg-[#12B5A8] transition-all"
            >
              {t("nav.signup", "ابدأ مجاناً")}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fafafa] via-white to-[#f0fdf9]" />
        <div className="absolute top-40 -end-20 w-96 h-96 rounded-full bg-[#0A8F84]/10 blur-3xl" />
        <div className="absolute bottom-0 -start-20 w-96 h-96 rounded-full bg-[#064E49]/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#064E49]/5 border border-[#064E49]/10 text-sm text-[#064E49] font-medium mb-6">
              <WasselLogo size={44} />
              {t("hero.badge", "مدعوم بالذكاء الاصطناعي · صنع في السعودية")}
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#064E49] leading-[1.1] mb-6">
              {t("hero.title", "وظيفتك القادمة")}
              <br />
              <span className="text-[#0A8F84]">
                {t("hero.title2", "تبدأ بنقرة واحدة")}
              </span>
            </h1>
            <p className="text-xl text-[#6b7280] leading-relaxed mb-10 max-w-xl">
              {t(
                "hero.subtitle",
                "حلّل ملفك على لينكدإن، حسّن سيرتك الذاتية، وأرسل 500 رسالة احترافية لصنّاع القرار في الشركات السعودية — كل ذلك بضغطة زر."
              )}
            </p>
            <div className="flex flex-wrap gap-4 mb-10">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#0A8F84] text-white font-semibold text-lg shadow-xl hover:shadow-2xl hover:bg-[#12B5A8] transition-all"
              >
                {t("hero.cta", "ابدأ مجاناً")}
                <ArrowRight
                  className={`w-5 h-5 group-hover:translate-x-1 transition ${isRTL ? "rotate-180" : ""}`}
                />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white border border-gray-200 text-[#064E49] font-semibold text-lg hover:border-[#064E49] transition"
              >
                {t("hero.cta2", "شاهد كيف يعمل")}
              </a>
            </div>
            <div className="flex items-center gap-6 text-sm text-[#6b7280]">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-[#064E49] to-[#0A8F84]"
                    />
                  ))}
                </div>
                <span>{t("hero.users", "+2,500 مستخدم")}</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-[#0A8F84] text-[#0A8F84]" />
                ))}
                <span className="ms-2">4.9/5</span>
              </div>
            </div>
          </motion.div>

          {/* Browser mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <div className="rounded-2xl shadow-2xl bg-white border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 text-center text-xs text-gray-500 font-mono">
                  wassel.sa/dashboard
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#6b7280]">
                      {t("mockup.score", "تقييم لينكدإن")}
                    </div>
                    <div className="text-3xl font-extrabold text-[#064E49]">
                      87<span className="text-base text-[#6b7280]">/100</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                    +12 {t("mockup.improved", "تحسّن")}
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: t("mockup.headline", "العنوان الوظيفي"), pct: 92 },
                    { label: t("mockup.summary", "النبذة"), pct: 85 },
                    { label: t("mockup.experience", "الخبرات"), pct: 78 },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs text-[#6b7280] mb-1">
                        <span>{row.label}</span>
                        <span>{row.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-full bg-gradient-to-r from-[#064E49] to-[#0A8F84]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-[#6b7280]">
                    {t("mockup.campaign", "حملة نشطة")}
                  </div>
                  <div className="text-sm font-semibold text-[#064E49]">
                    342 / 500
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -end-4 w-20 h-20 rounded-2xl bg-[#0A8F84] flex items-center justify-center shadow-xl rotate-6">
              <WasselLogo size={44} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section className="bg-white border-y border-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-[#6b7280] font-medium mb-6 uppercase tracking-wider">
            {t("trust.title", "موثوق به من قبل محترفين في")}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            {["Aramco", "STC", "SABIC", "NEOM", "PIF", "Almarai"].map((brand) => (
              <div key={brand} className="text-2xl font-bold text-[#064E49]">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — 6 cards */}
      {/* VIDEO DEMO */}
      <VideoDemo />

      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A8F84]/10 text-[#0A8F84] text-sm font-semibold mb-4">
              {t("features.badge", "كل ما تحتاجه")}
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#064E49] mb-4">
              {t("features.title", "منصة واحدة. نتائج حقيقية.")}
            </h2>
            <p className="text-xl text-[#6b7280] max-w-2xl mx-auto">
              {t(
                "features.subtitle",
                "ست أدوات قوية مدعومة بالذكاء الاصطناعي تعمل معاً لتسريع رحلتك المهنية"
              )}
            </p>
          </motion.div>

          <motion.div
            {...stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              {
                icon: Linkedin,
                title: t("features.linkedin.title", "تحليل لينكدإن بالذكاء الاصطناعي"),
                desc: t(
                  "features.linkedin.desc",
                  "احصل على تقييم شامل لملفك من 0 إلى 100 مع خطة تحسين مفصّلة خلال 30 ثانية."
                ),
              },
              {
                icon: FileText,
                title: t("features.cv.title", "تخصيص السيرة الذاتية"),
                desc: t(
                  "features.cv.desc",
                  "ولّد سيرة ذاتية محسّنة لكل وظيفة تتقدم لها بضغطة زر واحدة."
                ),
              },
              {
                icon: Mail,
                title: t("features.email.title", "حملات إيميل ذكية"),
                desc: t(
                  "features.email.desc",
                  "أرسل 500 رسالة مخصّصة لصنّاع القرار في الشركات السعودية والخليجية."
                ),
              },
              {
                icon: Users,
                title: t("features.discovery.title", "اكتشاف الفرص"),
                desc: t(
                  "features.discovery.desc",
                  "اعثر على المسؤولين المناسبين حسب الصناعة، المنصب، والشركة."
                ),
              },
              {
                icon: BarChart3,
                title: t("features.analytics.title", "تحليلات فورية"),
                desc: t(
                  "features.analytics.desc",
                  "تابع معدلات الفتح، الردود، والتحويلات في لوحة تحكم واضحة."
                ),
              },
              {
                icon: Shield,
                title: t("features.compliance.title", "متوافق مع نظام حماية البيانات"),
                desc: t(
                  "features.compliance.desc",
                  "متوافق بالكامل مع PDPL السعودي وميزة إلغاء الاشتراك في كل رسالة."
                ),
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="group p-8 rounded-2xl bg-white border border-gray-200 hover:border-[#0A8F84]/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#064E49]/5 group-hover:bg-[#0A8F84]/10 flex items-center justify-center mb-5 transition-colors">
                    <Icon className="w-6 h-6 text-[#064E49] group-hover:text-[#0A8F84] transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-[#064E49] mb-3">
                    {f.title}
                  </h3>
                  <p className="text-[#6b7280] leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 steps */}
      <section id="how" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#064E49] mb-4">
              {t("how.title", "ثلاث خطوات. عشر دقائق.")}
            </h2>
            <p className="text-xl text-[#6b7280]">
              {t("how.subtitle", "من التسجيل إلى أول حملة ناجحة")}
            </p>
          </motion.div>
          <motion.div {...stagger} className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: t("how.s1.title", "حلّل ملفك"),
                desc: t("how.s1.desc", "ألصق رابط لينكدإن واحصل على تقييم فوري + خطة تحسين."),
              },
              {
                step: "02",
                title: t("how.s2.title", "صمّم حملتك"),
                desc: t("how.s2.desc", "اختر شريحتك المستهدفة، ودع الذكاء الاصطناعي يكتب الرسائل."),
              },
              {
                step: "03",
                title: t("how.s3.title", "أطلق وراقب"),
                desc: t("how.s3.desc", "أرسل 500 رسالة وتابع الردود في لوحة تحكم واحدة."),
              },
            ].map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative p-8 rounded-2xl bg-gradient-to-br from-[#064E49] to-[#043530] text-white overflow-hidden"
              >
                <div className="absolute top-4 end-4 text-7xl font-extrabold text-white/10">
                  {s.step}
                </div>
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[#0A8F84] flex items-center justify-center mb-5">
                    <span className="text-xl font-extrabold">{s.step}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{s.title}</h3>
                  <p className="text-white/70 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#064E49] mb-4">
              {t("testimonials.title", "قصص نجاح حقيقية")}
            </h2>
            <p className="text-xl text-[#6b7280]">
              {t("testimonials.subtitle", "محترفون من السعودية والخليج يثقون بوصّل")}
            </p>
          </motion.div>
          <motion.div {...stagger} className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "أحمد الراشد",
                role: t("testimonials.t1.role", "مدير تطوير الأعمال · الرياض"),
                quote: t(
                  "testimonials.t1.quote",
                  "خلال أسبوعين فقط، حصلت على 12 مقابلة عمل من حملة واحدة. المنصة غيّرت طريقة بحثي عن الفرص."
                ),
              },
              {
                name: "نورة العتيبي",
                role: t("testimonials.t2.role", "مهندسة برمجيات · جدة"),
                quote: t(
                  "testimonials.t2.quote",
                  "تقييم لينكدإن كان دقيقاً جداً. رفعت تقييمي من 54 إلى 89 في يوم واحد. ممتاز!"
                ),
              },
              {
                name: "خالد الشمري",
                role: t("testimonials.t3.role", "مدير مبيعات · الدمام"),
                quote: t(
                  "testimonials.t3.quote",
                  "أرسلت 500 رسالة لشركات في القطاع الحكومي. النتائج فاقت توقعاتي بكثير."
                ),
              },
            ].map((tst, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="p-8 rounded-2xl bg-white border border-gray-200 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-[#0A8F84] text-[#0A8F84]" />
                  ))}
                </div>
                <p className="text-[#1f2937] leading-relaxed mb-6 text-lg">
                  "{tst.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#064E49] to-[#0A8F84] flex items-center justify-center text-white font-bold">
                    {tst.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-[#064E49]">{tst.name}</div>
                    <div className="text-sm text-[#6b7280]">{tst.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING — 4 plans */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#064E49] mb-4">
              {t("pricing.title", "أسعار بسيطة. شفافة. سعودية.")}
            </h2>
            <p className="text-xl text-[#6b7280]">
              {t("pricing.subtitle", "ابدأ مجاناً. ادفع فقط عند نمو احتياجك.")}
            </p>
          </motion.div>
          <motion.div {...stagger} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: t("pricing.free.name", "مجاني"),
                price: "0",
                desc: t("pricing.free.desc", "للتجربة"),
                features: [
                  t("pricing.free.f1", "تحليل لينكدإن واحد"),
                  t("pricing.free.f2", "10 رسائل شهرياً"),
                  t("pricing.free.f3", "دعم عبر البريد"),
                ],
                cta: t("pricing.free.cta", "ابدأ مجاناً"),
                highlight: false,
              },
              {
                name: t("pricing.starter.name", "المبتدئ"),
                price: "99",
                desc: t("pricing.starter.desc", "للباحثين عن عمل"),
                features: [
                  t("pricing.starter.f1", "تحليلات لينكدإن غير محدودة"),
                  t("pricing.starter.f2", "100 رسالة شهرياً"),
                  t("pricing.starter.f3", "تخصيص السيرة الذاتية"),
                  t("pricing.starter.f4", "دعم خلال 24 ساعة"),
                ],
                cta: t("pricing.starter.cta", "اشترك الآن"),
                highlight: false,
              },
              {
                name: t("pricing.pro.name", "المحترف"),
                price: "199",
                desc: t("pricing.pro.desc", "الأكثر شعبية"),
                features: [
                  t("pricing.pro.f1", "كل ما في المبتدئ"),
                  t("pricing.pro.f2", "500 رسالة شهرياً"),
                  t("pricing.pro.f3", "اكتشاف الفرص المتقدم"),
                  t("pricing.pro.f4", "تحليلات الحملات"),
                  t("pricing.pro.f5", "دعم أولوية"),
                ],
                cta: t("pricing.pro.cta", "اشترك الآن"),
                highlight: true,
              },
              {
                name: t("pricing.business.name", "الأعمال"),
                price: "299",
                desc: t("pricing.business.desc", "للفرق والشركات"),
                features: [
                  t("pricing.business.f1", "كل ما في المحترف"),
                  t("pricing.business.f2", "1500 رسالة شهرياً"),
                  t("pricing.business.f3", "حسابات متعددة"),
                  t("pricing.business.f4", "تكامل CRM"),
                  t("pricing.business.f5", "مدير حساب مخصّص"),
                ],
                cta: t("pricing.business.cta", "تواصل معنا"),
                highlight: false,
              },
            ].map((p, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className={`relative p-8 rounded-2xl border-2 transition-all ${
                  p.highlight
                    ? "border-[#0A8F84] bg-gradient-to-b from-[#f0fdf9] to-white shadow-2xl scale-105"
                    : "border-gray-200 bg-white hover:border-[#064E49]/30"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-4 py-1 rounded-full bg-[#0A8F84] text-white text-xs font-bold">
                    {t("pricing.popular", "الأكثر شعبية")}
                  </div>
                )}
                <div className="text-sm font-semibold text-[#6b7280] mb-2">
                  {p.name}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-extrabold text-[#064E49]">
                    {p.price}
                  </span>
                  <span className="text-[#6b7280]">SAR / {t("pricing.month", "شهر")}</span>
                </div>
                <p className="text-sm text-[#6b7280] mb-6">{p.desc}</p>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Check className="w-5 h-5 text-[#0A8F84] flex-shrink-0 mt-0.5" />
                      <span className="text-[#1f2937]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    p.highlight
                      ? "bg-[#0A8F84] text-white shadow-lg hover:shadow-xl hover:bg-[#12B5A8]"
                      : "bg-[#064E49]/5 text-[#064E49] hover:bg-[#064E49] hover:text-white"
                  }`}
                >
                  {p.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#064E49] mb-4">
              {t("faq.title", "أسئلة شائعة")}
            </h2>
          </motion.div>
          <motion.div {...stagger} className="space-y-4">
            {[
              {
                q: t("faq.q1", "هل وصّل متوافق مع نظام حماية البيانات السعودي؟"),
                a: t(
                  "faq.a1",
                  "نعم. نلتزم بالكامل بنظام حماية البيانات الشخصية (PDPL) وكل رسالة تحتوي على رابط إلغاء الاشتراك."
                ),
              },
              {
                q: t("faq.q2", "هل يمكنني الإلغاء في أي وقت؟"),
                a: t("faq.a2", "بالطبع. لا توجد عقود طويلة. يمكنك الإلغاء في أي وقت من لوحة التحكم."),
              },
              {
                q: t("faq.q3", "ما هي طرق الدفع المتاحة؟"),
                a: t(
                  "faq.a3",
                  "نقبل مدى، فيزا، ماستركارد، Apple Pay، و STC Pay عبر بوابة مُيسّر السعودية."
                ),
              },
              {
                q: t("faq.q4", "هل أحتاج حساب لينكدإن مدفوع؟"),
                a: t("faq.a4", "لا. وصّل يعمل مع أي حساب لينكدإن مجاني."),
              },
              {
                q: t("faq.q5", "كم من الوقت يستغرق إعداد أول حملة؟"),
                a: t("faq.a5", "أقل من 10 دقائق من التسجيل إلى إرسال أول حملة."),
              },
            ].map((f, i) => (
              <motion.details
                key={i}
                variants={fadeUp}
                className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-[#0A8F84]/30 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-[#064E49] list-none">
                  {f.q}
                  <span className="text-[#0A8F84] group-open:rotate-45 transition-transform text-2xl">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-[#6b7280] leading-relaxed">{f.a}</p>
              </motion.details>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            {...fadeUp}
            className="relative rounded-3xl bg-gradient-to-br from-[#064E49] to-[#043530] p-12 md:p-16 text-center overflow-hidden"
          >
            <div className="absolute top-0 end-0 w-64 h-64 rounded-full bg-[#0A8F84]/20 blur-3xl" />
            <div className="absolute bottom-0 start-0 w-64 h-64 rounded-full bg-[#0A8F84]/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                {t("cta.title", "جاهز لتغيير مسارك المهني؟")}
              </h2>
              <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
                {t("cta.subtitle", "انضم إلى آلاف المحترفين السعوديين الذين يستخدمون وصّل لتسريع مسيرتهم")}
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-10 py-5 rounded-xl bg-[#0A8F84] text-white font-bold text-lg shadow-2xl hover:bg-[#12B5A8] transition-all"
              >
                {t("cta.button", "ابدأ مجاناً الآن")}
                <ArrowRight className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
              <div className="mt-6 text-sm text-white/50">
                {t("cta.note", "بدون بطاقة ائتمان · إعداد في دقيقتين")}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#064E49] text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <WasselLogo size={32} variant="inverted" />
                <span className="text-xl font-extrabold">{t("brand.name", "وصّل")}</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                {t("footer.tagline", "منصة سعودية مدعومة بالذكاء الاصطناعي لتسريع مسيرتك المهنية.")}
              </p>
            </div>
            {/* Product */}
            <div>
              <h4 className="font-bold mb-4">{t("footer.product", "المنتج")}</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><a href="/#features" className="hover:text-[#0A8F84] transition">{t("footer.features", "المميزات")}</a></li>
                <li><Link href="/pricing" className="hover:text-[#0A8F84] transition">{t("footer.pricing", "الأسعار")}</Link></li>
                <li><a href="/#updates" className="hover:text-[#0A8F84] transition">{t("footer.changelog", "التحديثات")}</a></li>
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="font-bold mb-4">{t("footer.company", "الشركة")}</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><Link href="/about" className="hover:text-[#0A8F84] transition">{t("footer.about", "من نحن")}</Link></li>
                <li><Link href="/blog" className="hover:text-[#0A8F84] transition">{t("footer.blog", "المدونة")}</Link></li>
                <li><a href="mailto:waselhup@gmail.com" className="hover:text-[#0A8F84] transition">{t("footer.contact", "اتصل بنا")}</a></li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h4 className="font-bold mb-4">{t("footer.legal", "قانوني")}</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><Link href="/privacy" className="hover:text-[#0A8F84] transition">{t("footer.privacy", "سياسة الخصوصية")}</Link></li>
                <li><Link href="/terms" className="hover:text-[#0A8F84] transition">{t("footer.terms", "شروط الاستخدام")}</Link></li>
                <li><Link href="/privacy#pdpl" className="hover:text-[#0A8F84] transition">{t("footer.pdpl", "الامتثال لـ PDPL")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/50">
            <div>© 2026 Wassel. {t("footer.rights", "كل الحقوق محفوظة.")}</div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4" />
              {t("footer.madein", "صنع في الأحساء، السعودية")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
