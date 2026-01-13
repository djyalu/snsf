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
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
}

function extractItemsFromText(text) {
    // 번호로 시작하는 패턴을 찾아 데이터를 분리하는 시도
    // 실제 추출된 텍스트 구조를 보면 번호가 한 줄에 하나씩 나오거나 카테고리와 붙어 나옵니다.
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const items = [];
    let currentItem = null;
    let state = 0; // 0: 번호/카테고리 찾기, 1: 비교항목, 2: SF특징, 3: SN특징, 4: 출처

    // 이 로직은 PDF 텍스트 추출 순서에 매우 의존적입니다.
    // 미리보기 결과: 번호 -> 카테고리 -> 비교항목 -> SF -> SN -> 출처 순으로 나오는 경향이 있음

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 번호 패턴 매칭 (줄의 시작이 숫자인지 확인)
        const numMatch = line.match(/^(\d+)$/);
        if (numMatch) {
            if (currentItem && currentItem.item_number) {
                items.push(currentItem);
            }
            currentItem = {
                item_number: parseInt(numMatch[1], 10),
                category: "",
                comparison_item: "",
                salesforce_feature: "",
                servicenow_feature: "",
                source: ""
            };
            state = 1; // 다음은 카테고리 혹은 비교항목
            continue;
        }

        if (!currentItem) continue;

        // 간단한 상태 전이 및 텍스트 누적
        // 실제 데이터는 여러 줄일 수 있으므로 카테고리가 "Category"를 포함하는지 등으로 구분 시도
        if (line.includes("Category")) {
            currentItem.category = line;
            state = 2;
        } else if (state === 1 || state === 2) {
            currentItem.comparison_item += (currentItem.comparison_item ? " " : "") + line;
            // 특정 키워드나 길이를 기준으로 상태 전환을 시도할 수 있으나 위험함
            // 여기서는 번호가 나오기 전까지는 계속 누적하거나, 
            // 이전 미리보기에서 본 것처럼 SF/SN 특징들이 구분되는 패턴을 찾아야 함
        }
    }

    if (currentItem) items.push(currentItem);
    return items;
}

// 보다 확실한 방법: 파이프 구분자가 있는 원본 텍스트가 PDF에 포함되어 있는지 재확인
// 만약 파이프가 없다면, 정규식을 이용해 각 항목의 경계를 찾아야 합니다.

async function testParsing() {
    const text = await parsePdf(pdfFiles[0]);
    // 텍스트를 한 줄씩 출력해서 규칙성을 찾음
    const lines = text.split('\n').slice(0, 100);
    console.log("--- TEST LINES ---");
    lines.forEach((l, i) => console.log(`${i}: [${l.trim()}]`));
}

testParsing();
