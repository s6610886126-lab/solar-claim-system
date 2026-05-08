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
const sevLabelsExcel = { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', critical: 'วิกฤต' };

async function syncToExcel(claimsData) {
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
        const sevCell = row.getCell('severity'); const sevColors = { low: 'FF10B981', medium: 'FFFBBF24', high: 'FFF97316', critical: 'FFEF4444' }; const sc = sevColors[c.problem?.severity]; if (sc) { sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } }; sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; } sevCell.alignment = { horizontal: 'center' };
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

app.post('/api/claims', async (req, res) => {
    // Get max claim number to generate the next one
    const { data: lastClaim } = await supabase.from('claims').select('claim_number').order('claim_number', { ascending: false }).limit(1);
    let maxNum = 2024000;
    if (lastClaim && lastClaim.length > 0) {
        const num = parseInt(lastClaim[0].claim_number.split('-')[1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
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
        const sevStats = {
            low: claims.filter(c => c.problem.severity === 'low').length,
            medium: claims.filter(c => c.problem.severity === 'medium').length,
            high: claims.filter(c => c.problem.severity === 'high').length,
            critical: claims.filter(c => c.problem.severity === 'critical').length
        };
        res.json({ success: true, data: { stats: s, equipmentStats: eqStats, monthlyStats: monthly, severityStats: sevStats } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/claim-form', (req, res) => res.sendFile(path.join(__dirname, 'public', 'claim-form.html')));
app.get('/claim-detail', (req, res) => res.sendFile(path.join(__dirname, 'public', 'claim-detail.html')));

app.get('/api/export/excel', async (req, res) => {
    try {
        const { data: rawClaims, error } = await supabase.from('claims').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        await syncToExcel(rawClaims);

        const filename = 'solar-claims.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Cache-Control', 'no-cache');

        const fileBuffer = fs.readFileSync(EXCEL_FILE);
        res.send(fileBuffer);
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ success: false, message: 'ไม่สามารถสร้างไฟล์ Excel ได้' });
    }
});

app.listen(PORT, () => {
    console.log(`🌞 Solar Claim System running at http://localhost:${PORT}`);
});
