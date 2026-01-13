import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function debug(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    console.log(`Debug X coordinates for ${pdfPath} (Page 1):`);
    textContent.items.slice(0, 50).forEach(item => {
        const x = Math.round(item.transform[4]);
        const text = item.str.trim();
        if (text) console.log(`X: ${x} | Text: "${text}"`);
    });
}

debug("SN_1000제(1~100).pdf");
