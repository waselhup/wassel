import mammoth from 'mammoth';

export type DocumentType = 'pdf' | 'docx' | 'image' | 'text';
export type ParseMethod = 'pdf-text' | 'pdf-ocr' | 'docx' | 'image-ocr' | 'text';

export interface ParseResult {
  text: string;
  method: ParseMethod;
  documentType: DocumentType;
  pageCount: number;
  confidence: number;
  warnings: string[];
}

const MAX_OCR_PAGES = 5;
const MIN_TEXT_THRESHOLD = 50;

const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/tiff', 'image/bmp',
]);

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp']);

function getExt(fileName: string): string {
  return (fileName.toLowerCase().split('.').pop() || '').trim();
}

function detectType(mimeType: string, fileName: string): DocumentType {
  const ext = getExt(fileName);
  if (mimeType?.includes('pdf') || ext === 'pdf') return 'pdf';
  if (mimeType?.includes('wordprocessingml') || mimeType?.includes('officedocument') || ext === 'docx') return 'docx';
  if (IMAGE_MIMES.has(mimeType) || IMAGE_EXTS.has(ext)) return 'image';
  if (mimeType?.includes('text') || ext === 'txt') return 'text';
  throw new Error(`Unsupported file type: ${mimeType || ext || 'unknown'}`);
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParseResult> {
  const docType = detectType(mimeType, fileName);
  const warnings: string[] = [];

  switch (docType) {
    case 'pdf':
      return parsePdf(buffer, warnings);
    case 'docx':
      return parseDocx(buffer, warnings);
    case 'image':
      return parseImage(buffer, warnings);
    case 'text':
      return {
        text: buffer.toString('utf-8'),
        method: 'text',
        documentType: 'text',
        pageCount: 1,
        confidence: 1.0,
        warnings,
      };
  }
}

async function parsePdf(buffer: Buffer, warnings: string[]): Promise<ParseResult> {
  let pageCount = 0;

  try {
    const pdfMod: any = await import('pdf-parse');
    const pdf = pdfMod.default || pdfMod;
    const data = await pdf(buffer);
    pageCount = data.numpages || 0;

    if (data?.text && data.text.trim().length >= MIN_TEXT_THRESHOLD) {
      return {
        text: data.text,
        method: 'pdf-text',
        documentType: 'pdf',
        pageCount,
        confidence: 0.95,
        warnings,
      };
    }
    warnings.push('PDF text layer too thin, falling back to OCR');
  } catch (err: any) {
    warnings.push(`pdf-parse failed: ${err?.message}`);
  }

  try {
    const ocrResult = await ocrPdfPages(buffer, warnings);
    return {
      text: ocrResult.text,
      method: 'pdf-ocr',
      documentType: 'pdf',
      pageCount: ocrResult.pagesProcessed,
      confidence: ocrResult.confidence,
      warnings,
    };
  } catch (ocrErr: any) {
    warnings.push(`OCR failed: ${ocrErr?.message}`);
  }

  throw new Error(
    'Could not extract text from this PDF. Try uploading a Word (.docx) file instead.'
  );
}

async function parseDocx(buffer: Buffer, warnings: string[]): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value || result.value.trim().length < MIN_TEXT_THRESHOLD) {
    warnings.push('DOCX produced very little text');
  }
  return {
    text: result.value,
    method: 'docx',
    documentType: 'docx',
    pageCount: 1,
    confidence: 0.98,
    warnings,
  };
}

async function parseImage(buffer: Buffer, warnings: string[]): Promise<ParseResult> {
  const preprocessed = await preprocessImage(buffer);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ara+eng', undefined, {
    cachePath: '/tmp/tesseract-cache',
  });

  try {
    const result = await worker.recognize(preprocessed);
    const text = result.data.text || '';
    const confidence = (result.data.confidence || 0) / 100;

    if (text.trim().length < MIN_TEXT_THRESHOLD) {
      warnings.push('Very little text detected in image');
    }

    return {
      text,
      method: 'image-ocr',
      documentType: 'image',
      pageCount: 1,
      confidence: Math.round(confidence * 100) / 100,
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buffer)
      .greyscale()
      .normalize()
      .sharpen()
      .toBuffer();
  } catch {
    return buffer;
  }
}

interface OcrResult {
  text: string;
  pagesProcessed: number;
  confidence: number;
}

async function ocrPdfPages(pdfBuffer: Buffer, warnings: string[]): Promise<OcrResult> {
  let createCanvas: any;
  try {
    const canvasMod: any = await import('@napi-rs/canvas');
    createCanvas = canvasMod.createCanvas;
  } catch {
    throw new Error('Canvas rendering unavailable in this environment');
  }

  const pdfjsMod: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (pdfjsMod.GlobalWorkerOptions) pdfjsMod.GlobalWorkerOptions.workerSrc = '';

  const { createWorker } = await import('tesseract.js');

  const loadingTask = pdfjsMod.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pagesToProcess = Math.min(totalPages, MAX_OCR_PAGES);

  if (totalPages > MAX_OCR_PAGES) {
    warnings.push(`PDF has ${totalPages} pages, OCR limited to first ${MAX_OCR_PAGES}`);
  }

  const worker = await createWorker('ara+eng', undefined, {
    cachePath: '/tmp/tesseract-cache',
  });

  let fullText = '';
  let totalConfidence = 0;

  try {
    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;

      let pngBuf: Buffer = canvas.toBuffer('image/png');
      pngBuf = await preprocessImage(pngBuf);

      const result = await worker.recognize(pngBuf);
      fullText += (result.data.text || '') + '\n\n';
      totalConfidence += (result.data.confidence || 0);
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: fullText.trim(),
    pagesProcessed: pagesToProcess,
    confidence: Math.round((totalConfidence / pagesToProcess / 100) * 100) / 100,
  };
}
