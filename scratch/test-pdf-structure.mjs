// Test PDF text extraction using pdftotext (if available) or binary analysis
// Run with: node scratch/test-pdf-structure.mjs

import fs from 'fs';
import path from 'path';

const TEST_DIR = 'd:/logiclot-st/logiclot-main/test_files';
const PDF_FILES = [
  'CarMaxList (1).pdf',
  'adesa runlist.pdf',
  'pdf manheim runlist.pdf',
  'iaa temp.pdf',
  'Sales list - IAA-3.pdf',
];

// Simple PDF text extractor using BT/ET blocks (like the edge function)
function extractPDFTextRawBytes(pdfBytes) {
  try {
    // latin1 decode
    const rawStr = Buffer.from(pdfBytes).toString('latin1');
    const textMatches = [];
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let m;
    while ((m = btEtRegex.exec(rawStr)) !== null) {
      const block = m[1];
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(block)) !== null) {
        textMatches.push(tj[1]);
      }
      const tjArrayRegex = /\[(.*?)\]\s*TJ/gi;
      let tja;
      while ((tja = tjArrayRegex.exec(block)) !== null) {
        const parts = tja[1].match(/\(([^)]*)\)/g);
        if (parts) textMatches.push(parts.map(p => p.slice(1, -1)).join(''));
      }
    }
    return textMatches.join(' ');
  } catch (err) {
    return '';
  }
}

function detectVendor(text, rawLatin1, filePath) {
  const lowerPath = (filePath || '').toLowerCase();
  const lowerText = `${text}\n${rawLatin1}`.toLowerCase();
  
  if (lowerPath.includes('carmax') || lowerText.includes('carmax')) return 'carmax';
  if (lowerPath.includes('manheim') || lowerText.includes('manheim')) return 'manheim';
  if (lowerPath.includes('adesa') || lowerText.includes('adesa')) return 'adesa';
  if (
    lowerPath.includes('iaai') || lowerPath.includes('iaa') ||
    lowerText.includes('insurance auto') || lowerText.includes('iaai') ||
    lowerText.includes('iaa.com') || lowerText.includes('loss type') ||
    lowerText.includes('primary damage') || lowerText.includes('sale list for') ||
    (lowerText.includes('buy now') && lowerText.includes('salvage')) ||
    (lowerText.includes('buy now') && lowerText.includes('loss type')) ||
    (lowerText.includes('buy now') && (lowerPath.includes('iaa') || lowerPath.includes('sales list')))
  ) return 'iaai';
  return 'unknown';
}

function isValidVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

function countVins(text) {
  const matches = text.match(/[A-HJ-NPR-Z0-9]{17}/gi) || [];
  return matches.filter(v => isValidVin(v)).length;
}

function countPartialVins(text) {
  // IAA uses ****** for last 6 chars
  const matches = text.match(/[A-HJ-NPR-Z0-9*]{11,17}/gi) || [];
  return matches.length;
}

console.log('=== PDF Structure Analysis ===\n');
console.log('(Testing text extractability and vendor detection)\n');

for (const filename of PDF_FILES) {
  const filePath = path.join(TEST_DIR, filename);
  const pdfBytes = fs.readFileSync(filePath);
  const rawLatin1 = pdfBytes.toString('latin1');
  const pdfText = extractPDFTextRawBytes(pdfBytes);
  const meaningfulChars = pdfText.replace(/\s/g, '').length;
  const vinCount = countVins(pdfText);
  const partialVinCount = countPartialVins(rawLatin1);
  const isImageBased = meaningfulChars < 100;
  const vendor = detectVendor(pdfText, rawLatin1, filename);
  
  // Count pages from /Type /Page patterns
  const pageMatches = rawLatin1.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 1;
  
  // Check for IAA signals in text
  const lower = pdfText.toLowerCase();
  const iaaOldSignals = 
    (lower.includes('sale list for') && lower.includes('iaa')) ||
    lower.includes('iaa united states') ||
    (lower.includes('buy now') && lower.includes('pre-bid'));
  const iaaNewSignals = 
    iaaOldSignals ||
    lower.includes('insurance auto auction') ||
    lower.includes('insurance auto auctions') ||
    (lower.includes('buy now') && lower.includes('salvage')) ||
    (lower.includes('buy now') && lower.includes('loss type')) ||
    (lower.includes('primary damage') && lower.includes('lot')) ||
    (lower.includes('run & drive') && lower.includes('lot')) ||
    (lower.includes('key available') && (lower.includes('salvage') || lower.includes('lot')));
  
  console.log(`\n📄 ${filename}`);
  console.log(`   Size: ${(pdfBytes.length / 1024).toFixed(0)} KB | Pages: ${pageCount}`);
  console.log(`   Extracted text: ${meaningfulChars} meaningful chars`);
  console.log(`   Status: ${isImageBased ? '🖼️  IMAGE-BASED' : '📝 TEXT-BASED'}`);
  console.log(`   Vendor detected: ${vendor}`);
  console.log(`   VINs in text: ${vinCount} | Partial VINs in raw bytes: ${partialVinCount}`);
  
  if (vendor === 'iaai') {
    console.log(`   IAA signals (old): ${iaaOldSignals ? '✅' : '❌'}`);
    console.log(`   IAA signals (new): ${iaaNewSignals ? '✅' : '❌'}`);
  }
  
  if (!isImageBased && pdfText.length > 100) {
    // Show a sample of the text to understand the format
    const sample = pdfText.substring(0, 500).replace(/\s+/g, ' ');
    console.log(`   Text sample: "${sample.substring(0, 300)}"`);
  }
}
