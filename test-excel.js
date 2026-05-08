const ExcelJS = require('exceljs');
const wb = new ExcelJS.Workbook();
wb.xlsx.readFile('data/claims.xlsx').then(() => {
    const ws = wb.getWorksheet(1);
    console.log('Sheet name:', ws.name);
    console.log('Rows:', ws.rowCount);
    console.log('Columns:', ws.columnCount);
    
    // Print headers
    const row1 = ws.getRow(1);
    const headers = [];
    row1.eachCell((cell, col) => headers.push(cell.value));
    console.log('Headers:', headers.join(' | '));
    
    // Print first data row
    const row2 = ws.getRow(2);
    const data = [];
    row2.eachCell((cell, col) => data.push(cell.value));
    console.log('Row 2:', data.join(' | '));
    
    // Check Sheet 2
    const ws2 = wb.getWorksheet(2);
    if (ws2) {
        console.log('\nSheet 2:', ws2.name);
        ws2.eachRow((row, num) => {
            console.log(`  Row ${num}:`, row.getCell(1).value, '-', row.getCell(2).value);
        });
    }
    
    console.log('\n✅ Excel file is valid and readable!');
}).catch(err => console.error('❌ Error reading Excel:', err.message));
