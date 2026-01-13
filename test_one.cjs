const fs = require('fs');
const PDFParser = require("pdf2json");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function processPdf(fileName) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            const items = [];
            let currentItem = null;

            pdfData.Pages.forEach(page => {
                const rows = {};
                page.Texts.forEach(t => {
                    const y = Math.round(t.y * 2) / 2;
                    if (!rows[y]) rows[y] = [];
                    rows[y].push({ x: t.x, text: decodeURIComponent(t.R[0].T).trim() });
                });

                const sortedY = Object.keys(rows).sort((a, b) => parseFloat(a) - parseFloat(b));
                sortedY.forEach(y => {
                    const rowTexts = rows[y].sort((a, b) => a.x - b.x);
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

                    rowTexts.forEach(t => {
                        if (t.x >= 7.6 && t.x <= 13.0) currentItem.category += (currentItem.category ? " " : "") + t.text;
                        else if (t.x >= 13.1 && t.x <= 18.0) currentItem.comparison_item += (currentItem.comparison_item ? " " : "") + t.text;
                        else if (t.x >= 18.1 && t.x <= 23.5) currentItem.salesforce_feature += (currentItem.salesforce_feature ? " " : "") + t.text;
                        else if (t.x >= 23.6 && t.x <= 28.5) currentItem.servicenow_feature += (currentItem.servicenow_feature ? " " : "") + t.text;
                        else if (t.x >= 28.6) currentItem.source += (currentItem.source ? " " : "") + t.text;
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
    const file = "SN_1000제(1~100).pdf";
    console.log(`Testing with ${file}...`);
    try {
        const items = await processPdf(file);
        console.log(`Extracted ${items.length} items.`);
        if (items.length > 0) {
            console.log("First item:", JSON.stringify(items[0], null, 2));

            console.log("Attempting upload to Supabase...");
            const { data, error } = await supabase
                .from('comparisons')
                .upsert(items.slice(0, 5), { onConflict: 'item_number' });

            if (error) {
                console.error("Upload error:", error);
                if (error.code === '42501') {
                    console.log("REASON: RLS policies are preventing anonymous upsert. We need an admin/service-role key.");
                }
            } else {
                console.log("Upload successful for first 5 items!");
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
