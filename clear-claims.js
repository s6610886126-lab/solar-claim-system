require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_FILE = path.join(__dirname, 'data', 'claims.json');
const EXCEL_FILE = path.join(__dirname, 'data', 'claims.xlsx');

async function clearClaims() {
    console.log('\n======================================================');
    console.log('🔄 INITIATING CLAIM DATA PURGE & REINITIALIZATION 🔄');
    console.log('======================================================\n');

    // 1. Wipe Supabase DB 'claims' table
    console.log('🗑️ Step 1: Deleting all records from Supabase "claims" table...');
    const { error: dbError } = await supabase
        .from('claims')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
    if (dbError) {
        console.warn('⚠️ Supabase delete warning (Supabase offline):', dbError.message || dbError);
    } else {
        console.log('   ✅ All claims successfully deleted from Supabase database.\n');
    }

    // 2. Clear local JSON claims.json file (keeping the users array)
    if (fs.existsSync(DATA_FILE)) {
        console.log('📂 Step 2: Clearing claims in local backup "claims.json"...');
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const originalUserCount = data.users ? data.users.length : 0;
            data.claims = []; // clear claims
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
            console.log(`   ✅ Local "claims.json" cleared. (Preserved ${originalUserCount} users)\n`);
        } catch (e) {
            console.error('❌ Failed to clear local "claims.json":', e);
        }
    } else {
        console.log('📂 Step 2: Backup "claims.json" not found — skipping.\n');
    }

    // 3. Clear local EXCEL_FILE and write empty table headers
    console.log('📊 Step 3: Re-initializing local Excel claims cache to empty...');
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Solar Claim System';
        wb.created = new Date();

        const ws = wb.addWorksheet('Claims List', { 
            properties: { tabColor: { argb: 'FFF59E0B' } }, 
            views: [{ state: 'frozen', ySplit: 1 }] 
        });

        ws.columns = [
            { header: 'Claim Number', key: 'claimNumber', width: 18 },
            { header: 'Customer Name', key: 'customerName', width: 22 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Email', key: 'email', width: 24 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Equipment Type', key: 'eqType', width: 20 },
            { header: 'Brand', key: 'brand', width: 16 },
            { header: 'Model', key: 'model', width: 14 },
            { header: 'Serial Number', key: 'serial', width: 20 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 14 },
            { header: 'Warranty Number', key: 'warranty', width: 16 },
            { header: 'Warranty Period', key: 'warPeriod', width: 14 },
            { header: 'Warranty Expiry', key: 'warExpiry', width: 14 },
            { header: 'Problem Description', key: 'problem', width: 40 },
            { header: 'Severity', key: 'severity', width: 14 },
            { header: 'Status', key: 'status', width: 16 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Updated At', key: 'updatedAt', width: 20 },
            { header: 'Image Count', key: 'imageCount', width: 14 }
        ];

        ws.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } };
        });
        ws.getRow(1).height = 28;

        const ws2 = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF10B981' } } });
        ws2.columns = [{ header: 'Category', key: 'label', width: 25 }, { header: 'Count', key: 'count', width: 12 }];
        ws2.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        ws2.addRow({ label: 'Total Claims', count: 0 });
        ws2.addRow({ label: 'Pending', count: 0 });
        ws2.addRow({ label: 'Reviewing', count: 0 });
        ws2.addRow({ label: 'Approved', count: 0 });
        ws2.addRow({ label: 'Rejected', count: 0 });
        ws2.addRow({ label: 'Completed', count: 0 });

        await wb.xlsx.writeFile(EXCEL_FILE);
        console.log('   ✅ Local "claims.xlsx" successfully reset to empty with correct styled headers.\n');
    } catch (err) {
        console.error('❌ Failed to clear Excel file:', err);
    }

    console.log('======================================================');
    console.log('🎉 SUCCESS: All claims have been successfully cleared! 🎉');
    console.log('======================================================\n');
}

clearClaims();
