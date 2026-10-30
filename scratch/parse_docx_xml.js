const fs = require('fs');
const path = require('path');

const xmlPath = 'd:/logiclot-st/LogicLot/scratch/docx_temp/word/document.xml';
if (!fs.existsSync(xmlPath)) {
  console.error("XML not found");
  process.exit(1);
}

const xml = fs.readFileSync(xmlPath, 'utf8');

const pMatches = xml.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g);
if (!pMatches) {
  console.log("No paragraphs found");
  process.exit(0);
}

let outputText = "";
pMatches.forEach(p => {
  const tMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
  if (tMatches) {
    const pText = tMatches.map(t => {
      const content = t.replace(/<w:t\b[^>]*>/, '').replace(/<\/w:t>/, '');
      return content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }).join('');
    outputText += pText + "\n";
  } else {
    outputText += "\n";
  }
});

fs.writeFileSync('d:/logiclot-st/LogicLot/scratch/extracted_spec.txt', outputText);
console.log("Extracted spec successfully!");
