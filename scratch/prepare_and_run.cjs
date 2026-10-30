const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read the Edge Function index.ts
const edgeFunctionPath = path.join(__dirname, '..', 'supabase', 'functions', 'parse-run-list', 'index.ts');
let code = fs.readFileSync(edgeFunctionPath, 'utf8');

// 2. Load .env variables into process.env
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
} catch (e) {
  // ignore
}

// 3. Replace Deno ESM URL imports with standard Node imports
code = code.replace(/import\s+\{\s*createClient\s*\}\s+from\s+["']https:\/\/esm\.sh\/@supabase\/supabase-js@2["'];/g, 'import { createClient } from "@supabase/supabase-js";');
code = code.replace(/import\s+\*\s+as\s+XLSX\s+from\s+["']https:\/\/esm\.sh\/xlsx@0\.18\.5\?bundle["'];/g, 'import * as XLSX from "xlsx";');
code = code.replace(/import\s+\{\s*PDFDocument\s*\}\s+from\s+["']https:\/\/esm\.sh\/pdf-lib@1\.17\.1["'];/g, 'import { PDFDocument } from "pdf-lib";');
code = code.replace(/import\s+\{\s*getDocumentProxy\s*\}\s+from\s+["']https:\/\/esm\.sh\/unpdf["'];/g, 'import { getDocumentProxy } from "unpdf";');

// Remove Deno.serve block at the end (we only want the helper/parser functions)
code = code.replace(/Deno\.serve\([\s\S]*\}\);/g, '');

// Slice pdfBytes to avoid detaching the buffer
code = code.replace(/await getDocumentProxy\(pdfBytes\)/g, 'await getDocumentProxy(pdfBytes.slice())');

// Stub out Deno-specific objects so they work in Node
const denoShims = `
// Deno Shims
const Deno = {
  env: {
    get: (key: string) => {
      return process.env[key];
    }
  }
};
`;

code = denoShims + code + `
export {
  parseCSVToVehicles,
  parseSpreadsheetToVehicles,
  parsePDFInline,
  detectPdfVendor,
  extractPDFTextRaw
};
`;

// Write Node-compatible TypeScript file
const nodeParserPath = path.join(__dirname, 'parse_run_list_node.ts');
fs.writeFileSync(nodeParserPath, code, 'utf8');

console.log('Successfully prepared scratch/parse_run_list_node.ts');

// 4. Run the test runner using tsx
try {
  console.log('Running test runner via tsx...');
  execSync('npx tsx scratch/run_test.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run test runner:', err.message);
  process.exit(1);
}
