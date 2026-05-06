// === Dashboard JS ===
const statusLabels = { pending:'รอดำเนินการ', reviewing:'กำลังตรวจสอบ', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ', completed:'เสร็จสิ้น' };
const sevLabels = { low:'ต่ำ', medium:'ปานกลาง', high:'สูง', critical:'วิกฤต' };

function showToast(msg, type='success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100px)'; setTimeout(()=>t.remove(),400); }, 3000);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' });
}

// === Session Management ===
const currentUser = JSON.parse(localStorage.getItem('solar_user'));
if (!currentUser) { 
    window.location.href = '/';
    // Stop execution
    throw new Error('Not authenticated');
}

function logout() {
    localStorage.removeItem('solar_user');
    window.location.href = '/';
}

function initDashboard() {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Customer';
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);

    if (currentUser.role !== 'admin') {
        // Hide admin-only sections
        document.getElementById('statsGrid').style.display = 'none';
        document.getElementById('chartsSection').style.display = 'none';
        document.getElementById('exportBtn').style.display = 'none';
        
        // Update header for customer
        const header = document.querySelector('.page-header');
        header.querySelector('h1').textContent = '📋 รายการเคลมของคุณ';
        header.querySelector('p').textContent = 'ติดตามสถานะการเคลมอุปกรณ์โซลาร์เซลล์ของคุณ';
        
        document.getElementById('tableTitle').style.display = 'none'; // Header already says it
    }
}
initDashboard();

// Animate counter
function animateCount(el, target) {
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current;
    }, 30);
}

// Load stats
async function loadStats() {
    try {
        const params = new URLSearchParams({ userRole: currentUser.role, userEmail: currentUser.email });
        const res = await fetch(`/api/stats?${params}`);
        const { data } = await res.json();
        const s = data.stats;

        animateCount(document.getElementById('statTotal'), s.total);
        animateCount(document.getElementById('statPending'), s.pending);
        animateCount(document.getElementById('statApproved'), s.approved);
        animateCount(document.getElementById('statRejected'), s.rejected);

        // Monthly bar chart
        const container = document.getElementById('monthlyChart');
        const maxCount = Math.max(...data.monthlyStats.map(m => m.count), 1);
        container.innerHTML = '';
        data.monthlyStats.forEach((m, i) => {
            const pct = (m.count / maxCount) * 100;
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-bar-wrapper';
            wrapper.innerHTML = `
                <div class="chart-bar-value">${m.count}</div>
                <div class="chart-bar" style="height:0%"></div>
                <div class="chart-bar-label">${m.month}</div>
            `;
            container.appendChild(wrapper);
            setTimeout(() => { wrapper.querySelector('.chart-bar').style.height = `${Math.max(pct, 5)}%`; }, 100 + i * 100);
        });

        // Donut chart
        drawDonut(data.equipmentStats, s.total);
    } catch (e) { console.error('Stats error:', e); }
}

function drawDonut(eqStats, total) {
    const canvas = document.getElementById('donutCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 360; canvas.height = 360;
    const cx = 180, cy = 180, outerR = 160, innerR = 110;
    const colors = ['#F59E0B','#F97316','#3B82F6','#10B981','#8B5CF6','#EF4444'];
    const entries = Object.entries(eqStats);
    let startAngle = -Math.PI / 2;

    document.getElementById('donutTotal').textContent = total;

    entries.forEach(([key, val], i) => {
        const slice = (val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
        ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        startAngle += slice;
    });

    const legend = document.getElementById('donutLegend');
    legend.innerHTML = '';
    entries.forEach(([key, val], i) => {
        legend.innerHTML += `<div class="donut-legend-item"><div class="donut-legend-color" style="background:${colors[i%colors.length]}"></div><span>${key}</span><span style="margin-left:auto;font-weight:700;">${val}</span></div>`;
    });
}

// Load claims table
async function loadClaims() {
    const status = document.getElementById('filterStatus').value;
    const equipment = document.getElementById('filterEquipment').value;
    const search = document.getElementById('searchInput').value;

    try {
        const params = new URLSearchParams();
        if (status !== 'all') params.append('status', status);
        if (equipment !== 'all') params.append('equipment', equipment);
        if (search) params.append('search', search);
        
        // Add user context
        params.append('userRole', currentUser.role);
        params.append('userEmail', currentUser.email);

        const res = await fetch(`/api/claims?${params}`);
        const { data } = await res.json();
        const tbody = document.getElementById('claimsTable');
        const empty = document.getElementById('emptyState');

        if (!data.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = data.map(c => `
            <tr class="claim-row">
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer"><strong style="color:var(--primary)">${c.claimNumber}</strong></td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer">${c.customer.name}</td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer">${c.equipment.type}</td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer">${c.equipment.brand}</td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer"><span class="severity severity-${c.problem.severity}">${sevLabels[c.problem.severity]}</span></td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer"><span class="badge badge-${c.status}">${statusLabels[c.status]}</span></td>
                <td onclick="window.location.href='/claim-detail?id=${c.id}'" style="cursor:pointer">${formatDate(c.createdAt)}</td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="openModal('${c.id}','${c.status}')" title="เปลี่ยนสถานะ" ${currentUser.role !== 'admin' ? 'style="display:none"' : ''}>⚙️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteClaim('${c.id}')" title="ลบ" style="color:var(--danger); ${currentUser.role !== 'admin' ? 'display:none' : ''}">🗑</button>
                    <button class="btn btn-ghost btn-sm" onclick="window.location.href='/claim-detail?id=${c.id}'" title="ดูรายละเอียด">👁️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error('Claims error:', e); }
}

function openModal(id, currentStatus) {
    document.getElementById('modalClaimId').value = id;
    document.getElementById('modalStatus').value = currentStatus;
    document.getElementById('statusModal').classList.add('active');
}

function closeModal() {
    document.getElementById('statusModal').classList.remove('active');
}

async function updateStatus() {
    const id = document.getElementById('modalClaimId').value;
    const status = document.getElementById('modalStatus').value;
    const note = document.getElementById('modalNote').value;

    try {
        const res = await fetch(`/api/claims/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, note })
        });
        if (res.ok) {
            showToast('อัปเดตสถานะเรียบร้อย');
            closeModal();
            loadClaims();
            loadStats();
        }
    } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

function deleteClaim(id) {
    document.getElementById('deleteClaimId').value = id;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

async function confirmDelete() {
    const id = document.getElementById('deleteClaimId').value;
    try {
        const res = await fetch(`/api/claims/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('ลบเคลมเรียบร้อย');
            closeDeleteModal();
            loadClaims();
            loadStats();
        } else {
            showToast('เกิดข้อผิดพลาดในการลบ', 'error');
        }
    } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

// Debounce search
let searchTimer;
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadClaims, 300);
});
document.getElementById('filterStatus').addEventListener('change', loadClaims);
document.getElementById('filterEquipment').addEventListener('change', loadClaims);

// Init
if (currentUser.role === 'admin') {
    loadStats();
}
loadClaims();
