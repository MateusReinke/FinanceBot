import "server-only";
import { getDocumentProxy, extractText } from "unpdf";

declare global {
  interface Math {
    sumPrecise?(values: Iterable<number>): number;
  }
}

// pdf.js (bundled by unpdf) calls the TC39 Math.sumPrecise proposal to sum
// glyph widths whenever it substitutes a missing embedded font — not yet
// shipped in the Node 22 runtime this app runs on (confirmed: `typeof
// Math.sumPrecise` is "undefined" here), so every call throws. pdf.js
// swallows the throw and logs it as a warning, but the font-metrics step
// it was doing never completes, which was corrupting extracted text for
// any PDF using a custom embedded font — i.e. most real bank invoices.
// A plain sum is exactly as correct for width measurement; only the
// proposal's extra precision against float cancellation is lost, which
// doesn't matter here.
if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = (values: Iterable<number>) => {
    let sum = 0;
    for (const v of values) sum += v;
    return sum;
  };
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
