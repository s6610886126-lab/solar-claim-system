require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'claims.json');
const EXCEL_FILE = path.join(__dirname, 'data', 'claims.xlsx');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === Supabase Setup ===
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE')) {
    console.warn('⚠️ Supabase credentials not found in .env. API endpoints will fail.');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// --- Helper: Upload Base64 Images to Supabase Storage ---
async function uploadImagesToSupabase(base64Images) {
    if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) return [];

    const uploadedUrls = [];
    for (const base64Str of base64Images) {
        // If it's already a URL, keep it
        if (base64Str.startsWith('http')) {
            uploadedUrls.push(base64Str);
            continue;
        }

        try {
            // Extract content type and base64 data
            const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) continue;

            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const fileExtension = contentType.split('/')[1] || 'png';
            const fileName = `${uuidv4()}.${fileExtension}`;

            const { data, error } = await supabase.storage
                .from('claim-images')
                .upload(fileName, buffer, { contentType, upsert: false });

            if (error) {
                console.error('Supabase Storage Error:', error);
                continue;
            }

            const { data: { publicUrl } } = supabase.storage.from('claim-images').getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
        } catch (err) {
            console.error('Failed to process image:', err);
        }
    }
    return uploadedUrls;
}

// --- Data Migration ---
async function migrateData() {
    if (!fs.existsSync(DATA_FILE) || !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE')) return;

    try {
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: claimCount } = await supabase.from('claims').select('*', { count: 'exact', head: true });

        if (userCount === 0 || claimCount === 0) {
            console.log('🔄 Starting data migration from JSON to Supabase...');
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

            if (data.users && data.users.length > 0) {
                const usersToInsert = data.users.map(u => ({
                    id: u.id, name: u.name, email: u.email, phone: u.phone, password: u.password, role: u.role, created_at: u.createdAt
                }));
                const { error } = await supabase.from('users').upsert(usersToInsert, { onConflict: 'email' });
                if (error) console.error('Error migrating users:', error);
                else console.log(`✅ Migrated ${data.users.length} users.`);
            }
            if (data.claims && data.claims.length > 0) {
                const claimsToInsert = data.claims.map(c => ({
                    id: c.id, claim_number: c.claimNumber, customer: c.customer, equipment: c.equipment,
                    warranty: c.warranty, problem: c.problem, status: c.status, timeline: c.timeline, notes: c.notes,
                    created_at: c.createdAt, updated_at: c.updatedAt
                }));
                // Remove duplicates in the same batch
                const uniqueClaimsToInsert = [];
                const seenClaimNumbers = new Set();
                for (const c of claimsToInsert) {
                    if (!seenClaimNumbers.has(c.claim_number)) {
                        seenClaimNumbers.add(c.claim_number);
                        uniqueClaimsToInsert.push(c);
                    }
                }

                const { error } = await supabase.from('claims').upsert(uniqueClaimsToInsert, { onConflict: 'claim_number' });
                if (error) console.error('Error migrating claims:', error);
                else console.log(`✅ Migrated ${uniqueClaimsToInsert.length} unique claims.`);
            }
            console.log('🎉 Migration complete!');
        }
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

// Run migration on startup
migrateData();

// === Helper function to convert DB object to camelCase API response ===
function formatClaim(c) {
    if (!c) return null;
    return {
        id: c.id, claimNumber: c.claim_number, customer: c.customer, equipment: c.equipment,
        warranty: c.warranty, problem: c.problem, status: c.status, timeline: c.timeline, notes: c.notes,
        createdAt: c.created_at, updatedAt: c.updated_at
    };
}

// === SYNC TO EXCEL ===
const statusLabelsExcel = { pending: 'รอดำเนินการ', reviewing: 'กำลังตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', completed: 'เสร็จสิ้น' };
const sevLabelsExcel = { 10: '10%', 50: '50%', 80: '80%', 100: '100%' };

function buildExcelWorkbook(claimsData) {
    const claims = claimsData.map(formatClaim);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Solar Claim System';
    wb.created = new Date();

    const ws = wb.addWorksheet('รายการเคลม', { properties: { tabColor: { argb: 'FFF59E0B' } }, views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
        { header: 'เลขที่เคลม', key: 'claimNumber', width: 18 }, { header: 'ชื่อลูกค้า', key: 'customerName', width: 22 },
        { header: 'เบอร์โทร', key: 'phone', width: 16 }, { header: 'อีเมล', key: 'email', width: 24 },
        { header: 'ที่อยู่', key: 'address', width: 30 }, { header: 'ประเภทอุปกรณ์', key: 'eqType', width: 20 },
        { header: 'ยี่ห้อ', key: 'brand', width: 16 }, { header: 'รุ่น', key: 'model', width: 14 },
        { header: 'Serial Number', key: 'serial', width: 20 }, { header: 'วันที่ซื้อ', key: 'purchaseDate', width: 14 },
        { header: 'เลขประกัน', key: 'warranty', width: 16 }, { header: 'ระยะประกัน', key: 'warPeriod', width: 14 },
        { header: 'หมดประกัน', key: 'warExpiry', width: 14 }, { header: 'ปัญหา', key: 'problem', width: 40 },
        { header: 'ความรุนแรง', key: 'severity', width: 14 }, { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'วันที่แจ้ง', key: 'createdAt', width: 20 }, { header: 'อัปเดตล่าสุด', key: 'updatedAt', width: 20 },
        { header: 'จำนวนรูปภาพ', key: 'imageCount', width: 14 },
    ];

    ws.getRow(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } }; });
    ws.getRow(1).height = 28;

    const statusColors = { pending: 'FFFBBF24', reviewing: 'FF3B82F6', approved: 'FF10B981', rejected: 'FFEF4444', completed: 'FF8B5CF6' };
    claims.forEach(c => {
        const row = ws.addRow({ claimNumber: c.claimNumber, customerName: c.customer?.name || '', phone: c.customer?.phone || '', email: c.customer?.email || '', address: c.customer?.address || '', eqType: c.equipment?.type || '', brand: c.equipment?.brand || '', model: c.equipment?.model || '', serial: c.equipment?.serialNumber || '', purchaseDate: c.equipment?.purchaseDate || '', warranty: c.warranty?.number || '', warPeriod: c.warranty?.period || '', warExpiry: c.warranty?.expiryDate || '', problem: c.problem?.description || '', severity: sevLabelsExcel[c.problem?.severity] || c.problem?.severity || '', status: statusLabelsExcel[c.status] || c.status, createdAt: new Date(c.createdAt).toLocaleString('th-TH'), updatedAt: new Date(c.updatedAt).toLocaleString('th-TH'), imageCount: c.problem?.images?.length || 0 });
        const statusCell = row.getCell('status'); const sColor = statusColors[c.status]; if (sColor) { statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sColor } }; statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; } statusCell.alignment = { horizontal: 'center' };
        const sevCell = row.getCell('severity'); const sevColors = { 10: 'FF10B981', 50: 'FFFBBF24', 80: 'FFF97316', 100: 'FFEF4444' }; const sc = sevColors[c.problem?.severity]; if (sc) { sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } }; sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; } sevCell.alignment = { horizontal: 'center' };
        row.alignment = { vertical: 'middle', wrapText: true };
    });
    ws.autoFilter = { from: 'A1', to: `S${claims.length + 1}` };

    const ws2 = wb.addWorksheet('สรุป', { properties: { tabColor: { argb: 'FF10B981' } } });
    ws2.columns = [{ header: 'รายการ', key: 'label', width: 25 }, { header: 'จำนวน', key: 'count', width: 12 }];
    ws2.getRow(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    ws2.addRow({ label: 'เคลมทั้งหมด', count: claims.length });
    ws2.addRow({ label: 'รอดำเนินการ', count: claims.filter(c => c.status === 'pending').length });
    ws2.addRow({ label: 'กำลังตรวจสอบ', count: claims.filter(c => c.status === 'reviewing').length });
    ws2.addRow({ label: 'อนุมัติแล้ว', count: claims.filter(c => c.status === 'approved').length });
    ws2.addRow({ label: 'ไม่อนุมัติ', count: claims.filter(c => c.status === 'rejected').length });
    ws2.addRow({ label: 'เสร็จสิ้น', count: claims.filter(c => c.status === 'completed').length });
    ws2.addRow({});
    ws2.addRow({ label: '--- ตามประเภทอุปกรณ์ ---', count: '' });
    const eqCount = {}; claims.forEach(c => { eqCount[c.equipment?.type || 'อื่นๆ'] = (eqCount[c.equipment?.type || 'อื่นๆ'] || 0) + 1; });
    Object.entries(eqCount).forEach(([k, v]) => ws2.addRow({ label: k, count: v }));

    return wb;
}

