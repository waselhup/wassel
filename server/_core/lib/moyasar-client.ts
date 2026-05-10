/**
 * Moyasar (also spelled "Muyassar") payment-gateway client.
 *
 * Uses the hosted-form ("Invoices") flow rather than direct charge:
 *   1. Server creates an invoice via POST /v1/invoices
 *   2. Server returns the invoice URL to the client
 *   3. Client redirects the browser to that URL — Moyasar collects the card
 *   4. Moyasar fires our webhook on settlement → fulfillment runs
 *
 * Why invoices, not direct charge: the hosted form handles 3-D Secure, Mada,
 * Apple Pay, error UX, and PCI scope on Moyasar's side. We never touch a PAN.
 *
 * Auth: HTTP Basic with `username = secret_key`, `password = ""`.
 */
import type { Buffer } from 'node:buffer';

const MOYASAR_API = 'https://api.moyasar.com/v1';

export interface CreateInvoiceInput {
  /** Amount in halalas (1 SAR = 100 halalas). Must be a positive integer. */
  amountHalalas: number;
  /** Free-form description shown on the hosted form. Keep < 255 chars. */
  description: string;
  /** Where Moyasar redirects the browser after payment (success or failure). */
  callbackUrl: string;
  /**
   * Arbitrary metadata returned verbatim in the webhook payload. Stash the
   * payment_transactions.id here so the webhook can look it up.
   */
  metadata: Record<string, string>;
  /** ISO 4217 — only 'SAR' supported by Moyasar. */
  currency?: string;
}

export interface MoyasarInvoice {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  url: string;
  callback_url: string;
  metadata: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  fee: number | null;
  currency: string;
  description: string;
  invoice_id: string | null;
  source: { type?: string; company?: string } | null;
  metadata: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

function getSecretKey(): string {
  const key =
    process.env.MOYASAR_SECRET_KEY ||
    process.env.MUYASSAR_SECRET_KEY ||
    '';
  if (!key) {
    throw new Error('MOYASAR_SECRET_KEY env var missing');
  }
  return key;
}

function authHeader(): string {
  const key = getSecretKey();
  // Basic auth: base64("secret_key:")
  const encoded = Buffer.from(`${key}:`).toString('base64');
  return `Basic ${encoded}`;
}

async function moyasarFetch<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${MOYASAR_API}${path}`, {
    method,
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Moyasar ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Moyasar ${method} ${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<MoyasarInvoice> {
  const body: Record<string, unknown> = {
    amount: Math.round(input.amountHalalas),
    currency: input.currency || 'SAR',
    description: input.description,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
  };
  return moyasarFetch<MoyasarInvoice>('POST', '/invoices', body);
}

export async function getInvoice(invoiceId: string): Promise<MoyasarInvoice> {
  return moyasarFetch<MoyasarInvoice>('GET', `/invoices/${invoiceId}`);
}

export async function getPayment(paymentId: string): Promise<MoyasarPayment> {
  return moyasarFetch<MoyasarPayment>('GET', `/payments/${paymentId}`);
}

export function isMoyasarConfigured(): boolean {
  return !!(process.env.MOYASAR_SECRET_KEY || process.env.MUYASSAR_SECRET_KEY);
}
