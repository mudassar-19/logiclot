import * as fs from 'fs';
import * as path from 'path';
import {
  parseCSVToVehicles,
  parseSpreadsheetToVehicles,
  parsePDFInline,
  detectPdfVendor,
  extractPDFTextRaw
} from './parse_run_list_node';

const testFilesDir = path.join(process.cwd(), 'test_files');
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
        const vehicles = parseCSVToVehicles(text, 'test-run-list-id', 'test-org-id');
        printResults(file, vehicles);
      } else if (fileType === 'Spreadsheet') {
        const vehicles = parseSpreadsheetToVehicles(fileBytes, 'test-run-list-id', 'test-org-id');
        printResults(file, vehicles);
      } else if (fileType === 'PDF') {
        const pdfText = await extractPDFTextRaw(fileBytes);
        const rawLatin1 = new TextDecoder("latin1").decode(fileBytes);
        const vendor = detectPdfVendor(pdfText, rawLatin1, file);
        console.log(`Detected PDF Vendor: ${vendor}`);
        console.log(`Extracted characters count: ${pdfText.length}`);
        if (file === 'pdf manheim runlist.pdf') {
          console.log('--- SAMPLE TEXT FROM MANHEIM ---');
          console.log(pdfText.substring(0, 1500));
          console.log('--------------------------------');
        }

        const vehicles = await parsePDFInline(fileBytes, 'test-run-list-id', 'test-org-id', file);
        printResults(file, vehicles);
      }
    } catch (err) {
      console.error(`ERROR parsing ${file}:`, err);
    }
  }
}

function printResults(fileName: string, vehicles: any[]) {
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
