const fs = require('fs');
const path = require('path');

// 1. Read the Edge Function index.ts
const edgeFunctionPath = path.join(__dirname, '..', 'supabase', 'functions', 'parse-run-list', 'index.ts');
let code = fs.readFileSync(edgeFunctionPath, 'utf8');

// Load .env variables into process.env
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

// Remove the Deno.serve block or anything Deno-specific that would fail in Node
code = code.replace(/\/\/ @ts-nocheck[\s\S]*?import { getDocumentProxy } from "https:\/\/esm.sh\/unpdf";/, '');

// Add Node.js imports and Deno shims
const headerShims = `
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const { PDFDocument } = require("pdf-lib");
const { getDocumentProxy } = require("unpdf");

const Deno = {
  env: {
    get: (key) => {
      return process.env[key];
    }
  }
};
`;

code = headerShims + code;

// Remove Deno.serve at the end
code = code.replace(/Deno\.serve\([\s\S]*\}\);/g, '');

// Export the core functions we want to test
code += `
module.exports = {
  parseCSVToVehicles,
  parseSpreadsheetToVehicles,
  parsePDFInline,
  detectPdfVendor,
  parseCarMaxBlocks,
  parseIaaSaleListBlocks,
  parseAdesaBlocks,
  parseManheimBlocks,
  parseVinLineBlocks,
  parseGenericVehicleBlocks,
  extractPDFTextRaw,
  extractPDFTextRawBytes
};
`;

// Write the Node.js compatible version of the parser code
const nodeParserPath = path.join(__dirname, 'parse_run_list_node.cjs');
fs.writeFileSync(nodeParserPath, code, 'utf8');

// Load the parsed parser module
const parser = require(nodeParserPath);

// 3. Test files in the test_files folder
const testFilesDir = path.join(__dirname, '..', 'test_files');
const files = fs.readdirSync(testFilesDir);

console.log('--- RUNNING PARSER TEST ON ALL FILES ---');

async function testAll() {
  for (const file of files) {
    if (file.endsWith('.zip') || file.startsWith('.')) continue;
    const filePath = path.join(testFilesDir, file);
    const stat = fs.statSync(filePath);
    console.log(`\n======================================`);
    console.log(`File: ${file} (${(stat.size / 1024).toFixed(1)} KB)`);

    try {
      const fileBytes = new Uint8Array(fs.readFileSync(filePath));
      const fileType = file.endsWith('.pdf') ? 'PDF' : file.endsWith('.csv') ? 'CSV' : 'Spreadsheet';

      if (fileType === 'CSV') {
        const text = fs.readFileSync(filePath, 'utf8');
        const vehicles = parser.parseCSVToVehicles(text, 'test-run-list-id', 'test-org-id');
        printResults(file, vehicles);
      } else if (fileType === 'Spreadsheet') {
        const vehicles = parser.parseSpreadsheetToVehicles(fileBytes, 'test-run-list-id', 'test-org-id');
        printResults(file, vehicles);
      } else if (fileType === 'PDF') {
        // First extract text to see vendor
        const pdfText = await parser.extractPDFTextRaw(fileBytes);
        const rawLatin1 = new TextDecoder("latin1").decode(fileBytes);
        const vendor = parser.detectPdfVendor(pdfText, rawLatin1, file);
        console.log(`Detected PDF Vendor: ${vendor}`);
        console.log(`Extracted characters count: ${pdfText.length}`);

        const vehicles = await parser.parsePDFInline(fileBytes, 'test-run-list-id', 'test-org-id', file);
        printResults(file, vehicles);
      }
    } catch (err) {
      console.error(`ERROR parsing ${file}:`, err);
    }
  }
}

function printResults(fileName, vehicles) {
  console.log(`Successfully parsed ${vehicles.length} vehicles.`);
  if (vehicles.length === 0) return;

  // Print first 3 vehicles as sample
  console.log(`\nSample vehicles (first 3):`);
  vehicles.slice(0, 3).forEach((v, idx) => {
    console.log(`  [${idx + 1}] VIN: ${v.vin || 'MISSING'}, Year: ${v.year || 'MISSING'}, Make: ${v.make || 'MISSING'}, Model: ${v.model || 'MISSING'}, Lane: ${v.lane || 'MISSING'}, Run Order: ${v.run_order ?? 'MISSING'}, Lot: ${v.lot_number ?? 'N/A'}, Mileage: ${v.mileage ?? 'MISSING'}, CR Score: ${v.cr_score ?? 'N/A'}, Buy Now: ${v.buy_now ?? 'N/A'}, Current Bid: ${v.current_bid ?? 'N/A'}, Price Est: ${v.price_estimate ?? 'N/A'}`);
  });

  // Run some quality checks
  let missingVin = 0;
  let invalidVin = 0;
  let missingYear = 0;
  let missingMakeModel = 0;
  let missingLaneRun = 0;
  
  vehicles.forEach(v => {
    if (!v.vin) missingVin++;
    else if (!/^[A-HJ-NPR-Z0-9*]{11,17}$/i.test(v.vin)) invalidVin++;
    if (!v.year) missingYear++;
    if (!v.make || !v.model) missingMakeModel++;
    if (v.lane === null || v.run_order === null) missingLaneRun++;
  });

  console.log(`\nQuality Checks:`);
  console.log(`  - Missing VINs: ${missingVin}`);
  console.log(`  - Invalid VINs: ${invalidVin}`);
  console.log(`  - Missing Year: ${missingYear}`);
  console.log(`  - Missing Make/Model: ${missingMakeModel}`);
  console.log(`  - Missing Lane/Run Order: ${missingLaneRun}`);
}

testAll().catch(console.error);
