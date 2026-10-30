import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'newfiles', 'shopify.md');
const content = fs.readFileSync(filePath, 'utf-8');

function inspectSection(name, startKeyword, endKeyword) {
  const startIdx = content.indexOf(startKeyword);
  if (startIdx === -1) {
    console.log(`Could not find ${name} start`);
    return;
  }
  const endIdx = content.indexOf(endKeyword, startIdx + startKeyword.length);
  const sectionHtml = content.substring(startIdx, endIdx !== -1 ? endIdx : startIdx + 2000);
  console.log(`\n=================== ${name} ===================`);
  console.log(sectionHtml.substring(0, 1500) + "...\n");
}

inspectSection("Section 3: Agentic", 'data-section-name="agentic"', 'data-section-name="online-and-in-person"');
inspectSection("Section 7: Sidekick", 'data-section-name="sidekick"', 'data-section-name="apps"');
inspectSection("Section 11: Checkout Stats", 'data-section-name="checkout-stats"', 'data-section-name="rock-steady"');
