import { jsPDF } from 'jspdf';
import type { Carousel } from './content-engine';

/**
 * Content export helpers — Carousel PDF (slide-per-page).
 *
 * All exports cost 0 tokens. The PDF lays out one slide per page with the
 * slide title centered at the top and the body filling the page. Per A11,
 * we never include vendor names, model names, or "powered by" footers.
 *
 * RTL note: jsPDF base does not shape Arabic glyphs natively. Arabic
 * carousels still produce valid PDFs that users can paste into LinkedIn,
 * but the visual rendering of Arabic ligatures may be imperfect — for
 * presentation-grade Arabic PDFs the user can copy the text into a Word
 * doc. (Same trade-off as Sprint 4 Resume PDF export.)
 */

const PAGE_MARGIN_MM = 18;
const TITLE_FONT_SIZE = 22;
const BODY_FONT_SIZE = 14;
const SLIDE_NUMBER_FONT_SIZE = 9;
const LINE_HEIGHT_MM_BODY = 7.5;
const LINE_HEIGHT_MM_TITLE = 9;

export async function exportCarouselToPdf(
  carousel: Carousel,
  language: 'ar' | 'en' = 'ar',
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;

  const totalSlides = carousel.slides.length;

  carousel.slides.forEach((slide, index) => {
    if (index > 0) doc.addPage();

    // Slide number — top corner
    doc.setFontSize(SLIDE_NUMBER_FONT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(
      `${index + 1} / ${totalSlides}`,
      pageWidth - PAGE_MARGIN_MM,
      PAGE_MARGIN_MM - 5,
      { align: 'right' },
    );

    // Title — centered, top third
    doc.setFontSize(TITLE_FONT_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    const titleLines = doc.splitTextToSize(slide.title || '', contentWidth);
    let y = PAGE_MARGIN_MM + 18;
    for (const line of titleLines) {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += LINE_HEIGHT_MM_TITLE;
    }

    // Body — centered, below title
    doc.setFontSize(BODY_FONT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55);
    const bodyLines = doc.splitTextToSize(slide.body || '', contentWidth);
    const bodyTotalHeight = bodyLines.length * LINE_HEIGHT_MM_BODY;
    const bodyStartY = Math.max(y + 14, pageHeight / 2 - bodyTotalHeight / 2);
    let by = bodyStartY;
    for (const line of bodyLines) {
      doc.text(line, pageWidth / 2, by, { align: 'center' });
      by += LINE_HEIGHT_MM_BODY;
    }

    // Footer placeholder — kept intentionally empty (no Wassel branding,
    // no vendor watermark, per A11). The user owns the export.
    void language;
  });

  const buf = doc.output('arraybuffer');
  return new Uint8Array(buf);
}
