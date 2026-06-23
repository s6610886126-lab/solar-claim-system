(function() {
    const savedTheme = localStorage.getItem('solar_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
    // Inject theme toggle button into navbar
    const userInfo = document.querySelector('.navbar .user-info');
    if (userInfo) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.title = 'เปลี่ยนโหมดหน้าจอ (Dark/Light)';
        
        const sunIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        
        const moonIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        toggleBtn.innerHTML = currentTheme === 'dark' ? sunIcon : moonIcon;
        
        toggleBtn.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('solar_theme', newTheme);
            
            toggleBtn.innerHTML = newTheme === 'dark' ? sunIcon : moonIcon;
            
            // Dispatch custom event for dynamic components (like charts)
            window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: newTheme } }));
        });
        
        // Insert it as the first item in user-info
        userInfo.insertBefore(toggleBtn, userInfo.firstChild);
    }
    
    // Initialize notifications system
    initNotifications();
    
    // Initialize profile dropdown system
    initProfileDropdown();
});

// === Notifications System ===
function initNotifications() {
    const notifyBtn = document.querySelector('.notify-btn');
    if (!notifyBtn) return;

    // Get current user session
    const currentUser = JSON.parse(localStorage.getItem('solar_user'));
    if (!currentUser) {
        notifyBtn.style.display = 'none';
        return;
    }

    // Wrap notify button in a relative positioned container
    const wrapper = document.createElement('div');
    wrapper.className = 'notify-wrapper';
    notifyBtn.parentNode.insertBefore(wrapper, notifyBtn);
    wrapper.appendChild(notifyBtn);

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'notify-dropdown';
    dropdown.id = 'notifyDropdown';
    dropdown.innerHTML = `
        <div class="notify-header">
            <span>การแจ้งเตือน</span>
            <button class="notify-clear-btn" id="notifyClearBtn">อ่านแล้วทั้งหมด</button>
        </div>
        <div class="notify-list" id="notifyList">
            <div class="notify-empty">กำลังโหลด...</div>
        </div>
    `;
    wrapper.appendChild(dropdown);

    // Add unread badge to notifyBtn
    const badge = document.createElement('span');
    badge.className = 'notify-badge';
    badge.style.display = 'none';
    notifyBtn.appendChild(badge);

    let notificationsData = [];

    // Toggle dropdown visibility
    notifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            loadNotificationsUI();
        }
    });

    // Close dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Mark all as read
    const clearBtn = dropdown.querySelector('#notifyClearBtn');
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const readList = JSON.parse(localStorage.getItem('read_notifications') || '[]');
        notificationsData.forEach(item => {
            if (!readList.includes(item.id)) {
                readList.push(item.id);
            }
        });
        localStorage.setItem('read_notifications', JSON.stringify(readList));
        updateBadge();
        loadNotificationsUI();
    });

    // Render list elements dynamically
    function loadNotificationsUI() {
        const listContainer = dropdown.querySelector('#notifyList');
        const readList = JSON.parse(localStorage.getItem('read_notifications') || '[]');
        
        if (notificationsData.length === 0) {
            listContainer.innerHTML = '<div class="notify-empty">ไม่มีการแจ้งเตือนในระบบ</div>';
            return;
        }

        listContainer.innerHTML = notificationsData.map(item => {
            const isUnread = !readList.includes(item.id);
            const dateStr = new Date(item.date).toLocaleDateString('th-TH', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            return `
                <div class="notify-item ${isUnread ? 'unread' : ''}" data-claim-id="${item.claimId}" data-id="${item.id}">
                    <div class="notify-item-title">${item.title}</div>
                    <div class="notify-item-desc">${item.description}</div>
                    <div class="notify-item-date">${dateStr}</div>
                </div>
            `;
        }).join('');

        // Link click actions
        listContainer.querySelectorAll('.notify-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.getAttribute('data-id');
                const claimId = el.getAttribute('data-claim-id');
                
                const readList = JSON.parse(localStorage.getItem('read_notifications') || '[]');
                if (!readList.includes(id)) {
                    readList.push(id);
                    localStorage.setItem('read_notifications', JSON.stringify(readList));
                }
                
                window.location.href = `/claim-detail.html?id=${claimId}`;
            });
        });
    }

    // Refresh badge visibility
    function updateBadge() {
        const readList = JSON.parse(localStorage.getItem('read_notifications') || '[]');
        const unreadCount = notificationsData.filter(item => !readList.includes(item.id)).length;

        if (unreadCount > 0) {
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Fetch from API
    async function fetchNotifications() {
        try {
            const res = await fetch(`/api/notifications?email=${encodeURIComponent(currentUser.email)}&role=${encodeURIComponent(currentUser.role)}`);
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    notificationsData = json.data;
                    updateBadge();
                }
            }
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        }
    }

    fetchNotifications();
    // Poll every 30 seconds
    setInterval(fetchNotifications, 30000);
}

