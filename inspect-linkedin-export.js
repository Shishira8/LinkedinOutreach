const XLSX = require('xlsx');

const workbook = XLSX.readFile('Content_2026-02-24_2026-03-02_ShishiraShashidhar.xlsx');

for (const sheetName of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  console.log(`SHEET: ${sheetName}`);
  console.log(`ROWCOUNT: ${rows.length}`);
  console.log(`HEADERS: ${headers.join(' | ')}`);
  console.log(`SAMPLE: ${JSON.stringify(rows.slice(0, 2), null, 2)}`);
  console.log('---');
}
