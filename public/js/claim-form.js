// === Claim Form JS ===
let uploadedImages = [];

// === Session Management ===
const currentUser = JSON.parse(localStorage.getItem('solar_user'));
if (!currentUser) { window.location.href = '/'; }

function showToast(msg, type='success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3000);
}

// Auto-fill customer info
if (currentUser.role === 'customer') {
    document.getElementById('custName').value = currentUser.name;
    document.getElementById('custEmail').value = currentUser.email;
    // Optionally make them readonly for customers
    document.getElementById('custEmail').readOnly = true;
}

// === Image Upload ===
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const uploadPreview = document.getElementById('uploadPreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');

uploadZone.addEventListener('click', () => imageInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

imageInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    imageInput.value = '';
});

function handleFiles(files) {
    const remaining = 5 - uploadedImages.length;
    if (remaining <= 0) { showToast('อัปโหลดได้สูงสุด 5 รูป', 'error'); return; }

    const fileArr = Array.from(files).slice(0, remaining);
    fileArr.forEach(file => {
        if (!file.type.startsWith('image/')) { showToast(`${file.name} ไม่ใช่ไฟล์รูปภาพ`, 'error'); return; }
        if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} ขนาดเกิน 5MB`, 'error'); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImages.push(e.target.result);
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderPreviews() {
    uploadPreview.innerHTML = '';
    uploadedImages.forEach((img, i) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <img src="${img}" alt="รูปที่ ${i+1}">
            <button type="button" class="remove-btn" onclick="event.stopPropagation();removeImage(${i})">✕</button>
        `;
        uploadPreview.appendChild(item);
    });

    if (uploadedImages.length >= 5) {
        uploadPlaceholder.style.display = 'none';
    } else {
        uploadPlaceholder.style.display = '';
    }
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderPreviews();
}

// === Form Submit ===
document.getElementById('claimForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const payload = {
        customer: {
            name: document.getElementById('custName').value,
            phone: document.getElementById('custPhone').value,
            email: document.getElementById('custEmail').value,
            address: document.getElementById('custAddress').value
        },
        equipment: {
            type: document.getElementById('eqType').value,
            brand: document.getElementById('eqBrand').value,
            model: document.getElementById('eqModel').value,
            serialNumber: document.getElementById('eqSerial').value,
            purchaseDate: document.getElementById('eqPurchaseDate').value
        },
        warranty: {
            number: document.getElementById('warNumber').value,
            period: document.getElementById('warPeriod').value,
            expiryDate: ''
        },
        problem: {
            description: document.getElementById('probDesc').value,
            severity: document.getElementById('probSeverity').value,
            images: uploadedImages
        }
    };

    try {
        const res = await fetch('/api/claims', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const { data } = await res.json();
            showToast(`แจ้งเคลมสำเร็จ! เลขที่: ${data.claimNumber}`);
            setTimeout(() => { window.location.href = `/claim-detail?id=${data.id}`; }, 1500);
        } else {
            showToast('เกิดข้อผิดพลาดในการส่งเคลม', 'error');
        }
    } catch (e) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
});