// === Profile Dropdown System ===
function initProfileDropdown() {
    const userAvatar = document.getElementById('userAvatar');
    if (!userAvatar) return;

    const currentUser = JSON.parse(localStorage.getItem('solar_user'));
    if (!currentUser) return;

    const avatarSrc = currentUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.name || currentUser.email)}&backgroundColor=b6e3f4`;
    userAvatar.innerHTML = `<img src="${avatarSrc}" class="avatar-img" alt="Avatar">`;

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'avatar-wrapper';
    userAvatar.parentNode.insertBefore(wrapper, userAvatar);
    wrapper.appendChild(userAvatar);

    // Create profile dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.id = 'profileDropdown';
    
    // Define role labels
    const roleText = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ลูกค้า (Customer)';
    
    dropdown.innerHTML = `
        <div class="profile-header">
            <div class="avatar large">
                <img src="${avatarSrc}" class="avatar-img" alt="Avatar">
            </div>
            <div class="profile-details">
                <div class="profile-name" title="${currentUser.name || 'User'}">${currentUser.name || 'User'}</div>
                <div class="profile-email" title="${currentUser.email || ''}">${currentUser.email || ''}</div>
                <div class="profile-role">${roleText}</div>
            </div>
        </div>
        <div class="dropdown-divider"></div>
        <button onclick="openEditProfileModal(event)" class="dropdown-item">
            <span>⚙️ แก้ไขข้อมูลส่วนตัว</span>
        </button>
        <div class="dropdown-divider"></div>
        <button onclick="logout()" class="dropdown-item logout-item">
            <span>🚪 ออกจากระบบ</span>
        </button>
    `;
    wrapper.appendChild(dropdown);

    // Toggle dropdown on avatar click
    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close notify dropdown if open
        const notifyDropdown = document.getElementById('notifyDropdown');
        if (notifyDropdown) {
            notifyDropdown.classList.remove('active');
        }
        
        dropdown.classList.toggle('active');
    });

    // Close dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Hide the old raw logout button to keep navbar clean
    const logoutBtn = wrapper.parentNode.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        logoutBtn.style.display = 'none';
    }

    // Inject Edit Profile Modal overlay
    if (!document.getElementById('editProfileOverlay')) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'editProfileOverlay';
        modalOverlay.style.zIndex = '1200';
        
        modalOverlay.innerHTML = `
            <div class="modal" style="max-width: 450px;">
                <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-primary); text-align: center;">แก้ไขข้อมูลส่วนตัว</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem; text-align: center;">แก้ไขข้อมูลบัญชีผู้ใช้ของคุณ</p>
                
                <form id="editProfileForm">
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">อีเมล (ไม่สามารถเปลี่ยนได้)</label>
                            <input type="text" id="editProfileEmail" class="form-control" style="background: var(--bg-light); cursor: not-allowed; width: 100%; border: 1px solid var(--border-light); border-radius: var(--radius-xs); padding: 10px 14px; font-size: 0.9rem;" readonly>
                        </div>
                        
                        <!-- Avatar Picker -->
                        <div>
                            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">รูปภาพโปรไฟล์</label>
                            
                            <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px; padding: 10px; background: var(--bg-light); border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                                <img id="editProfileAvatarPreview" src="" style="width: 54px; height: 54px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover;" alt="Preview">
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; color: var(--text-primary); font-weight: 600;">
                                        <input type="radio" name="avatarType" value="default" checked id="avatarTypeDefault"> เลือกการ์ตูน Avatar
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; color: var(--text-primary); font-weight: 600;">
                                        <input type="radio" name="avatarType" value="custom" id="avatarTypeCustom"> ใช้รูปภาพของตัวเอง
                                    </label>
                                </div>
                            </div>

                            <!-- Default Avatars Grid Selection -->
                            <div id="defaultAvatarGridSection" style="margin-bottom: 12px;">
                                <div id="defaultAvatarGrid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; justify-items: center; padding: 6px; background: var(--bg-light); border-radius: var(--radius-xs); border: 1px solid var(--border-light);">
                                    <!-- Dynamic default avatars -->
                                </div>
                            </div>

                            <!-- Custom Image Upload input -->
                            <div id="customAvatarSection" style="display: none; margin-bottom: 12px;">
                                <input type="file" id="customAvatarFile" accept="image/*" class="form-control" style="font-size: 0.82rem; padding: 8px 12px; width: 100%; border: 1px solid var(--border-light); border-radius: var(--radius-xs); background: var(--bg-card); color: var(--text-primary);">
                                <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">รองรับไฟล์รูปภาพทั่วไป ขนาดไม่เกิน 5MB</p>
                            </div>
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">ชื่อ-นามสกุล</label>
                            <input type="text" id="editProfileName" class="form-control" style="width: 100%; border: 1px solid var(--border-light); border-radius: var(--radius-xs); padding: 10px 14px; font-size: 0.9rem;" required>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">เบอร์โทรศัพท์</label>
                            <input type="text" id="editProfilePhone" class="form-control" style="width: 100%; border: 1px solid var(--border-light); border-radius: var(--radius-xs); padding: 10px 14px; font-size: 0.9rem;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">รหัสผ่านใหม่ (หากไม่ต้องการเปลี่ยนให้เว้นว่างไว้)</label>
                            <input type="password" id="editProfilePassword" class="form-control" placeholder="ป้อนรหัสผ่านใหม่ที่ต้องการเปลี่ยน" style="width: 100%; border: 1px solid var(--border-light); border-radius: var(--radius-xs); padding: 10px 14px; font-size: 0.9rem;">
                        </div>
                    </div>
                    
                    <div class="modal-actions" style="margin-top: 24px;">
                        <button type="button" id="closeEditProfileBtn" class="btn btn-secondary" style="border: 1px solid var(--border-light); padding: 8px 16px; border-radius: var(--radius-xs); background: none; color: var(--text-secondary); cursor: pointer;">ยกเลิก</button>
                        <button type="submit" class="btn btn-primary" style="background: var(--primary); border: none; padding: 8px 16px; border-radius: var(--radius-xs); color: #fff; font-weight: 600; cursor: pointer;">บันทึกข้อมูล</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        // Set up cancel action
        document.getElementById('closeEditProfileBtn').addEventListener('click', closeEditProfileModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeEditProfileModal();
            }
        });

        // Set up radio button events to toggle UI options
        document.getElementById('avatarTypeDefault').addEventListener('change', () => toggleAvatarTypeUI('default'));
        document.getElementById('avatarTypeCustom').addEventListener('change', () => toggleAvatarTypeUI('custom'));

        // File input change event
        document.getElementById('customAvatarFile').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showGlobalToast('ขนาดรูปภาพต้องไม่เกิน 5MB', 'error');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                selectedAvatarUrl = e.target.result;
                document.getElementById('editProfileAvatarPreview').src = selectedAvatarUrl;
            };
            reader.readAsDataURL(file);
        });

        // Set up submit action
        document.getElementById('editProfileForm').addEventListener('submit', saveProfileChanges);
    }
}

