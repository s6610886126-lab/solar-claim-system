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
        name: "นายสมชาย ดีมั่น",
        phone: "0812345678",
        email: "somchai.d@gmail.com",
        address: "45/2 หมู่ 3 ถ.วิภาวดีรังสิต แขวงตลาดบางเขน เขตหลักสี่ กรุงเทพมหานคร 10210",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "Tiger Neo N-type",
        serial: "JK-TIGER-2026A1",
        purchaseDate: "2024-10-15",
        warrantyNum: "WRT-JK-20241015",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-10-15",
        problemDesc: "แผงโซล่าเซลล์จ่ายไฟไม่เต็มกำลังผลิต ในช่วงแดดจัดกำลังไฟตกลงกว่า 50% พบ hot spot เล็กๆ บนแผง",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-01T09:30:00.000Z",
        notes: "ดำเนินการตรวจสอบผ่านภาพถ่ายพบความบกพร่องจริง อนุมัติการเคลมแผงใหม่ทดแทน"
    },
    {
        name: "นางสาววิภาดา เลิศล้ำ",
        phone: "0898765432",
        email: "wipada.lert@outlook.com",
        address: "12/5 ถ.พัฒนาการ แขวงสวนหลวง เขตสวนหลวง กรุงเทพมหานคร 10250",
        eqType: "Inverter",
        brand: "Solis",
        model: "S6-GR1P5K",
        serial: "SL-INV-S6-293810",
        purchaseDate: "2025-02-10",
        warrantyNum: "WRT-SL-20250210",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2030-02-10",
        problemDesc: "ตัวอินเวอร์เตอร์จอดับสนิท ไฟสถานะทุกดวงไม่ขึ้นเลย ไม่มีกระแสไฟจ่ายเข้าระบบของบ้าน",
        severity: "50",
        status: "reviewing",
        createdAt: "2026-05-18T10:15:00.000Z",
        notes: "ทีมช่างกำลังเตรียมเครื่องมือเข้าไปหน้างานเพื่อตรวจสอบระบบสายดินและบอร์ดควบคุมอินเวอร์เตอร์"
    },
    {
        name: "นายกิตติศักดิ์ รุ่งเรือง",
        phone: "0823456789",
        email: "kittisak.r@gmail.com",
        address: "99/9 หมู่บ้านกรีนวิว ถ.บางนา-ตราด ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Powerbox F-10.0",
        serial: "DN-PB-98471203",
        purchaseDate: "2025-11-20",
        warrantyNum: "WRT-DN-20251120",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2035-11-20",
        problemDesc: "แบตเตอรี่ชาร์จไฟไม่เข้าเลย ไฟแสดงสถานะแบตเตอรี่กะพริบเป็นสีส้มตลอดเวลา ลองรีบูตระบบแล้วไม่หาย",
        severity: "100",
        status: "pending",
        createdAt: "2026-05-20T14:22:00.000Z",
        notes: "รับเรื่องเคลมเข้าระบบ รอนัดหมายวิศวกรเข้าหน้างานเพื่อตรวจเช็คระบบไฟฟ้าหลักและแบตเตอรี่"
    },
    {
        name: "นางสาวกมลวรรณ ชัยชนะ",
        phone: "0845678901",
        email: "kamolwan.c@hotmail.com",
        address: "555/23 คอนโดไฮไรส์ ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
        eqType: "Solar Panel",
        brand: "Solis",
        model: "Solis Panel 440W",
        serial: "SL-PANEL-440-0012",
        purchaseDate: "2024-01-18",
        warrantyNum: "WRT-SLP-20240118",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2036-01-18",
        problemDesc: "เกิดคราบสนิมบริเวณขอบอลูมิเนียมของแผงโซล่าเซลล์ ประสิทธิภาพการผลิตไฟลดลงเล็กน้อย",
        severity: "10",
        status: "completed",
        createdAt: "2026-04-10T08:00:00.000Z",
        notes: "ทำการส่งเจ้าหน้าที่เข้าทำความสะอาดและตรวจสอบขอบแผงโซล่าเซลล์เรียบร้อย ปรับแต่งการยึดให้แข็งแรงขึ้น"
    },
    {
        name: "นายประสิทธิ์ รักการดี",
        phone: "0856789012",
        email: "prasit.rak@gmail.com",
        address: "88/1 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
        eqType: "Battery",
        brand: "LV Topsun",
        model: "Topsun LV 48V 100Ah",
        serial: "TS-BATT-100-9928",
        purchaseDate: "2024-05-05",
        warrantyNum: "WRT-TSB-20240505",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-05-05",
        problemDesc: "ขณะใช้งานช่วงค่ำ ตัวแบตเตอรี่ร้อนจัดจนระบบ Safety ตัดการทำงานและส่งกลิ่นไหม้",
        severity: "80",
        status: "rejected",
        createdAt: "2026-04-15T11:45:00.000Z",
        notes: "ปฏิเสธการเคลม: เนื่องจากตรวจพบรอยน้ำซึมเข้าด้านล่างเครื่องเนื่องจากลูกค้าติดตั้งในพื้นที่โล่งไม่มีหลังคาคลุม"
    },
    {
        name: "นายอภิชาติ แก้วมณี",
        phone: "0867890123",
        email: "apichart.k@yahoo.com",
        address: "214/8 ถ.ช้างคลาน ต.ช้างคลาน อ.เมือง จ.เชียงใหม่ 50100",
        eqType: "Inverter",
        brand: "Solis",
        model: "S5-GR3P10K",
        serial: "SL-INV-3P10K-9028",
        purchaseDate: "2024-06-30",
        warrantyNum: "WRT-SLI-20240630",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-06-30",
        problemDesc: "เครื่องขึ้นโค้ดสัญญาณเตือนความบกพร่องของฮาร์ดแวร์ภายใน ไม่สามารถผลิตกระแสไฟ AC ได้",
        severity: "100",
        status: "approved",
        createdAt: "2026-03-25T13:20:00.000Z",
        notes: "ตรวจสอบแล้วพบปัญหาที่บอร์ดแปลงไฟอินเวอร์เตอร์จริง อนุมัติเปลี่ยนเครื่องใหม่ให้แก่ลูกค้า"
    },
    {
        name: "นางสาวศิริพร บุญเหลือ",
        phone: "0878901234",
        email: "siriporn.b@gmail.com",
        address: "73 ถ.รอบเมือง ต.หมากแข้ง อ.เมือง จ.อุดรธานี 41000",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "Tiger Pro",
        serial: "JK-TIGERPRO-8812",
        purchaseDate: "2024-08-12",
        warrantyNum: "WRT-JKP-20240812",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-08-12",
        problemDesc: "กระจกเทมเปอร์หน้าแผงโซล่าเซลล์เกิดรอยร้าวเป็นใยแมงมุม คาดว่าเกิดจากความร้อนสะสมและการหดตัว",
        severity: "50",
        status: "completed",
        createdAt: "2026-05-02T16:10:00.000Z",
        notes: "ดำเนินการเปลี่ยนแผงโซล่าเซลล์แผงใหม่ทดแทนแผงเดิมที่แตกร้าวเรียบร้อยแล้ว ระบบกลับมาผลิตไฟได้ปกติ"
    },
    {
        name: "นายธีรเดช สุขสวัสดิ์",
        phone: "0889012345",
        email: "teeradech.s@gmail.com",
        address: "318/14 ถ.พระราม 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพมหานคร 10120",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Dyness B4850",
        serial: "DN-B4850-202409",
        purchaseDate: "2025-03-15",
        warrantyNum: "WRT-DN-20250315",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2035-03-15",
        problemDesc: "ค่าความจุแบตเตอรี่ลดลงอย่างรวดเร็ว ชาร์จเต็มแต่จ่ายไฟได้เพียง 10 นาทีระบบก็ตัดการทำงานทันที",
        severity: "50",
        status: "pending",
        createdAt: "2026-05-21T02:00:00.000Z",
        notes: "รับเรื่องเข้าระบบ อยู่ระหว่างวิเคราะห์ประวัติการใช้งานและการชาร์จผ่านทาง Cloud Logger"
    },
    {
        name: "นางนงลักษณ์ สมบูรณ์",
        phone: "0890123456",
        email: "nonglak.s@outlook.com",
        address: "105/4 ถ.เพชรเกษม ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110",
        eqType: "Inverter",
        brand: "Solis",
        model: "S5-GR1P5K",
        serial: "SL-S5-GR1P-88219",
        purchaseDate: "2024-12-01",
        warrantyNum: "WRT-SLS-20241201",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-12-01",
        problemDesc: "พัดลมระบายความร้อนของเครื่องส่งเสียงดังแหลมและสั่นรุนแรงขณะทำงานแดดจัด คาดว่าตลับลูกปืนภายในชำรุด",
        severity: "80",
        status: "reviewing",
        createdAt: "2026-05-19T09:40:00.000Z",
        notes: "ทีมแอดมินประสานงานเตรียมจัดส่งอะไหล่ชุดพัดลมระบายความร้อนของ Solis ตรงรุ่นเพื่อเข้าไปเปลี่ยนทดแทน"
    },
    {
        name: "นายวรวุฒิ อุดมทรัพย์",
        phone: "0801234567",
        email: "worawut.u@gmail.com",
        address: "41 ถ.ราชดำเนิน ต.ศรีภูมิ อ.เมือง จ.เชียงใหม่ 50200",
        eqType: "Solar Panel",
        brand: "Solis",
        model: "Solis Panel 550W",
        serial: "SLP-550W-982103",
        purchaseDate: "2024-04-10",
        warrantyNum: "WRT-SLP-20240410",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2036-04-10",
        problemDesc: "ประสิทธิภาพการผลิตไฟฟ้าของแผงต่ำผิดปกติ เทียบกับแผงข้างๆ ในสตริงเดียวกันลดลงไปกว่า 40%",
        severity: "50",
        status: "approved",
        createdAt: "2026-03-12T15:30:00.000Z",
        notes: "ตรวจสอบข้อมูลการผลิตไฟฟ้าและวัดระดับแรงดันแผงเดี่ยวพบความผิดปกติจริง อนุมัติเปลี่ยนแผงให้ลูกค้า"
    },
    {
        name: "นายรุ่งโรจน์ สว่างจิต",
        phone: "0811122334",
        email: "rungroj.s@gmail.com",
        address: "234/11 หมู่ 5 ต.ท่าทราย อ.เมือง จ.สมุทรสาคร 74000",
        eqType: "Battery",
        brand: "LV Topsun",
        model: "Topsun LV 48V 200Ah",
        serial: "TS-LV200-9921",
        purchaseDate: "2024-01-20",
        warrantyNum: "WRT-TS-20240120",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-01-20",
        problemDesc: "ตัวแบตเตอรี่สื่อสารกับอินเวอร์เตอร์ไม่ได้ ขึ้นไฟสีส้มกะพริบเตือน Communication Error",
        severity: "80",
        status: "completed",
        createdAt: "2026-02-15T08:30:00.000Z",
        notes: "ช่างเทคนิคเดินทางเข้าตรวจสอบและทำการเปลี่ยนสายสัญญาณสื่อสาร Modbus เส้นใหม่ ระบบสามารถใช้งานได้ปกติ"
    },
    {
        name: "นางสาวชลลดา สุขใจ",
        phone: "0822233445",
        email: "chonlada.s@hotmail.com",
        address: "68/9 ถ.สุขสวัสดิ์ อ.พระประแดง จ.สมุทรปราการ 10130",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "JKM-440N",
        serial: "JK-440N-202408B",
        purchaseDate: "2024-09-05",
        warrantyNum: "WRT-JK-20240905",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-09-05",
        problemDesc: "เกิดรอยขุ่นและฝ้าขาวใต้ชั้นกระจกแผงโซล่าเซลล์ ประสิทธิภาพลดลงในช่วงบ่ายเนื่องจากความร้อนสูง",
        severity: "10",
        status: "pending",
        createdAt: "2026-05-21T04:10:00.000Z",
        notes: "ลงทะเบียนรับคำขอเคลมเรียบร้อย รอนัดหมายส่งเจ้าหน้าที่ไปวัดค่ากระแสไฟฟ้าที่แผงจริงหน้างาน"
    },
    {
        name: "นายธนพล มั่งคั่ง",
        phone: "0833344556",
        email: "thanapol.m@gmail.com",
        address: "123 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพมหานคร 10240",
        eqType: "Inverter",
        brand: "Solis",
        model: "S6-GR1P5K",
        serial: "SL-S6-0029381",
        purchaseDate: "2025-07-12",
        warrantyNum: "WRT-SLI-20250712",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2030-07-12",
        problemDesc: "เครื่องหยุดทำงานและฟ้องโค้ด Grid Overvoltage บ่อยครั้งมาก ไม่สลับเข้าสู่โหมดจ่ายกระแสไฟปกติ",
        severity: "100",
        status: "rejected",
        createdAt: "2026-05-17T11:00:00.000Z",
        notes: "ปฏิเสธการเคลม: การแจ้งเตือนเกิดจากระบบไฟฟ้าภายนอกอาคารของการไฟฟ้ามีแรงดันเกินขีดจำกัด ไม่ใช่ความบกพร่องของเครื่องอินเวอร์เตอร์"
    },
    {
        name: "นางสาวพัชราภรณ์ แสนทวี",
        phone: "0844455667",
        email: "patchara.s@outlook.com",
        address: "47 หมู่ 2 ต.แสนสุข อ.เมืองชลบุรี จ.ชลบุรี 20130",
        eqType: "Battery",
        brand: "Battery Dyness",
        model: "Dyness A48100",
        serial: "DN-A48100-2938",
        purchaseDate: "2024-11-11",
        warrantyNum: "WRT-DN-20241111",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2034-11-11",
        problemDesc: "แบตเตอรี่หยุดทำงานชั่วคราวและแจ้งเตือนอุณหภูมิสูงผิดปกติขณะคายประจุสำรองไฟช่วงกลางคืน",
        severity: "50",
        status: "reviewing",
        createdAt: "2026-04-05T13:40:00.000Z",
        notes: "ทีมเทคนิคประสานงานขอข้อมูลการบันทึกอุณหภูมิห้องติดตั้งเพื่อเช็คสภาพแวดล้อมและการระบายอากาศเบื้องต้น"
    },
    {
        name: "นายทวีป มีสุข",
        phone: "0855566778",
        email: "taveep.m@gmail.com",
        address: "99 หมู่ 1 ต.บ้านใหม่ อ.เมืองปทุมธานี จ.ปทุมธานี 12000",
        eqType: "Solar Panel",
        brand: "JinkoSolar",
        model: "JKM-400M",
        serial: "JK-400M-202411",
        purchaseDate: "2024-01-15",
        warrantyNum: "WRT-JK-20240115",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-01-15",
        problemDesc: "มีประกายไฟที่ขั้วเชื่อมต่อสายหลังแผงและขั้วต่อเกิดความร้อนหลอมละลายจนสายขาดชำรุด",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-20T10:00:00.000Z",
        notes: "ตรวจสอบแล้วพบปัญหาที่ขั้ว Junction Box หลวมมาจากโรงงาน อนุมัติเปลี่ยนแผงโซล่าเซลล์ชิ้นใหม่ให้แก่ลูกค้า"
    }
];

