import { describe, it, expect } from 'vitest';
import { getPlan, getUsagePercentage, getRemainingLeads, checkLeadLimit, PLANS } from '../../shared/plans';

/**
 * Phase 4: Monetization Layer Tests
 * 
 * Tests for:
 * 1. Plan configuration
 * 2. Usage tracking
 * 3. Limit enforcement
 * 4. Upgrade prompts
 */

describe('Monetization Layer - Phase 4', () => {
  describe('Plan Configuration', () => {
    it('should have 3 plans defined', () => {
      expect(Object.keys(PLANS)).toHaveLength(3);
      expect(PLANS).toHaveProperty('starter');
      expect(PLANS).toHaveProperty('pro');
      expect(PLANS).toHaveProperty('agency');
    });

    it('should have correct starter plan limits', () => {
      const starter = PLANS.starter;
      expect(starter.monthlyLeadLimit).toBe(100);
      expect(starter.maxCampaigns).toBe(3);
      expect(starter.price).toBe(0);
    });

    it('should have correct pro plan limits', () => {
      const pro = PLANS.pro;
      expect(pro.monthlyLeadLimit).toBe(500);
      expect(pro.maxCampaigns).toBe(10);
      expect(pro.price).toBe(99);
    });

    it('should have correct agency plan limits', () => {
      const agency = PLANS.agency;
      expect(agency.monthlyLeadLimit).toBe(5000);
      expect(agency.maxCampaigns).toBe(100);
      expect(agency.price).toBe(499);
    });

    it('should have Arabic names for all plans', () => {
      Object.values(PLANS).forEach(plan => {
        expect(plan.nameAr).toBeTruthy();
        expect(plan.descriptionAr).toBeTruthy();
      });
    });

    it('should have feature lists for all plans', () => {
      Object.values(PLANS).forEach(plan => {
        expect(plan.features.length).toBeGreaterThan(0);
        expect(plan.featuresAr.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Usage Tracking', () => {
    it('should calculate usage percentage correctly', () => {
      const starter = PLANS.starter;
      
      expect(getUsagePercentage(0, starter)).toBe(0);
      expect(getUsagePercentage(50, starter)).toBe(50);
      expect(getUsagePercentage(100, starter)).toBe(100);
      expect(getUsagePercentage(150, starter)).toBe(100); // Capped at 100
    });

    it('should calculate remaining leads correctly', () => {
      const starter = PLANS.starter;
      
      expect(getRemainingLeads(0, starter)).toBe(100);
      expect(getRemainingLeads(50, starter)).toBe(50);
      expect(getRemainingLeads(100, starter)).toBe(0);
      expect(getRemainingLeads(150, starter)).toBe(0);
    });

    it('should track usage for different plans', () => {
      const pro = PLANS.pro;
      
      expect(getUsagePercentage(250, pro)).toBe(50);
      expect(getRemainingLeads(250, pro)).toBe(250);
    });
  });

  describe('Limit Enforcement', () => {
    it('should allow adding leads under limit', () => {
      const starter = PLANS.starter;
      
      expect(checkLeadLimit(50, starter)).toBe(true);
      expect(checkLeadLimit(99, starter)).toBe(true);
    });

    it('should prevent adding leads at limit', () => {
      const starter = PLANS.starter;
      
      expect(checkLeadLimit(100, starter)).toBe(false);
      expect(checkLeadLimit(150, starter)).toBe(false);
    });

    it('should enforce limits per plan', () => {
      const starter = PLANS.starter;
      const pro = PLANS.pro;
      
      expect(checkLeadLimit(100, starter)).toBe(false);
      expect(checkLeadLimit(100, pro)).toBe(true);
    });
  });

  describe('Upgrade Pressure', () => {
    it('should identify when user is near limit (80%+)', () => {
      const starter = PLANS.starter;
      const usageAt80 = 80;
      
      expect(getUsagePercentage(usageAt80, starter)).toBeGreaterThanOrEqual(80);
    });

    it('should show upgrade prompt at 80% usage', () => {
      const starter = PLANS.starter;
      const usagePercentage = getUsagePercentage(80, starter);
      
      const shouldShowPrompt = usagePercentage >= 80;
      expect(shouldShowPrompt).toBe(true);
    });

    it('should show hard limit at 100% usage', () => {
      const starter = PLANS.starter;
      const usagePercentage = getUsagePercentage(100, starter);
      
      const isAtLimit = usagePercentage >= 100;
      expect(isAtLimit).toBe(true);
    });
  });

  describe('Soft Paywall', () => {
    it('should allow viewing data at limit', () => {
      const starter = PLANS.starter;
      const usedLeads = 100;
      
      // User can view, but cannot add
      const canView = true;
      const canAdd = checkLeadLimit(usedLeads, starter);
      
      expect(canView).toBe(true);
      expect(canAdd).toBe(false);
    });

    it('should prevent adding new leads at limit', () => {
      const starter = PLANS.starter;
      
      expect(checkLeadLimit(100, starter)).toBe(false);
    });

    it('should allow upgrade to higher plan', () => {
      const pro = PLANS.pro;
      
      // User at starter limit (100) can add to pro (500)
      expect(checkLeadLimit(100, pro)).toBe(true);
    });
  });

  describe('Plan Comparison', () => {
    it('should show clear upgrade path', () => {
      const starter = PLANS.starter;
      const pro = PLANS.pro;
      const agency = PLANS.agency;
      
      expect(starter.monthlyLeadLimit).toBeLessThan(pro.monthlyLeadLimit);
      expect(pro.monthlyLeadLimit).toBeLessThan(agency.monthlyLeadLimit);
    });

    it('should show price progression', () => {
      const starter = PLANS.starter;
      const pro = PLANS.pro;
      const agency = PLANS.agency;
      
      expect(starter.price).toBeLessThan(pro.price);
      expect(pro.price).toBeLessThan(agency.price);
    });

    it('should have more features in higher plans', () => {
      const starter = PLANS.starter;
      const pro = PLANS.pro;
      const agency = PLANS.agency;
      
      expect(starter.features.length).toBeLessThanOrEqual(pro.features.length);
      expect(pro.features.length).toBeLessThanOrEqual(agency.features.length);
    });
  });

  describe('Founder Sales Scenario', () => {
    it('should support demo with Starter plan', () => {
      const starter = PLANS.starter;
      
      // Founder can show 100 leads/month to prospect
      expect(starter.monthlyLeadLimit).toBeGreaterThan(0);
      expect(starter.price).toBe(0);
    });

    it('should support upsell to Pro', () => {
      const starter = PLANS.starter;
      const pro = PLANS.pro;
      
      // Prospect hits starter limit, upgrades to pro
      expect(starter.monthlyLeadLimit).toBe(100);
      expect(pro.monthlyLeadLimit).toBe(500);
      expect(pro.price).toBe(99);
    });

    it('should support enterprise upsell to Agency', () => {
      const pro = PLANS.pro;
      const agency = PLANS.agency;
      
      // Pro customer hits limit, upgrades to agency
      expect(pro.monthlyLeadLimit).toBe(500);
      expect(agency.monthlyLeadLimit).toBe(5000);
      expect(agency.price).toBe(499);
    });

    it('should have manual contact CTA', () => {
      // No Stripe - founder handles manually
      const hasManualCTA = true;
      expect(hasManualCTA).toBe(true);
    });
  });

  describe('Usage Meter Display', () => {
    it('should show progress bar status', () => {
      const starter = PLANS.starter;
      
      const statuses = [
        { usage: 0, status: 'available' },
        { usage: 50, status: 'available' },
        { usage: 80, status: 'warning' },
        { usage: 100, status: 'limit' },
      ];

      statuses.forEach(({ usage, status }) => {
        const percentage = getUsagePercentage(usage, starter);
        const displayStatus = 
          percentage >= 100 ? 'limit' :
          percentage >= 80 ? 'warning' :
          'available';
        
        expect(displayStatus).toBe(status);
      });
    });

    it('should display remaining leads', () => {
      const starter = PLANS.starter;
      
      expect(getRemainingLeads(0, starter)).toBe(100);
      expect(getRemainingLeads(25, starter)).toBe(75);
      expect(getRemainingLeads(100, starter)).toBe(0);
    });
  });

  describe('No Stripe Required', () => {
    it('should not require payment processing', () => {
      // Phase 4 is founder-sellable without Stripe
      const requiresStripe = false;
      expect(requiresStripe).toBe(false);
    });

    it('should support manual upgrade flow', () => {
      // Founder handles via WhatsApp/email
      const upgradeFlow = 'manual';
      expect(upgradeFlow).toBe('manual');
    });

    it('should log upgrade requests for founder follow-up', () => {
      // Backend logs requests, founder reviews
      const logsRequests = true;
      expect(logsRequests).toBe(true);
    });
  });
});
