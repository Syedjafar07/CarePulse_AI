// ---- REGISTER ----
async function register() {
    const name     = document.getElementById('name').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone    = document.getElementById('phone').value.trim();
    const blood    = document.getElementById('blood_group').value;
    const age      = document.getElementById('age').value;
    const gender   = document.getElementById('gender').value;

    if (!name || !email || !password || !phone || !blood || !age || !gender) {
        showToast('Please fill all required fields', 'error'); return;
    }

    // Locations
    const locations = [];
    const primary = document.getElementById('primary_location').value.trim();
    const college = document.getElementById('college_location').value.trim();
    const work    = document.getElementById('work_location').value.trim();
    if (primary) locations.push({ type: 'home', address: primary });
    if (college) locations.push({ type: 'college', address: college });
    if (work)    locations.push({ type: 'work', address: work });

    // Health declaration
    const healthFields = ['hiv','hepatitis','diabetes','heart_disease','cancer','malaria_recent','tattoo_recent','pregnant'];
    const health_declaration = {};
    let restricted = false;
    healthFields.forEach(f => {
        const el = document.getElementById('hd_' + f);
        health_declaration[f] = el ? el.checked : false;
        if (health_declaration[f]) restricted = true;
    });

    const btn = document.getElementById('registerBtn');
    btn.textContent = 'Registering...'; btn.disabled = true;

    try {
        const res = await apiCall('/auth/register', 'POST', {
            name, email, password, phone, blood_group: blood,
            age: parseInt(age), gender, locations, health_declaration,
            donation_restricted: restricted,
            profile_photo: window._photoBase64 || null
        });

        if (res.ok && res.data.token) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            showToast('Registration successful! Welcome to CarePulse AI 🎉', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1200);
        } else {
            showToast(res.data.error || 'Registration failed', 'error');
            btn.textContent = 'Register'; btn.disabled = false;
        }
    } catch (e) {
        showToast('Server error. Please try again.', 'error');
        btn.textContent = 'Register'; btn.disabled = false;
    }
}

function switchTab(type) {
    const emailSection = document.getElementById('section-email');
    const phoneSection = document.getElementById('section-phone');
    const emailTab     = document.getElementById('tab-email');
    const phoneTab     = document.getElementById('tab-phone');

    if (type === 'email') {
        emailSection.style.display = 'block';
        phoneSection.style.display = 'none';
        emailTab.classList.add('active');
        phoneTab.classList.remove('active');
        // clear phone field
        const p = document.getElementById('phone');
        if (p) p.value = '';
    } else {
        emailSection.style.display = 'none';
        phoneSection.style.display = 'block';
        phoneTab.classList.add('active');
        emailTab.classList.remove('active');
        // clear email field
        const e = document.getElementById('email');
        if (e) e.value = '';
    }
}

// ---- LOGIN ----
async function login() {
    const password = document.getElementById('password').value;

    const emailEl = document.getElementById('email');
    const phoneEl = document.getElementById('phone');

    const email = (emailEl && emailEl.offsetParent !== null) ? emailEl.value.trim() : '';
    const phone = (phoneEl && phoneEl.offsetParent !== null) ? phoneEl.value.trim() : '';

    if (!email && !phone) {
        showToast('Enter email or phone number', 'error'); return;
    }
    if (!password) {
        showToast('Enter your password', 'error'); return;
    }

    const body = { password };
    if (email) body.email = email;
    if (phone) body.phone = phone;

    const btn = document.getElementById('loginBtn');
    btn.textContent = 'Logging in...'; btn.disabled = true;

    try {
        const res = await apiCall('/auth/login', 'POST', body);

        if (res.ok && res.data.token) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            showToast('Welcome back! 💪', 'success');
            setTimeout(() => window.location.replace('dashboard.html'), 1000);
        } else {
            showToast(res.data.error || 'Invalid credentials', 'error');
            btn.textContent = 'Login →'; btn.disabled = false;
        }
    } catch (e) {
        showToast('Server error. Please try again.', 'error');
        btn.textContent = 'Login →'; btn.disabled = false;
    }
}

// GPS helper for register page
function detectLocation(fieldId) {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error'); return;
    }
    showToast('Detecting location...', 'info');
    navigator.geolocation.getCurrentPosition(
        pos => {
            const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
            document.getElementById(fieldId).value = coords;
            showToast('Location detected ✅', 'success');
        },
        () => showToast('Location access denied', 'error')
    );
}