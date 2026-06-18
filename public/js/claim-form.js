// === Claim Form JS ===
let uploadedImages = [];
const DRAFT_KEY = 'solar_claim_draft';

// === Session Management ===
const currentUser = JSON.parse(localStorage.getItem('solar_user'));
if (!currentUser) { window.location.href = '/'; }

function initNavbar() {
    if (document.getElementById('userName')) document.getElementById('userName').textContent = currentUser.name;
    if (document.getElementById('userRole')) document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Customer';
    if (document.getElementById('userAvatar')) document.getElementById('userAvatar').innerHTML = `<img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.email || currentUser.name)}&backgroundColor=b6e3f4" class="avatar-img" alt="Avatar">`;
}
initNavbar();

// Initialize flatpickr to display DD/MM/YYYY while outputting YYYY-MM-DD
if (typeof flatpickr !== 'undefined') {
    flatpickr("#eqPurchaseDate", {
        altInput: true,
        altFormat: "d/m/Y",
        dateFormat: "Y-m-d",
        locale: "th"
    });
}

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

// Auto-fill customer info
function autoFill() {
    if (currentUser.role === 'customer') {
        if (currentUser.name) document.getElementById('custName').value = currentUser.name;
        if (currentUser.email) document.getElementById('custEmail').value = currentUser.email;
        if (currentUser.phone) document.getElementById('custPhone').value = currentUser.phone;
        
        // Optionally make them readonly for customers
        document.getElementById('custEmail').readOnly = true;
    }
}

// === Custom Value Helpers for Select Elements ===
function getBrandValue() {
    const brandSel = document.getElementById('eqBrand').value;
    if (brandSel === 'custom') {
        return document.getElementById('eqBrandCustom').value;
    }
    return brandSel;
}

function getModelValue() {
    const modelSel = document.getElementById('eqModel').value;
    if (modelSel === 'custom') {
        return document.getElementById('eqModelCustom').value;
    }
    return modelSel;
}

// === Draft Management ===
function saveDraft() {
    const draft = {
        customer: {
            name: document.getElementById('custName').value,
            phone: document.getElementById('custPhone').value,
            email: document.getElementById('custEmail').value,
            address: document.getElementById('custAddress').value
        },
        equipment: {
            type: document.getElementById('eqType').value,
            brand: getBrandValue(),
            model: getModelValue(),
            serialNumber: document.getElementById('eqSerial').value,
            purchaseDate: document.getElementById('eqPurchaseDate').value
        },
        warranty: {
            number: document.getElementById('warNumber').value,
            period: document.getElementById('warPeriod').value
        },
        problem: {
            description: document.getElementById('probDesc').value,
            severity: document.getElementById('probSeverity').value
        }
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
    const draftJson = localStorage.getItem(DRAFT_KEY);
    if (!draftJson) return;

    try {
        const draft = JSON.parse(draftJson);
        // Customer
        if (draft.customer.name && !document.getElementById('custName').value) document.getElementById('custName').value = draft.customer.name;
        if (draft.customer.phone && !document.getElementById('custPhone').value) document.getElementById('custPhone').value = draft.customer.phone;
        if (draft.customer.email && !document.getElementById('custEmail').value) document.getElementById('custEmail').value = draft.customer.email;
        if (draft.customer.address) document.getElementById('custAddress').value = draft.customer.address;

        // Equipment
        if (draft.equipment.type) {
            document.getElementById('eqType').value = draft.equipment.type;
            if (typeof updateBrands === 'function') {
                updateBrands();
                setBrandAndModelValues(draft.equipment.brand, draft.equipment.model);
            }
        }
        if (draft.equipment.serialNumber) document.getElementById('eqSerial').value = draft.equipment.serialNumber;
        if (draft.equipment.purchaseDate) document.getElementById('eqPurchaseDate').value = draft.equipment.purchaseDate;

        // Warranty
        if (draft.warranty.number) document.getElementById('warNumber').value = draft.warranty.number;
        if (draft.warranty.period) document.getElementById('warPeriod').value = draft.warranty.period;

        // Problem
        if (draft.problem.description) document.getElementById('probDesc').value = draft.problem.description;
        if (draft.problem.severity) document.getElementById('probSeverity').value = draft.problem.severity;
    } catch (e) {
        console.error('Failed to load draft', e);
    }
}

// Initial setup
autoFill();
loadDraft();

// Listen for changes to save draft
const formInputs = document.querySelectorAll('#claimForm input, #claimForm select, #claimForm textarea');
formInputs.forEach(input => {
    input.addEventListener('input', saveDraft);
});

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
            brand: getBrandValue(),
            model: getModelValue(),
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
            // Clear draft on success
            localStorage.removeItem(DRAFT_KEY);
            showToast(`แจ้งเคลมสำเร็จ! เลขที่: ${data.claimNumber}`);
            setTimeout(() => { window.location.href = `/claim-detail?id=${data.id}`; }, 1500);
        } else {
            showToast('เกิดข้อผิดพลาดในการส่งเคลม', 'error');
        }
    } catch (e) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
});

