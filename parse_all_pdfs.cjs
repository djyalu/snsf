const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfFiles = [
    "SN_1000제(1~100).pdf",
    "SN_1000제(101~200).pdf",
    "SN_1000제(201~300).pdf",
    "SN_1000제(301~400).pdf",
    "SN_1000제(401~500).pdf",
    "SN_1000제(501~600).pdf",
    "SN_1000제(601~700).pdf",
    "SN_1000제(701~800).pdf",
    "SN_1000제(801~900).pdf",
    "SN_1000제(901~1000).pdf"
];

async function parsePdf(fileName) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return "";
    }
    const dataBuffer = fs.readFileSync(filePath);
    try {
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (err) {
        console.error(`Error parsing ${fileName}:`, err);
        return "";
    }
}

function cleanText(text) {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
}

function extractItems(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes("|"));
    const items = [];
    for (const line of lines) {
        const parts = line.split("|").map(p => p.trim());
        const numMatch = parts[0].match(/^\d+/);

        if (numMatch && parts.length >= 5) {
            items.push({
                item_number: parseInt(numMatch[0], 10),
                category: parts[1] || "General",
                comparison_item: parts[2] || "",
                salesforce_feature: parts[3] || "",
                servicenow_feature: parts[4] || "",
                source: parts[5] || ""
            });
        }
    }
    return items;
}

async function main() {
    const allItems = [];
    for (const file of pdfFiles) {
        console.log(`Parsing ${file}...`);
        const text = await parsePdf(file);
        if (file === pdfFiles[0]) {
            console.log("DEBUG Preview:\n", text.substring(0, 1000));
        }
        const cleaned = cleanText(text);
        const items = extractItems(cleaned);
        console.log(`Found ${items.length} items in ${file}.`);
        allItems.push(...items);
    }

    console.log(`Total items found: ${allItems.length}`);

    if (allItems.length === 0) {
        console.log("No items found to generate SQL.");
        return;
    }

    // Sort by item number
    allItems.sort((a, b) => a.item_number - b.item_number);

    // Generate SQL
    let sql = "-- SNSF Comparison Data Import\n";
    sql += "INSERT INTO comparisons (item_number, category, comparison_item, salesforce_feature, servicenow_feature, source)\nVALUES\n";

    const valueRows = allItems.map(item => {
        return `(${item.item_number}, ${escapeSql(item.category)}, ${escapeSql(item.comparison_item)}, ${escapeSql(item.salesforce_feature)}, ${escapeSql(item.servicenow_feature)}, ${escapeSql(item.source)})`;
    });

    sql += valueRows.join(",\n") + "\n";
    sql += "ON CONFLICT (item_number) DO UPDATE SET\n";
    sql += "  category = EXCLUDED.category,\n";
    sql += "  comparison_item = EXCLUDED.comparison_item,\n";
    sql += "  salesforce_feature = EXCLUDED.salesforce_feature,\n";
    sql += "  servicenow_feature = EXCLUDED.servicenow_feature,\n";
    sql += "  source = EXCLUDED.source;";

    fs.writeFileSync('import_data.sql', sql);
    console.log("SQL script generated: import_data.sql");
}

function escapeSql(str) {
    if (str === null || str === undefined) return "''";
    return `'${str.replace(/'/g, "''")}'`;
}

main();