// === Profile Dropdown Actions & Helpers ===
let selectedAvatarUrl = '';
const defaultSeeds = ['Felix', 'Aneka', 'Jack', 'Milo', 'Sasha', 'Toby'];

function toggleAvatarTypeUI(type) {
    const defaultSection = document.getElementById('defaultAvatarGridSection');
    const customSection = document.getElementById('customAvatarSection');
    if (type === 'default') {
        defaultSection.style.display = 'block';
        customSection.style.display = 'none';
    } else {
        defaultSection.style.display = 'none';
        customSection.style.display = 'block';
    }
}

function renderDefaultAvatars(selectedUrl) {
    const grid = document.getElementById('defaultAvatarGrid');
    if (!grid) return;
    
    grid.innerHTML = defaultSeeds.map(seed => {
        const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4`;
        const isSelected = selectedUrl === url;
        const activeStyle = isSelected ? 'border: 2px solid var(--primary); box-shadow: var(--shadow-glow-gold); transform: scale(1.1);' : 'border: 1px solid var(--border-light); opacity: 0.7;';
        
        return `
            <img src="${url}" 
                 data-url="${url}" 
                 class="default-avatar-option" 
                 style="width: 38px; height: 38px; border-radius: 50%; cursor: pointer; transition: all 0.2s ease; ${activeStyle}"
                 alt="${seed}">
        `;
    }).join('');

    // Bind click events
    grid.querySelectorAll('.default-avatar-option').forEach(el => {
        el.addEventListener('click', () => {
            selectedAvatarUrl = el.getAttribute('data-url');
            document.getElementById('editProfileAvatarPreview').src = selectedAvatarUrl;
            
            // Update active states
            grid.querySelectorAll('.default-avatar-option').forEach(img => {
                img.style.border = '1px solid var(--border-light)';
                img.style.opacity = '0.7';
                img.style.transform = 'none';
                img.style.boxShadow = 'none';
            });
            el.style.border = '2px solid var(--primary)';
            el.style.opacity = '1';
            el.style.transform = 'scale(1.1)';
            el.style.boxShadow = 'var(--shadow-glow-gold)';
            
            // Set type to default
            document.getElementById('avatarTypeDefault').checked = true;
            toggleAvatarTypeUI('default');
        });
    });
}

function openEditProfileModal(e) {
    if (e) e.stopPropagation();
    
    // Close the dropdown first
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }

    const currentUser = JSON.parse(localStorage.getItem('solar_user'));
    if (!currentUser) return;

    // Populate values
    document.getElementById('editProfileEmail').value = currentUser.email || '';
    document.getElementById('editProfileName').value = currentUser.name || '';
    document.getElementById('editProfilePhone').value = currentUser.phone || '';
    document.getElementById('editProfilePassword').value = ''; // empty password field

    // Set up avatar state
    selectedAvatarUrl = currentUser.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.name || currentUser.email)}&backgroundColor=b6e3f4`;
    document.getElementById('editProfileAvatarPreview').src = selectedAvatarUrl;

    const isDefault = selectedAvatarUrl.includes('dicebear.com');
    if (isDefault) {
        document.getElementById('avatarTypeDefault').checked = true;
        toggleAvatarTypeUI('default');
    } else {
        document.getElementById('avatarTypeCustom').checked = true;
        toggleAvatarTypeUI('custom');
    }

    // Render default avatar grid
    renderDefaultAvatars(selectedAvatarUrl);

    // Reset file input
    const fileInput = document.getElementById('customAvatarFile');
    if (fileInput) fileInput.value = '';

    // Show overlay
    const overlay = document.getElementById('editProfileOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function closeEditProfileModal() {
    const overlay = document.getElementById('editProfileOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function showGlobalToast(msg, type='success') {
    if (typeof showToast === 'function') {
        showToast(msg, type);
        return;
    }
    const c = document.getElementById('toastContainer');
    if (!c) {
        alert(msg);
        return;
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✅':type==='error'?'❌':'ℹ️'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100px)'; setTimeout(()=>t.remove(),400); }, 3000);
}

async function saveProfileChanges(e) {
    if (e) e.preventDefault();

    const email = document.getElementById('editProfileEmail').value;
    const name = document.getElementById('editProfileName').value;
    const phone = document.getElementById('editProfilePhone').value;
    const password = document.getElementById('editProfilePassword').value;

    const submitBtn = document.querySelector('#editProfileForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึก...';

    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, name, phone, password, avatarUrl: selectedAvatarUrl })
        });

        const result = await response.json();
        if (result.success) {
            // Update local storage user session
            localStorage.setItem('solar_user', JSON.stringify(result.user));

            showGlobalToast('แก้ไขข้อมูลส่วนตัวสำเร็จแล้ว', 'success');
            closeEditProfileModal();

            // Refresh the header display instantly!
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) {
                userAvatar.innerHTML = `<img src="${result.user.avatarUrl}" class="avatar-img" alt="Avatar">`;
            }

            // Update dropdown values dynamically
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) {
                const nameEl = dropdown.querySelector('.profile-name');
                const emailEl = dropdown.querySelector('.profile-email');
                if (nameEl) nameEl.textContent = result.user.name;
                if (emailEl) emailEl.textContent = result.user.email;
                
                const largeAvatar = dropdown.querySelector('.profile-header .avatar.large');
                if (largeAvatar) {
                    largeAvatar.innerHTML = `<img src="${result.user.avatarUrl}" class="avatar-img" alt="Avatar">`;
                }
            }

            // Update page-level greetings if they exist
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = result.user.name;
            }
        } else {
            showGlobalToast(result.message || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (err) {
        console.error('Save profile changes error:', err);
        showGlobalToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Global logout function
function logout() {
    localStorage.removeItem('solar_user');
    window.location.href = '/';
}

