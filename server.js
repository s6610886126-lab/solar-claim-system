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
const AVATARS_FILE = path.join(__dirname, 'data', 'user_avatars.json');

function getAvatars() {
    try {
        if (fs.existsSync(AVATARS_FILE)) {
            return JSON.parse(fs.readFileSync(AVATARS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading avatars file:', e);
    }
    return {};
}

function saveAvatars(avatars) {
    try {
        if (!fs.existsSync(path.dirname(AVATARS_FILE))) {
            fs.mkdirSync(path.dirname(AVATARS_FILE), { recursive: true });
        }
        fs.writeFileSync(AVATARS_FILE, JSON.stringify(avatars, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing avatars file:', e);
    }
}

async function uploadSingleImageToSupabase(base64Str) {
    if (!base64Str) return null;
    if (base64Str.startsWith('http')) return base64Str;
    try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;

        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileExtension = contentType.split('/')[1] || 'png';
        const fileName = `avatar-${uuidv4()}.${fileExtension}`;

        const { data, error } = await supabase.storage
            .from('claim-images')
            .upload(fileName, buffer, { contentType, upsert: false });

        if (error) {
            console.error('Supabase Storage Error uploading avatar:', error);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage.from('claim-images').getPublicUrl(fileName);
        return publicUrl;
    } catch (err) {
        console.error('Failed to upload avatar image:', err);
        return null;
    }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === Supabase Setup ===
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let useLocalDatabase = false;

// Local JSON database file-based client to mimic Supabase client when offline
function readLocalData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading local claims file:', e);
    }
    return { claims: [], users: [] };
}

function writeLocalData(data) {
    try {
        if (!fs.existsSync(path.dirname(DATA_FILE))) {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing local claims file:', e);
    }
}

// Map camelCase keys in claims.json to snake_case DB format
function mapLocalClaimToDb(c) {
    if (!c) return null;
    const dbVal = { ...c };
    dbVal.claim_number = c.claimNumber;
    dbVal.created_at = c.createdAt;
    dbVal.updated_at = c.updatedAt;
    delete dbVal.claimNumber;
    delete dbVal.createdAt;
    delete dbVal.updatedAt;
    return dbVal;
}

function mapDbClaimToLocal(c) {
    if (!c) return null;
    const local = { ...c };
    local.claimNumber = c.claim_number;
    local.createdAt = c.created_at;
    local.updatedAt = c.updated_at;
    delete local.claim_number;
    delete local.created_at;
    delete local.updated_at;
    return local;
}

function mapLocalUserToDb(u) {
    if (!u) return null;
    const dbVal = { ...u };
    dbVal.created_at = u.createdAt;
    delete dbVal.createdAt;
    return dbVal;
}

function mapDbUserToLocal(u) {
    if (!u) return null;
    const local = { ...u };
    local.createdAt = u.created_at;
    delete local.created_at;
    return local;
}

class LocalQueryBuilder {
    constructor(table) {
        this.table = table; // 'claims' or 'users'
        this.filters = [];
        this.orderField = null;
        this.orderAscending = true;
        this.limitCount = null;
        this.isSingle = false;
        this.isCount = false;
        
        this.action = 'select'; // 'select', 'insert', 'update', 'delete', 'upsert'
        this.actionData = null;
        this.upsertConflict = null;
    }

    select(fields = '*', options = {}) {
        if (options.count) {
            this.isCount = true;
        }
        return this;
    }

    insert(rows) {
        this.action = 'insert';
        this.actionData = rows;
        return this;
    }

    update(fields) {
        this.action = 'update';
        this.actionData = fields;
        return this;
    }

    upsert(rows, options = {}) {
        this.action = 'upsert';
        this.actionData = rows;
        this.upsertConflict = options.onConflict;
        return this;
    }

    delete() {
        this.action = 'delete';
        return this;
    }

    eq(field, value) {
        this.filters.push({ type: 'eq', field, value });
        return this;
    }

    ilike(field, value) {
        this.filters.push({ type: 'ilike', field, value });
        return this;
    }

    or(filterString) {
        this.filters.push({ type: 'or', filterString });
        return this;
    }

    filter(field, operator, value) {
        this.filters.push({ type: 'filter', field, operator, value });
        return this;
    }

    order(field, { ascending = true } = {}) {
        this.orderField = field;
        this.orderAscending = ascending;
        return this;
    }

    limit(count) {
        this.limitCount = count;
        return this;
    }

    single() {
        this.isSingle = true;
        return this;
    }

    // Awaitable Support
    async then(resolve, reject) {
        try {
            const result = await this.execute();
            resolve(result);
        } catch (err) {
            reject(err);
        }
    }

    async execute() {
        const fileData = readLocalData();
        
        // Load and map from local JSON schema (camelCase) to DB schema (snake_case)
        const items = (fileData[this.table] || []).map(item => {
            return this.table === 'claims' ? mapLocalClaimToDb(item) : mapLocalUserToDb(item);
        });

        // Helper to save DB schema items back to local JSON schema (camelCase)
        const saveAllItems = (dbItems) => {
            fileData[this.table] = dbItems.map(item => {
                return this.table === 'claims' ? mapDbClaimToLocal(item) : mapDbUserToLocal(item);
            });
            writeLocalData(fileData);
        };

        if (this.action === 'insert') {
            const rowsToInsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
            const inserted = [];
            for (let row of rowsToInsert) {
                const newRow = { 
                    ...row, 
                    id: row.id || uuidv4(),
                    created_at: row.created_at || new Date().toISOString(),
                    updated_at: row.updated_at || new Date().toISOString()
                };
                items.push(newRow);
                inserted.push(newRow);
            }
            saveAllItems(items);
            return { data: this.isSingle ? inserted[0] : inserted, error: null };
        }

        if (this.action === 'upsert') {
            const rowsToInsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
            const inserted = [];
            const conflictKey = this.upsertConflict;
            
            for (let row of rowsToInsert) {
                let existingIndex = -1;
                if (conflictKey) {
                    existingIndex = items.findIndex(item => {
                        let itemVal = item[conflictKey];
                        let rowVal = row[conflictKey];
                        if (typeof itemVal === 'string') itemVal = itemVal.toLowerCase();
                        if (typeof rowVal === 'string') rowVal = rowVal.toLowerCase();
                        return itemVal === rowVal;
                    });
                }
                
                if (existingIndex > -1) {
                    items[existingIndex] = {
                        ...items[existingIndex],
                        ...row,
                        updated_at: new Date().toISOString()
                    };
                    inserted.push(items[existingIndex]);
                } else {
                    const newRow = {
                        ...row,
                        id: row.id || uuidv4(),
                        created_at: row.created_at || new Date().toISOString(),
                        updated_at: row.updated_at || new Date().toISOString()
                    };
                    items.push(newRow);
                    inserted.push(newRow);
                }
            }
            saveAllItems(items);
            return { data: this.isSingle ? inserted[0] : inserted, error: null };
        }

        let filteredItems = [...items];

        const matchField = (item, field, filterType, filterValue) => {
            let val;
            if (field.includes('->>')) {
                const parts = field.split('->>');
                const objName = parts[0];
                const propName = parts[1];
                if (item[objName] && typeof item[objName] === 'object') {
                    val = item[objName][propName];
                } else if (item[objName] && typeof item[objName] === 'string') {
                    try {
                        const parsed = JSON.parse(item[objName]);
                        val = parsed[propName];
                    } catch (e) {}
                }
            } else {
                val = item[field];
            }

            if (val === undefined || val === null) return false;

            const strVal = String(val).toLowerCase();
            const strFilter = String(filterValue).toLowerCase();

            if (filterType === 'eq') {
                return strVal === strFilter;
            } else if (filterType === 'ilike') {
                const cleanFilter = strFilter.replace(/%/g, '');
                return strVal.includes(cleanFilter);
            }
            return false;
        };

        for (let filter of this.filters) {
            if (filter.type === 'eq') {
                filteredItems = filteredItems.filter(item => matchField(item, filter.field, 'eq', filter.value));
            } else if (filter.type === 'ilike') {
                filteredItems = filteredItems.filter(item => matchField(item, filter.field, 'ilike', filter.value));
            } else if (filter.type === 'filter') {
                if (filter.operator === 'ilike' || filter.operator === 'eq') {
                    filteredItems = filteredItems.filter(item => matchField(item, filter.field, filter.operator, filter.value));
                }
            } else if (filter.type === 'or') {
                const parts = filter.filterString.split(',');
                filteredItems = filteredItems.filter(item => {
                    return parts.some(part => {
                        const subparts = part.split('.');
                        if (subparts.length >= 3) {
                            const field = subparts[0];
                            const op = subparts[1];
                            const val = subparts.slice(2).join('.');
                            return matchField(item, field, op, val);
                        }
                        return false;
                    });
                });
            }
        }

        if (this.action === 'update') {
            const updateFields = this.actionData || {};
            const updated = [];
            for (let item of filteredItems) {
                const originalItem = items.find(x => x.id === item.id);
                if (originalItem) {
                    Object.assign(originalItem, updateFields);
                    originalItem.updated_at = new Date().toISOString();
                    updated.push(originalItem);
                }
            }
            saveAllItems(items);
            return { data: this.isSingle ? updated[0] : updated, error: null };
        }

        if (this.action === 'delete') {
            const deletedIds = new Set(filteredItems.map(x => x.id));
            const newItems = items.filter(x => !deletedIds.has(x.id));
            saveAllItems(newItems);
            return { data: null, error: null };
        }

        if (this.orderField) {
            filteredItems.sort((a, b) => {
                let valA = a[this.orderField] || '';
                let valB = b[this.orderField] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return this.orderAscending ? -1 : 1;
                if (valA > valB) return this.orderAscending ? 1 : -1;
                return 0;
            });
        }

        if (this.limitCount !== null) {
            filteredItems = filteredItems.slice(0, this.limitCount);
        }

        if (this.isCount) {
            return { count: filteredItems.length, data: null, error: null };
        }

        const data = this.isSingle ? (filteredItems[0] || null) : filteredItems;
        return { data, error: null };
    }
}

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE') || supabaseUrl.includes('lfaawqiyxdqrncwpvfib')) {
    console.warn('⚠️ Supabase credentials not found or invalid in .env. Defaulting to Local Database fallback.');
    useLocalDatabase = true;
}

const actualSupabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// Perform a fast DNS lookup to check if Supabase hostname is reachable
(async () => {
    if (!useLocalDatabase) {
        try {
            const urlObj = new URL(supabaseUrl);
            const dns = require('dns').promises;
            await dns.lookup(urlObj.hostname);
            console.log('✅ DNS check: Supabase host resolves.');
        } catch (e) {
            console.log('🔌 Supabase host not reachable. Falling back to Local Database.');
            useLocalDatabase = true;
        }
    }
})();

const supabase = new Proxy(actualSupabase, {
    get(target, prop, receiver) {
        if (useLocalDatabase) {
            if (prop === 'from') {
                return (table) => new LocalQueryBuilder(table);
            }
            if (prop === 'storage') {
                return {
                    from: (bucket) => ({
                        upload: async (fileName, buffer, options) => {
                            try {
                                const uploadDir = path.join(__dirname, 'public', 'uploads');
                                if (!fs.existsSync(uploadDir)) {
                                    fs.mkdirSync(uploadDir, { recursive: true });
                                }
                                fs.writeFileSync(path.join(uploadDir, fileName), buffer);
                                return { data: { path: fileName }, error: null };
                            } catch (e) {
                                return { data: null, error: e };
                            }
                        },
                        getPublicUrl: (fileName) => {
                            return { data: { publicUrl: `/uploads/${fileName}` } };
                        }
                    })
                };
            }
        }
        return Reflect.get(target, prop, receiver);
    }
});

function calculateExpiryDate(purchaseDateStr, periodStr) {
    if (!purchaseDateStr) return '';
    const date = new Date(purchaseDateStr);
    if (isNaN(date.getTime())) return '';

    const str = String(periodStr).toLowerCase();
    
    // 1. Try to find "ปี" or "year"
    let years = 0;
    const yearMatch = str.match(/(\d+)\s*(?:ปี|year)/i);
    if (yearMatch) {
        years = parseInt(yearMatch[1], 10);
    }

    // 2. Try to find "เดือน" or "month"
    let months = 0;
    const monthMatch = str.match(/(\d+)\s*(?:เดือน|month)/i);
    if (monthMatch) {
        months = parseInt(monthMatch[1], 10);
    }

    // 3. Fallback: if neither matched, but there is a plain number
    if (!yearMatch && !monthMatch) {
        const plainMatch = str.match(/(\d+)/);
        if (plainMatch) {
            years = parseInt(plainMatch[1], 10);
        }
    }

    date.setFullYear(date.getFullYear() + years);
    date.setMonth(date.getMonth() + months);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

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
    if (useLocalDatabase || !fs.existsSync(DATA_FILE) || !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE')) return;

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
const statusLabelsExcel = { pending: 'Pending', reviewing: 'Reviewing', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' };
const sevLabelsExcel = { 10: '10%', 50: '50%', 80: '80%', 100: '100%' };

function buildExcelWorkbook(claimsData) {
    const claims = claimsData.map(formatClaim);
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

    ws.getRow(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.border = { bottom: { style: 'medium', color: { argb: 'FFF59E0B' } } }; });
    ws.getRow(1).height = 28;

    const statusColors = { pending: 'FFFBBF24', reviewing: 'FF3B82F6', approved: 'FF10B981', rejected: 'FFEF4444', completed: 'FF8B5CF6' };
    claims.forEach(c => {
        const row = ws.addRow({ claimNumber: c.claimNumber, customerName: c.customer?.name || '', phone: c.customer?.phone || '', email: c.customer?.email || '', address: c.customer?.address || '', eqType: c.equipment?.type || '', brand: c.equipment?.brand || '', model: c.equipment?.model || '', serial: c.equipment?.serialNumber || '', purchaseDate: c.equipment?.purchaseDate || '', warranty: c.warranty?.number || '', warPeriod: c.warranty?.period || '', warExpiry: c.warranty?.expiryDate || '', problem: c.problem?.description || '', severity: sevLabelsExcel[c.problem?.severity] || c.problem?.severity || '', status: statusLabelsExcel[c.status] || c.status, createdAt: new Date(c.createdAt).toLocaleString('en-US'), updatedAt: new Date(c.updatedAt).toLocaleString('en-US'), imageCount: c.problem?.images?.length || 0 });
        const statusCell = row.getCell('status'); const sColor = statusColors[c.status]; if (sColor) { statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sColor } }; statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; } statusCell.alignment = { horizontal: 'center' };
        const sevCell = row.getCell('severity'); const sevColors = { 10: 'FF10B981', 50: 'FFFBBF24', 80: 'FFF97316', 100: 'FFEF4444' }; const sc = sevColors[c.problem?.severity]; if (sc) { sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } }; sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; } sevCell.alignment = { horizontal: 'center' };
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
    const eqCount = {}; claims.forEach(c => { eqCount[c.equipment?.type || 'Other'] = (eqCount[c.equipment?.type || 'Other'] || 0) + 1; });
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
    if (existingUser) return res.status(400).json({ success: false, message: 'This email is already in use' });

    const { error } = await supabase.from('users').insert([{ id: uuidv4(), name, email, phone, password, role: 'customer' }]);
    if (error) return res.status(500).json({ success: false, message: 'Server error occurred' });

    res.status(201).json({ success: true, message: 'Registration successful' });
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
        const avatars = getAvatars();
        const avatarUrl = avatars[user.email] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name || user.email)}&backgroundColor=b6e3f4`;
        return res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone, role: user.role, avatarUrl } });
    }

    if (username.includes('@')) {
        const { data: isRegistered } = await supabase.from('users').select('*').ilike('email', username).single();
        if (isRegistered) return res.status(401).json({ success: false, message: 'Invalid password for this account' });

        // Filter JSON column logic in Supabase using ->>
        const { data: customerClaims } = await supabase.from('claims')
            .select('customer')
            .filter('customer->>email', 'ilike', username)
            .limit(1);

        if (customerClaims && customerClaims.length > 0) {
            const cust = customerClaims[0].customer;
            const avatars = getAvatars();
            const avatarUrl = avatars[username] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(cust.name || username)}&backgroundColor=b6e3f4`;
            return res.json({ success: true, user: { name: cust.name, email: username, phone: cust.phone, role: 'customer', avatarUrl } });
        }
    }
    res.status(401).json({ success: false, message: 'Invalid username or password' });
});

