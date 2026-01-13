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

        // Find column boundaries from header if present
        let colBounds = {
            cat: 80,
            item: 140,
            sf: 260,
            sn: 450,
            source: 650
        };

        sortedY.forEach(y => {
            const rowTexts = rows[y].sort((a, b) => a.x - b.x);

            // Update boundaries if header found
            const headerRow = rowTexts.map(t => t.text).join("");
            if (headerRow.includes("번호") && headerRow.includes("Category")) {
                const cat = rowTexts.find(t => t.text.includes("Category"));
                const item = rowTexts.find(t => t.text.includes("비교 항목"));
                const sf = rowTexts.find(t => t.text.includes("Salesforce"));
                const sn = rowTexts.find(t => t.text.includes("ServiceNow"));
                const source = rowTexts.find(t => t.text.includes("Source"));

                if (cat) colBounds.cat = cat.x - 5;
                if (item) colBounds.item = item.x - 5;
                if (sf) colBounds.sf = sf.x - 5;
                if (sn) colBounds.sn = sn.x - 5;
                if (source) colBounds.source = source.x - 5;
                return; // Skip header row from data
            }

            const numberText = rowTexts.find(t => t.x < colBounds.cat && /^\d+$/.test(t.text));

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
                if (t === numberText) return;
                if (t.x >= colBounds.cat && t.x < colBounds.item) currentItem.category += (currentItem.category ? " " : "") + t.text;
                else if (t.x >= colBounds.item && t.x < colBounds.sf) currentItem.comparison_item += (currentItem.comparison_item ? " " : "") + t.text;
                else if (t.x >= colBounds.sf && t.x < colBounds.sn) currentItem.salesforce_feature += (currentItem.salesforce_feature ? " " : "") + t.text;
                else if (t.x >= colBounds.sn && t.x < colBounds.source) currentItem.servicenow_feature += (currentItem.servicenow_feature ? " " : "") + t.text;
                else if (t.x >= colBounds.source) currentItem.source += (currentItem.source ? " " : "") + t.text;
            });
        });
    }
    if (currentItem) items.push(currentItem);
    return items;
}

const pdfFiles = [
    "SN_1000제(1~100).pdf", "SN_1000제(101~200).pdf", "SN_1000제(201~300).pdf",
    "SN_1000제(301~400).pdf", "SN_1000제(401~500).pdf", "SN_1000제(501~600).pdf",
    "SN_1000제(601~700).pdf", "SN_1000제(701~800).pdf", "SN_1000제(801~900).pdf",
    "SN_1000제(901~1000).pdf"
];

async function main() {
    console.log("Starting bulk PDF import to Supabase...");
    let totalImported = 0;

    for (const file of pdfFiles) {
        if (!fs.existsSync(file)) continue;

        try {
            console.log(`Processing ${file}...`);
            const items = await extractData(file);
            const validItems = items.filter(it => it.item_number && it.comparison_item);

            console.log(`Extracted ${validItems.length} valid items from ${file}.`);

            for (let i = 0; i < validItems.length; i += 50) {
                const chunk = validItems.slice(i, i + 50);
                const { error } = await supabase
                    .from('comparisons')
                    .upsert(chunk, { onConflict: 'item_number' });

                if (error) {
                    console.error(`Error uploading chunk from ${file}:`, error.message);
                } else {
                    totalImported += chunk.length;
                }
            }
        } catch (err) {
            console.error(`Failed to process ${file}:`, err);
        }
    }

    console.log(`Successfully imported ${totalImported} items to the database.`);
}

main();
