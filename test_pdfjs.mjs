import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function extractData(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true
    });
    const pdf = await loadingTask.promise;
    const items = [];
    let currentItem = null;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const rows = {};
        textContent.items.forEach(item => {
            const x = item.transform[4];
            const y = item.transform[5];
            const text = item.str.trim();
            if (!text) return;

            const yKey = Math.round(y * 2) / 2;
            if (!rows[yKey]) rows[yKey] = [];
            rows[yKey].push({ x, text });
        });

        const sortedY = Object.keys(rows).sort((a, b) => b - a);

        sortedY.forEach(y => {
            const rowTexts = rows[y].sort((a, b) => a.x - b.x);

            const numberText = rowTexts.find(t => t.x < 100 && /^\d+$/.test(t.text));

            if (numberText) {
                if (currentItem) items.push(currentItem);
                currentItem = {
                    item_number: parseInt(numberText.text, 10),
                    category: "",
                    comparison_item: "",
                    salesforce_feature: "",
                    servicenow_feature: "",
                    source: ""
                };
            }

            if (!currentItem) return;

            rowTexts.forEach(t => {
                if (t.x >= 80 && t.x < 155) currentItem.category += (currentItem.category ? " " : "") + t.text;
                else if (t.x >= 155 && t.x < 245) currentItem.comparison_item += (currentItem.comparison_item ? " " : "") + t.text;
                else if (t.x >= 245 && t.x < 420) currentItem.salesforce_feature += (currentItem.salesforce_feature ? " " : "") + t.text;
                else if (t.x >= 420 && t.x < 620) currentItem.servicenow_feature += (currentItem.servicenow_feature ? " " : "") + t.text;
                else if (t.x >= 620) currentItem.source += (currentItem.source ? " " : "") + t.text;
            });
        });
    }
    if (currentItem) items.push(currentItem);
    return items;
}

async function main() {
    const file = "SN_1000제(1~100).pdf";
    console.log(`Parsing ${file} with pdfjs-dist (.mjs)...`);
    try {
        const items = await extractData(file);
        console.log(`Extracted ${items.length} items.`);
        if (items.length > 0) {
            console.log("First item:", JSON.stringify(items[0], null, 2));
            console.log("Sample item (e.g. 50):", JSON.stringify(items.find(it => it.item_number === 50) || items[Math.min(items.length - 1, 50)], null, 2));
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
