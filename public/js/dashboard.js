// === Dashboard JS ===
const statusLabels = { pending:'รอดำเนินการ', reviewing:'กำลังตรวจสอบ', approved:'อนุมัติแล้ว', rejected:'ไม่อนุมัติ', completed:'เสร็จสิ้น' };
const sevLabels = { low:'ต่ำ', medium:'ปานกลาง', high:'สูง', critical:'วิกฤต', 10:'1-10%', 50:'11-50%', 80:'51-80%', 100:'81-100%' };

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

function initDashboard() {
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userRoleEl) userRoleEl.textContent = currentUser.role === 'admin' ? 'Administrator' : 'Customer';
    
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) {
        const avatarSrc = currentUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.name || currentUser.email)}&backgroundColor=b6e3f4`;
        userAvatarEl.innerHTML = `<img src="${avatarSrc}" class="avatar-img" alt="Avatar">`;
    }

    if (currentUser.role !== 'admin') {
        // Hide admin-only sections
        const chartsSection = document.getElementById('chartsSection');
        if (chartsSection) chartsSection.style.display = 'none';
        
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.style.display = 'none';
        
        const importBtn = document.getElementById('importBtn');
        if (importBtn) importBtn.style.display = 'none';
        
        const newItemsBadge = document.getElementById('newItemsBadge');
        if (newItemsBadge) newItemsBadge.style.display = 'none';
        
        // Update header for customer
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        if (heroTitle) heroTitle.innerHTML = 'ระบบจัดการ<br><span style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 8px rgba(245, 158, 11, 0.2));">เคลมของคุณ</span>';
        if (heroSubtitle) heroSubtitle.textContent = 'ติดตามสถานะการเคลมอุปกรณ์โซลาร์เซลล์ของคุณแบบเรียลไทม์';
        
        const tableTitle = document.getElementById('tableTitle');
        if (tableTitle) tableTitle.style.display = 'none';
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

        const statTotalEl = document.getElementById('statTotal');
        const statSuccessEl = document.getElementById('statSuccess');
        const statAvgTimeEl = document.getElementById('statAvgTime');
        const statResponseEl = document.getElementById('statResponse');

        if (statTotalEl) animateCount(statTotalEl, s.total);
        
        if (statSuccessEl) {
            const total = s.total || 0;
            const approved = s.approved || 0;
            const completed = s.completed || 0;
            const successRate = total > 0 ? Math.round(((approved + completed) / total) * 100) : 0;
            
            if (successRate === 0) {
                statSuccessEl.textContent = '0%';
            } else {
                let current = 0;
                const timer = setInterval(() => {
                    current += 3;
                    if (current >= successRate) { current = successRate; clearInterval(timer); }
                    statSuccessEl.textContent = `${current}%`;
                }, 30);
            }
        }

        if (statAvgTimeEl) {
            statAvgTimeEl.textContent = s.total > 0 ? `${data.avgResolutionDays || '0.0'} วัน` : '0 วัน';
        }
        if (statResponseEl) {
            statResponseEl.textContent = s.total > 0 ? '24 ชม.' : '0 ชม.';
        }

        // Monthly chart rendering (Chart.js or Fallback)
        const monthlyCanvas = document.getElementById('monthlyChartCanvas');
        if (monthlyCanvas && typeof Chart !== 'undefined') {
            const ctx = monthlyCanvas.getContext('2d');
            if (window.myMonthlyChart) window.myMonthlyChart.destroy();
            window.myMonthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.monthlyStats.map(m => m.month),
                    datasets: [{
                        label: 'จำนวนรายการเคลม',
                        data: data.monthlyStats.map(m => m.count),
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderColor: '#f59e0b',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        hoverBackgroundColor: '#fbbf24'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a3b8', stepSize: 1 }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        } else {
            // Fallback: Custom HTML bar chart if Chart.js is not loaded
            const container = document.getElementById('monthlyChart');
            if (container) {
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
            }
        }

        // Donut chart
        const canvas = document.getElementById('donutCanvas');
        if (canvas) {
            drawDonut(data.equipmentStats, s.total);
        }
    } catch (e) { console.error('Stats error:', e); }
}

function drawDonut(eqStats, total) {
    const canvas = document.getElementById('donutCanvas');
    if (!canvas) return;

    if (typeof Chart !== 'undefined') {
        const ctx = canvas.getContext('2d');
        if (window.myDonutChart) window.myDonutChart.destroy();
        
        const entries = Object.entries(eqStats);
        const labels = entries.map(([k, v]) => k);
        const counts = entries.map(([k, v]) => v);
        const colors = ['#F59E0B','#F97316','#3B82F6','#10B981','#8B5CF6','#EF4444'];

        document.getElementById('donutTotal').textContent = total;

        if (total === 0) {
            window.myDonutChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['ไม่มีข้อมูล'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#475569'],
                        borderWidth: 2,
                        borderColor: '#1e293b'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                }
            });
            const legend = document.getElementById('donutLegend');
            if (legend) legend.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:1rem;">ไม่มีข้อมูลอุปกรณ์</div>';
            return;
        }

        window.myDonutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, entries.length),
                    borderWidth: 2,
                    borderColor: '#1e293b',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const legend = document.getElementById('donutLegend');
        legend.innerHTML = '';
        entries.forEach(([key, val], i) => {
            const pct = total > 0 ? ((val / total) * 100).toFixed(0) : 0;
            legend.innerHTML += `<div class="donut-legend-item"><div class="donut-legend-color" style="background:${colors[i%colors.length]}"></div><span>${key}</span><span style="margin-left:auto;font-weight:700;">${val} (${pct}%)</span></div>`;
        });
        return;
    }

    // Fallback: Old Canvas API drawing
    const ctx = canvas.getContext('2d');
    canvas.width = 360; canvas.height = 360;
    const cx = 180, cy = 180, outerR = 160, innerR = 110;
    const colors = ['#F59E0B','#F97316','#3B82F6','#10B981','#8B5CF6','#EF4444'];
    const entries = Object.entries(eqStats);

    document.getElementById('donutTotal').textContent = total;

    if (total === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = '#475569';
        ctx.fill();
        
        const legend = document.getElementById('donutLegend');
        if (legend) legend.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:1rem;">ไม่มีข้อมูลอุปกรณ์</div>';
        return;
    }

    let startAngle = -Math.PI / 2;
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

// === Sorting State ===
let currentSortField = 'createdAt';
let currentSortOrder = 'desc';

function sortBy(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    
    const fields = ['claimNumber', 'customer', 'equipment', 'brand', 'severity', 'status', 'createdAt'];
    fields.forEach(f => {
        const indicator = document.getElementById(`sort-${f}`);
        if (indicator) {
            if (f === currentSortField) {
                indicator.textContent = currentSortOrder === 'asc' ? ' ▲' : ' ▼';
                indicator.style.color = 'var(--primary)';
            } else {
                indicator.textContent = '';
                indicator.style.color = '';
            }
        }
    });

    loadClaims();
}

// Load claims table
async function loadClaims() {
    const filterStatusEl = document.getElementById('filterStatus');
    const filterEquipmentEl = document.getElementById('filterEquipment');
    const searchInputEl = document.getElementById('searchInput');

    // Safe status resolution for pill tabs
    const status = window.activeStatus || (filterStatusEl ? filterStatusEl.value : 'all');
    const equipment = filterEquipmentEl ? filterEquipmentEl.value : 'all';
    const search = searchInputEl ? searchInputEl.value : '';

    const tbody = document.getElementById('claimsTable');
    const cardsContainer = document.getElementById('claimsListCards');
    const empty = document.getElementById('emptyState');

    if (!tbody && !cardsContainer) return; // Exit if not on claims-list pages

    // Dynamically update mockup pill tab count numbers
    const countAllEl = document.getElementById('countAll');
    const countPendingEl = document.getElementById('countPending');
    const countReviewingEl = document.getElementById('countReviewing');
    const countApprovedEl = document.getElementById('countApproved');
    const countRejectedEl = document.getElementById('countRejected');
    const countCompletedEl = document.getElementById('countCompleted');

    if (countAllEl) {
        const statsParams = new URLSearchParams({ userRole: currentUser.role, userEmail: currentUser.email });
        fetch(`/api/stats?${statsParams}`)
            .then(res => res.json())
            .then(({ data }) => {
                const s = data.stats;
                if (countAllEl) countAllEl.textContent = s.total;
                if (countPendingEl) countPendingEl.textContent = s.pending;
                if (countReviewingEl) countReviewingEl.textContent = s.reviewing;
                if (countApprovedEl) countApprovedEl.textContent = s.approved;
                if (countRejectedEl) countRejectedEl.textContent = s.rejected;
                if (countCompletedEl) countCompletedEl.textContent = s.completed;
            }).catch(err => console.error(err));
    }

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
        
        // Sort data array
        data.sort((a, b) => {
            let valA, valB;
            if (currentSortField === 'claimNumber') {
                valA = a.claimNumber;
                valB = b.claimNumber;
            } else if (currentSortField === 'customer') {
                valA = a.customer.name;
                valB = b.customer.name;
            } else if (currentSortField === 'equipment') {
                valA = a.equipment.type;
                valB = b.equipment.type;
            } else if (currentSortField === 'brand') {
                valA = a.equipment.brand;
                valB = b.equipment.brand;
            } else if (currentSortField === 'severity') {
                valA = parseInt(a.problem.severity) || 0;
                valB = parseInt(b.problem.severity) || 0;
            } else if (currentSortField === 'status') {
                valA = a.status;
                valB = b.status;
            } else if (currentSortField === 'createdAt') {
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
            } else {
                valA = a.createdAt;
                valB = b.createdAt;
            }

            if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        if (!data.length) {
            if (tbody) tbody.innerHTML = '';
            if (cardsContainer) cardsContainer.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        // 1. RENDER MOCKUP FLOATING CARDS
        if (cardsContainer) {
            cardsContainer.innerHTML = data.map(c => {
                // Determine CSS colors for status
                let colorClass = 'blue';
                let displayStatusText = 'กำลังดำเนินการ';
                
                if (c.status === 'pending') {
                    colorClass = 'orange';
                    displayStatusText = 'รอดำเนินการ';
                } else if (c.status === 'completed' || c.status === 'approved') {
                    colorClass = 'green';
                    displayStatusText = c.status === 'completed' ? 'เสร็จสิ้น' : 'อนุมัติแล้ว';
                } else if (c.status === 'rejected') {
                    colorClass = 'red';
                    displayStatusText = 'ไม่อนุมัติ';
                } else if (c.status === 'reviewing') {
                    colorClass = 'blue';
                    displayStatusText = 'กำลังดำเนินการ';
                }

                return `
                    <div class="claim-card">
                        <div class="claim-card-left" onclick="window.location.href='/claim-detail?id=${c.id}'">
                            <div class="claim-icon-box ${colorClass}">⚡</div>
                            <div class="claim-card-progress ${colorClass}"></div>
                        </div>
                        <div class="claim-card-mid" onclick="window.location.href='/claim-detail?id=${c.id}'">
                            <div class="claim-card-number-badge">${c.claimNumber}</div>
                            <div class="claim-card-title">${c.customer.name}</div>
                            <div class="claim-card-sub">${c.problem.description}</div>
                        </div>
                        <div class="claim-card-right">
                            <div class="claim-card-status-area" onclick="window.location.href='/claim-detail?id=${c.id}'">
                                <span class="claim-card-dot-badge ${colorClass}">${displayStatusText}</span>
                                <span class="claim-card-meta">${c.equipment.type}</span>
                            </div>
                            <div class="claim-card-date" onclick="window.location.href='/claim-detail?id=${c.id}'">
                                ${formatDate(c.createdAt)}
                            </div>
                            <div class="claim-card-actions">
                                <button class="btn btn-ghost btn-sm" onclick="openModal('${c.id}','${c.status}')" title="เปลี่ยนสถานะ" ${currentUser.role !== 'admin' ? 'style="display:none"' : ''}>⚙️</button>
                                <button class="btn btn-ghost btn-sm" onclick="deleteClaim('${c.id}')" title="ลบ" style="color:var(--danger); ${currentUser.role !== 'admin' ? 'display:none' : ''}">🗑</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 2. RENDER TRADITIONAL TABLE ROWS (Backup Compatibility)
        if (tbody) {
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
        }
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
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadClaims, 300);
    });
}

