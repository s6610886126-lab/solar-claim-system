const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'claims.json');
const EXCEL_FILE = path.join(__dirname, 'data', 'claims.xlsx');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

function readClaims() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initial = { claims: generateMockData(), users: [] };
            fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!data.users) data.users = [];
        if (!data.claims) data.claims = [];
        return data;
    } catch (err) { return { claims: [], users: [] }; }
}

function writeClaims(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    syncToExcel(data.claims).catch(err => console.error('Excel sync error:', err));
}

// === SYNC TO EXCEL ===
const statusLabelsExcel = { pending:'รอดำเนินการ', reviewing:'กำลังตรวจสอบ', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ', completed:'เสร็จสิ้น' };
const sevLabelsExcel = { low:'ต่ำ', medium:'ปานกลาง', high:'สูง', critical:'วิกฤต' };

async function syncToExcel(claims) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Solar Claim System';
    wb.created = new Date();

    // --- Sheet 1: Claims ---
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
        { header: 'วันที่ซื้อ', key: 'purchaseDate', width: 14 },
        { header: 'เลขประกัน', key: 'warranty', width: 16 },
        { header: 'ระยะประกัน', key: 'warPeriod', width: 14 },
        { header: 'หมดประกัน', key: 'warExpiry', width: 14 },
        { header: 'ปัญหา', key: 'problem', width: 40 },
        { header: 'ความรุนแรง', key: 'severity', width: 14 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'วันที่แจ้ง', key: 'createdAt', width: 20 },
        { header: 'อัปเดตล่าสุด', key: 'updatedAt', width: 20 },
        { header: 'จำนวนรูปภาพ', key: 'imageCount', width: 14 },
    ];

    // Header style
    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } };
    });
    ws.getRow(1).height = 28;

    // Data rows
    const statusColors = { pending:'FFFBBF24', reviewing:'FF3B82F6', approved:'FF10B981', rejected:'FFEF4444', completed:'FF8B5CF6' };

    claims.forEach(c => {
        const row = ws.addRow({
            claimNumber: c.claimNumber,
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
            createdAt: new Date(c.createdAt).toLocaleString('th-TH'),
            updatedAt: new Date(c.updatedAt).toLocaleString('th-TH'),
            imageCount: c.problem?.images?.length || 0,
        });

        // Status cell color
        const statusCell = row.getCell('status');
        const sColor = statusColors[c.status];
        if (sColor) {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sColor } };
            statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        statusCell.alignment = { horizontal: 'center' };

        // Severity cell color
        const sevCell = row.getCell('severity');
        const sevColors = { low:'FF10B981', medium:'FFFBBF24', high:'FFF97316', critical:'FFEF4444' };
        const sc = sevColors[c.problem?.severity];
        if (sc) {
            sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } };
            sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        sevCell.alignment = { horizontal: 'center' };

        row.alignment = { vertical: 'middle', wrapText: true };
    });

    // Auto-filter
    ws.autoFilter = { from: 'A1', to: `S${claims.length + 1}` };

    // --- Sheet 2: Summary ---
    const ws2 = wb.addWorksheet('สรุป', {
        properties: { tabColor: { argb: 'FF10B981' } }
    });

    ws2.columns = [
        { header: 'รายการ', key: 'label', width: 25 },
        { header: 'จำนวน', key: 'count', width: 12 },
    ];
    ws2.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    ws2.addRow({ label: 'เคลมทั้งหมด', count: claims.length });
    ws2.addRow({ label: 'รอดำเนินการ', count: claims.filter(c=>c.status==='pending').length });
    ws2.addRow({ label: 'กำลังตรวจสอบ', count: claims.filter(c=>c.status==='reviewing').length });
    ws2.addRow({ label: 'อนุมัติแล้ว', count: claims.filter(c=>c.status==='approved').length });
    ws2.addRow({ label: 'ไม่อนุมัติ', count: claims.filter(c=>c.status==='rejected').length });
    ws2.addRow({ label: 'เสร็จสิ้น', count: claims.filter(c=>c.status==='completed').length });
    ws2.addRow({});
    ws2.addRow({ label: '--- ตามประเภทอุปกรณ์ ---', count: '' });
    const eqCount = {};
    claims.forEach(c => { eqCount[c.equipment?.type||'อื่นๆ'] = (eqCount[c.equipment?.type||'อื่นๆ']||0)+1; });
    Object.entries(eqCount).forEach(([k,v]) => ws2.addRow({ label: k, count: v }));

    try {
        await wb.xlsx.writeFile(EXCEL_FILE);
        console.log(`📊 Excel synced: ${EXCEL_FILE}`);
    } catch (err) {
        if (err.code === 'EBUSY') {
            console.log('⚠️ Excel file is open — will sync next time');
        } else {
            throw err;
        }
    }
}

