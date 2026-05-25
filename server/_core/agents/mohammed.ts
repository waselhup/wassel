// Mohammed (محمد) — Finance & ZATCA agent.
// Reconciles Moyasar, generates ZATCA invoices, daily finance snapshots,
// runway prediction, margin alerts.
// approval mode: auto_with_bounds.

import { BaseAgent } from './base';
import { generateZatcaQr, generateInvoiceNumber, nextInvoiceSequence, splitGrossAmount, SELLER_VAT_NUMBER, SELLER_COMMERCIAL_REG, SELLER_NAME_AR } from '../lib/zatca';

interface InvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  qrBase64: string;
}

export class MohammedAgent extends BaseAgent {
  readonly id = 'mohammed';
  readonly nameAr = 'محمد';
  readonly nameEn = 'Mohammed';

  async generateZatcaInvoice(paymentTransactionId: string): Promise<InvoiceResult | null> {
    const { data: tx } = await this.client()
      .from('payment_transactions')
      .select('id, user_id, amount_sar, created_at, status, metadata')
      .eq('id', paymentTransactionId)
      .maybeSingle();
    if (!tx) return null;
    if (!['paid', 'completed', 'succeeded'].includes((tx.status || '').toLowerCase())) {
      // still issue; refund handling is elsewhere
    }

    const { data: user } = await this.client()
      .from('profiles')
      .select('full_name, email, phone, language')
      .eq('id', tx.user_id)
      .maybeSingle();

    const seq = await nextInvoiceSequence(this.client(), new Date(tx.created_at));
    const invoiceNumber = generateInvoiceNumber(seq, new Date(tx.created_at));
    const { subtotal, vat } = splitGrossAmount(Number(tx.amount_sar));

    const qr = generateZatcaQr({
      sellerName: SELLER_NAME_AR,
      vatNumber: SELLER_VAT_NUMBER,
      timestamp: new Date(tx.created_at),
      totalSar: Number(tx.amount_sar),
      vatSar: vat,
    });

    const { data: row } = await this.client()
      .from('zatca_invoices')
      .insert({
        invoice_number: invoiceNumber,
        user_id: tx.user_id,
        payment_transaction_id: tx.id,
        subtotal_sar: subtotal,
        vat_rate: 15.00,
        vat_amount_sar: vat,
        total_sar: Number(tx.amount_sar),
        buyer_name: user?.full_name || null,
        seller_vat_number: SELLER_VAT_NUMBER,
        seller_commercial_registration: SELLER_COMMERCIAL_REG,
        issue_date: tx.created_at,
        zatca_qr_payload: qr,
        status: 'issued',
        language: user?.language || 'ar',
      })
      .select('id, invoice_number')
      .single();

    return { invoiceId: row?.id || '', invoiceNumber: row?.invoice_number || invoiceNumber, qrBase64: qr };
  }