const filterStatus = document.getElementById('filterStatus');
if (filterStatus) {
    filterStatus.addEventListener('change', loadClaims);
}

const filterEquipment = document.getElementById('filterEquipment');
if (filterEquipment) {
    filterEquipment.addEventListener('change', loadClaims);
}

// Init
loadStats();
loadClaims();

// === Excel Import ===
function triggerImport() {
    document.getElementById('importFileInput').click();
}

async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx');
    const isCsv = file.name.endsWith('.csv');
    if (!isExcel && !isCsv) {
        showToast('กรุณาเลือกไฟล์ Excel (.xlsx) หรือ CSV (.csv) เท่านั้น', 'error');
        event.target.value = '';
        return;
    }

    const importBtn = document.getElementById('importBtn');
    const originalText = importBtn.innerHTML;
    importBtn.disabled = true;
    importBtn.innerHTML = '⏳ กำลังนำเข้าข้อมูล...';

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result.split(',')[1];
        
        try {
            const res = await fetch('/api/import/excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData: base64Data, fileName: file.name })
            });
            const result = await res.json();
            
            if (res.ok && result.success) {
                showToast(`นำเข้าข้อมูลสำเร็จ ${result.count} รายการ!`);
                loadClaims();
                if (currentUser.role === 'admin') {
                    loadStats();
                }
            } else {
                showToast(result.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล', 'error');
            }
        } catch (err) {
            console.error('Import error:', err);
            showToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        } finally {
            importBtn.disabled = false;
            importBtn.innerHTML = originalText;
            event.target.value = '';
        }
    };
    reader.readAsDataURL(file);
}

