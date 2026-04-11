import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, Zap, Shield, TrendingUp, Star } from "lucide-react";

interface Props { children: ReactNode; title: string; subtitle: string }

export default function AuthLayout({ children, title, subtitle }: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen bg-[#fafafa] flex"
      style={{ fontFamily: isRTL ? "Cairo, sans-serif" : "Inter, sans-serif" }}
    >
      {/* Form side */}
      <motion.div
        initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex items-center justify-center p-8"
      >
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-[#064E49] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#0A8F84]" />
            </div>
            <span className="text-2xl font-extrabold text-[#064E49]">
              {t("brand.name", "وصّل")}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#064E49] mb-2">{title}</h1>
          <p className="text-[#6b7280] mb-8">{subtitle}</p>
          {children}
        </div>
      </motion.div>

      {/* Brand panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-[#064E49] via-[#043530] to-[#064E49] text-white items-center justify-center p-12"
      >
        <div className="absolute top-20 -end-20 w-96 h-96 rounded-full bg-[#0A8F84]/20 blur-3xl" />
        <div className="absolute bottom-0 -start-20 w-96 h-96 rounded-full bg-[#0A8F84]/10 blur-3xl" />

        <div className="relative max-w-md space-y-10">
          <div>
            <div className="text-7xl font-extrabold mb-4">وصّل</div>
            <div className="text-white/70 text-lg">
              {t("auth.panel.tagline", "منصتك الذكية لتسريع مسيرتك المهنية")}
            </div>
          </div>

          <div className="space-y-5">
            {[
              { icon: Zap, title: t("auth.feature1.title", "تحليل فوري بالذكاء الاصطناعي"), desc: t("auth.feature1.desc", "احصل على تقييم شامل لملفك خلال 30 ثانية") },
              { icon: TrendingUp, title: t("auth.feature2.title", "حملات إيميل تصل للنتيجة"), desc: t("auth.feature2.desc", "500 رسالة مخصصة لصنّاع القرار") },
              { icon: Shield, title: t("auth.feature3.title", "متوافق مع PDPL السعودي"), desc: t("auth.feature3.desc", "خصوصيتك وبياناتك محمية بالكامل") },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#0A8F84]/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#0A8F84]" />
                  </div>
                  <div>
                    <div className="font-bold mb-1">{f.title}</div>
                    <div className="text-sm text-white/60">{f.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#064E49] bg-gradient-to-br from-[#0A8F84] to-[#12B5A8]" />
                ))}
              </div>
              <div className="text-white/80">
                <span className="font-bold">+500</span>{" "}
                {t("auth.social", "محترف يستخدم وصّل")}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-white/60">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-[#0A8F84] text-[#0A8F84]" />)}
              <span className="ms-2">4.9/5 · {t("auth.rating", "تقييم المستخدمين")}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
