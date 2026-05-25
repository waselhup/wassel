// ZATCA (Saudi Tax Authority) e-invoicing — TLV-encoded QR payload.
// Phase 1 spec: 5 tags (seller, VAT number, timestamp, total, VAT amount)
// encoded as Tag(1B) + Length(1B) + Value(UTF-8 bytes), wrapped to base64.

interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string | Date; // ISO 8601
  totalSar: number;         // gross including VAT
  vatSar: number;           // VAT portion
}

/**
 * Encode a ZATCA Phase 1 simplified-invoice QR payload.
 * Returns a base64 string (paste into a QR generator at render-time).
 */
export function generateZatcaQr(input: ZatcaQrInput): string {
  const ts = input.timestamp instanceof Date
    ? input.timestamp.toISOString()
    : new Date(input.timestamp).toISOString();

  const fields: Array<{ tag: number; value: string }> = [
    { tag: 1, value: input.sellerName },
    { tag: 2, value: input.vatNumber },
    { tag: 3, value: ts },
    { tag: 4, value: input.totalSar.toFixed(2) },
    { tag: 5, value: input.vatSar.toFixed(2) },
  ];

  const buffers: Buffer[] = [];
  for (const f of fields) {
    const valueBytes = Buffer.from(f.value, 'utf8');
    if (valueBytes.length > 255) {
      throw new Error(`ZATCA TLV field too long (tag=${f.tag}, ${valueBytes.length} bytes, max 255)`);
    }
    const tlv = Buffer.alloc(2 + valueBytes.length);
    tlv.writeUInt8(f.tag, 0);
    tlv.writeUInt8(valueBytes.length, 1);
    valueBytes.copy(tlv, 2);
    buffers.push(tlv);
  }
  return Buffer.concat(buffers).toString('base64');
}

/**
 * Sequential invoice number: WSL-YYYYMM-NNNNN.
 * Caller passes the next sequence number (looked up from the DB).
 */
export function generateInvoiceNumber(sequence: number, date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const n = String(sequence).padStart(5, '0');
  return `WSL-${y}${m}-${n}`;
}

/**
 * Compute the next invoice sequence number for the current month.
 * Reads zatca_invoices and finds max suffix for WSL-YYYYMM-* prefix.
 */
export async function nextInvoiceSequence(supabase: any, date: Date = new Date()): Promise<number> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `WSL-${y}${m}-`;
  const { data } = await supabase
    .from('zatca_invoices')
    .select('invoice_number')
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.invoice_number) return 1;
  const suffix = String(data.invoice_number).slice(prefix.length);
  const n = parseInt(suffix, 10);
  return Number.isFinite(n) ? n + 1 : 1;
}

export const ZATCA_VAT_RATE = 0.15;
export const SELLER_VAT_NUMBER = process.env.ZATCA_SELLER_VAT || '300000000000003';
export const SELLER_COMMERCIAL_REG = process.env.ZATCA_SELLER_CR || '7052843203';
export const SELLER_NAME_AR = 'وصل';
export const SELLER_NAME_EN = 'Wassel';

/**
 * Split a gross amount (VAT-inclusive) into subtotal + VAT components.
 * Standard Saudi VAT 15%.
 */
export function splitGrossAmount(totalSar: number): { subtotal: number; vat: number } {
  const subtotal = totalSar / (1 + ZATCA_VAT_RATE);
  const vat = totalSar - subtotal;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    vat: Number(vat.toFixed(2)),
  };
}
