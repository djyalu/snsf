const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const pages = pdfData.Pages;
    const page = pages[0];
    const texts = page.Texts;

    // 처음 50개의 텍스트 객체의 x, y, 내용 출력
    console.log("--- X, Y COORDINATES SAMPLE ---");
    texts.slice(0, 50).forEach(t => {
        const x = t.x;
        const y = t.y;
        const content = decodeURIComponent(t.R[0].T);
        console.log(`x: ${x.toFixed(2)}, y: ${y.toFixed(2)}, text: [${content}]`);
    });
});

pdfParser.loadPDF("SN_1000제(1~100).pdf");
