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
});
