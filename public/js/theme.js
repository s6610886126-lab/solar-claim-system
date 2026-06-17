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
