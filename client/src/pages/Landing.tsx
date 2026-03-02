import React from 'react';
import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import ProblemSolution from '@/components/landing/ProblemSolution';
import Features from '@/components/landing/Features';
import ExtensionIntegration from '@/components/landing/ExtensionIntegration';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <SocialProof />
      <ProblemSolution />
      <Features />
      <ExtensionIntegration />
      <CTA />
      <Footer />
    </div>
  );
}
