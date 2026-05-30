const API_BASE = 'http://127.0.0.1:5000/api';

function getToken() { return localStorage.getItem('token'); }
function getUser() { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('login.html');
}

function requireAuth() {
    if (!getToken()) { window.location.replace('login.html'); return false; }
    return true;
}

async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (e) {
        console.error('API Error:', e);
        return { ok: false, data: { error: 'Connection failed' } };
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

const toastStyle = document.createElement('style');
toastStyle.textContent = `
.toast {
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    color: #fff; padding: 12px 28px; border-radius: 8px;
    font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 9999;
    pointer-events: none; white-space: nowrap;
}
.toast.show { opacity: 1; }
.toast-success { background: #2ecc71; }
.toast-error { background: #e74c3c; }
.toast-info { background: #3498db; }
`;
document.head.appendChild(toastStyle);

window.addEventListener('pageshow', function(e) {
    if (e.persisted && !getToken()) window.location.replace('login.html');
});

function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve({ lat: 13.1340, lng: 77.5680 }); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: 13.1340, lng: 77.5680 }),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

async function reverseGeocode(lat, lng) {
    try {
        const key = 'AIzaSyCLR_LjKXQeEH6hteqo1msycx6MecMqNHU';
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
        const data = await res.json();
        if (data.results && data.results[0]) return data.results[0].formatted_address;
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch { return 'Location detected'; }
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    try {
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)} hr ago`;
        return `${Math.floor(diff/86400)} day ago`;
    } catch { return ''; }
}

// SOS alert — only for DONORS receiving alerts, not for patients sending SOS
function triggerDonorAlert() {
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        function beep(freq, start, duration) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = freq; o.type = 'square';
            g.gain.setValueAtTime(0.3, ctx.currentTime + start);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            o.start(ctx.currentTime + start);
            o.stop(ctx.currentTime + start + duration + 0.1);
        }
        beep(880, 0, 0.2); beep(880, 0.3, 0.2); beep(880, 0.6, 0.2);
        beep(440, 1.0, 0.5); beep(440, 1.6, 0.5); beep(440, 2.2, 0.5);
    } catch(e) { console.log('Audio not supported'); }
    if (Notification.permission === 'granted') {
        new Notification('CarePulse SOS ALERT', {
            body: 'Blood donation needed nearby! Open the app immediately.',
            requireInteraction: true
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

function initNotifications() {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// Set active nav item based on current page
function setActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        const href = btn.getAttribute('onclick') || '';
        if (href.includes(page)) btn.classList.add('active');
    });
    document.querySelectorAll('.bnav-item').forEach(btn => {
        btn.classList.remove('active');
        const href = btn.getAttribute('onclick') || '';
        if (href.includes(page)) btn.classList.add('active');
    });
}

document.addEventListener('DOMContentLoaded', setActiveNav);