// Helper: Sync to Excel function written inline so we don't depend on server.js imports
const statusLabelsExcel = { pending: 'รอดำเนินการ', reviewing: 'กำลังตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', completed: 'เสร็จสิ้น' };
const sevLabelsExcel = { 10: '10%', 50: '50%', 80: '80%', 100: '100%' };

async function syncToExcelLocal(claims) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Solar Claim System';
    wb.created = new Date();

    const ws = wb.addWorksheet('รายการเคลม', { properties: { tabColor: { argb: 'FFF59E0B' } }, views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
        { header: 'เลขที่เคลม', key: 'claimNumber', width: 18 }, { header: 'ชื่อลูกค้า', key: 'customerName', width: 22 },
        { header: 'เบอร์โทร', key: 'phone', width: 16 }, { header: 'อีเมล', key: 'email', width: 24 },
        { header: 'ที่อยู่', key: 'address', width: 30 }, { header: 'ประเภทอุปกรณ์', key: 'eqType', width: 20 },
        { header: 'ยี่ห้อ', key: 'brand', width: 16 }, { header: 'รุ่น', key: 'model', width: 14 },
        { header: 'Serial Number', key: 'serial', width: 20 }, { header: 'วันที่แจ้งเคลม', key: 'purchaseDate', width: 14 },
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
            createdAt: new Date(c.created_at).toLocaleString('th-TH'),
            updatedAt: new Date(c.updated_at).toLocaleString('th-TH'),
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

    const eqCount = {};
    claims.forEach(c => {
        const type = c.equipment?.type || 'อื่นๆ';
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
    console.log('⚡ Starting dummy data generation script (15 claims)...');

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

    for (let i = 0; i < Math.min(15, dummyClaims.length); i++) {
        const c = dummyClaims[i];
        
        // Construct timeline
        const timeline = [
            { status: 'pending', date: c.createdAt, note: 'รับเรื่องเคลมเข้าระบบเรียบร้อย' }
        ];

        if (c.status !== 'pending') {
            const reviewingDate = new Date(new Date(c.createdAt).getTime() + 1000 * 60 * 60 * 24).toISOString(); // +1 day
            timeline.push({ status: 'reviewing', date: reviewingDate, note: 'ทีมช่างเทคนิคทำการตรวจสอบรายละเอียดเบื้องต้น' });

            if (c.status === 'approved' || c.status === 'rejected') {
                const finalDate = new Date(new Date(reviewingDate).getTime() + 1000 * 60 * 60 * 24 * 2).toISOString(); // +2 days
                timeline.push({
                    status: c.status,
                    date: finalDate,
                    note: c.status === 'approved' ? `อนุมัติคำขอ: ${c.notes}` : `ปฏิเสธคำขอ: ${c.notes}`
                });
            } else if (c.status === 'completed') {
                const approvedDate = new Date(new Date(reviewingDate).getTime() + 1000 * 60 * 60 * 24 * 2).toISOString(); // +2 days
                timeline.push({ status: 'approved', date: approvedDate, note: 'อนุมัติการเคลมสินค้าและจัดเตรียมอุปกรณ์ชิ้นใหม่' });

                const completedDate = new Date(new Date(approvedDate).getTime() + 1000 * 60 * 60 * 24 * 3).toISOString(); // +3 days
                timeline.push({ status: 'completed', date: completedDate, note: `ปิดงานเคลม: ${c.notes}` });
            }
        }

        const noteArray = [];
        if (c.notes) {
            noteArray.push({
                id: uuidv4(),
                text: c.notes,
                author: 'Admin System',
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
        console.error('❌ Supabase Insert Error:', error);
    } else {
        console.log(`🎉 Supabase Insert Success! Successfully inserted ${data.length} records.`);
        
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
}

insertDummyData();