async function syncToExcel(claimsData) {
    const wb = buildExcelWorkbook(claimsData);
    try { await wb.xlsx.writeFile(EXCEL_FILE); console.log(`📊 Excel synced: ${EXCEL_FILE}`); }
    catch (err) { if (err.code === 'EBUSY') console.log('⚠️ Excel file is open — will sync next time'); else throw err; }
}

// === API ===
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password } = req.body;

    // Using simple ILIKE for case-insensitive email check
    const { data: existingUser } = await supabase.from('users').select('*').ilike('email', email).single();
    if (existingUser) return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });

    const { error } = await supabase.from('users').insert([{ id: uuidv4(), name, email, phone, password, role: 'customer' }]);
    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });

    res.status(201).json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
});

app.post('/api/login', async (req, res) => {
    let { username, password } = req.body;
    
    // Trim whitespace to prevent login issues
    if (username) username = username.trim();
    if (password) password = password.trim();

    const { data: user } = await supabase.from('users')
        .select('*')
        .or(`email.ilike.${username},name.eq.${username}`)
        .eq('password', password)
        .single();

    if (user) {
        return res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone, role: user.role } });
    }

    if (username.includes('@')) {
        const { data: isRegistered } = await supabase.from('users').select('*').ilike('email', username).single();
        if (isRegistered) return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้องสำหรับบัญชีนี้' });

        // Filter JSON column logic in Supabase using ->>
        const { data: customerClaims } = await supabase.from('claims')
            .select('customer')
            .filter('customer->>email', 'ilike', username)
            .limit(1);

        if (customerClaims && customerClaims.length > 0) {
            const cust = customerClaims[0].customer;
            return res.json({ success: true, user: { name: cust.name, email: username, phone: cust.phone, role: 'customer' } });
        }
    }
    res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/claims', async (req, res) => {
    const { status, equipment, severity, search, userRole, userEmail } = req.query;
    let query = supabase.from('claims').select('*').order('created_at', { ascending: false });

    if (userRole === 'customer' && userEmail) query = query.filter('customer->>email', 'ilike', userEmail);
    if (status && status !== 'all') query = query.eq('status', status);
    if (equipment && equipment !== 'all') query = query.filter('equipment->>type', 'eq', equipment);
    if (severity && severity !== 'all') query = query.filter('problem->>severity', 'eq', severity);
    if (search) {
        query = query.or(`claim_number.ilike.%${search}%,customer->>name.ilike.%${search}%,equipment->>brand.ilike.%${search}%,equipment->>serialNumber.ilike.%${search}%`);
    }

    const { data: claims, error } = await query;
    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล', error });

    const formattedData = claims.map(formatClaim);
    res.json({ success: true, data: formattedData, total: formattedData.length });
});