// === Dynamic Brand & Model Datalists ===
const brandModelMapping = {
    "Solar Panel": {
        brands: ["JinkoSolar", "Solis"],
        models: {
            "JinkoSolar": ["Tiger Neo N-type", "Tiger Pro", "JKM-400M", "JKM-440N"],
            "Solis": ["Solis Panel 400W", "Solis Panel 440W", "Solis Panel 550W"]
        }
    },
    "Inverter": {
        brands: ["Solis"],
        models: {
            "Solis": ["S5-GR1P5K", "S6-GR1P5K", "S5-GR3P10K"]
        }
    },
    "Battery": {
        brands: ["Battery Dyness", "LV Topsun"],
        models: {
            "Battery Dyness": ["Powerbox F-10.0", "Dyness B4850", "Dyness A48100"],
            "LV Topsun": ["Topsun LV 48V 100Ah", "Topsun LV 48V 200Ah"]
        }
    },
    "Charge Controller": {
        brands: ["Victron Energy", "EPEVER", "SRNE", "MidNite Solar"],
        models: {
            "Victron Energy": ["SmartSolar MPPT 150/35", "SmartSolar MPPT 250/100", "BlueSolar MPPT 100/20"],
            "EPEVER": ["Tracer 4210AN", "Tracer 3210AN", "Tracer 5415AN", "LandStar LS1024B"],
            "SRNE": ["ML2420", "ML2440", "ML4860"],
            "MidNite Solar": ["Classic 150", "Classic 200"]
        }
    },
    "Mounting Structure": {
        brands: ["Schletter", "K2 Systems", "Clenergy", "SolarMount"],
        models: {
            "Schletter": ["FixGrid", "Solo5", "ProLine"],
            "K2 Systems": ["MiniRail", "SingleRail", "SolidRail"],
            "Clenergy": ["PV-ezRack SolarRoof", "PV-ezRack GroundSolar", "PV-ezRack SolarTerrace"],
            "SolarMount": ["Standard Rail", "Light Rail"]
        }
    },
    "Cable & Connector": {
        brands: ["Staubli", "Link", "Nexans", "Helukabel"],
        models: {
            "Staubli": ["MC4 Connector", "MC4-Evo 2 Connector", "PV-KBT4 Female", "PV-KST4 Male"],
            "Link": ["Solar Cable 4mm2", "Solar Cable 6mm2", "Solar Cable 10mm2"],
            "Nexans": ["KEYLIOS Solar 4mm2", "KEYLIOS Solar 6mm2"],
            "Helukabel": ["SOLARFLEX-X 4mm2", "SOLARFLEX-X 6mm2"]
        }
    }
};

