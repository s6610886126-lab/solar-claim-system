// === Claim Detail JS ===
const statusLabels = { pending:'รอดำเนินการ', reviewing:'กำลังตรวจสอบ', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ', completed:'เสร็จสิ้น' };
const sevLabels = { low:'🟢 ต่ำ', medium:'🟡 ปานกลาง', high:'🟠 สูง', critical:'🔴 วิกฤต', 10: '1-10% - ใช้งานได้ปกติ', 50: '11-50% - ใช้งานได้บางส่วน', 80: '51-80% - ใช้งานไม่ได้เป็นส่วนใหญ่', 100: '81-100% - ใช้งานไม่ได้ / อันตราย' };
let currentClaim = null;

const currentUser = JSON.parse(localStorage.getItem('solar_user'));
if (!currentUser) { window.location.href = '/'; }

function initNavbar() {
    if (document.getElementById('userName')) document.getElementById('userName').textContent = currentUser.name;
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Customer';
    if (document.getElementById('userAvatar')) document.getElementById('userAvatar').innerHTML = `<img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.email || currentUser.name)}&backgroundColor=b6e3f4" class="avatar-img" alt="Avatar">`;
}
initNavbar();

function logout() {
    localStorage.removeItem('solar_user');
    window.location.href = '/';
}

function showToast(msg, type='success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3000);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('th-TH', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function detailRow(label, value) {
    return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value || '-'}</span></div>`;
}

async function loadClaim() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) { window.location.href = '/dashboard'; return; }

    try {
        const res = await fetch(`/api/claims/${id}`);
        if (!res.ok) { window.location.href = '/dashboard'; return; }
        const { data } = await res.json();
        
        // Security: Check if customer can view this claim
        if (currentUser.role === 'customer' && data.customer.email.toLowerCase() !== currentUser.email.toLowerCase()) {
            window.location.href = '/dashboard';
            return;
        }

        currentClaim = data;
        renderClaim(data);
    } catch (e) { console.error(e); }
}

function renderClaim(c) {
    document.getElementById('claimTitle').textContent = `เคลม ${c.claimNumber}`;
    document.getElementById('claimSubtitle').textContent = `สร้างเมื่อ ${formatDate(c.createdAt)}`;
    document.getElementById('currentStatus').innerHTML = `<span class="badge badge-${c.status}" style="font-size:0.9rem;padding:6px 16px;">${statusLabels[c.status]}</span>`;

    // Action buttons based on status (Admin only)
    let btns = '';
    if (currentUser.role === 'admin') {
        if (c.status === 'pending') {
            btns = `<button class="btn btn-primary btn-sm" onclick="openStatusModal('reviewing','ตรวจสอบ')">🔍 เริ่มตรวจสอบ</button>`;
        } else if (c.status === 'reviewing') {
            btns = `<button class="btn btn-success btn-sm" onclick="openStatusModal('approved','อนุมัติ')">✅ อนุมัติ</button>
                     <button class="btn btn-danger btn-sm" onclick="openStatusModal('rejected','ไม่อนุมัติ')">❌ ไม่อนุมัติ</button>`;
        } else if (c.status === 'approved') {
            btns = `<button class="btn btn-primary btn-sm" onclick="openStatusModal('completed','เสร็จสิ้น')">🏁 เสร็จสิ้น</button>`;
        }
        
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-flex';
        }
    }
    document.getElementById('actionButtons').innerHTML = btns;

    // Customer
    document.getElementById('customerInfo').innerHTML =
        detailRow('ชื่อ', c.customer.name) + detailRow('โทร', c.customer.phone) +
        detailRow('อีเมล', c.customer.email) + detailRow('ที่อยู่', c.customer.address);

    // Equipment
    document.getElementById('equipmentInfo').innerHTML =
        detailRow('ประเภท', c.equipment.type) + detailRow('ยี่ห้อ', c.equipment.brand) +
        detailRow('รุ่น', c.equipment.model) + detailRow('Serial No.', c.equipment.serialNumber) +
        detailRow('วันที่ซื้อ', c.equipment.purchaseDate);

    // Warranty
    document.getElementById('warrantyInfo').innerHTML =
        detailRow('เลขที่ใบรับประกัน', c.warranty.number) + detailRow('ระยะเวลา', c.warranty.period) +
        detailRow('หมดอายุ', c.warranty.expiryDate);

    // Problem
    let problemHtml = detailRow('เปอร์เซ็นความเสียหาย', `<span class="severity severity-${c.problem.severity}">${sevLabels[c.problem.severity] || c.problem.severity}</span>`) +
        `<div style="margin-top:0.75rem;"><div class="detail-label" style="margin-bottom:4px;">คำอธิบายปัญหา</div><p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">${c.problem.description}</p></div>`;

    // Images
    if (c.problem.images && c.problem.images.length > 0) {
        problemHtml += `<div style="margin-top:1rem;"><div class="detail-label" style="margin-bottom:8px;">📷 รูปภาพแนบ (${c.problem.images.length} รูป)</div><div class="image-gallery">`;
        c.problem.images.forEach((img, i) => {
            problemHtml += `<div class="image-gallery-item" onclick="openLightbox('${img}')"><img src="${img}" alt="รูปที่ ${i+1}"></div>`;
        });
        problemHtml += `</div></div>`;
    }
    document.getElementById('problemInfo').innerHTML = problemHtml;

    // Timeline
    const tl = document.getElementById('timeline');
    tl.innerHTML = c.timeline.map(t => `
        <div class="timeline-item ${t.status}">
            <div class="timeline-date">${formatDate(t.date)}</div>
            <div class="timeline-status">${statusLabels[t.status] || t.status}</div>
            <div class="timeline-note">${t.note}</div>
        </div>
    `).join('');

    // Notes
    renderNotes(c.notes);

    // Hide add note for customer if needed (or keep it for communication)
    const noteInputSec = document.querySelector('.note-input-section');
    if (noteInputSec && currentUser.role === 'customer') {
        noteInputSec.style.display = 'none';
    }

    // Populate Print Area
    document.getElementById('printClaimNumber').textContent = c.claimNumber;
    document.getElementById('printClaimDate').textContent = formatDate(c.createdAt);
    document.getElementById('printClaimStatus').textContent = statusLabels[c.status] || c.status;

    document.getElementById('printCustName').textContent = c.customer.name;
    document.getElementById('printCustPhone').textContent = c.customer.phone;
    document.getElementById('printCustEmail').textContent = c.customer.email || '-';
    document.getElementById('printCustAddress').textContent = c.customer.address;

    document.getElementById('printEqType').textContent = c.equipment.type;
    document.getElementById('printEqBrandModel').textContent = `${c.equipment.brand} ${c.equipment.model || ''}`;
    document.getElementById('printEqSerial').textContent = c.equipment.serialNumber;
    document.getElementById('printEqPurchase').textContent = c.equipment.purchaseDate ? formatDate(c.equipment.purchaseDate) : '-';

    document.getElementById('printWarNum').textContent = c.warranty.number || '-';
    document.getElementById('printWarExpiry').textContent = c.warranty.expiryDate ? formatDate(c.warranty.expiryDate) : '-';
    document.getElementById('printWarPeriod').textContent = c.warranty.period || '-';

    // Clear severity icons/emojis for official print
    const cleanSev = (sevLabels[c.problem.severity] || c.problem.severity)
        .replace('🟢', '')
        .replace('🟡', '')
        .replace('🟠', '')
        .replace('🔴', '')
        .trim();
    document.getElementById('printSeverity').textContent = cleanSev;
    document.getElementById('printProblemDesc').textContent = c.problem.description;

    const printTimeline = document.getElementById('printTimelineRows');
    printTimeline.innerHTML = c.timeline.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><strong>${statusLabels[t.status] || t.status}</strong></td>
            <td>${t.note}</td>
        </tr>
    `).join('');
}

function exportPDF() {
    document.getElementById('printPrintedAt').textContent = new Date().toLocaleString('th-TH');
    window.print();
}

async function downloadPDF() {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn || !currentClaim) return;
    
    const originalText = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.7';
    downloadBtn.innerHTML = `
        <svg class="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        กำลังสร้าง PDF...
    `;
    
    try {
        window.location.href = `/api/claims/${currentClaim.id}/pdf`;
        
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';
            downloadBtn.innerHTML = originalText;
        }, 4000);
    } catch (e) {
        console.error(e);
        showToast('เกิดข้อผิดพลาดในการดาวน์โหลด PDF', 'error');
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        downloadBtn.innerHTML = originalText;
    }
}

function renderNotes(notes) {
    const el = document.getElementById('notesList');
    if (!notes.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">ยังไม่มีหมายเหตุ</p>'; return; }
    el.innerHTML = notes.map(n => `
        <div class="note-item">
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(n.author)}&backgroundColor=b6e3f4" class="note-avatar" alt="Avatar">
            <div class="note-content">
                <div class="note-header"><span class="note-author">${n.author}</span><span class="note-date">${formatDate(n.createdAt)}</span></div>
                <div class="note-text">${n.text}</div>
            </div>
        </div>
    `).join('');
}

async function addNote() {
    const text = document.getElementById('newNote').value.trim();
    if (!text) return;
    try {
        const res = await fetch(`/api/claims/${currentClaim.id}/notes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, author: currentUser.name })
        });
        if (res.ok) {
            document.getElementById('newNote').value = '';
            showToast('เพิ่มหมายเหตุเรียบร้อย');
            loadClaim();
        }
    } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

function openStatusModal(newStatus, label) {
    document.getElementById('modalNewStatus').value = newStatus;
    document.getElementById('modalTitle').textContent = `ยืนยันการ${label}`;
    document.getElementById('statusModal').classList.add('active');
}

function closeModal() { document.getElementById('statusModal').classList.remove('active'); }

async function confirmStatusChange() {
    const status = document.getElementById('modalNewStatus').value;
    const note = document.getElementById('modalNote').value;
    try {
        const res = await fetch(`/api/claims/${currentClaim.id}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, note })
        });
        if (res.ok) {
            showToast('อัปเดตสถานะเรียบร้อย');
            closeModal();
            loadClaim();
        }
    } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

// Lightbox
function openLightbox(src) {
    let lb = document.getElementById('lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightbox';
        lb.className = 'lightbox';
        lb.innerHTML = `<button class="lightbox-close" onclick="closeLightbox()">✕</button><img src="" alt="Preview">`;
        lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
        document.body.appendChild(lb);
    }
    lb.querySelector('img').src = src;
    lb.classList.add('active');
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('active');
}

loadClaim();
