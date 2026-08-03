// === Register JS ===
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const btn = document.getElementById('regBtn');
    
    btn.disabled = true;
    btn.innerHTML = 'Registering...';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Registration successful! Please login.');
            window.location.href = '/';
        } else {
            alert(data.message || 'Registration failed');
            btn.disabled = false;
            btn.innerHTML = '✨ Register';
        }
    } catch (err) {
        alert('Connection error occurred');
        btn.disabled = false;
        btn.innerHTML = '✨ Register';
    }
});
