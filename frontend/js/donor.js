let currentMapsUrl = "";

document.addEventListener("DOMContentLoaded", () => {
    requireAuth();
    initNotifications();
    loadUserInfo();
    loadAlerts();
    detectLocation();
});

async function loadUserInfo() {
    const user = getUser();
    if (user) setAvatarFromProfile(user.name, null);
    const { ok, data } = await apiCall("/auth/profile");
    if (!ok) return;
    setAvatarFromProfile(data.name, data.profile_photo);
    document.getElementById("stat-total").textContent = data.total_donations || 0;
    document.getElementById("stat-lives").textContent = data.lives_saved || 0;
    document.getElementById("stat-helped").textContent = data.total_donations || 0;
    const toggle = document.getElementById("donate-toggle");
    toggle.checked = data.available_to_donate;
    if (data.cooldown_active) {
        document.getElementById("cooldown-section").classList.remove("hidden");
        document.getElementById("cooldown-msg").textContent = "You recently donated blood. Rest and recover!";
        document.getElementById("next-eligible").textContent = `Next eligible: ${data.next_eligible_date?.split('T')[0] || 'N/A'}`;
        toggle.disabled = true;
        document.getElementById("toggle-text").textContent = "Cooldown active — 90 day rest period";
    } else if (!data.health_eligible) {
        toggle.disabled = true;
        document.getElementById("toggle-text").textContent = "Restricted — health conditions declared";
    } else {
        document.getElementById("toggle-text").textContent = data.available_to_donate ? "You will receive SOS alerts" : "Turn on to receive SOS alerts";
    }
}

function setAvatarFromProfile(name, photoUrl) {
    const img = document.getElementById("user-avatar-img");
    const initials = document.getElementById("user-avatar-initials");
    if (!img || !initials) return;
    if (photoUrl) {
        img.src = photoUrl;
        img.style.display = "block";
        initials.style.display = "none";
    } else {
        img.style.display = "none";
        initials.textContent = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : "?";
        initials.style.display = "block";
    }
}

async function detectLocation() {
    try {
        const pos = await getUserLocation();
        const addr = await reverseGeocode(pos.lat, pos.lng);
        const el = document.getElementById("location-text");
        if (el) el.textContent = addr.split(",").slice(0,2).join(",");
    } catch {
        const el = document.getElementById("location-text");
        if (el) el.textContent = "Location unavailable";
    }
}

async function loadAlerts() {
    const container = document.getElementById("alerts-container");
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray-400);"><div class="spinner" style="margin:0 auto 12px;"></div>Loading alerts...</div>';
    const { ok, data } = await apiCall("/donor/alerts");
    if (!ok || !data.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="font-size:40px;margin-bottom:12px;color:var(--gray-300);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h3>No Active Alerts</h3>
                <p>You will receive SMS when blood is needed nearby.</p>
            </div>`;
        return;
    }
    // Trigger donor alert sound only when there are real alerts
    triggerDonorAlert();
    container.innerHTML = data.map(req => `
        <div class="alert-card" id="alert-${req._id}">
            <div class="alert-head">
                <span class="alert-blood">${req.blood_group_needed} Blood Needed</span>
                <span class="urgency-tag ${req.urgency === 'critical' ? 'urgent' : req.urgency === 'urgent' ? 'high-priority' : 'normal-tag'}">${req.urgency.toUpperCase()}</span>
            </div>
            <div class="alert-body">
                <div class="alert-field"><strong>${req.hospital_name}</strong><span>Hospital</span></div>
                <div class="alert-field"><strong>${req.patient_name || 'Patient'}</strong><span>Patient</span></div>
                <div class="alert-field"><strong>${req.hospital_address || 'Address not provided'}</strong><span>Location</span></div>
                <div class="alert-field"><strong>${timeAgo(req.created_at)}</strong><span>Requested</span></div>
            </div>
            <div class="alert-actions">
                <button class="btn btn-success btn-full" onclick="acceptRequest('${req._id}', '${req.hospital_name}', '${req.hospital_address || ''}', ${req.hospital_lat || 0}, ${req.hospital_lng || 0})">
                    Accept and Navigate
                </button>
                <button class="btn btn-gray btn-sm" onclick="declineRequest('${req._id}')">Decline</button>
            </div>
        </div>
    `).join("");
}

async function acceptRequest(reqId, hospital, address, lat, lng) {
    const { ok, data } = await apiCall(`/donor/accept/${reqId}`, "POST");
    if (ok) {
        document.getElementById("modal-hospital").textContent = hospital;
        document.getElementById("modal-address").textContent = address || "Address not provided";
        currentMapsUrl = data.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        document.getElementById("accept-modal").classList.remove("hidden");
        showToast("Request accepted! Navigate to hospital.", "success");
        document.getElementById(`alert-${reqId}`)?.remove();
    } else {
        showToast(data.error || "Failed to accept", "error");
    }
}

function openMaps() {
    if (currentMapsUrl) window.open(currentMapsUrl, "_blank");
}

async function declineRequest(reqId) {
    const { ok } = await apiCall(`/donor/decline/${reqId}`, "POST");
    if (ok) {
        showToast("Request declined", "info");
        document.getElementById(`alert-${reqId}`)?.remove();
    }
}

async function toggleDonateStatus() {
    const toggle = document.getElementById("donate-toggle");
    const { ok, data } = await apiCall("/auth/toggle-donate", "POST");
    if (ok) {
        toggle.checked = data.available_to_donate;
        document.getElementById("toggle-text").textContent = data.available_to_donate ? "You will receive SOS alerts" : "Turn on to receive SOS alerts";
        showToast(data.available_to_donate ? "You are now available to donate!" : "Availability turned off", data.available_to_donate ? "success" : "info");
    } else {
        toggle.checked = !toggle.checked;
        showToast(data.error, "error");
    }
}
// Auto refresh alerts every 15 seconds
setInterval(() => {
    loadAlerts();
}, 15000);