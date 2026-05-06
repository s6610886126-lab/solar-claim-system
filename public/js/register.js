// === Register JS ===
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const btn = document.getElementById('regBtn');
    
    btn.disabled = true;
    btn.innerHTML = 'กำลังลงทะเบียน...';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('สมัครสมาชิกเรียบร้อย! กรุณาเข้าสู่ระบบ');
            window.location.href = '/';
        } else {
            alert(data.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
            btn.disabled = false;
            btn.innerHTML = '✨ สมัครสมาชิก';
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        btn.disabled = false;
        btn.innerHTML = '✨ สมัครสมาชิก';
    }
});
