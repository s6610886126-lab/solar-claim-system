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
        console.error('❌ Supabase delete error:', dbError);
        return;
    }
    console.log('   ✅ All claims successfully deleted from Supabase database.\n');

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

        const ws = wb.addWorksheet('รายการเคลม', { 
            properties: { tabColor: { argb: 'FFF59E0B' } }, 
            views: [{ state: 'frozen', ySplit: 1 }] 
        });

        ws.columns = [
            { header: 'เลขที่เคลม', key: 'claimNumber', width: 18 },
            { header: 'ชื่อลูกค้า', key: 'customerName', width: 22 },
            { header: 'เบอร์โทร', key: 'phone', width: 16 },
            { header: 'อีเมล', key: 'email', width: 24 },
            { header: 'ที่อยู่', key: 'address', width: 30 },
            { header: 'ประเภทอุปกรณ์', key: 'eqType', width: 20 },
            { header: 'ยี่ห้อ', key: 'brand', width: 16 },
            { header: 'รุ่น', key: 'model', width: 14 },
            { header: 'Serial Number', key: 'serial', width: 20 },
            { header: 'วันที่แจ้งเคลม', key: 'purchaseDate', width: 14 },
            { header: 'เลขประกัน', key: 'warranty', width: 16 },
            { header: 'ระยะประกัน', key: 'warPeriod', width: 14 },
            { header: 'หมดประกัน', key: 'warExpiry', width: 14 },
            { header: 'ปัญหา', key: 'problem', width: 40 },
            { header: 'ความรุนแรง', key: 'severity', width: 14 },
            { header: 'สถานะ', key: 'status', width: 16 },
            { header: 'วันที่แจ้ง', key: 'createdAt', width: 20 },
            { header: 'อัปเดตล่าสุด', key: 'updatedAt', width: 20 },
            { header: 'จำนวนรูปภาพ', key: 'imageCount', width: 14 }
        ];

        ws.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } };
        });
        ws.getRow(1).height = 28;

        const ws2 = wb.addWorksheet('สรุป', { properties: { tabColor: { argb: 'FF10B981' } } });
        ws2.columns = [{ header: 'รายการ', key: 'label', width: 25 }, { header: 'จำนวน', key: 'count', width: 12 }];
        ws2.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        ws2.addRow({ label: 'เคลมทั้งหมด', count: 0 });
        ws2.addRow({ label: 'รอดำเนินการ', count: 0 });
        ws2.addRow({ label: 'กำลังตรวจสอบ', count: 0 });
        ws2.addRow({ label: 'อนุมัติแล้ว', count: 0 });
        ws2.addRow({ label: 'ไม่อนุมัติ', count: 0 });
        ws2.addRow({ label: 'เสร็จสิ้น', count: 0 });

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