app.put('/api/users/profile', async (req, res) => {
    let { email, name, phone, password, avatarUrl } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Please specify email' });
    }

    try {
        if (avatarUrl) {
            if (avatarUrl.startsWith('data:')) {
                const uploadedUrl = await uploadSingleImageToSupabase(avatarUrl);
                if (uploadedUrl) {
                    avatarUrl = uploadedUrl;
                } else {
                    return res.status(500).json({ success: false, message: 'Unable to upload profile picture' });
                }
            }
            const avatars = getAvatars();
            avatars[email] = avatarUrl;
            saveAvatars(avatars);
        }

        const updateData = { name, phone };
        if (password && password.trim() !== '') {
            updateData.password = password.trim();
        }

        let { data, error } = await supabase
            .from('users')
            .update(updateData)
            .ilike('email', email)
            .select('*');

        if (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({ success: false, message: 'Error updating user profile' });
        }

        if (!data || data.length === 0) {
            // Auto-create user record if they logged in via dynamic claims fallback
            const newRecord = {
                id: uuidv4(),
                name: name || email.split('@')[0],
                email: email,
                phone: phone || '',
                role: 'customer',
                password: password && password.trim() !== '' ? password.trim() : '1234'
            };
            const { data: insertedData, error: insertError } = await supabase
                .from('users')
                .insert([newRecord])
                .select('*');
            
            if (insertError) {
                console.error('Insert profile user error:', insertError);
                return res.status(500).json({ success: false, message: 'Error creating new user account' });
            }
            data = insertedData;
        }

        const updatedUser = data[0];
        const avatars = getAvatars();
        const finalAvatarUrl = avatars[updatedUser.email] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(updatedUser.name || updatedUser.email)}&backgroundColor=b6e3f4`;
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                avatarUrl: finalAvatarUrl
            }
        });
    } catch (err) {
        console.error('Update profile server error:', err);
        res.status(500).json({ success: false, message: 'Internal server error occurred' });
    }
});

app.post('/api/users/avatar', async (req, res) => {
    let { email, avatarUrl } = req.body;
    if (!email || !avatarUrl) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    try {
        if (avatarUrl.startsWith('data:')) {
            const uploadedUrl = await uploadSingleImageToSupabase(avatarUrl);
            if (!uploadedUrl) {
                return res.status(500).json({ success: false, message: 'Unable to upload profile picture' });
            }
            avatarUrl = uploadedUrl;
        }

        const avatars = getAvatars();
        avatars[email] = avatarUrl;
        saveAvatars(avatars);

        res.json({ success: true, message: 'Profile picture updated successfully', avatarUrl });
    } catch (err) {
        console.error('Set avatar error:', err);
        res.status(500).json({ success: false, message: 'Error updating profile picture' });
    }
});

app.get('/api/users/avatars', async (req, res) => {
    try {
        const { data: users, error } = await supabase.from('users').select('name, email');
        if (error) {
            console.error('Error fetching users for avatars mapping:', error);
            return res.status(500).json({ success: false, message: 'Error retrieving user avatars' });
        }

        const avatars = getAvatars();
        const avatarMapping = {};
        const nameMapping = {};
        
        // Default admin avatars and names
        avatarMapping['admin@solar.com'] = avatars['admin@solar.com'] || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin&backgroundColor=b6e3f4';
        nameMapping['admin@solar.com'] = 'System Admin';

        if (users) {
            users.forEach(user => {
                const avatar = avatars[user.email] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name || user.email)}&backgroundColor=b6e3f4`;
                avatarMapping[user.email] = avatar;
                avatarMapping[user.name] = avatar;
                nameMapping[user.email] = user.name;
            });
        }

        res.json({ success: true, avatars: avatarMapping, names: nameMapping });
    } catch (err) {
        console.error('Get avatars mapping error:', err);
        res.status(500).json({ success: false, message: 'Internal server error occurred' });
    }
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
    if (error) return res.status(500).json({ success: false, message: 'Error fetching claims data', error });

    const formattedData = claims.map(formatClaim);
    res.json({ success: true, data: formattedData, total: formattedData.length });
});

