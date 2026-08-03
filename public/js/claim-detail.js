// === Claim Detail JS ===
const statusLabels = { pending:'Pending', reviewing:'Reviewing', approved:'Approved', rejected:'Rejected', completed:'Completed' };
const sevLabels = { low:'🟢 Low', medium:'🟡 Medium', high:'🟠 High', critical:'🔴 Critical', 10: '1-10% - Normal Functioning', 50: '11-50% - Partially Functioning', 80: '51-80% - Mostly Non-Functioning', 100: '81-100% - Non-Functioning / Dangerous' };
let currentClaim = null;
let userAvatars = {};
let userNames = {};

async function loadUserAvatars() {
    try {
        const res = await fetch('/api/users/avatars');
        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                userAvatars = json.avatars || {};
                userNames = json.names || {};
            }
        }
    } catch (e) {
        console.error('Failed to load user avatars mapping:', e);
    }
}

const currentUser = JSON.parse(localStorage.getItem('solar_user'));
if (!currentUser) { window.location.href = '/'; }

function initNavbar() {
    if (document.getElementById('userName')) document.getElementById('userName').textContent = currentUser.name;
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Customer';
    if (document.getElementById('userAvatar')) {
        const avatarSrc = currentUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.name || currentUser.email)}&backgroundColor=b6e3f4`;
        document.getElementById('userAvatar').innerHTML = `<img src="${avatarSrc}" class="avatar-img" alt="Avatar">`;
    }
}
initNavbar();

function showToast(msg, type='success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3000);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function formatDateOnly(d) {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const monthIndex = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const dateObj = new Date(year, monthIndex, day);
        return dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    const dateObj = new Date(d);
    if (isNaN(dateObj)) return d;
    return dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
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
    document.getElementById('claimTitle').textContent = `Claim ${c.claimNumber}`;
    document.getElementById('claimSubtitle').textContent = `Submitted on ${formatDate(c.createdAt)}`;
    document.getElementById('currentStatus').innerHTML = `<span class="badge badge-${c.status}" style="font-size:0.9rem;padding:6px 16px;">${statusLabels[c.status]}</span>`;

    // Action buttons based on status (Admin only)
    let btns = '';
    if (currentUser.role === 'admin') {
        if (c.status === 'pending') {
            btns = `<button class="btn btn-primary btn-sm" onclick="openStatusModal('reviewing','Reviewing')">🔍 Start Review</button>`;
        } else if (c.status === 'reviewing') {
            btns = `<button class="btn btn-success btn-sm" onclick="openStatusModal('approved','Approved')">✅ Approve</button>
                     <button class="btn btn-danger btn-sm" onclick="openStatusModal('rejected','Rejected')">❌ Reject</button>`;
        } else if (c.status === 'approved') {
            btns = `<button class="btn btn-primary btn-sm" onclick="openStatusModal('completed','Completed')">🏁 Complete Case</button>`;
        }
        
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-flex';
        }
        const printBtn = document.getElementById('printPdfBtn');
        if (printBtn) {
            printBtn.style.display = 'inline-flex';
        }
    }
    document.getElementById('actionButtons').innerHTML = btns;

    // Customer
    const currentCustName = userNames[c.customer.email] || c.customer.name;
    document.getElementById('customerInfo').innerHTML =
        detailRow('Name', currentCustName) + detailRow('Phone', c.customer.phone) +
        detailRow('Email', c.customer.email) + detailRow('Address', c.customer.address);

    // Equipment
    document.getElementById('equipmentInfo').innerHTML =
        detailRow('Type', c.equipment.type) + detailRow('Brand', c.equipment.brand) +
        detailRow('Model', c.equipment.model) + detailRow('Serial No.', c.equipment.serialNumber) +
        detailRow('Purchase Date', formatDateOnly(c.equipment.purchaseDate));

    // Warranty
    document.getElementById('warrantyInfo').innerHTML =
        detailRow('Warranty Cert No.', c.warranty.number) + detailRow('Period', c.warranty.period) +
        detailRow('Expiry Date', c.warranty.expiryDate);

    // Problem
    let problemHtml = detailRow('Damage Percentage', `<span class="severity severity-${c.problem.severity}">${sevLabels[c.problem.severity] || c.problem.severity}</span>`) +
        `<div style="margin-top:0.75rem;"><div class="detail-label" style="margin-bottom:4px;">Problem Description</div><p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">${c.problem.description}</p></div>`;

    // Images
    if (c.problem.images && c.problem.images.length > 0) {
        problemHtml += `<div style="margin-top:1rem;"><div class="detail-label" style="margin-bottom:8px;">📷 Attached Photos (${c.problem.images.length})</div><div class="image-gallery">`;
        c.problem.images.forEach((img, i) => {
            problemHtml += `<div class="image-gallery-item" onclick="openLightbox('${img}')"><img src="${img}" alt="Photo ${i+1}"></div>`;
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
    document.getElementById('printEqPurchase').textContent = formatDateOnly(c.equipment.purchaseDate);

    document.getElementById('printWarNum').textContent = c.warranty.number || '-';
    document.getElementById('printWarExpiry').textContent = formatDateOnly(c.warranty.expiryDate);
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
    document.getElementById('printPrintedAt').textContent = new Date().toLocaleString('en-US');
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
        Generating PDF...
    `;
    
    try {
        const element = document.getElementById('printArea');
        if (!element) throw new Error('Print area element not found');

        document.getElementById('printPrintedAt').textContent = new Date().toLocaleString('en-US');

        const opt = {
            margin:       10,
            filename:     `Claim-Request-${currentClaim.claimNumber || currentClaim.claim_number || 'UNKNOWN'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                onclone: (clonedDoc) => {
                    const clonedArea = clonedDoc.getElementById('printArea');
                    if (clonedArea) {
                        clonedArea.style.display = 'block';
                        clonedArea.style.position = 'relative';
                        clonedArea.style.visibility = 'visible';
                        clonedArea.style.padding = '10px';
                        clonedArea.style.backgroundColor = '#ffffff';
                    }
                }
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().from(element).set(opt).save();

        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        downloadBtn.innerHTML = originalText;
    } catch (e) {
        console.error(e);
        showToast('Failed to download PDF', 'error');
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        downloadBtn.innerHTML = originalText;
    }
}

window.selectedChatImageBase64 = null;

function handleChatImageSelection() {
    const fileInput = document.getElementById('chatImageFile');
    const previewContainer = document.getElementById('chatImagePreview');
    const previewName = document.getElementById('chatImageName');
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size must not exceed 5MB', 'error');
            fileInput.value = '';
            return;
        }

        previewName.textContent = `📷 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
        previewContainer.style.display = 'flex';

        const reader = new FileReader();
        reader.onload = function(e) {
            selectedChatImageBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearChatImageAttachment() {
    document.getElementById('chatImageFile').value = '';
    document.getElementById('chatImagePreview').style.display = 'none';
    selectedChatImageBase64 = null;
}

function handleChatEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNote();
    }
}

function renderNotes(notes) {
    const el = document.getElementById('notesList');
    if (!notes.length) { 
        el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;margin-top:2.5rem;width:100%;">💬 No conversation history found for this claim</p>'; 
        return; 
    }
    
    // Get customer email for this claim
    const customerEmail = currentClaim && currentClaim.customer ? currentClaim.customer.email : '';
    
    el.innerHTML = notes.map(n => {
        const isNoteAdmin = String(n.author).toLowerCase().includes('admin');
        
        // Determine alignment based on active session role
        const isSentByMe = currentUser.role === 'admin' ? isNoteAdmin : !isNoteAdmin;
        const wrapperClass = isSentByMe ? 'sent' : 'received';
        
        // Determine correct display name and avatar dynamically
        let displayName = n.author;
        let avatarUrl = '';
        
        if (isNoteAdmin) {
            displayName = userNames['admin@solar.com'] || 'System Admin';
            avatarUrl = userAvatars['admin@solar.com'] || `https://api.dicebear.com/7.x/adventurer/svg?seed=Admin&backgroundColor=b6e3f4`;
        } else if (customerEmail) {
            displayName = userNames[customerEmail] || n.author;
            avatarUrl = userAvatars[customerEmail] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(n.author)}&backgroundColor=b6e3f4`;
        } else {
            avatarUrl = userAvatars[n.author] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(n.author)}&backgroundColor=b6e3f4`;
        }
        
        let imageHtml = '';
        if (n.image) {
            imageHtml = `<img src="${n.image}" class="chat-bubble-image" onclick="openLightbox('${n.image}')" alt="Attached Photo">`;
        }

        const date = new Date(n.createdAt);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        const displayTime = `${timeStr} | ${dateStr}`;

        return `
            <div class="chat-bubble-wrapper ${wrapperClass}">
                <img src="${avatarUrl}" class="chat-avatar" alt="Avatar">
                <div class="chat-bubble-content">
                    <div class="chat-bubble-header">
                        <span class="chat-author">${displayName}</span>
                        <span class="chat-date">${displayTime}</span>
                    </div>
                    <div class="chat-bubble">
                        <div>${n.text || ''}</div>
                        ${imageHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Scroll to the bottom of message list
    setTimeout(() => {
        el.scrollTop = el.scrollHeight;
    }, 50);
}

async function addNote() {
    const inputEl = document.getElementById('newNote');
    const sendBtn = document.getElementById('chatSendBtn');
    const text = inputEl.value.trim();
    
    if (!text && !selectedChatImageBase64) return;
    
    inputEl.disabled = true;
    sendBtn.disabled = true;
    const originalBtnText = sendBtn.textContent;
    sendBtn.textContent = 'Sending...';

    try {
        const payload = {
            text: text || (selectedChatImageBase64 ? 'Sent an image attachment' : ''),
            author: currentUser.name,
            image: selectedChatImageBase64
        };

        const res = await fetch(`/api/claims/${currentClaim.id}/notes`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            inputEl.value = '';
            clearChatImageAttachment();
            showToast('Message sent successfully');
            await loadClaim();
        } else {
            showToast('Failed to send message', 'error');
        }
    } catch (e) { 
        showToast('Connection error occurred', 'error'); 
    } finally {
        inputEl.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = originalBtnText;
        inputEl.focus();
    }
}

function openStatusModal(newStatus, label) {
    document.getElementById('modalNewStatus').value = newStatus;
    document.getElementById('modalTitle').textContent = `Confirm ${label}`;
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
            showToast('Status updated successfully');
            closeModal();
            loadClaim();
        }
    } catch (e) { showToast('An error occurred', 'error'); }
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

async function initPage() {
    await loadUserAvatars();
    await loadClaim();
}
initPage();
