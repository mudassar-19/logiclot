import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'newfiles', 'shopify.md');
const content = fs.readFileSync(filePath, 'utf-8');

// Let's grab the HTML from Section 1 up to the start of Section 2
const section1Start = content.indexOf('<section class="grid grid-cols-full pb-0 bg-section-dark-bg');
const section2Start = content.indexOf('<section class="grid gap-y-2xl grid-cols-full bg-section-dark-bg text-section-dark-text pt-0');

if (section1Start !== -1 && section2Start !== -1) {
  const section1Html = content.substring(section1Start, section2Start);
  console.log("Section 1 length:", section1Html.length);
  // Save it formatted so we can view it
  fs.writeFileSync(path.join(__dirname, 'section1.html'), section1Html);
  console.log("Saved Section 1 HTML to scratch/section1.html");
} else {
  console.log("Could not find boundaries");
}
