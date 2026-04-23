import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { WasselLogo } from './WasselLogo';

interface Props { children: ReactNode; title: string; subtitle: string }

export default function AuthLayout({ children, title, subtitle }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const font = isRTL ? "Cairo, sans-serif" : "Inter, sans-serif";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: font,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      <div className="v4-bg-circles" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 440,
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "2.5rem 2.25rem",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: "1.5rem",
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <WasselLogo size={28} />
          <span style={{ fontWeight: 600, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>
            {isRTL ? "وصل" : "Wassel"}
          </span>
        </Link>

        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: "0 0 0.5rem",
            lineHeight: 1.2,
            fontFamily: font,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-dim)",
            margin: "0 0 1.75rem",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>

        {children}
      </motion.div>
    </div>
  );
}
