require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const EXCEL_FILE = path.join(__dirname, 'data', 'claims.xlsx');

// 15 realistic claims conforming to equipment brand rules:
// Solar Panel (JinkoSolar, Solis), Inverter (Solis), Battery (Battery Dyness, LV Topsun)
const dummyClaims = [
    {
        name: "Mr. Somchai Deeman",
        phone: "0812345678",
        email: "somchai.d@gmail.com",
        address: "45/2 Moo 3, Vibhavadi Rangsit Rd, Laksi, Bangkok 10210",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "Tiger Neo N-type",
        serial: "JK-TIGER-2026A1",
        purchaseDate: "2024-10-15",
        warrantyNum: "WRT-JK-20241015",
        warrantyPeriod: "15 years",
        warrantyExpiry: "2039-10-15",
        problemDesc: "Solar panel is not generating full power. During peak sunlight, output drops by over 50%. A small hot spot is visible on the panel.",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-01T09:30:00.000Z",
        notes: "Inspected via photos and confirmed the defect. Approved replacement with a new panel."
    },
    {
        name: "Ms. Wipada Lertlam",
        phone: "0898765432",
        email: "wipada.lert@outlook.com",
        address: "12/5 Phatthanakan Rd, Suan Luang, Bangkok 10250",
        eqType: "Inverter",
        brand: "Solis",
        model: "S6-GR1P5K",
        serial: "SL-INV-S6-293810",
        purchaseDate: "2025-02-10",
        warrantyNum: "WRT-SL-20250210",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2030-02-10",
        problemDesc: "Inverter screen is completely black. Status lights are all off. No electricity is being supplied to the home system.",
        severity: "50",
        status: "reviewing",
        createdAt: "2026-05-18T10:15:00.000Z",
        notes: "Technical team is preparing equipment to inspect the ground system and inverter control board on-site."
    },
    {
        name: "Mr. Kittisak Rungruang",
        phone: "0823456789",
        email: "kittisak.r@gmail.com",
        address: "99/9 Greenview Village, Bangna-Trad Rd, Bang Phli, Samut Prakan 10540",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Powerbox F-10.0",
        serial: "DN-PB-98471203",
        purchaseDate: "2025-11-20",
        warrantyNum: "WRT-DN-20251120",
        warrantyPeriod: "10 years",
        warrantyExpiry: "2035-11-20",
        problemDesc: "Battery is not charging at all. Status light flashes orange continuously. Reboots do not resolve the issue.",
        severity: "100",
        status: "pending",
        createdAt: "2026-05-20T14:22:00.000Z",
        notes: "Claim request received. Scheduling engineer visit to check the main electrical system and battery."
    },
    {
        name: "Ms. Kamolwan Chaichana",
        phone: "0845678901",
        email: "kamolwan.c@hotmail.com",
        address: "555/23 High-Rise Condo, Sukhumvit Rd, Khlong Toei, Bangkok 10110",
        eqType: "Solar Panel",
        brand: "Solis",
        model: "Solis Panel 440W",
        serial: "SL-PANEL-440-0012",
        purchaseDate: "2024-01-18",
        warrantyNum: "WRT-SLP-20240118",
        warrantyPeriod: "12 years",
        warrantyExpiry: "2036-01-18",
        problemDesc: "Rust spots formed around the aluminum frame of the solar panel. Power generation efficiency dropped slightly.",
        severity: "10",
        status: "completed",
        createdAt: "2026-04-10T08:00:00.000Z",
        notes: "Sent technician to clean and inspect the panel frame. Secured the mounting structure."
    },
    {
        name: "Mr. Prasit Rakkarndee",
        phone: "0856789012",
        email: "prasit.rak@gmail.com",
        address: "88/1 Mittraphap Rd, Mueang, Khon Kaen 40000",
        eqType: "Battery",
        brand: "LV Topsun",
        model: "Topsun LV 48V 100Ah",
        serial: "TS-BATT-100-9928",
        purchaseDate: "2024-05-05",
        warrantyNum: "WRT-TSB-20240505",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2029-05-05",
        problemDesc: "During evening usage, the battery overheated. Safety system cut off operation and a burning smell was detected.",
        severity: "80",
        status: "rejected",
        createdAt: "2026-04-15T11:45:00.000Z",
        notes: "Rejected claim: Water ingress detected at the bottom of the device due to installation in an open area without a roof."
    },
    {
        name: "Mr. Apichart Kaewmanee",
        phone: "0867890123",
        email: "apichart.k@yahoo.com",
        address: "214/8 Chang Klan Rd, Chang Klan, Mueang, Chiang Mai 50100",
        eqType: "Inverter",
        brand: "Solis",
        model: "S5-GR3P10K",
        serial: "SL-INV-3P10K-9028",
        purchaseDate: "2024-06-30",
        warrantyNum: "WRT-SLI-20240630",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2029-06-30",
        problemDesc: "Inverter displays an internal hardware fault code and cannot generate AC power.",
        severity: "100",
        status: "approved",
        createdAt: "2026-03-25T13:20:00.000Z",
        notes: "Verified internal power board defect. Approved replacement inverter for customer."
    },
    {
        name: "Ms. Siriporn Boonlue",
        phone: "0878901234",
        email: "siriporn.b@gmail.com",
        address: "73 Rob Mueang Rd, Mak Khaeng, Mueang, Udon Thani 41000",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "Tiger Pro",
        serial: "JK-TIGERPRO-8812",
        purchaseDate: "2024-08-12",
        warrantyNum: "WRT-JKP-20240812",
        warrantyPeriod: "15 years",
        warrantyExpiry: "2039-08-12",
        problemDesc: "Tempered glass on solar panel has spiderweb cracks, likely due to heat accumulation and contraction.",
        severity: "50",
        status: "completed",
        createdAt: "2026-05-02T16:10:00.000Z",
        notes: "Successfully replaced the cracked solar panel. System power output has returned to normal."
    },
    {
        name: "Mr. Teeradech Suksawat",
        phone: "0889012345",
        email: "teeradech.s@gmail.com",
        address: "318/14 Rama 3 Rd, Yan Nawa, Bangkok 10120",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Dyness B4850",
        serial: "DN-B4850-202409",
        purchaseDate: "2025-03-15",
        warrantyNum: "WRT-DN-20250315",
        warrantyPeriod: "10 years",
        warrantyExpiry: "2035-03-15",
        problemDesc: "Battery capacity drops rapidly. Fully charged battery only discharges for 10 minutes before system cuts off.",
        severity: "50",
        status: "pending",
        createdAt: "2026-05-21T02:00:00.000Z",
        notes: "Claim request received. Analyzing usage and charge history logs via Cloud Logger."
    },
    {
        name: "Mrs. Nonglak Somboon",
        phone: "0890123456",
        email: "nonglak.s@outlook.com",
        address: "105/4 Phetkasem Rd, Hat Yai, Songkhla 90110",
        eqType: "Inverter",
        brand: "Solis",
        model: "S5-GR1P5K",
        serial: "SL-S5-GR1P-88219",
        purchaseDate: "2024-12-01",
        warrantyNum: "WRT-SLS-20241201",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2029-12-01",
        problemDesc: "Cooling fan makes a high-pitched noise and vibrates heavily under high sunlight. Defective internal bearings suspected.",
        severity: "80",
        status: "reviewing",
        createdAt: "2026-05-19T09:40:00.000Z",
        notes: "Admin team is coordinating delivery of a replacement Solis cooling fan unit to install."
    },
    {
        name: "Mr. Worawut Udomsap",
        phone: "0801234567",
        email: "worawut.u@gmail.com",
        address: "41 Ratchadamnoen Rd, Sri Phum, Mueang, Chiang Mai 50200",
        eqType: "Solar Panel",
        brand: "Solis",
        model: "Solis Panel 550W",
        serial: "SLP-550W-982103",
        purchaseDate: "2024-04-10",
        warrantyNum: "WRT-SLP-20240410",
        warrantyPeriod: "12 years",
        warrantyExpiry: "2036-04-10",
        problemDesc: "Solar panel power generation efficiency is abnormally low. Output is 40% lower compared to adjacent panels in the same string.",
        severity: "50",
        status: "approved",
        createdAt: "2026-03-12T15:30:00.000Z",
        notes: "Analyzed power generation data and measured single-panel voltage, confirming fault. Approved replacement panel."
    },
    {
        name: "Mr. Rungroj Sawangjit",
        phone: "0811122334",
        email: "rungroj.s@gmail.com",
        address: "234/11 Moo 5, Tha Sai, Mueang, Samut Sakhon 74000",
        eqType: "Battery",
        brand: "LV Topsun",
        model: "Topsun LV 48V 200Ah",
        serial: "TS-LV200-9921",
        purchaseDate: "2024-01-20",
        warrantyNum: "WRT-TS-20240120",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2029-01-20",
        problemDesc: "Battery communication with the inverter failed. Orange indicator light flashes signaling a Communication Error.",
        severity: "80",
        status: "completed",
        createdAt: "2026-02-15T08:30:00.000Z",
        notes: "Technician visited and replaced the Modbus communication cable. System is now fully functional."
    },
    {
        name: "Ms. Chonlada Sukjai",
        phone: "0822233445",
        email: "chonlada.s@hotmail.com",
        address: "68/9 Suksawat Rd, Phra Pradaeng, Samut Prakan 10130",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "JKM-440N",
        serial: "JK-440N-202408B",
        purchaseDate: "2024-09-05",
        warrantyNum: "WRT-JK-20240905",
        warrantyPeriod: "15 years",
        warrantyExpiry: "2039-09-05",
        problemDesc: "Cloudiness and white haze formed under the solar panel glass. Efficiency drops significantly in the afternoon due to high temperature.",
        severity: "10",
        status: "pending",
        createdAt: "2026-05-21T04:10:00.000Z",
        notes: "Claim request registered. Scheduling site visit to measure electrical current at the panel."
    },
    {
        name: "Mr. Thanapol Mangkang",
        phone: "0833344556",
        email: "thanapol.m@gmail.com",
        address: "123 Ramkhamhaeng Rd, Hua Mak, Bang Kapi, Bangkok 10240",
        eqType: "Inverter",
        brand: "Solis",
        model: "S6-GR1P5K",
        serial: "SL-S6-0029381",
        purchaseDate: "2025-07-12",
        warrantyNum: "WRT-SLI-20250712",
        warrantyPeriod: "5 years",
        warrantyExpiry: "2030-07-12",
        problemDesc: "Inverter halts and displays Grid Overvoltage error frequently. Fails to switch to normal power export mode.",
        severity: "100",
        status: "rejected",
        createdAt: "2026-05-17T11:00:00.000Z",
        notes: "Rejected claim: Warning is caused by external utility grid voltage limit exceed, not an inverter device fault."
    },
    {
        name: "Ms. Patcharaporn Saentawee",
        phone: "0844455667",
        email: "patchara.s@outlook.com",
        address: "47 Moo 2, Saen Suk, Mueang, Chon Buri 20130",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Dyness A48100",
        serial: "DN-A48100-2938",
        purchaseDate: "2024-11-11",
        warrantyNum: "WRT-DN-20241111",
        warrantyPeriod: "10 years",
        warrantyExpiry: "2034-11-11",
        problemDesc: "Battery shuts down temporarily and triggers a high temperature alert during nighttime discharge.",
        severity: "50",
        status: "reviewing",
        createdAt: "2026-04-05T13:40:00.000Z",
        notes: "Technical team is requesting temperature logs of the installation room to verify environment conditions."
    },
    {
        name: "Mr. Taveep Meesook",
        phone: "0855566778",
        email: "taveep.m@gmail.com",
        address: "99 Moo 1, Ban Mai, Mueang Pathum Thani, Pathum Thani 12000",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "JKM-400M",
        serial: "JK-400M-202411",
        purchaseDate: "2024-01-15",
        warrantyNum: "WRT-JK-20240115",
        warrantyPeriod: "15 years",
        warrantyExpiry: "2039-01-15",
        problemDesc: "Sparking occurred at the junction connector behind the panel, overheating and melting the terminal.",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-20T10:00:00.000Z",
        notes: "Inspected and found a loose Junction Box terminal from factory. Approved replacement with a new solar panel."
    }
];