app.get('/api/claims/:id', async (req, res) => {
    const { data: claim, error } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (error || !claim) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเคลม' });
    res.json({ success: true, data: formatClaim(claim) });
});

app.get('/api/claims/:id/pdf', async (req, res) => {
    const { id } = req.params;
    let browser;
    try {
        const { data: claim, error } = await supabase.from('claims').select('claim_number').eq('id', id).single();
        if (error || !claim) {
            return res.status(404).send('ไม่พบข้อมูลเคลม / Claim not found');
        }
        const claimNumber = claim.claim_number || 'UNKNOWN';

        const puppeteer = require('puppeteer');
        
        browser = await puppeteer.launch({
            headless: true,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });
        
        const host = req.headers.host || `localhost:${PORT}`;
        const baseUrl = `http://${host}`;
        
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        
        await page.evaluate(() => {
            localStorage.setItem('solar_user', JSON.stringify({
                email: 'admin@solar.com',
                name: 'System Admin',
                role: 'admin'
            }));
        });
        
        const claimDetailUrl = `${baseUrl}/claim-detail.html?id=${id}`;
        await page.goto(claimDetailUrl, { waitUntil: 'domcontentloaded' });
        await page.emulateMediaType('print');
        
        // Wait for dynamic data to load from API
        await page.waitForFunction(() => {
            const el = document.getElementById('customerInfo');
            return el && el.innerText.trim().length > 0;
        }, { timeout: 10000 });
        
        // Short settle timeout for styles/images
        await new Promise(r => setTimeout(r, 1000));
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '12mm',
                bottom: '12mm',
                left: '12mm',
                right: '12mm'
            }
        });
        
        await browser.close();
        browser = null;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Claim-Request-${claimNumber}.pdf`);
        res.send(Buffer.from(pdfBuffer));
        
    } catch (err) {
        console.error('PDF Generation Error:', err);
        if (browser) {
            try { await browser.close(); } catch(e) {}
        }
        res.status(500).send('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF / Failed to generate PDF');
    }
});

app.post('/api/claims', async (req, res) => {
    // Get max claim number to generate the next one
    const { data: allClaims } = await supabase.from('claims').select('claim_number');
    let maxNum = 2024000;
    if (allClaims && allClaims.length > 0) {
        for (const c of allClaims) {
            const match = c.claim_number.match(/^CLM-(\d+)$/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        }
    }

    // Upload images to Supabase Storage if present
    if (req.body.problem && req.body.problem.images) {
        req.body.problem.images = await uploadImagesToSupabase(req.body.problem.images);
    }

    const newClaim = {
        id: uuidv4(),
        claim_number: `CLM-${String(maxNum + 1).padStart(7, '0')}`,
        customer: req.body.customer,
        equipment: req.body.equipment,
        warranty: req.body.warranty,
        problem: req.body.problem,
        status: 'pending',
        timeline: [{ status: 'pending', date: new Date().toISOString(), note: 'รับเรื่องเคลมเข้าระบบ' }],
        notes: []
    };

    const { data, error } = await supabase.from('claims').insert([newClaim]).select().single();
    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error });
    res.status(201).json({ success: true, data: formatClaim(data) });
});

app.put('/api/claims/:id', async (req, res) => {
    const { data: currentClaim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!currentClaim) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเคลม' });

    // Upload any new base64 images if problem is updated
    let problemUpdates = req.body.problem || currentClaim.problem;
    if (req.body.problem && req.body.problem.images) {
        problemUpdates.images = await uploadImagesToSupabase(req.body.problem.images);
    }

    const updates = {
        customer: req.body.customer || currentClaim.customer,
        equipment: req.body.equipment || currentClaim.equipment,
        warranty: req.body.warranty || currentClaim.warranty,
        problem: problemUpdates,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('claims').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    res.json({ success: true, data: formatClaim(data) });
});

app.patch('/api/claims/:id/status', async (req, res) => {
    const labels = { pending: 'รอดำเนินการ', reviewing: 'กำลังตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', completed: 'เสร็จสิ้น' };
    const { data: claim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเคลม' });

    const newTimeline = [...(claim.timeline || []), {
        status: req.body.status,
        date: new Date().toISOString(),
        note: req.body.note || `เปลี่ยนสถานะเป็น: ${labels[req.body.status] || req.body.status}`
    }];

    const { data, error } = await supabase.from('claims').update({
        status: req.body.status,
        timeline: newTimeline,
        updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();

    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    res.json({ success: true, data: formatClaim(data) });
});

app.post('/api/claims/:id/notes', async (req, res) => {
    const { data: claim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเคลม' });

    const note = { id: uuidv4(), text: req.body.text, author: req.body.author || 'Admin', createdAt: new Date().toISOString() };
    const newNotes = [...(claim.notes || []), note];

    const { data, error } = await supabase.from('claims').update({
        notes: newNotes,
        updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();

    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    res.json({ success: true, data: note });
});

app.delete('/api/claims/:id', async (req, res) => {
    const { error } = await supabase.from('claims').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    res.json({ success: true, message: 'ลบเคลมเรียบร้อย' });
});

app.get('/api/stats', async (req, res) => {
    try {
        const { userRole, userEmail } = req.query;
        let query = supabase.from('claims').select('*');
        if (userRole === 'customer' && userEmail) query = query.filter('customer->>email', 'ilike', userEmail);

        const { data: rawClaims, error } = await query;
        if (error) throw error;

        const claims = rawClaims.map(formatClaim);

        const s = {
            total: claims.length,
            pending: claims.filter(c => c.status === 'pending').length,
            reviewing: claims.filter(c => c.status === 'reviewing').length,
            approved: claims.filter(c => c.status === 'approved').length,
            rejected: claims.filter(c => c.status === 'rejected').length,
            completed: claims.filter(c => c.status === 'completed').length
        };
        const eqStats = {}; claims.forEach(c => { eqStats[c.equipment.type] = (eqStats[c.equipment.type] || 0) + 1; });
        const mNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const monthly = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i); const m = d.getMonth(), y = d.getFullYear();
            monthly.push({ month: mNames[m], year: y, count: claims.filter(c => { const cd = new Date(c.createdAt); return cd.getMonth() === m && cd.getFullYear() === y; }).length });
        }
        
        // Correct severity mappings (which are numeric strings "10", "50", "80", "100" in DB)
        const sevStats = {
            low: claims.filter(c => c.problem?.severity === '10' || c.problem?.severity === 10 || c.problem?.severity === 'low').length,
            medium: claims.filter(c => c.problem?.severity === '50' || c.problem?.severity === 50 || c.problem?.severity === 'medium').length,
            high: claims.filter(c => c.problem?.severity === '80' || c.problem?.severity === 80 || c.problem?.severity === 'high').length,
            critical: claims.filter(c => c.problem?.severity === '100' || c.problem?.severity === 100 || c.problem?.severity === 'critical').length
        };

        // Compute dynamic average resolution time (in days) from timeline data
        let resolvedCount = 0;
        let totalDurationMs = 0;
        claims.forEach(c => {
            if ((c.status === 'completed' || c.status === 'approved' || c.status === 'rejected') && c.timeline && c.timeline.length > 0) {
                const pendingEvent = c.timeline.find(t => t.status === 'pending');
                const endEvent = c.timeline.find(t => t.status === 'completed' || t.status === 'approved' || t.status === 'rejected');
                if (pendingEvent && endEvent) {
                    const start = new Date(pendingEvent.date);
                    const end = new Date(endEvent.date);
                    if (!isNaN(start) && !isNaN(end) && end >= start) {
                        totalDurationMs += (end - start);
                        resolvedCount++;
                    }
                }
            }
        });
        const avgResolutionDays = resolvedCount > 0 ? (totalDurationMs / (1000 * 60 * 60 * 24) / resolvedCount).toFixed(1) : '3.2';

        res.json({ success: true, data: { stats: s, equipmentStats: eqStats, monthlyStats: monthly, severityStats: sevStats, avgResolutionDays } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/claim-form', (req, res) => res.sendFile(path.join(__dirname, 'public', 'claim-form.html')));
app.get('/claim-detail', (req, res) => res.sendFile(path.join(__dirname, 'public', 'claim-detail.html')));
app.get('/track-claim', (req, res) => res.sendFile(path.join(__dirname, 'public', 'track-claim.html')));
app.get('/overview', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overview.html')));
app.get('/import-export', (req, res) => res.sendFile(path.join(__dirname, 'public', 'import-export.html')));

app.get('/api/export/excel', async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('claims').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        const { data: rawClaims, error } = await query;
        if (error) throw error;

        const wb = buildExcelWorkbook(rawClaims);
        const buffer = await wb.xlsx.writeBuffer();

        const filename = status && status !== 'all' ? `solar-claims-${status}.xlsx` : 'solar-claims.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(buffer);
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ success: false, message: 'ไม่สามารถสร้างไฟล์ Excel ได้' });
    }
});

app.post('/api/import/excel', async (req, res) => {
    const { fileData, fileName } = req.body;
    if (!fileData) {
        return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลไฟล์ที่อัปโหลด' });
    }

    try {
        const buffer = Buffer.from(fileData, 'base64');
        const workbook = new ExcelJS.Workbook();
        
        let ws;
        const isCsv = fileName && fileName.toLowerCase().endsWith('.csv');
        
        if (isCsv) {
            const { Readable } = require('stream');
            const stream = Readable.from(buffer);
            await workbook.csv.read(stream);
            ws = workbook.getWorksheet(1) || workbook.worksheets[0];
        } else {
            await workbook.xlsx.load(buffer);
            ws = workbook.getWorksheet('รายการเคลม') || workbook.getWorksheet(1);
        }

        if (!ws) {
            return res.status(400).json({ success: false, message: isCsv ? 'ไม่สามารถอ่านไฟล์ CSV ได้' : 'ไม่พบตาราง "รายการเคลม" ในไฟล์ Excel' });
        }

        const claimsToInsert = [];
        const seenClaimNumbers = new Set();
        
        // Find existing max claim number
        const { data: dbClaims } = await supabase.from('claims').select('claim_number');
        let maxNum = 2024000;
        if (dbClaims && dbClaims.length > 0) {
            for (const c of dbClaims) {
                const match = c.claim_number.match(/^CLM-(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNum) maxNum = num;
                }
            }
        }

        // Iterate through rows (start at row 2 to skip headers)
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            // Extract values safely
            const getVal = (col) => {
                const cell = row.getCell(col);
                if (cell && cell.value !== null && cell.value !== undefined) {
                    if (typeof cell.value === 'object' && cell.value.text) return String(cell.value.text).trim();
                    if (typeof cell.value === 'object' && cell.value.result !== undefined) return String(cell.value.result).trim();
                    return String(cell.value).trim();
                }
                return '';
            };

            const claimNumRaw = getVal(1);
            const customerName = getVal(2);
            const phone = getVal(3);
            const email = getVal(4);
            const address = getVal(5);
            const eqType = getVal(6);
            const brand = getVal(7);
            const model = getVal(8);
            const serial = getVal(9);
            const purchaseDate = getVal(10);
            const warNumber = getVal(11);
            const warPeriod = getVal(12);
            const warExpiry = getVal(13);
            const problemDesc = getVal(14);
            const severityRaw = getVal(15);
            const statusRaw = getVal(16);
            const createdAtRaw = getVal(17);

            // Validation: Skip rows with missing critical fields
            if (!customerName || !phone || !address || !eqType || !brand || !serial || !problemDesc) {
                console.log(`Skipping row ${rowNumber} due to missing required fields.`);
                return;
            }

            // Map Severity (e.g. "80%" -> "80")
            let severity = '10';
            if (severityRaw) {
                const cleanSev = severityRaw.replace('%', '').trim();
                if (['10', '50', '80', '100'].includes(cleanSev)) {
                    severity = cleanSev;
                } else if (severityRaw.includes('ต่ำ') || severityRaw.includes('ปกติ')) {
                    severity = '10';
                } else if (severityRaw.includes('ปานกลาง') || severityRaw.includes('บางส่วน')) {
                    severity = '50';
                } else if (severityRaw.includes('สูง') || severityRaw.includes('ส่วนใหญ่')) {
                    severity = '80';
                } else if (severityRaw.includes('วิกฤต') || severityRaw.includes('อันตราย')) {
                    severity = '100';
                }
            }

            // Map Status
            let status = 'pending';
            const statusMap = {
                'รอดำเนินการ': 'pending', 'pending': 'pending',
                'กำลังตรวจสอบ': 'reviewing', 'reviewing': 'reviewing',
                'อนุมัติแล้ว': 'approved', 'อนุมัติ': 'approved', 'approved': 'approved',
                'ไม่อนุมัติ': 'rejected', 'rejected': 'rejected',
                'เสร็จสิ้น': 'completed', 'completed': 'completed'
            };
            if (statusRaw && statusMap[statusRaw.toLowerCase()]) {
                status = statusMap[statusRaw.toLowerCase()];
            }

            // Generate claim number if missing or duplicate
            let claimNumber = claimNumRaw;
            if (!claimNumber || !claimNumber.startsWith('CLM-') || seenClaimNumbers.has(claimNumber)) {
                maxNum += 1;
                claimNumber = `CLM-${String(maxNum).padStart(7, '0')}`;
            }
            seenClaimNumbers.add(claimNumber);

            // Date processing
            let createdAt = new Date().toISOString();
            if (createdAtRaw) {
                let parsedDate = Date.parse(createdAtRaw);
                if (isNaN(parsedDate)) {
                    const parts = createdAtRaw.split(/[\/\s:]/);
                    if (parts.length >= 3) {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1;
                        let year = parseInt(parts[2]);
                        if (year > 2400) year -= 543; // BE to CE conversion
                        const hour = parseInt(parts[3]) || 0;
                        const minute = parseInt(parts[4]) || 0;
                        const second = parseInt(parts[5]) || 0;
                        const d = new Date(year, month, day, hour, minute, second);
                        if (!isNaN(d.getTime())) createdAt = d.toISOString();
                    }
                } else {
                    createdAt = new Date(parsedDate).toISOString();
                }
            }

            claimsToInsert.push({
                id: uuidv4(),
                claim_number: claimNumber,
                customer: { name: customerName, phone, email, address },
                equipment: { type: eqType, brand, model, serialNumber: serial, purchaseDate },
                warranty: { number: warNumber, period: warPeriod, expiryDate: warExpiry },
                problem: { description: problemDesc, severity, images: [] },
                status: status,
                timeline: [{ status: status, date: createdAt, note: 'นำเข้าข้อมูลเคลมจากไฟล์ Excel' }],
                notes: [],
                created_at: createdAt,
                updated_at: createdAt
            });
        });

        if (claimsToInsert.length === 0) {
            return res.status(400).json({ success: false, message: 'ไม่พบรายการเคลมที่ถูกต้องในไฟล์ Excel' });
        }

        // Upsert into Supabase on claim_number conflict
        const { error } = await supabase.from('claims').upsert(claimsToInsert, { onConflict: 'claim_number' });
        if (error) {
            console.error('Supabase Import Upsert Error:', error);
            return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล' });
        }

        // Fetch all claims to sync to Excel cache
        const { data: allClaims, error: fetchErr } = await supabase.from('claims').select('*').order('created_at', { ascending: false });
        if (!fetchErr && allClaims) {
            await syncToExcel(allClaims);
        }

        res.json({ success: true, message: 'นำเข้าข้อมูลสำเร็จ', count: claimsToInsert.length });
    } catch (err) {
        console.error('Import excel API error:', err);
        res.status(500).json({ success: false, message: 'ไม่สามารถประมวลผลไฟล์ Excel ได้' });
    }
});

app.listen(PORT, () => {
    console.log(`🌞 Solar Claim System running at http://localhost:${PORT}`);
});