function generateMockData() {
    const types = ['Solar Panel','Inverter','Battery','Charge Controller','Mounting Structure','Cable & Connector'];
    const brands = ['SunPower','LG Solar','JinkoSolar','Trina Solar','Canadian Solar','Huawei','SMA','Enphase','BYD','Tesla'];
    const sevs = ['low','medium','high','critical'];
    const stats = ['pending','reviewing','approved','rejected','completed'];
    const probs = [
        'แผงโซลาร์มีรอยร้าว ประสิทธิภาพลดลง','Inverter แสดง Error Code หยุดทำงาน',
        'แบตเตอรี่ชาร์จไม่เต็ม ความจุลดลง','Charge Controller ไม่ตรวจจับแผง',
        'โครงสร้างรับแผงมีสนิม','สายเคเบิลไหม้ จุดเชื่อมต่อหลวม',
        'แผงโซลาร์ไม่ผลิตกระแสไฟ','Inverter มีเสียงดังร้อนผิดปกติ',
        'แบตเตอรี่บวม มีกลิ่น','ตัวควบคุมแสดงค่าผิดพลาด',
        'Hot spot บนแผงโซลาร์','Micro-inverter ไม่ส่งข้อมูล'
    ];
    const names = ['สมชาย วงศ์วิทยา','สุดา แสงทอง','ประเสริฐ มั่นคง','วิภา ศรีสุข',
        'ธนากร เจริญดี','พิมพ์ใจ รักดี','อำนาจ สุขสันต์','นารี ดวงดาว',
        'กิตติ พงษ์ศักดิ์','อรุณ แก้วมณี','ชนิดา ภูมิพัฒน์','วีระ สมบูรณ์'];
    const provs = ['กรุงเทพฯ','นนทบุรี','ปทุมธานี','เชียงใหม่','ขอนแก่น','ชลบุรี','สงขลา','ภูเก็ต'];

    const claims = [];
    for (let i = 0; i < 25; i++) {
        const cd = new Date(); cd.setDate(cd.getDate() - Math.floor(Math.random()*90));
        const st = stats[Math.floor(Math.random()*stats.length)];
        const eq = types[Math.floor(Math.random()*types.length)];
        const tl = [{ status:'pending', date:cd.toISOString(), note:'รับเรื่องเคลมเข้าระบบ' }];
        if(['reviewing','approved','rejected','completed'].includes(st)){
            const d=new Date(cd); d.setDate(d.getDate()+Math.floor(Math.random()*5)+1);
            tl.push({status:'reviewing',date:d.toISOString(),note:'กำลังตรวจสอบอุปกรณ์'});
        }
        if(['approved','completed'].includes(st)){
            const d=new Date(cd); d.setDate(d.getDate()+Math.floor(Math.random()*7)+5);
            tl.push({status:'approved',date:d.toISOString(),note:'อนุมัติการเคลม'});
        }
        if(st==='rejected'){
            const d=new Date(cd); d.setDate(d.getDate()+Math.floor(Math.random()*7)+3);
            tl.push({status:'rejected',date:d.toISOString(),note:'ไม่อนุมัติ - หมดประกัน'});
        }
        if(st==='completed'){
            const d=new Date(cd); d.setDate(d.getDate()+Math.floor(Math.random()*14)+10);
            tl.push({status:'completed',date:d.toISOString(),note:'ส่งมอบอุปกรณ์ใหม่เรียบร้อย'});
        }
        const pd = new Date(); pd.setFullYear(pd.getFullYear()-Math.floor(Math.random()*3)-1);
        claims.push({
            id: uuidv4(), claimNumber: `CLM-${String(2024001+i).padStart(7,'0')}`,
            customer: { name:names[i%names.length], phone:`08${Math.floor(Math.random()*10)}${String(Math.floor(Math.random()*10000000)).padStart(7,'0')}`,
                email:`customer${i+1}@email.com`, address:`${Math.floor(Math.random()*999)+1} ${provs[i%provs.length]}` },
            equipment: { type:eq, brand:brands[Math.floor(Math.random()*brands.length)],
                model:`${eq.substring(0,3).toUpperCase()}-${Math.floor(Math.random()*9000)+1000}`,
                serialNumber:`SN${Math.floor(Math.random()*900000000)+100000000}`, purchaseDate:pd.toISOString().split('T')[0] },
            warranty: { number:`WRT-${Math.floor(Math.random()*90000)+10000}`,
                period:`${Math.floor(Math.random()*10)+5} ปี`,
                expiryDate: new Date(pd.getTime()+(Math.floor(Math.random()*10)+5)*365*86400000).toISOString().split('T')[0] },
            problem: { description:probs[i%probs.length], severity:sevs[Math.floor(Math.random()*sevs.length)], images:[] },
            status:st, timeline:tl, notes:[], createdAt:cd.toISOString(), updatedAt:new Date().toISOString()
        });
    }
    return claims;
}

