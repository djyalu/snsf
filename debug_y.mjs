import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function debug(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    console.log(`Detailed Debug with Y for ${pdfPath}:`);
    textContent.items.slice(0, 100).forEach(item => {
        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);
        const text = item.str.trim();
        if (text) {
            console.log(`Y: ${y} | X: ${x} | Text: "${text}"`);
        }
    });
}

debug("SN_1000제(1~100).pdf");
