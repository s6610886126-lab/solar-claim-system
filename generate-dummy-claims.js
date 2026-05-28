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

// 30 realistic claims
const dummyClaims = [
    {
        name: "นายสมชาย ดีมั่น",
        phone: "0812345678",
        email: "somchai.d@gmail.com",
        address: "45/2 หมู่ 3 ถ.วิภาวดีรังสิต แขวงตลาดบางเขน เขตหลักสี่ กรุงเทพมหานคร 10210",
        eqType: "Solar Panel",
        brand: "Longi",
        model: "LR5-72HPH-550M",
        serial: "LN-550M-20239011",
        purchaseDate: "2023-10-15",
        warrantyNum: "WRT-LG-20231015A",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2035-10-15",
        problemDesc: "แผงโซล่าเซลล์ชาร์จไฟไม่เต็มกำลังผลิต ในช่วงแดดจัดผลผลิตไฟฟ้าตกลงกว่า 50% ผิดปกติมาก",
        severity: "50",
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
        brand: "Huawei",
        model: "SUN2000-10KTL-M1",
        serial: "HW-INV-10K-293810",
        purchaseDate: "2024-02-10",
        warrantyNum: "WRT-HW-20240210",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-02-10",
        problemDesc: "ตัวอินเวอร์เตอร์จอดับสนิท ไฟสถานะทุกดวงไม่ขึ้นเลย ไม่มีกระแสไฟไหลเข้าระบบบ้าน",
        severity: "80",
        status: "reviewing",
        createdAt: "2026-05-18T10:15:00.000Z",
        notes: "ทีมช่างกำลังเตรียมเครื่องมือเข้าไปหน้างานเพื่อตรวจสอบระบบสายดินและบอร์ดควบคุม"
    },
    {
        name: "นายกิตติศักดิ์ รุ่งเรือง",
        phone: "0823456789",
        email: "kittisak.r@gmail.com",
        address: "99/9 หมู่บ้านกรีนวิว ถ.บางนา-ตราด ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540",
        eqType: "Battery",
        brand: "Tesla",
        model: "Powerwall 2",
        serial: "TS-PW2-98471203",
        purchaseDate: "2024-11-20",
        warrantyNum: "WRT-TS-20241120B",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2034-11-20",
        problemDesc: "แบตเตอรี่ชาร์จไฟไม่เข้าเลย ไฟแสดงสถานะแบตเตอรี่กะพริบเป็นสีส้มตลอดเวลา ลองรีสตาร์ทแล้วไม่หาย",
        severity: "100",
        status: "pending",
        createdAt: "2026-05-20T14:22:00.000Z",
        notes: "รับเรื่องเคลมเข้าระบบ รอนัดหมายวิศวกรเข้าหน้างานเพื่อตรวจเช็คระบบไฟฟ้าหลัก"
    },
    {
        name: "นางสาวกมลวรรณ ชัยชนะ",
        phone: "0845678901",
        email: "kamolwan.c@hotmail.com",
        address: "555/23 คอนโดไฮไรส์ ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
        eqType: "Smart Meter",
        brand: "Growatt",
        model: "Eastron SDM630",
        serial: "GW-MTR-0029381",
        purchaseDate: "2025-01-18",
        warrantyNum: "WRT-GW-20250118",
        warrantyPeriod: "2 ปี",
        warrantyExpiry: "2027-01-18",
        problemDesc: "ตัว Smart Meter ดำเนินการวัดค่าปกติ แต่ไม่ยอมเชื่อมต่อ WiFi ส่งข้อมูลขึ้นแอปพลิเคชันไม่ได้เลย",
        severity: "10",
        status: "completed",
        createdAt: "2026-04-10T08:00:00.000Z",
        notes: "ช่างเทคนิคได้รีเซ็ตและอัปเดตเฟิร์มแวร์ใหม่ สามารถเชื่อมต่อกับสัญญาณอินเทอร์เน็ตได้ปกติแล้ว ปิดงานเคลม"
    },
    {
        name: "นายประสิทธิ์ รักการดี",
        phone: "0856789012",
        email: "prasit.rak@gmail.com",
        address: "88/1 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
        eqType: "Inverter",
        brand: "Sungrow",
        model: "SG10RT",
        serial: "SG-INV-10RT-8842",
        purchaseDate: "2023-05-05",
        warrantyNum: "WRT-SG-20230505",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2028-05-05",
        problemDesc: "ขณะใช้งานช่วงเที่ยงวัน ตัวเครื่องมีความร้อนจัดผิดปกติ และมีกลิ่นเหม็นไหม้คล้ายพลาสติกละลายลอยออกมา",
        severity: "100",
        status: "rejected",
        createdAt: "2026-04-15T11:45:00.000Z",
        notes: "ปฏิเสธการรับเคลม: จากการตรวจสอบสภาพพบรอยน้ำซึมเข้าด้านล่างเครื่องเนื่องจากช่างภายนอกเจาะรูร้อยสายผิดวิธี ทำให้ไฟฟ้าลัดวงจร ไม่อยู่ในเงื่อนไขรับประกัน"
    },
    {
        name: "นายอภิชาติ แก้วมณี",
        phone: "0867890123",
        email: "apichart.k@yahoo.com",
        address: "214/8 ถ.ช้างคลาน ต.ช้างคลาน อ.เมือง จ.เชียงใหม่ 50100",
        eqType: "Solar Panel",
        brand: "Jinko Solar",
        model: "Tiger Neo N-type 575W",
        serial: "JK-575N-293810A",
        purchaseDate: "2024-06-30",
        warrantyNum: "WRT-JK-20240630C",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-06-30",
        problemDesc: "กระจกเทมเปอร์หน้าแผงโซล่าเซลล์เกิดรอยร้าวเป็นใยแมงมุมเอง ไม่มีรอยของแข็งกระแทก คาดว่าเกิดจากความร้อนสะสมสะท้อนแผ่นวัสดุภายใน",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-25T13:20:00.000Z",
        notes: "ตรวจสอบแล้วไม่มีหลักฐานการโดนกระแทกภายนอก คาดว่าเกิดจาก Defect ของวัสดุกระจก อนุมัติส่งแผงใหม่ให้ลูกค้า"
    },
    {
        name: "นางสาวศิริพร บุญเหลือ",
        phone: "0878901234",
        email: "siriporn.b@gmail.com",
        address: "73 ถ.รอบเมือง ต.หมากแข้ง อ.เมือง จ.อุดรธานี 41000",
        eqType: "Connector",
        brand: "Staubli",
        model: "MC4-Evo2",
        serial: "ST-MC4-90283",
        purchaseDate: "2023-08-12",
        warrantyNum: "WRT-ST-20230812",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2028-08-12",
        problemDesc: "หัวต่อ MC4 หลังแผงเกิดละลายเสียหาย ทำให้ระบบฟอลต์อินเวอร์เตอร์ฟ้องเป็นค่า Ground Fault นำมาซึ่งความไม่ปลอดภัย",
        severity: "50",
        status: "completed",
        createdAt: "2026-05-02T16:10:00.000Z",
        notes: "ทีมช่างหน้างานทำการเปลี่ยนหัวต่อ MC4 ตัวใหม่ให้เรียบร้อย และทำการหุ้มฉนวนกันแดดฝนอย่างหนาแน่น ทดสอบระบบทำงานได้สมบูรณ์"
    },
    {
        name: "นายธีรเดช สุขสวัสดิ์",
        phone: "0889012345",
        email: "teeradech.s@gmail.com",
        address: "318/14 ถ.พระราม 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพมหานคร 10120",
        eqType: "Mounting System",
        brand: "Clenergy",
        model: "SolarRoof Pro",
        serial: "CL-MNT-2024-0019",
        purchaseDate: "2024-03-15",
        warrantyNum: "WRT-CL-20240315",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2034-03-15",
        problemDesc: "ขายึดรางอลูมิเนียมหลวมหลายจุด คลายน็อตไม่ได้เนื่องจากสนิมขึ้นที่ตัวสลักเหล็กเกรดต่ำกว่ามาตรฐานที่ระบุไว้ กลัวแผงจะปลิวเวลาลมแรง",
        severity: "50",
        status: "pending",
        createdAt: "2026-05-21T02:00:00.000Z",
        notes: "รับเรื่องเรียบร้อย เตรียมประเมินชิ้นส่วนอุปกรณ์เหล็กเพื่อนำสลักและข้อยึดมาตรฐานใหม่ไปเปลี่ยนให้"
    },
    {
        name: "นางนงลักษณ์ สมบูรณ์",
        phone: "0890123456",
        email: "nonglak.s@outlook.com",
        address: "105/4 ถ.เพชรเกษม ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110",
        eqType: "Inverter",
        brand: "Fronius",
        model: "Symo Advanced 15.0",
        serial: "FR-SYM-2938102B",
        purchaseDate: "2023-12-01",
        warrantyNum: "WRT-FR-20231201A",
        warrantyPeriod: "7 ปี",
        warrantyExpiry: "2030-12-01",
        problemDesc: "พัดลมระบายความร้อนของอินเวอร์เตอร์ส่งเสียงดังแหลมและสั่นรุนแรงขณะทำงานแดดจัด คาดว่าตลับลูกปืนภายในพัดลมจะชำรุดชำรุด",
        severity: "50",
        status: "reviewing",
        createdAt: "2026-05-19T09:40:00.000Z",
        notes: "ทีมแอดมินประสานงานแบรนด์เพื่อจัดส่งอะไหล่ชุดพัดลม Fronius ตรงรุ่น เพื่อไปเปลี่ยนทดแทนที่หน้างานของลูกค้า"
    },
    {
        name: "นายวรวุฒิ อุดมทรัพย์",
        phone: "0801234567",
        email: "worawut.u@gmail.com",
        address: "41 ถ.ราชดำเนิน ต.ศรีภูมิ อ.เมือง จ.เชียงใหม่ 50200",
        eqType: "Battery",
        brand: "BYD",
        model: "Battery-Box Premium HVS",
        serial: "BYD-HVS-394819",
        purchaseDate: "2024-04-10",
        warrantyNum: "WRT-BYD-20240410",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2034-04-10",
        problemDesc: "ความจุแบตเตอรี่ลดลงอย่างรวดเร็ว (Battery Degradation) ชาร์จเต็ม 100% แต่ใช้งานไฟบ้านปกติได้ไม่ถึง 1 ชั่วโมงก็ดับลงเหลือ 0%",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-12T15:30:00.000Z",
        notes: "จากการดึง Log ระบบผ่าน Cloud พบความจุเสื่อมสภาพเร็วกว่าเกณฑ์มาตรฐานการรับประกันจริง อนุมัติเคลมโมดูลแบตเตอรี่ตัวใหม่"
    },
    {
        name: "นายรุ่งโรจน์ สว่างจิต",
        phone: "0811122334",
        email: "rungroj.s@gmail.com",
        address: "234/11 หมู่ 5 ต.ท่าทราย อ.เมือง จ.สมุทรสาคร 74000",
        eqType: "Inverter",
        brand: "SMA",
        model: "Sunny Tripower 25000TL",
        serial: "SMA-ST-25K-092831",
        purchaseDate: "2023-01-20",
        warrantyNum: "WRT-SMA-20230120",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2033-01-20",
        problemDesc: "เครื่องหยุดทำงานและมีไฟสีแดงกะพริบถี่ๆ หน้าจอ LCD แจ้งเตือน Error Code 301 (Grid Overvoltage) บ่อยครั้งไม่ยอมทำงานปกติ",
        severity: "80",
        status: "completed",
        createdAt: "2026-02-15T08:30:00.000Z",
        notes: "วิศวกรเข้าหน้างานตรวจสอบระบบไฟฟ้าหลัก ปรับลดเกณฑ์โวลต์ในเฟิร์มแวร์ของ SMA ให้สอดคล้องกับค่าไฟของ กฟภ. ท้องถิ่น ตอนนี้ใช้งานได้ปกติเรียบร้อย"
    },
    {
        name: "นางสาวชลลดา สุขใจ",
        phone: "0822233445",
        email: "chonlada.s@hotmail.com",
        address: "68/9 ถ.สุขสวัสดิ์ อ.พระประแดง จ.สมุทรปราการ 10130",
        eqType: "Solar Panel",
        brand: "Canadian Solar",
        model: "BiHiKu7 650W",
        serial: "CS-650W-9847291",
        purchaseDate: "2024-09-05",
        warrantyNum: "WRT-CS-20240905B",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2036-09-05",
        problemDesc: "แผงแถวที่ 2 มีผลผลิตไฟตกลงไปเยอะมากเกือบเท่ากับศูนย์ ทำให้ระบบภาพรวมทั้งหมดผลิตไฟไม่ขึ้น คาดว่ามีไดโอดภายในแผงชำรุดชำรุด",
        severity: "80",
        status: "pending",
        createdAt: "2026-05-21T04:10:00.000Z",
        notes: "รับเรื่องเคลมเบื้องต้น กำลังติดต่อส่งทีมช่างวัดค่าโวลต์-แอมป์ (V-A) แต่ละแผงเพื่อระบุตัวที่มีปัญหาและดำเนินการขั้นตอนต่อไป"
    },
    {
        name: "นายธนพล มั่งคั่ง",
        phone: "0833344556",
        email: "thanapol.m@gmail.com",
        address: "123 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพมหานคร 10240",
        eqType: "Smart Dongle",
        brand: "Huawei",
        model: "SDongleA-05 WLAN-FE",
        serial: "HW-DGL-92830182",
        purchaseDate: "2024-07-12",
        warrantyNum: "WRT-HW-20240712C",
        warrantyPeriod: "2 ปี",
        warrantyExpiry: "2026-07-12",
        problemDesc: "ตัว Dongle ที่เสียบเข้ากับอินเวอร์เตอร์มีไฟกระพริบสีแดงตลอดเวลา เชื่อมต่ออินเทอร์เน็ตไม่ได้ ทำให้แอป FusionSolar ดูสถานะแบบ Real-time ไม่ได้",
        severity: "10",
        status: "reviewing",
        createdAt: "2026-05-17T11:00:00.000Z",
        notes: "ทีมเทคนิคหลังบ้านกำลังทำการรีโมทเช็คสถานะการเชื่อมต่อ หากตัวอุปกรณ์เสียจริงจะจัดส่งอุปกรณ์ทดแทนตัวใหม่ไปทางพัสดุให้ลูกค้านำไปเสียบแทน"
    },
    {
        name: "นางสาวพัชราภรณ์ แสนทวี",
        phone: "0844455667",
        email: "patchara.s@outlook.com",
        address: "47 หมู่ 2 ต.แสนสุข อ.เมืองชลบุรี จ.ชลบุรี 20130",
        eqType: "Safety Switch",
        brand: "ABB",
        model: "RCBO 2P 40A",
        serial: "ABB-RCBO-92831",
        purchaseDate: "2023-11-11",
        warrantyNum: "WRT-ABB-20231111",
        warrantyPeriod: "3 ปี",
        warrantyExpiry: "2026-11-11",
        problemDesc: "ตัวเบรกเกอร์กันดูด RCBO สับสวิตช์แล้วเกิดทริป (Trip) ทันทีในช่วงที่โซล่าเซลล์เริ่มทำงานช่วง 8.00 น. ลองสับขึ้นใหม่ก็ทริปทันที คาดว่าตัวอุปกรณ์เสื่อมสภาพ",
        severity: "50",
        status: "approved",
        createdAt: "2026-04-05T13:40:00.000Z",
        notes: "ตรวจสอบประวัติการติดตั้งพบว่าอุปกรณ์อยู่ในชุดคอนโทรลระบบความปลอดภัยที่จัดจำหน่ายโดยบริษัท อนุมัติเปลี่ยนเบรกเกอร์ ABB ตัวใหม่ให้ฟรี"
    },
    {
        name: "นายทวีป มีสุข",
        phone: "0855566778",
        email: "taveep.m@gmail.com",
        address: "99 หมู่ 1 ต.บ้านใหม่ อ.เมืองปทุมธานี จ.ปทุมธานี 12000",
        eqType: "Inverter",
        brand: "Growatt",
        model: "MIN 6000TL-X",
        serial: "GW-MIN-6K-92837",
        purchaseDate: "2024-01-15",
        warrantyNum: "WRT-GW-20240115A",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-01-15",
        problemDesc: "ตัวเครื่องดับและขึ้นหน้าจอไฟสีแดงเตือน Fault Code 'F03' (DC Isolation Fault) ระบบหยุดผลิตกระแสไฟฟ้าทันทีเพื่อป้องกันอัคคีภัย",
        severity: "80",
        status: "completed",
        createdAt: "2026-03-20T10:00:00.000Z",
        notes: "ส่งทีมช่างเข้าไล่สายไฟ DC ค้นพบว่ามีข้อต่อสายชำรุดตรงใต้หลังคาและมีกระแสไฟรั่วลงดิน ได้ทำการเข้าหัวสายใหม่และเปลี่ยนคอนเนคเตอร์ ใช้งานได้ปกติแล้ว"
    },
    {
        name: "นายสุรศักดิ์ วิเศษดี",
        phone: "0866677889",
        email: "surasak.w@gmail.com",
        address: "18/9 ถ.ราษฎร์อุทิศ ต.วัดเกต อ.เมือง จ.เชียงใหม่ 50000",
        eqType: "Battery",
        brand: "Huawei",
        model: "LUNA2000-5KW-C0",
        serial: "HW-LUNA-5K-00293",
        purchaseDate: "2025-02-25",
        warrantyNum: "WRT-HW-20250225B",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2035-02-25",
        problemDesc: "แบตเตอรี่สื่อสารผิดพลาด (Communication Loss) ไฟวิ่งที่ตัวเครื่องกะพริบสีแดง อินเวอร์เตอร์หาแบตเตอรี่ไม่เจอ ทำให้ไม่สามารถชาร์จเก็บพลังงานได้",
        severity: "80",
        status: "pending",
        createdAt: "2026-05-21T06:15:00.000Z",
        notes: "เพิ่งส่งข้อมูลเคลมเข้ามา รอดำเนินการติดต่อประสานงานวิศวกรเพื่อทำการ Remote Diagnostic เช็คสายสัญญาณสื่อสารแบบ Modbus ก่อน"
    },
    {
        name: "นายมานะ ใจตรง",
        phone: "0877788990",
        email: "mana.j@hotmail.com",
        address: "54 ถ.สถิตนิมานกาล ต.ในเมือง อ.วารินชำราบ จ.อุบลราชธานี 34190",
        eqType: "Solar Panel",
        brand: "Suntech",
        model: "Ultra V 550W",
        serial: "ST-550W-2938102",
        purchaseDate: "2023-04-20",
        warrantyNum: "WRT-ST-20230420",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2035-04-20",
        problemDesc: "แผงโซล่าเซลล์เกิดจุดไหม้ขนาดใหญ่ที่ตัวเซลล์ (Hotspot) มองเห็นได้ชัดเจนด้วยตาเปล่า ส่งผลให้แผงร้อนจัดและประสิทธิภาพการทำงานลดลงมาก",
        severity: "100",
        status: "approved",
        createdAt: "2026-04-28T09:12:00.000Z",
        notes: "ตรวจสอบรูปถ่ายหลักฐานจุด Hotspot เด่นชัดเป็นข้อบกพร่องด้านการผลิต อนุมัติการเคลมและอยู่ระหว่างจัดส่งแผงทดแทนไปยังศูนย์บริการพื้นที่"
    },
    {
        name: "นางสาวณิชา ศรีสุข",
        phone: "0888899001",
        email: "nicha.s@gmail.com",
        address: "21/5 ถ.บรมราชชนนี แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพมหานคร 10700",
        eqType: "Inverter",
        brand: "Sungrow",
        model: "SG5.0RS-ADA",
        serial: "SG-INV-5RS-293810",
        purchaseDate: "2024-05-15",
        warrantyNum: "WRT-SG-20240515",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-05-15",
        problemDesc: "หลังจากมีพายุฝนและฟ้าร้องอย่างรุนแรงเมื่อวานนี้ อินเวอร์เตอร์ดับสนิท เปิดสวิตช์ DC/AC ใหม่ก็ไม่มีการตอบสนองใดๆ คาดว่าเกิดจากแรงดันไฟฟ้ากระชากเหนี่ยวนำ",
        severity: "100",
        status: "reviewing",
        createdAt: "2026-05-20T08:50:00.000Z",
        notes: "ส่งทีมช่างเข้าไปถอดเครื่องกลับมาตรวจวิเคราะห์ที่ห้องแล็บเพื่อเช็คว่าเกิดจากระบบป้องกันฟ้าผ่าทำงานเกินขีดจำกัด (Force Majeure) หรือไม่"
    },
    {
        name: "นายปิยะพงษ์ ทองคำ",
        phone: "0899900112",
        email: "piyapong.t@gmail.com",
        address: "888 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400",
        eqType: "Smart Dongle",
        brand: "Growatt",
        model: "ShineWiFi-X",
        serial: "GW-SHINE-X-2938",
        purchaseDate: "2025-03-01",
        warrantyNum: "WRT-GW-20250301B",
        warrantyPeriod: "1 ปี",
        warrantyExpiry: "2026-03-01",
        problemDesc: "ตัวดองเกิล ShineWiFi ไฟแสดงสถานะไม่ยอมติด ดำเนินการรีเสียบตัวเครื่องแล้วยังคงเงียบเฉย ไม่สามารถรับสัญญาณใดๆ ได้",
        severity: "10",
        status: "completed",
        createdAt: "2026-01-10T14:00:00.000Z",
        notes: "ส่งดองเกิลเครื่องใหม่ไปให้ลูกค้าเปลี่ยนเองที่บ้านทางระบบพัสดุด่วน ลูกค้าได้รับอุปกรณ์และทำตามคู่มือติดตั้งเสร็จสิ้น ดึงข้อมูลการทำงานสำเร็จแล้ว"
    },
    {
        name: "นายวิทยา เกียรติอนันต์",
        phone: "0800011223",
        email: "wittaya.k@gmail.com",
        address: "34/8 ถ.อ่อนนุช แขวงประเวศ เขตประเวศ กรุงเทพมหานคร 10250",
        eqType: "Inverter",
        brand: "Hoymiles",
        model: "HM-1500",
        serial: "HM-MICRO-1500-09",
        purchaseDate: "2023-09-22",
        warrantyNum: "WRT-HM-20230922",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2035-09-22",
        problemDesc: "ตัวไมโครอินเวอร์เตอร์ที่ติดตั้งใต้แผงโซล่าเซลล์ดับสนิท 1 ตัว (จากทั้งหมด 4 ตัว) ทำให้แผงโซล่าเซลล์ที่ต่อกับพอร์ตนั้นไม่มีการผลิตไฟฟ้าเข้าระบบบ้านเลย",
        severity: "80",
        status: "pending",
        createdAt: "2026-05-21T07:30:00.000Z",
        notes: "ได้รับแจ้งปัญหาเคลมเข้ามาทางออนไลน์ อยู่ในขั้นตอนการนัดหมายทีมงานเข้าตรวจสอบระบบสายส่ง AC และเช็คฟิวส์ไฟฟ้า"
    },
    {
        name: "นางสาวอนงค์ ทองเจือ",
        phone: "0811133445",
        email: "anong.t@gmail.com",
        address: "59 หมู่ 4 ต.เสม็ด อ.เมืองชลบุรี จ.ชลบุรี 20000",
        eqType: "Connector",
        brand: "Link",
        model: "Solar Cable 4mm",
        serial: "LK-CBL-4MM-29381",
        purchaseDate: "2024-08-01",
        warrantyNum: "WRT-LK-20240801",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-08-01",
        problemDesc: "สายไฟโซล่าเซลล์เกิดไฟสปาร์ค มีรอยฉีกขาดของฉนวนหุ้มสายไฟ ทำให้กระแสไฟฟ้าหยุดเดินบ่อยครั้งและเกิดอันตรายต่อโครงสร้างหลังคา",
        severity: "50",
        status: "rejected",
        createdAt: "2026-04-18T10:30:00.000Z",
        notes: "ปฏิเสธการรับเคลม: จากการพิสูจน์รอยแผลที่ฉนวนหุ้มพลาสติกพบคราบฟันของหนูและกระรอกชัดเจน ความเสียหายเกิดจากสัตว์แทะภายนอก ไม่จัดเป็นการเสื่อมสภาพของอุปกรณ์"
    },
    {
        name: "นายเฉลิมพล บุญมี",
        phone: "0822244556",
        email: "chalermpon.b@yahoo.com",
        address: "71/3 ถ.รัตนโกสินทร์ ต.ช้างม่อย อ.เมือง จ.เชียงใหม่ 50300",
        eqType: "Mounting System",
        brand: "Clenergy",
        model: "L-Feet mounting",
        serial: "CL-LF-2023-0092",
        purchaseDate: "2023-07-19",
        warrantyNum: "WRT-CL-20230719B",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2033-07-19",
        problemDesc: "โครงสร้างตัวรับแรงลมและยึดแผงสไลด์ตกจากแป้นเหล็ก ทำให้แผงเอียงและเกือบจะสไลด์ตกลงมาเสียหายเนื่องจากโครงสร้างน็อตรับน้ำหนักไม่ได้มาตรฐาน",
        severity: "100",
        status: "approved",
        createdAt: "2026-05-15T15:20:00.000Z",
        notes: "ได้รับการยืนยันการบกพร่องของวิศวกรโครงสร้างว่าจุดยึด L-Feet รับแรงสั่นไหวและโบลต์เกิดความเครียดวัสดุ อนุมัติให้จัดหาชุดยึดโครงใหม่ทดแทนทันทีเพื่อความปลอดภัยสูงสุด"
    },
    {
        name: "นายเอกชัย ประเสริฐ",
        phone: "0833355667",
        email: "ekachai.p@gmail.com",
        address: "102 ถ.ประชาชื่น แขวงบางซื่อ เขตบางซื่อ กรุงเทพมหานคร 10800",
        eqType: "Connector",
        brand: "Staubli",
        model: "MC4 Female/Male",
        serial: "ST-MC4-PAIR-293",
        purchaseDate: "2024-03-20",
        warrantyNum: "WRT-ST-20240320A",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-03-20",
        problemDesc: "หัวต่อ MC4 เกิดความร้อนจัดจนเกิดการอาร์คหลอมละลายรวมกัน ส่งผลให้ไฟช็อตและระบบควบคุมเบรกเกอร์ DC ตัดการทำงานเองอัตโนมัติเพื่อความปลอดภัย",
        severity: "80",
        status: "completed",
        createdAt: "2026-03-05T09:00:00.000Z",
        notes: "ช่างเทคนิคได้ทำการเดินทางเข้าเปลี่ยนและเข้าหัวต่อสาย MC4 ชิ้นใหม่ ยึดแคลมป์รัดแน่นหนาและปรับระดับการเข้าสายเพื่อลดแรงตึงผิว ทดสอบระบบแล้วทำงานเป็นปกติ"
    },
    {
        name: "นางสาวเบญจวรรณ พูนสุข",
        phone: "0844466778",
        email: "benjawan.p@gmail.com",
        address: "3/11 ถ.สุขุมวิท ต.แสนสุข อ.เมืองชลบุรี จ.ชลบุรี 20130",
        eqType: "Solar Panel",
        brand: "Trina Solar",
        model: "Vertex S+ 430W",
        serial: "TR-430W-883710A",
        purchaseDate: "2024-12-10",
        warrantyNum: "WRT-TR-20241210",
        warrantyPeriod: "15 ปี",
        warrantyExpiry: "2039-12-10",
        problemDesc: "เกิดรอยคราบจุดสนิมน้ำตาลบริเวณกรอบอลูมิเนียมขอบแผงโซล่าเซลล์ มีผลผลิตไฟตกลงเล็กน้อยแต่กังวลเรื่องการกร่อนระยะยาวเนื่องจากอยู่ใกล้ทะเล",
        severity: "10",
        status: "pending",
        createdAt: "2026-05-21T08:00:00.000Z",
        notes: "รับเรื่องเข้าระบบวิเคราะห์ คาดว่าแผงได้รับสารไอเค็มจากทะเลยึดเกาะ เตรียมขอข้อมูลภาพถ่ายความเสียหายอย่างละเอียดเพื่อส่งเคลม Trina Solar"
    },
    {
        name: "นายประเสริฐ ยิ่งดี",
        phone: "0855577889",
        email: "prasert.y@outlook.com",
        address: "24 ถ.พระราม 2 แขวงจอมทอง เขตจอมทอง กรุงเทพมหานคร 10150",
        eqType: "Safety Switch",
        brand: "Schneider",
        model: "DC Circuit Breaker 500V",
        serial: "SN-DC-BRK-9923",
        purchaseDate: "2023-06-15",
        warrantyNum: "WRT-SN-20230615",
        warrantyPeriod: "3 ปี",
        warrantyExpiry: "2026-06-15",
        problemDesc: "พบกระแสไฟรั่วลงมาที่ตัวโครงเหล็กตู้คุมระบบไฟฟ้าหลัก (ตู้ MDB) มีไฟดูดอ่อนๆ เวลาแตะต้องหน้าตู้เป็นที่อันตรายอย่างยิ่ง",
        severity: "100",
        status: "reviewing",
        createdAt: "2026-05-20T16:40:00.000Z",
        notes: "ประสานงานช่างด่วนเร่งด่วนเข้าประเมินจุดชำรุดของสายดินและฉนวนรองตู้ และเตรียมเปลี่ยนสวิตช์ตัดไฟฟ้า DC ที่รั่วลงตู้"
    },
    {
        name: "นางสาวรัตนาภรณ์ รวยรื่น",
        phone: "0866688990",
        email: "rattanaporn.r@gmail.com",
        address: "88 หมู่ 6 ต.บ้านใหม่ อ.เมืองปทุมธานี จ.ปทุมธานี 12000",
        eqType: "Battery",
        brand: "Tesla",
        model: "Powerwall 2",
        serial: "TS-PW2-0092831B",
        purchaseDate: "2024-08-25",
        warrantyNum: "WRT-TS-20240825A",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2034-08-25",
        problemDesc: "ตัวแบตเตอรี่เสื่อมประสิทธิภาพอย่างร้ายแรง หลังจากสำรองไฟระบบจะดรอปไฟฟ้าดับเกือบจะทันทีที่โหลดแอร์ทำงาน ความจุจริงลดลงเยอะกว่า 70%",
        severity: "80",
        status: "approved",
        createdAt: "2026-03-08T11:20:00.000Z",
        notes: "ตรวจสอบข้อมูลการคายประจุพบแบตเตอรี่เซลล์พังจริงตามระบุ อนุมัติเปลี่ยนโมดูลแบตเตอรี่ก้อนใหม่ตามประกันคุณภาพแบรนด์"
    },
    {
        name: "นายสมบูรณ์ ปลอดภัย",
        phone: "0877799001",
        email: "somboon.p@gmail.com",
        address: "15/4 ถ.จรัญสนิทวงศ์ แขวงบ้านช่างหล่อ เขตบางกอกน้อย กรุงเทพมหานคร 10700",
        eqType: "Inverter",
        brand: "SMA",
        model: "Sunny Boy 5.0",
        serial: "SMA-SB-5K-293810",
        purchaseDate: "2023-03-10",
        warrantyNum: "WRT-SMA-20230310",
        warrantyPeriod: "10 ปี",
        warrantyExpiry: "2033-03-10",
        problemDesc: "อินเวอร์เตอร์ค้างในสถานะ 'Starting' ตั้งแต่ 6.00 น. ไม่ยอมสลับไปโหลดผลิตไฟฟ้า (Grid-Tied Mode) แม้แดดจะออกจัดและแผ่นแผงส่งไฟปกติ",
        severity: "50",
        status: "completed",
        createdAt: "2026-04-02T08:45:00.000Z",
        notes: "วิศวกรเข้าหน้างานตรวจสอบพบความผิดพลาดด้านซอฟต์แวร์ระบบล็อกบูท จึงทำการทำอัปเดตฟลายวีลและแฟลชรอม SMA ใหม่จนกลับมาทำงานปกติ"
    },
    {
        name: "นายอนันต์ พัฒนา",
        phone: "0888800112",
        email: "anant.pat@gmail.com",
        address: "220/1 ถ.รามอินทรา แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพมหานคร 10220",
        eqType: "Connector",
        brand: "Staubli",
        model: "MC4 Female/Male",
        serial: "ST-MC4-CONN-883",
        purchaseDate: "2024-02-28",
        warrantyNum: "WRT-ST-20240228",
        warrantyPeriod: "5 ปี",
        warrantyExpiry: "2029-02-28",
        problemDesc: "พบความร้อนสูงสะสมที่หัวคอนเนคเตอร์ตัวเชื่อมต่อใต้แผงโซล่าเซลล์ มีควันขึ้นเล็กน้อย โชคดีระบบตัดระบบก่อนเกิดประกายไฟสร้างความเสียหาย",
        severity: "80",
        status: "pending",
        createdAt: "2026-05-21T09:00:00.000Z",
        notes: "รับเรื่องเคลมด่วน เตรียมประสานงานช่างพื้นที่เพื่อความปลอดภัยให้เข้าหน้างานเปลี่ยนคอนเนคเตอร์และสุ่มวัดค่าความต้านทานกระแสไฟฟ้าสายอื่น"
    },
    {
        name: "นางสาวสุดา รักความสะอาด",
        phone: "0899911223",
        email: "suda.clean@gmail.com",
        address: "42/5 หมู่ 2 ถ.กาญจนาภิเษก ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110",
        eqType: "Solar Panel",
        brand: "Longi",
        model: "LR5-72HPH-550M",
        serial: "LN-550M-20239982",
        purchaseDate: "2023-11-05",
        warrantyNum: "WRT-LG-20231105C",
        warrantyPeriod: "12 ปี",
        warrantyExpiry: "2035-11-05",
        problemDesc: "แผงโซล่าเซลล์มีรอยขุ่นและฝุ่นสีเทาเกาะแน่นอยู่ภายในกระจกชั้นแผง (Delamination) ไม่สามารถล้างออกด้านนอกได้ ทำให้รับแสงอาทิตย์ได้แย่ลงมาก",
        severity: "10",
        status: "rejected",
        createdAt: "2026-05-10T11:00:00.000Z",
        notes: "ปฏิเสธการรับเคลม: จากการประเมินวิเคราะห์ชี้แจงรอยขุ่นเกิดจากลูกค้าล้างแผงด้วยน้ำยาล้างห้องน้ำที่มีกรดเข้มข้น ทำให้กระจกทำปฏิกิริยาผุกร่อน ไม่นับเป็น Defect โรงงาน"
    },
    {
        name: "นายสุรเดช เพชรดี",
        phone: "0800022334",
        email: "suradech.p@outlook.com",
        address: "7/7 ถ.ศรีนครินทร์ ต.บางเมือง อ.เมือง จ.สมุทรปราการ 10270",
        eqType: "Safety Switch",
        brand: "Schneider",
        model: "Surge Protection Device",
        serial: "SN-SPD-202302",
        purchaseDate: "2023-09-10",
        warrantyNum: "WRT-SN-20230910B",
        warrantyPeriod: "3 ปี",
        warrantyExpiry: "2026-09-10",
        problemDesc: "ตัวอุปกรณ์กันไฟกระชาก (Surge Protection Device - SPD) มีไฟแสดงสถานะเปลี่ยนเป็นสีแดง บ่งบอกถึงตัววาริสเตอร์พังและเสื่อมสภาพเสียหายแล้ว",
        severity: "50",
        status: "approved",
        createdAt: "2026-05-12T14:30:00.000Z",
        notes: "ตรวจสอบแล้วพบอุปกรณ์ทำหน้าที่ดูดซับแรงดันเกินจากฟ้าผ่าใกล้เคียงจนสละชีพเพื่อป้องกันส่วนอื่น อนุมัติเปลี่ยนโมดูลอะไหล่ชดเชยตามนโยบายรับประกัน"
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
    console.log('⚡ Starting dummy data generation script (30 claims)...');

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

    for (let i = 0; i < dummyClaims.length; i++) {
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