// === API ===
app.post('/api/register', (req, res) => {
    const { name, email, phone, password } = req.body;
    const data = readClaims();
    
    if (data.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }

    const newUser = { id: uuidv4(), name, email, phone, password, role: 'customer', createdAt: new Date().toISOString() };
    data.users.push(newUser);
    writeClaims(data);
    
    res.status(201).json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const data = readClaims();

    // Check registered users first
    const user = data.users.find(u => (u.email.toLowerCase() === username.toLowerCase() || u.name === username) && u.password === password);
    if (user) {
        return res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
    }

    // Simple demo logic fallback
    if (username === 'admin' && password === 'admin') {
        return res.json({ success: true, user: { name: 'System Admin', email: 'admin@solar.com', role: 'admin' } });
    }
    // If it looks like an email, treat as customer (demo mode fallback)
    if (username.includes('@')) {
        // If this email is already registered, they MUST use the correct password above
        const isRegistered = data.users.some(u => u.email.toLowerCase() === username.toLowerCase());
        if (isRegistered) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้องสำหรับบัญชีนี้' });
        }

        const customerClaim = data.claims.find(c => c.customer.email.toLowerCase() === username.toLowerCase());
        const customerName = customerClaim ? customerClaim.customer.name : 'Customer';
        return res.json({ success: true, user: { name: customerName, email: username, role: 'customer' } });
    }
    res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/claims', (req, res) => {
    const data = readClaims(); let claims = data.claims;
    const { status, equipment, severity, search, userRole, userEmail } = req.query;

    // Role-based filtering
    if (userRole === 'customer' && userEmail) {
        claims = claims.filter(c => c.customer.email.toLowerCase() === userEmail.toLowerCase());
    }

    if(status&&status!=='all') claims=claims.filter(c=>c.status===status);
    if(equipment&&equipment!=='all') claims=claims.filter(c=>c.equipment.type===equipment);
    if(severity&&severity!=='all') claims=claims.filter(c=>c.problem.severity===severity);
    if(search){ const s=search.toLowerCase(); claims=claims.filter(c=>c.claimNumber.toLowerCase().includes(s)||c.customer.name.toLowerCase().includes(s)||c.equipment.brand.toLowerCase().includes(s)||c.equipment.serialNumber.toLowerCase().includes(s)); }
    claims.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    res.json({ success:true, data:claims, total:claims.length });
});

app.get('/api/claims/:id', (req, res) => {
    const data=readClaims(); const claim=data.claims.find(c=>c.id===req.params.id);
    if(!claim) return res.status(404).json({success:false,message:'ไม่พบข้อมูลเคลม'});
    res.json({success:true,data:claim});
});

