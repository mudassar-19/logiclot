const fs = require('fs');
const content = fs.readFileSync('d:/logiclot-st/LogicLot/src/pages/app/BuyList.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('risk_flags') || line.includes('riskFlags')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
