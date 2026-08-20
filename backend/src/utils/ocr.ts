import fs from 'fs';
import path from 'path';

export interface OcrResult {
  rawText: string;
  extractedNumber: number | null;
  confidence: number;
}

/**
 * Parses odometer text from an image file using Tesseract.js if available,
 * with resilient numerical extraction and regex sanitization.
 */
export async function parseOdometerImage(imagePath: string): Promise<OcrResult> {
  try {
    if (!fs.existsSync(imagePath)) {
      return { rawText: '', extractedNumber: null, confidence: 0 };
    }

    // Dynamic import of tesseract.js
    const Tesseract = await import('tesseract.js');
    const result = await Tesseract.recognize(imagePath, 'eng');

    const rawText = result.data.text.trim();
    const confidence = result.data.confidence || 0;

    // Extract potential odometer digit sequence (3 to 7 digits)
    const matches = rawText.replace(/[^0-9\s]/g, ' ').match(/\b\d{3,7}\b/g);
    let extractedNumber: number | null = null;

    if (matches && matches.length > 0) {
      // Pick the longest or highest plausible odometer reading
      const numbers = matches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n));
      if (numbers.length > 0) {
        extractedNumber = Math.max(...numbers);
      }
    }

    return {
      rawText,
      extractedNumber,
      confidence: Math.round(confidence * 100) / 100,
    };
  } catch (error) {
    console.warn('⚠️ OCR processing warning (using fallback):', (error as Error).message);
    return {
      rawText: 'OCR_SKIPPED_OR_ERROR',
      extractedNumber: null,
      confidence: 0,
    };
  }
}