function updateBrands() {
    const eqType = document.getElementById('eqType').value;
    const brandSel = document.getElementById('eqBrand');
    const modelSel = document.getElementById('eqModel');
    
    brandSel.innerHTML = '<option value="">-- เลือกยี่ห้อ --</option>';
    modelSel.innerHTML = '<option value="">-- เลือกรุ่น --</option>';
    
    if (brandModelMapping[eqType]) {
        brandSel.disabled = false;
        
        brandModelMapping[eqType].brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandSel.appendChild(option);
        });
        
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'อื่นๆ (ระบุเอง)';
        brandSel.appendChild(customOpt);
    } else {
        brandSel.disabled = true;
        modelSel.disabled = true;
    }
    
    document.getElementById('eqBrandCustom').style.display = 'none';
    document.getElementById('eqBrandCustom').required = false;
    document.getElementById('eqBrandCustom').value = '';
    
    updateModels();
}

function updateModels() {
    const eqType = document.getElementById('eqType').value;
    const eqBrand = document.getElementById('eqBrand').value;
    const modelSel = document.getElementById('eqModel');
    
    modelSel.innerHTML = '<option value="">-- เลือกรุ่น --</option>';
    
    const brandCustom = document.getElementById('eqBrandCustom');
    if (eqBrand === 'custom') {
        brandCustom.style.display = 'block';
        brandCustom.required = true;
    } else {
        brandCustom.style.display = 'none';
        brandCustom.required = false;
    }
    
    if (brandModelMapping[eqType] && eqBrand) {
        modelSel.disabled = false;
        
        const modelsByBrand = brandModelMapping[eqType].models;
        if (modelsByBrand[eqBrand]) {
            modelsByBrand[eqBrand].forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSel.appendChild(option);
            });
        }
        
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'อื่นๆ (ระบุเอง)';
        modelSel.appendChild(customOpt);
    } else {
        modelSel.disabled = true;
    }
    
    checkModelCustomVisibility();
}

function checkModelCustomVisibility() {
    const eqModel = document.getElementById('eqModel').value;
    const modelCustom = document.getElementById('eqModelCustom');
    if (eqModel === 'custom') {
        modelCustom.style.display = 'block';
        modelCustom.required = true;
    } else {
        modelCustom.style.display = 'none';
        modelCustom.required = false;
    }
}

function setBrandAndModelValues(brandVal, modelVal) {
    const brandSel = document.getElementById('eqBrand');
    const brandCustom = document.getElementById('eqBrandCustom');
    const modelSel = document.getElementById('eqModel');
    const modelCustom = document.getElementById('eqModelCustom');
    
    if (!brandVal) return;
    
    brandSel.disabled = false;
    
    let brandFound = false;
    for (let i = 0; i < brandSel.options.length; i++) {
        if (brandSel.options[i].value === brandVal) {
            brandSel.value = brandVal;
            brandFound = true;
            break;
        }
    }
    
    if (!brandFound) {
        brandSel.value = 'custom';
        brandCustom.value = brandVal;
        brandCustom.style.display = 'block';
        brandCustom.required = true;
    } else {
        brandCustom.style.display = 'none';
        brandCustom.required = false;
        brandCustom.value = '';
    }
    
    updateModels();
    
    if (!modelVal) return;
    
    modelSel.disabled = false;
    
    let modelFound = false;
    for (let i = 0; i < modelSel.options.length; i++) {
        if (modelSel.options[i].value === modelVal) {
            modelSel.value = modelVal;
            modelFound = true;
            break;
        }
    }
    
    if (!modelFound) {
        modelSel.value = 'custom';
        modelCustom.value = modelVal;
        modelCustom.style.display = 'block';
        modelCustom.required = true;
    } else {
        modelCustom.style.display = 'none';
        modelCustom.required = false;
        modelCustom.value = '';
    }
}

// Add listeners
document.getElementById('eqType').addEventListener('change', updateBrands);
document.getElementById('eqBrand').addEventListener('change', updateModels);
document.getElementById('eqModel').addEventListener('change', checkModelCustomVisibility);

document.getElementById('eqBrandCustom').addEventListener('input', saveDraft);
document.getElementById('eqModelCustom').addEventListener('input', saveDraft);

// Initialize on load
updateBrands();