// Helper: Sync to Excel function written inline so we don't depend on server.js imports
const statusLabelsExcel = { pending: 'Pending', reviewing: 'Reviewing', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' };
const sevLabelsExcel = { 10: '10%', 50: '50%', 80: '80%', 100: '100%' };

async function syncToExcelLocal(claims) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Solar Claim System';
    wb.created = new Date();

    const ws = wb.addWorksheet('Claims List', { properties: { tabColor: { argb: 'FFF59E0B' } }, views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
        { header: 'Claim Number', key: 'claimNumber', width: 18 }, { header: 'Customer Name', key: 'customerName', width: 22 },
        { header: 'Phone', key: 'phone', width: 16 }, { header: 'Email', key: 'email', width: 24 },
        { header: 'Address', key: 'address', width: 30 }, { header: 'Equipment Type', key: 'eqType', width: 20 },
        { header: 'Brand', key: 'brand', width: 16 }, { header: 'Model', key: 'model', width: 14 },
        { header: 'Serial Number', key: 'serial', width: 20 }, { header: 'Purchase Date', key: 'purchaseDate', width: 14 },
        { header: 'Warranty Number', key: 'warranty', width: 16 }, { header: 'Warranty Period', key: 'warPeriod', width: 14 },
        { header: 'Warranty Expiry', key: 'warExpiry', width: 14 }, { header: 'Problem Description', key: 'problem', width: 40 },
        { header: 'Severity', key: 'severity', width: 14 }, { header: 'Status', key: 'status', width: 16 },
        { header: 'Created At', key: 'createdAt', width: 20 }, { header: 'Updated At', key: 'updatedAt', width: 20 },
        { header: 'Image Count', key: 'imageCount', width: 14 },
    ];

    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } };
    });
    ws.getRow(1).height = 28;

    const statusColors = { pending: 'FFFBBF24', reviewing: 'FF3B82F6', approved: 'FF10B981', rejected: 'FFEF4444', completed: 'FF8B5CF6' };
    claims.forEach(c => {
        const row = ws.addRow({
            claimNumber: c.claim_number,
            customerName: c.customer?.name || '',
            phone: c.customer?.phone || '',
            email: c.customer?.email || '',
            address: c.customer?.address || '',
            eqType: c.equipment?.type || '',
            brand: c.equipment?.brand || '',
            model: c.equipment?.model || '',
            serial: c.equipment?.serialNumber || '',
            purchaseDate: c.equipment?.purchaseDate || '',
            warranty: c.warranty?.number || '',
            warPeriod: c.warranty?.period || '',
            warExpiry: c.warranty?.expiryDate || '',
            problem: c.problem?.description || '',
            severity: sevLabelsExcel[c.problem?.severity] || c.problem?.severity || '',
            status: statusLabelsExcel[c.status] || c.status,
            createdAt: new Date(c.created_at).toLocaleString('en-US'),
            updatedAt: new Date(c.updated_at).toLocaleString('en-US'),
            imageCount: c.problem?.images?.length || 0
        });

        const statusCell = row.getCell('status');
        const sColor = statusColors[c.status];
        if (sColor) {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sColor } };
            statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        statusCell.alignment = { horizontal: 'center' };

        const sevCell = row.getCell('severity');
        const sevColors = { 10: 'FF10B981', 50: 'FFFBBF24', 80: 'FFF97316', 100: 'FFEF4444' };
        const sc = sevColors[c.problem?.severity];
        if (sc) {
            sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } };
            sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        sevCell.alignment = { horizontal: 'center' };
        row.alignment = { vertical: 'middle', wrapText: true };
    });

    ws.autoFilter = { from: 'A1', to: `S${claims.length + 1}` };

    const ws2 = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF10B981' } } });
    ws2.columns = [{ header: 'Category', key: 'label', width: 25 }, { header: 'Count', key: 'count', width: 12 }];
    ws2.getRow(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    ws2.addRow({ label: 'Total Claims', count: claims.length });
    ws2.addRow({ label: 'Pending', count: claims.filter(c => c.status === 'pending').length });
    ws2.addRow({ label: 'Reviewing', count: claims.filter(c => c.status === 'reviewing').length });
    ws2.addRow({ label: 'Approved', count: claims.filter(c => c.status === 'approved').length });
    ws2.addRow({ label: 'Rejected', count: claims.filter(c => c.status === 'rejected').length });
    ws2.addRow({ label: 'Completed', count: claims.filter(c => c.status === 'completed').length });
    ws2.addRow({});
    ws2.addRow({ label: '--- By Equipment Type ---', count: '' });

    const eqCount = {};
    claims.forEach(c => {
        const type = c.equipment?.type || 'Other';
        eqCount[type] = (eqCount[type] || 0) + 1;
    });
    Object.entries(eqCount).forEach(([k, v]) => ws2.addRow({ label: k, count: v }));

    // Create directories if not exists
    const dir = path.dirname(EXCEL_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        await wb.xlsx.writeFile(EXCEL_FILE);
        console.log(`✅ Excel synced locally: ${EXCEL_FILE}`);
    } catch (err) {
        console.error('⚠️ Could not write Excel file:', err);
    }
}