app.post('/api/claims', (req, res) => {
    const data=readClaims();
    
    // Find max claim number to avoid duplicates
    let maxNum = 2024000;
    data.claims.forEach(c => {
        const num = parseInt(c.claimNumber.split('-')[1]);
        if (num > maxNum) maxNum = num;
    });
    
    const newClaim = { id:uuidv4(), claimNumber:`CLM-${String(maxNum + 1).padStart(7,'0')}`,
        customer:req.body.customer, equipment:req.body.equipment, warranty:req.body.warranty, problem:req.body.problem,
        status:'pending', timeline:[{status:'pending',date:new Date().toISOString(),note:'รับเรื่องเคลมเข้าระบบ'}],
        notes:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    data.claims.push(newClaim); writeClaims(data);
    res.status(201).json({success:true,data:newClaim});
});

app.put('/api/claims/:id', (req, res) => {
    const data=readClaims(); const idx=data.claims.findIndex(c=>c.id===req.params.id);
    if(idx===-1) return res.status(404).json({success:false,message:'ไม่พบข้อมูลเคลม'});
    data.claims[idx]={...data.claims[idx],...req.body,updatedAt:new Date().toISOString()};
    writeClaims(data); res.json({success:true,data:data.claims[idx]});
});

app.patch('/api/claims/:id/status', (req, res) => {
    const data=readClaims(); const claim=data.claims.find(c=>c.id===req.params.id);
    if(!claim) return res.status(404).json({success:false,message:'ไม่พบข้อมูลเคลม'});
    const labels={pending:'รอดำเนินการ',reviewing:'กำลังตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ',completed:'เสร็จสิ้น'};
    claim.status=req.body.status; claim.updatedAt=new Date().toISOString();
    claim.timeline.push({status:req.body.status,date:new Date().toISOString(),note:req.body.note||`เปลี่ยนสถานะเป็น: ${labels[req.body.status]||req.body.status}`});
    writeClaims(data); res.json({success:true,data:claim});
});

app.post('/api/claims/:id/notes', (req, res) => {
    const data=readClaims(); const claim=data.claims.find(c=>c.id===req.params.id);
    if(!claim) return res.status(404).json({success:false,message:'ไม่พบข้อมูลเคลม'});
    const note={id:uuidv4(),text:req.body.text,author:req.body.author||'Admin',createdAt:new Date().toISOString()};
    claim.notes.push(note); claim.updatedAt=new Date().toISOString(); writeClaims(data);
    res.json({success:true,data:note});
});

app.delete('/api/claims/:id', (req, res) => {
    const data=readClaims(); const idx=data.claims.findIndex(c=>c.id===req.params.id);
    if(idx===-1) return res.status(404).json({success:false,message:'ไม่พบข้อมูลเคลม'});
    data.claims.splice(idx,1); writeClaims(data);
    res.json({success:true,message:'ลบเคลมเรียบร้อย'});
});

app.get('/api/stats', (req, res) => {
    const data=readClaims(); let claims=data.claims;
    const { userRole, userEmail } = req.query;

    // Role-based filtering
    if (userRole === 'customer' && userEmail) {
        claims = claims.filter(c => c.customer.email.toLowerCase() === userEmail.toLowerCase());
    }

    const s={total:claims.length,pending:claims.filter(c=>c.status==='pending').length,
        reviewing:claims.filter(c=>c.status==='reviewing').length,approved:claims.filter(c=>c.status==='approved').length,
        rejected:claims.filter(c=>c.status==='rejected').length,completed:claims.filter(c=>c.status==='completed').length};
    const eqStats={}; claims.forEach(c=>{eqStats[c.equipment.type]=(eqStats[c.equipment.type]||0)+1;});
    const mNames=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const monthly=[]; for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);const m=d.getMonth(),y=d.getFullYear();
        monthly.push({month:mNames[m],year:y,count:claims.filter(c=>{const cd=new Date(c.createdAt);return cd.getMonth()===m&&cd.getFullYear()===y;}).length});}
    const sevStats={low:claims.filter(c=>c.problem.severity==='low').length,medium:claims.filter(c=>c.problem.severity==='medium').length,
        high:claims.filter(c=>c.problem.severity==='high').length,critical:claims.filter(c=>c.problem.severity==='critical').length};
    res.json({success:true,data:{stats:s,equipmentStats:eqStats,monthlyStats:monthly,severityStats:sevStats}});
});

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/dashboard', (req,res)=>res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get('/claim-form', (req,res)=>res.sendFile(path.join(__dirname,'public','claim-form.html')));
app.get('/claim-detail', (req,res)=>res.sendFile(path.join(__dirname,'public','claim-detail.html')));

// Download Excel endpoint
app.get('/api/export/excel', async (req, res) => {
    try {
        const data = readClaims();
        await syncToExcel(data.claims);
        
        const filename = 'solar-claims.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Cache-Control', 'no-cache');
        
        const fileBuffer = fs.readFileSync(EXCEL_FILE);
        res.send(fileBuffer);
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ success:false, message:'ไม่สามารถสร้างไฟล์ Excel ได้' });
    }
});

app.listen(PORT, ()=>{
    console.log(`🌞 Solar Claim System running at http://localhost:${PORT}`);
    // Sync Excel on startup
    const data = readClaims();
    syncToExcel(data.claims).then(() => console.log('📊 Initial Excel sync complete'));
});