  async reconcileMoyasarDaily(): Promise<{ checked: number; new: number; mismatches: number }> {
    // Pull last-24h transactions table; compare statuses. (Real Moyasar API call
    // would go here — kept conservative for now.)
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: txs } = await this.client()
      .from('payment_transactions')
      .select('id, status, amount_sar, created_at, moyasar_payment_id, metadata')
      .gte('created_at', since);
    let mismatches = 0;
    for (const t of txs || []) {
      // Generate invoice if paid and no invoice yet
      if (['paid', 'completed', 'succeeded'].includes((t.status || '').toLowerCase())) {
        const { count } = await this.client()
          .from('zatca_invoices')
          .select('*', { count: 'exact', head: true })
          .eq('payment_transaction_id', t.id);
        if ((count || 0) === 0) {
          await this.generateZatcaInvoice(t.id);
        }
      }
    }
    return { checked: (txs || []).length, new: 0, mismatches };
  }

  async computeFinanceSnapshot(): Promise<{ snapshotId: string | null }> {
    const supabase = this.client();
    const today = new Date().toISOString().slice(0, 10);
    const since24h = new Date(Date.now() - 86400000).toISOString();

    // MRR: count active paid subscriptions × plan price.
    const { data: subs } = await supabase
      .from('profiles')
      .select('plan')
      .neq('plan', 'free');
    const planPrices: Record<string, number> = { starter: 29, pro: 99, business: 299 };
    const mrr = (subs || []).reduce((sum, s: any) => sum + (planPrices[s.plan] || 0), 0);
    const arr = mrr * 12;

    const { count: newSignups } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since24h);

    const { data: paidConv } = await supabase
      .from('payment_transactions')
      .select('id, amount_sar')
      .gte('created_at', since24h)
      .in('status', ['paid', 'succeeded', 'completed']);

    // Cost stack
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['apify_monthly_cost_usd', 'infra_monthly_cost_usd', 'usd_sar_rate', 'cash_on_hand_sar']);
    const settingsMap: Record<string, any> = {};
    for (const s of settings || []) settingsMap[s.key] = s.value;
    const usdSar = parseFloat(settingsMap.usd_sar_rate || '3.75');
    const apifyMonthlyUsd = parseFloat(settingsMap.apify_monthly_cost_usd || '49');
    const infraMonthlyUsd = parseFloat(settingsMap.infra_monthly_cost_usd || '20');
    const apifyDailySar = (apifyMonthlyUsd / 30) * usdSar;
    const infraDailySar = (infraMonthlyUsd / 30) * usdSar;

    // Anthropic cost from agent_cost_log
    const { data: anthropicLogs } = await supabase
      .from('agent_cost_log')
      .select('cost_sar')
      .gte('created_at', since24h);
    const anthropicCostSar = (anthropicLogs || []).reduce((s: number, l: any) => s + (Number(l.cost_sar) || 0), 0);

    // Ad spend (last 24h from ad_campaigns spend log if exists)
    const adSpend = 0; // placeholder until Sayed wires spend reporting

    const cashOnHand = parseFloat(settingsMap.cash_on_hand_sar || '0');
    const dailyBurn = anthropicCostSar + apifyDailySar + infraDailySar + adSpend;
    const runwayDays = dailyBurn > 0 ? Math.floor(cashOnHand / dailyBurn) : 9999;

    const totalRev24h = (paidConv || []).reduce((s, p: any) => s + (Number(p.amount_sar) || 0), 0);
    const margin = totalRev24h > 0 ? ((totalRev24h - dailyBurn) / totalRev24h) * 100 : 0;
    const cac = (newSignups || 0) > 0 ? adSpend / (newSignups as number) : 0;

    const { data: row } = await supabase
      .from('finance_snapshots')
      .upsert({
        snapshot_date: today,
        mrr_sar: mrr,
        arr_sar: arr,
        active_subscribers: (subs || []).length,
        new_signups_24h: newSignups || 0,
        paid_conversions_24h: (paidConv || []).length,
        ad_spend_24h_sar: adSpend,
        anthropic_cost_24h_sar: Number(anthropicCostSar.toFixed(2)),
        apify_cost_24h_sar: Number(apifyDailySar.toFixed(2)),
        infra_cost_24h_sar: Number(infraDailySar.toFixed(2)),
        cac_24h_sar: Number(cac.toFixed(2)),
        ltv_estimate_sar: 99 * 6, // crude — pro × 6mo avg lifetime
        cash_on_hand_sar: cashOnHand,
        runway_days: runwayDays,
        margin_percent: Number(margin.toFixed(2)),
        metadata: { rev_24h_sar: totalRev24h, daily_burn_sar: dailyBurn },
      }, { onConflict: 'snapshot_date' })
      .select('id')
      .single();

    return { snapshotId: row?.id || null };
  }

  async predictRunway(): Promise<{ runwayDays: number; dailyBurnSar: number; cashSar: number }> {
    const { data } = await this.client()
      .from('finance_snapshots')
      .select('runway_days, cash_on_hand_sar, anthropic_cost_24h_sar, apify_cost_24h_sar, infra_cost_24h_sar, ad_spend_24h_sar')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { runwayDays: 0, dailyBurnSar: 0, cashSar: 0 };
    const burn = Number(data.anthropic_cost_24h_sar || 0) + Number(data.apify_cost_24h_sar || 0) + Number(data.infra_cost_24h_sar || 0) + Number(data.ad_spend_24h_sar || 0);
    return { runwayDays: data.runway_days || 0, dailyBurnSar: burn, cashSar: data.cash_on_hand_sar || 0 };
  }

  async flagMarginIssues(): Promise<{ alerts: Array<{ plan: string; revenue: number; cost: number; pct: number }> }> {
    // Per-plan revenue 24h vs allocated cost slice
    const { data } = await this.client()
      .from('finance_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { alerts: [] };
    const totalCost = Number(data.anthropic_cost_24h_sar || 0) + Number(data.apify_cost_24h_sar || 0) + Number(data.infra_cost_24h_sar || 0);
    const rev = Number(data.metadata?.rev_24h_sar || 0);
    const alerts = [] as any[];
    if (rev > 0 && (totalCost / rev) > 0.30) {
      alerts.push({ plan: 'overall', revenue: rev, cost: totalCost, pct: Number(((totalCost / rev) * 100).toFixed(1)) });
    }
    return { alerts };
  }

  async weeklyFinanceReport(): Promise<{ summary: string }> {
    const { data: snaps } = await this.client()
      .from('finance_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(7);
    if (!snaps || snaps.length === 0) return { summary: 'No finance data yet.' };
    const mrr = snaps[0].mrr_sar || 0;
    const runway = snaps[0].runway_days || 0;
    const subs = snaps[0].active_subscribers || 0;
    return {
      summary: `MRR: ${mrr} SAR · Subscribers: ${subs} · Runway: ${runway} days · ${snaps.length}-day trend logged.`,
    };
  }
}

export const mohammed = new MohammedAgent();
