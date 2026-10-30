const fs = require('fs');
const content = fs.readFileSync('d:/logiclot-st/LogicLot/src/pages/app/BuyList.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('setVehicles(') || line.includes('setVehicles') || line.includes('from(\'auction_vehicles\')') || line.includes('from("auction_vehicles")')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