app.get('/api/claims/:id', async (req, res) => {
    const { data: claim, error } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (error || !claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    res.json({ success: true, data: formatClaim(claim) });
});

app.get('/api/notifications', async (req, res) => {
    const { email, role } = req.query;
    if (!email || !role) {
        return res.status(400).json({ success: false, message: 'Missing email or role' });
    }

    try {
        let query = supabase.from('claims').select('*');
        if (role === 'customer') {
            query = query.filter('customer->>email', 'ilike', email);
        }
        
        const { data: claims, error } = await query;
        if (error) throw error;

        const notifications = [];

        claims.forEach(c => {
            const formattedClaim = formatClaim(c);
            
            // 1. New claim creation notification
            notifications.push({
                id: `${formattedClaim.id}_new`,
                claimId: formattedClaim.id,
                claimNumber: formattedClaim.claimNumber,
                title: role === 'admin' ? `New Claim ${formattedClaim.claimNumber}` : `Claim ${formattedClaim.claimNumber} Submitted`,
                description: role === 'admin' 
                    ? `By ${formattedClaim.customer?.name || 'Customer'}` 
                    : `We have received your claim request and it is pending verification.`,
                date: formattedClaim.createdAt
            });

            // 2. Timeline status changes
            if (formattedClaim.timeline && formattedClaim.timeline.length > 1) {
                formattedClaim.timeline.slice(1).forEach((t, i) => {
                    const statusName = statusLabelsExcel[t.status] || t.status;
                    notifications.push({
                        id: `${formattedClaim.id}_status_${i}`,
                        claimId: formattedClaim.id,
                        claimNumber: formattedClaim.claimNumber,
                        title: `Claim ${formattedClaim.claimNumber} Status Changed`,
                        description: `New status: ${statusName} (${t.note || 'No details'})`,
                        date: t.date
                    });
                });
            }

            // 3. Notes notifications
            if (formattedClaim.notes && formattedClaim.notes.length > 0) {
                formattedClaim.notes.forEach((n, i) => {
                    const isOwnNote = role === 'admin' 
                        ? (n.author === 'System Admin' || n.author === 'admin' || n.author.toLowerCase().includes('admin')) 
                        : (n.author !== 'System Admin' && n.author !== 'admin' && !n.author.toLowerCase().includes('admin'));

                    if (!isOwnNote) {
                        notifications.push({
                            id: `${formattedClaim.id}_note_${i}`,
                            claimId: formattedClaim.id,
                            claimNumber: formattedClaim.claimNumber,
                            title: `New message on Claim ${formattedClaim.claimNumber}`,
                            description: `"${n.text.length > 40 ? n.text.slice(0, 40) + '...' : n.text}" by ${n.author}`,
                            date: n.createdAt
                        });
                    }
                });
            }
        });

        // Sort notifications by date descending
        notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Limit to top 20 notifications
        const topNotifications = notifications.slice(0, 20);

        res.json({ success: true, data: topNotifications });
    } catch (err) {
        console.error('Notifications Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
    }
});

app.get('/api/claims/:id/pdf', async (req, res) => {
    const { id } = req.params;
    let browser;
    try {
        const { data: claim, error } = await supabase.from('claims').select('claim_number').eq('id', id).single();
        if (error || !claim) {
            return res.status(404).send('Claim not found');
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
        res.status(500).send('Failed to generate PDF');
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

    const purchaseDate = req.body.equipment ? req.body.equipment.purchaseDate : '';
    const period = req.body.warranty ? req.body.warranty.period : '';
    let expiryDate = req.body.warranty ? req.body.warranty.expiryDate : '';
    if (!expiryDate || expiryDate === '') {
        expiryDate = calculateExpiryDate(purchaseDate, period);
    }

    const newClaim = {
        id: uuidv4(),
        claim_number: `CLM-${String(maxNum + 1).padStart(7, '0')}`,
        customer: req.body.customer,
        equipment: req.body.equipment,
        warranty: {
            number: req.body.warranty ? req.body.warranty.number : '',
            period: req.body.warranty ? req.body.warranty.period : '',
            expiryDate: expiryDate
        },
        problem: req.body.problem,
        status: 'pending',
        timeline: [{ status: 'pending', date: new Date().toISOString(), note: 'Claim submitted successfully' }],
        notes: []
    };

    const { data, error } = await supabase.from('claims').insert([newClaim]).select().single();
    if (error) return res.status(500).json({ success: false, message: 'Error saving data', error });
    res.status(201).json({ success: true, data: formatClaim(data) });
});

app.put('/api/claims/:id', async (req, res) => {
    const { data: currentClaim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!currentClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    // Upload any new base64 images if problem is updated
    let problemUpdates = req.body.problem || currentClaim.problem;
    if (req.body.problem && req.body.problem.images) {
        problemUpdates.images = await uploadImagesToSupabase(req.body.problem.images);
    }

    const equipment = req.body.equipment || currentClaim.equipment;
    const warranty = req.body.warranty || currentClaim.warranty;
    const purchaseDate = equipment ? equipment.purchaseDate : '';
    const period = warranty ? warranty.period : '';
    let expiryDate = warranty ? warranty.expiryDate : '';
    if (!expiryDate || expiryDate === '') {
        expiryDate = calculateExpiryDate(purchaseDate, period);
    }

    const updates = {
        customer: req.body.customer || currentClaim.customer,
        equipment: equipment,
        warranty: {
            number: warranty ? warranty.number : '',
            period: warranty ? warranty.period : '',
            expiryDate: expiryDate
        },
        problem: problemUpdates,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('claims').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ success: false, message: 'Error saving data' });
    res.json({ success: true, data: formatClaim(data) });
});

app.patch('/api/claims/:id/status', async (req, res) => {
    const labels = { pending: 'Pending', reviewing: 'Reviewing', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' };
    const { data: claim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const newTimeline = [...(claim.timeline || []), {
        status: req.body.status,
        date: new Date().toISOString(),
        note: req.body.note || `Status updated to: ${labels[req.body.status] || req.body.status}`
    }];

    const { data, error } = await supabase.from('claims').update({
        status: req.body.status,
        timeline: newTimeline,
        updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();

    if (error) return res.status(500).json({ success: false, message: 'Error saving data' });
    res.json({ success: true, data: formatClaim(data) });
});

app.post('/api/claims/:id/notes', async (req, res) => {
    const { data: claim } = await supabase.from('claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    let imageUrl = null;
    if (req.body.image) {
        try {
            const uploaded = await uploadImagesToSupabase([req.body.image]);
            if (uploaded && uploaded.length > 0) {
                imageUrl = uploaded[0];
            }
        } catch (uploadErr) {
            console.error('Failed to upload chat image to Supabase:', uploadErr);
        }
    }

    const note = { 
        id: uuidv4(), 
        text: req.body.text, 
        author: req.body.author || 'Admin', 
        image: imageUrl, 
        createdAt: new Date().toISOString() 
    };
    const newNotes = [...(claim.notes || []), note];

    const { data, error } = await supabase.from('claims').update({
        notes: newNotes,
        updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();

    if (error) return res.status(500).json({ success: false, message: 'Error saving data' });
    res.json({ success: true, data: note });
});

app.delete('/api/claims/:id', async (req, res) => {
    const { error } = await supabase.from('claims').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: 'Error deleting claim' });
    res.json({ success: true, message: 'Claim deleted successfully' });
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
        const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
        const avgResolutionDays = resolvedCount > 0 ? (totalDurationMs / (1000 * 60 * 60 * 24) / resolvedCount).toFixed(1) : '0.0';

        res.json({ success: true, data: { stats: s, equipmentStats: eqStats, monthlyStats: monthly, severityStats: sevStats, avgResolutionDays } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving statistics' });
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
        res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
    }
});

app.post('/api/import/excel', async (req, res) => {
    const { fileData, fileName } = req.body;
    if (!fileData) {
        return res.status(400).json({ success: false, message: 'No uploaded file data found' });
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
            ws = workbook.getWorksheet('Claims List') || workbook.getWorksheet(1);
        }

        if (!ws) {
            return res.status(400).json({ success: false, message: isCsv ? 'Unable to read CSV file' : 'Worksheet "Claims List" not found in Excel file' });
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

            let finalExpiry = warExpiry;
            if (!finalExpiry || finalExpiry === '') {
                finalExpiry = calculateExpiryDate(purchaseDate, warPeriod);
            }

            claimsToInsert.push({
                id: uuidv4(),
                claim_number: claimNumber,
                customer: { name: customerName, phone, email, address },
                equipment: { type: eqType, brand, model, serialNumber: serial, purchaseDate },
                warranty: { number: warNumber, period: warPeriod, expiryDate: finalExpiry },
                problem: { description: problemDesc, severity, images: [] },
                status: status,
                timeline: [{ status: status, date: createdAt, note: 'Claim imported from Excel file' }],
                notes: [],
                created_at: createdAt,
                updated_at: createdAt
            });
        });

        if (claimsToInsert.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid claims found in Excel file' });
        }

        // Upsert into Supabase on claim_number conflict
        const { error } = await supabase.from('claims').upsert(claimsToInsert, { onConflict: 'claim_number' });
        if (error) {
            console.error('Supabase Import Upsert Error:', error);
            return res.status(500).json({ success: false, message: 'Error saving data to the database' });
        }

        // Fetch all claims to sync to Excel cache
        const { data: allClaims, error: fetchErr } = await supabase.from('claims').select('*').order('created_at', { ascending: false });
        if (!fetchErr && allClaims) {
            await syncToExcel(allClaims);
        }

        res.json({ success: true, message: 'Data imported successfully', count: claimsToInsert.length });
    } catch (err) {
        console.error('Import excel API error:', err);
        res.status(500).json({ success: false, message: 'Unable to process Excel file' });
    }
});

app.listen(PORT, () => {
    console.log(`🌞 Solar Claim System running at http://localhost:${PORT}`);
});
