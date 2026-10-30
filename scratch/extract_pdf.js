import fs from 'fs';
import path from 'path';
import { getDocumentProxy } from 'unpdf';

async function main() {
  const pdfPath = 'd:/logiclot-st/LogicLot/newfiles/LogicLot_Landing_Page_Change_Requests.pdf';
  console.log('Reading PDF file:', pdfPath);
  
  const buffer = fs.readFileSync(pdfPath);
  const pdfBytes = new Uint8Array(buffer);
  
  const pdf = await getDocumentProxy(pdfBytes);
  const numPages = pdf.numPages;
  console.log(`PDF parsed successfully. Total pages: ${numPages}`);
  
  let fullText = '';
  for (let p = 1; p <= numPages; p++) {
    console.log(`Extracting page ${p}...`);
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    let out = `--- Page ${p} ---\n`;
    for (const item of (textContent.items || [])) {
      if (typeof item.str === 'string') {
        out += item.str;
        out += item.hasEOL ? '\n' : ' ';
      }
    }
    fullText += out + '\n';
  }
  
  const outputPath = 'd:/logiclot-st/LogicLot/scratch/extracted_pdf_text.txt';
  fs.writeFileSync(outputPath, fullText, 'utf8');
  console.log('Extracted text written to:', outputPath);
}

main().catch(err => {
  console.error('Error extracting PDF:', err);
});
