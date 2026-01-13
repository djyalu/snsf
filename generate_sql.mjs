import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function cleanText(text) {
    if (!text) return "";
    return text
        .replace(/[\x00-\x1F\x7F-\x9F\uFFFD]/g, "") // Remove control chars and replacement char
        .replace(/[]/g, " ") // Remove specific PDF symbol artifacts
        .replace(/\s+/g, " ")
        .trim();
}

function stripHeaders(text) {
    const headers = ["Category", "비교항목", "Salesforce", "ServiceNow", "Source", "번호"];
    let result = text;
    headers.forEach(h => {
        if (result.startsWith(h)) {
            result = result.substring(h.length).trim();
        }
    });
    return result;
}

async function extractData(pdfPath) {
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const loadingTask = pdfjsLib.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true
        });
        const pdf = await loadingTask.promise;
        const allItems = [];

        for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
            const page = await pdf.getPage(pNum);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map(item => ({
                x: item.transform[4],
                y: item.transform[5],
                text: item.str
            })).filter(it => it.text.trim());

            const BOUNDS = { CAT: 100, ITEM: 175, SF: 245, SN: 355, SOURCE: 455 };
            const numbers = textItems
                .filter(it => it.x < BOUNDS.CAT && /^\d+$/.test(it.text.trim()))
                .map(it => ({ num: parseInt(it.text.trim(), 10), y: it.y }))
                .sort((a, b) => b.y - a.y);

            if (numbers.length === 0) continue;

            const itemRanges = [];
            for (let i = 0; i < numbers.length; i++) {
                const current = numbers[i];
                const prev = numbers[i - 1];
                const next = numbers[i + 1];

                const top = prev ? (prev.y + current.y) / 2 : current.y + 60;
                const bottom = next ? (current.y + next.y) / 2 : current.y - 60;

                itemRanges.push({
                    num: current.num, top, bottom, data: {
                        item_number: current.num,
                        category: "",
                        comparison_item: "",
                        salesforce_feature: "",
                        servicenow_feature: "",
                        source: ""
                    }
                });
            }

            textItems.forEach(it => {
                const range = itemRanges.find(r => it.y <= r.top && it.y > r.bottom);
                if (range) {
                    const x = it.x;
                    const val = it.text;
                    const d = range.data;

                    if (x < BOUNDS.CAT) { /* skip */ }
                    else if (x < BOUNDS.ITEM) d.category += val;
                    else if (x < BOUNDS.SF) d.comparison_item += val;
                    else if (x < BOUNDS.SN) d.salesforce_feature += val;
                    else if (x < BOUNDS.SOURCE) d.servicenow_feature += val;
                    else d.source += val;
                }
            });

            itemRanges.forEach(r => {
                const d = r.data;
                d.category = stripHeaders(cleanText(d.category));
                d.comparison_item = stripHeaders(cleanText(d.comparison_item));
                d.salesforce_feature = stripHeaders(cleanText(d.salesforce_feature));
                d.servicenow_feature = stripHeaders(cleanText(d.servicenow_feature));
                d.source = stripHeaders(cleanText(d.source));
                allItems.push(d);
            });
        }
        return allResultsCleaning(allItems);
    } catch (e) {
        console.error(`Error processing ${pdfPath}:`, e);
        return [];
    }
}

function allResultsCleaning(items) {
    // Remove items that are just headers or noise
    return items.filter(it => it.item_number && it.comparison_item.length > 0);
}

const pdfFiles = [
    "SN_1000제(1~100).pdf", "SN_1000제(101~200).pdf", "SN_1000제(201~300).pdf",
    "SN_1000제(301~400).pdf", "SN_1000제(401~500).pdf", "SN_1000제(501~600).pdf",
    "SN_1000제(601~700).pdf", "SN_1000제(701~800).pdf", "SN_1000제(801~900).pdf",
    "SN_1000제(901~1000).pdf"
];

function escapeSql(str) {
    if (!str) return "''";
    return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
    console.log("Final Re-parsing all PDFs with RANGE-BASED approach & Cleaning...");
    const allResults = [];
    for (const file of pdfFiles) {
        if (!fs.existsSync(file)) continue;
        console.log(`Analyzing ${file}...`);
        const items = await extractData(file);
        console.log(`  -> Found ${items.length} items.`);
        allResults.push(...items);
    }

    const uniqueMap = new Map();
    allResults.forEach(item => {
        uniqueMap.set(item.item_number, item);
    });
    const sortedItems = Array.from(uniqueMap.values()).sort((a, b) => a.item_number - b.item_number);

    console.log(`Total unique items found: ${sortedItems.length}`);

    let sql = "-- Final Bulk Import for SNSF Comparison Data (v4 Cleaned)\n\n";
    const chunkSize = 100;

    for (let i = 0; i < sortedItems.length; i += chunkSize) {
        const chunk = sortedItems.slice(i, i + chunkSize);
        sql += `INSERT INTO public.comparisons (item_number, category, comparison_item, salesforce_feature, servicenow_feature, source)\nVALUES\n`;
        sql += chunk.map(it => `(${it.item_number}, ${escapeSql(it.category)}, ${escapeSql(it.comparison_item)}, ${escapeSql(it.salesforce_feature)}, ${escapeSql(it.servicenow_feature)}, ${escapeSql(it.source)})`).join(",\n");
        sql += `\nON CONFLICT (item_number) DO UPDATE SET\n`;
        sql += `  category = EXCLUDED.category,\n  comparison_item = EXCLUDED.comparison_item,\n  salesforce_feature = EXCLUDED.salesforce_feature,\n  servicenow_feature = EXCLUDED.servicenow_feature,\n  source = EXCLUDED.source,\n  updated_at = now();\n\n`;
    }

    fs.writeFileSync('import_data.sql', sql);
    console.log(`SUCCESS! Final import_data.sql generated with ${sortedItems.length} items.`);
}

main();
