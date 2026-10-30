// Quick local test for CSV parsing logic
// Run with: node scratch/test-parsers.mjs

import fs from 'fs';
import path from 'path';

const TEST_DIR = 'd:/logiclot-st/logiclot-main/test_files';

// ── Minimal re-implementations of the edge function's CSV parsers ──

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_MAP = {
  vin: 'vin', vehiclevin: 'vin', vinno: 'vin', vinnumber: 'vin',
  vehicleidentificationnumber: 'vin', fullvin: 'vin',
  year: 'year', yr: 'year', modelyear: 'year', vehicleyear: 'year',
  make: 'make', manufacturer: 'make', vehiclemake: 'make', brand: 'make',
  model: 'model', vehiclemodel: 'model',
  trim: 'trim', trimlevel: 'trim', style: 'trim', series: 'trim',
  mileage: 'mileage', miles: 'mileage', odometer: 'mileage', odo: 'mileage',
  odometerreading: 'mileage', mi: 'mileage', actualmileage: 'mileage',
  lane: 'lane', lanename: 'lane', lanenumber: 'lane',
  runorder: 'run_order', run: 'run_order', runnumber: 'run_order', linenumber: 'run_order', line: 'run_order',
  lot: 'lot_number', lotnumber: 'lot_number', stocknumber: 'lot_number',
  cr: 'cr_score', crscore: 'cr_score', grade: 'cr_score', conditionreport: 'cr_score',
  price: 'price_estimate', mmr: 'mmr_value', currentbid: 'current_bid', buynow: 'buy_now',
};

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i+1] === '\n')) {
        row.push(field.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = []; field = '';
        if (ch === '\r') i++;
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

function isValidVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

function parseNumberish(raw) {
  // Strip fraction denominators
  const stripped = raw.replace(/\s*\/\s*\d+\s*$/, '');
  const cleaned = stripped.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function rowHasVehicleSignal(row) {
  const vin = typeof row.vin === 'string' ? row.vin.trim().toUpperCase() : '';
  if (vin && isValidVin(vin)) return true;
  
  const year = typeof row.year === 'number' ? row.year : null;
  const make = typeof row.make === 'string' ? row.make.trim() : '';
  const model = typeof row.model === 'string' ? row.model.trim() : '';
  const mileage = typeof row.mileage === 'number' ? row.mileage : null;
  const lane = row.lane != null ? String(row.lane).trim() : '';
  const runOrder = typeof row.run_order === 'number' ? row.run_order : null;
  const lotNumber = typeof row.lot_number === 'string' ? row.lot_number.trim() : '';

  if (vin && vin.length >= 10 && year) return true;
  if (vin && vin.length >= 10 && make) return true;

  return Boolean(
    (year && make && model) ||
    (year && make && lane) ||
    (year && model && runOrder != null) ||
    (make && model && mileage != null) ||
    (lane && runOrder != null) ||
    (lotNumber && year && make)
  );
}

function testCSVFile(filename) {
  const filePath = path.join(TEST_DIR, filename);
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const rows = parseCSV(text);
  if (rows.length < 2) {
    console.log(`  ❌ ${filename}: Only ${rows.length} rows (no data)`);
    return;
  }
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Build column map
  const colMap = {};
  headers.forEach((h, idx) => {
    const col = HEADER_MAP[norm(h)];
    if (col && !colMap[col]) colMap[col] = idx;
  });
  
  console.log(`\n📄 ${filename}`);
  console.log(`   Headers found: [${headers.slice(0, 8).join(', ')}${headers.length > 8 ? '...' : ''}]`);
  console.log(`   Column mapping: ${JSON.stringify(colMap)}`);
  console.log(`   Data rows: ${dataRows.length}`);
  
  // Parse rows
  let parsed = 0, skipped = 0, hasVin = 0, hasCr = 0;
  const sample = [];
  
  dataRows.forEach((row, i) => {
    const v = {};
    for (const [col, idx] of Object.entries(colMap)) {
      const raw = (row[idx] ?? '').trim();
      if (!raw) continue;
      
      if (col === 'mileage') {
        const val = parseInt(raw.replace(/,/g, '').replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val) && val > 0) v.mileage = val;
      } else if (col === 'year') {
        const m = raw.match(/\b(19|20)\d{2}\b/);
        if (m) v.year = parseInt(m[0], 10);
      } else if (col === 'run_order') {
        const stripped = raw.replace(/^[^0-9]+/, '');
        const n = parseInt(stripped, 10);
        if (!isNaN(n) && n >= 0) v.run_order = n;
      } else if (['mmr_value', 'current_bid', 'buy_now', 'price_estimate', 'cr_score'].includes(col)) {
        const n = parseNumberish(raw);
        if (n != null && (col === 'cr_score' || n >= 0)) v[col] = n;
      } else {
        v[col] = raw;
      }
    }
    
    const vin = typeof v.vin === 'string' ? v.vin.trim().toUpperCase() : '';
    if (vin) { v.vin = vin; if (isValidVin(vin)) hasVin++; }
    
    // CR validation
    const crValue = typeof v.cr_score === 'number' && v.cr_score >= 1 && v.cr_score <= 5 ? v.cr_score : null;
    if (crValue != null) { v.cr_score = crValue; v.has_cr = true; hasCr++; }
    else delete v.cr_score;
    
    if (rowHasVehicleSignal(v)) {
      parsed++;
      if (sample.length < 3) sample.push(v);
    } else {
      skipped++;
    }
  });
  
  console.log(`   ✅ Parsed: ${parsed} vehicles | Skipped: ${skipped} | Has VIN: ${hasVin} | Has CR: ${hasCr}`);
  if (sample.length > 0) {
    console.log(`   Sample vehicle: ${JSON.stringify(sample[0], null, 2).split('\n').slice(0, 8).join('\n')}`);
  }
}

// Run tests
console.log('=== CSV Parser Tests ===\n');

['Export (5).csv', 'test-runlist-2200.csv', 'test-runlist-20000.csv'].forEach(f => {
  try {
    testCSVFile(f);
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
});
