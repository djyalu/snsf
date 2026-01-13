const fs = require('fs');
const PDFParser = require("pdf2json");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const pdfFiles = [
    "SN_1000제(1~100).pdf", "SN_1000제(101~200).pdf", "SN_1000제(201~300).pdf",
    "SN_1000제(301~400).pdf", "SN_1000제(401~500).pdf", "SN_1000제(501~600).pdf",
    "SN_1000제(601~700).pdf", "SN_1000제(701~800).pdf", "SN_1000제(801~900).pdf",
    "SN_1000제(901~1000).pdf"
];

async function processPdf(fileName) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            const items = [];
            let currentItem = null;

            pdfData.Pages.forEach(page => {
                // Group texts by Y coordinate (rounded to 1 decimal place)
                const rows = {};
                page.Texts.forEach(t => {
                    const y = Math.round(t.y * 2) / 2; // Split by 0.5 units
                    if (!rows[y]) rows[y] = [];
                    rows[y].push({ x: t.x, text: decodeURIComponent(t.R[0].T).trim() });
                });

                // Sort Y coordinates
                const sortedY = Object.keys(rows).sort((a, b) => parseFloat(a) - parseFloat(b));

                sortedY.forEach(y => {
                    const rowTexts = rows[y].sort((a, b) => a.x - b.x);

                    // Detect Row Start (typically Column 1 is Item Number around X=4~7)
                    const numberText = rowTexts.find(t => t.x >= 4 && t.x <= 7.5 && /^\d+$/.test(t.text));

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

                    // Classify other columns by X
                    rowTexts.forEach(t => {
                        if (t.x >= 7.6 && t.x <= 12.5) currentItem.category += (currentItem.category ? " " : "") + t.text;
                        else if (t.x >= 12.6 && t.x <= 16.5) currentItem.comparison_item += (currentItem.comparison_item ? " " : "") + t.text;
                        else if (t.x >= 16.6 && t.x <= 22.0) currentItem.salesforce_feature += (currentItem.salesforce_feature ? " " : "") + t.text;
                        else if (t.x >= 22.1 && t.x <= 28.0) currentItem.servicenow_feature += (currentItem.servicenow_feature ? " " : "") + t.text;
                        else if (t.x >= 28.1) currentItem.source += (currentItem.source ? " " : "") + t.text;
                    });
                });
            });

            if (currentItem) items.push(currentItem);
            resolve(items);
        });
        pdfParser.loadPDF(fileName);
    });
}

async function main() {
    console.log("Starting bulk PDF import to Supabase...");
    let totalImported = 0;

    for (const file of pdfFiles) {
        if (!fs.existsSync(file)) {
            console.warn(`File not found: ${file}`);
            continue;
        }

        try {
            console.log(`Processing ${file}...`);
            const items = await processPdf(file);
            console.log(`Extracted ${items.length} items from ${file}. Uploading...`);

            // Filter out invalid items
            const validItems = items.filter(it => it.item_number && it.comparison_item);

            // Upload items in chunks to avoid timeout
            for (let i = 0; i < validItems.length; i += 20) {
                const chunk = validItems.slice(i, i + 20);
                const { error } = await supabase
                    .from('comparisons')
                    .upsert(chunk, { onConflict: 'item_number' });

                if (error) {
                    console.error(`Error uploading chunk from ${file}:`, error);
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