async function insertDummyData() {
    console.log('⚡ Starting dummy data generation script (10 claims)...');

    // 1. Delete all existing claims from Supabase
    console.log('🗑️ Deleting all records from Supabase "claims" table first...');
    const { error: dbClearError } = await supabase
        .from('claims')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
    if (dbClearError) {
        console.error('❌ Supabase delete error:', dbClearError);
    } else {
        console.log('✅ Cleaned old database entries.');
    }

    // 2. Generate and insert new claims
    const claimsToInsert = [];
    let startClaimNum = 2026001;

    for (let i = 0; i < Math.min(10, dummyClaims.length); i++) {
        const c = dummyClaims[i];
        
        // Construct timeline
        const timeline = [
            { status: 'pending', date: c.createdAt, note: 'Claim submitted successfully' }
        ];

        if (c.status !== 'pending') {
            const reviewingDate = new Date(new Date(c.createdAt).getTime() + 1000 * 60 * 60 * 24).toISOString(); // +1 day
            timeline.push({ status: 'reviewing', date: reviewingDate, note: 'Technical team is conducting initial review' });

            if (c.status === 'approved' || c.status === 'rejected') {
                const finalDate = new Date(new Date(reviewingDate).getTime() + 1000 * 60 * 60 * 24 * 2).toISOString(); // +2 days
                timeline.push({
                    status: c.status,
                    date: finalDate,
                    note: c.status === 'approved' ? `Claim approved: ${c.notes}` : `Claim rejected: ${c.notes}`
                });
            } else if (c.status === 'completed') {
                const approvedDate = new Date(new Date(reviewingDate).getTime() + 1000 * 60 * 60 * 24 * 2).toISOString(); // +2 days
                timeline.push({ status: 'approved', date: approvedDate, note: 'Claim approved and replacement unit is being prepared' });

                const completedDate = new Date(new Date(approvedDate).getTime() + 1000 * 60 * 60 * 24 * 3).toISOString(); // +3 days
                timeline.push({ status: 'completed', date: completedDate, note: `Claim completed: ${c.notes}` });
            }
        }

        const noteArray = [];
        if (c.notes) {
            noteArray.push({
                id: uuidv4(),
                text: c.notes,
                author: 'System Admin',
                createdAt: c.createdAt
            });
        }

        const claimNumber = `CLM-${startClaimNum + i}`;
        claimsToInsert.push({
            id: uuidv4(),
            claim_number: claimNumber,
            customer: {
                name: c.name,
                phone: c.phone,
                email: c.email,
                address: c.address
            },
            equipment: {
                type: c.eqType,
                brand: c.brand,
                model: c.model,
                serialNumber: c.serial,
                purchaseDate: c.purchaseDate
            },
            warranty: {
                number: c.warrantyNum,
                period: c.warrantyPeriod,
                expiryDate: c.warrantyExpiry
            },
            problem: {
                description: c.problemDesc,
                severity: c.severity,
                images: []
            },
            status: c.status,
            timeline: timeline,
            notes: noteArray,
            created_at: c.createdAt,
            updated_at: c.status !== 'pending' ? timeline[timeline.length - 1].date : c.createdAt
        });
    }

    console.log(`📤 Inserting ${claimsToInsert.length} dummy claims to Supabase...`);
    const { data, error } = await supabase.from('claims').insert(claimsToInsert).select();

    if (error) {
        console.warn('⚠️ Supabase Insert failed (Supabase offline):', error.message || error);
    } else {
        console.log(`🎉 Supabase Insert Success! Successfully inserted ${data.length} records.`);
    }
        
    // 3. Sync to local Excel file
    console.log('🔄 Syncing local Excel cache claims...');
    await syncToExcelLocal(claimsToInsert);
    
    // 4. Backup to claims.json if it exists
    const DATA_FILE = path.join(__dirname, 'data', 'claims.json');
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            fileData.claims = claimsToInsert.map(c => ({
                id: c.id,
                claimNumber: c.claim_number,
                customer: c.customer,
                equipment: c.equipment,
                warranty: c.warranty,
                problem: c.problem,
                status: c.status,
                timeline: c.timeline,
                notes: c.notes,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }));
            fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2), 'utf8');
            console.log('✅ Local backup claims.json updated successfully.');
        } catch (e) {
            console.error('❌ Failed to update claims.json:', e);
        }
    }
    
    console.log('\n🌟 DUMMY DATA INITIALIZATION COMPLETE 🌟\n');
}

insertDummyData();
