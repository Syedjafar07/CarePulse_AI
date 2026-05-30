document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    loadUserInfo();
    detectLocation();
    loadBloodRequests();
    loadDonorMatches();
    loadAlertCount();
});

async function loadUserInfo() {
    const user = getUser();
    if (user && user.name) {
        document.getElementById("user-name").textContent = user.name;
        setAvatar(user.name, null);
    }
    const { ok, data } = await apiCall("/auth/profile");
    if (ok) {
        document.getElementById("user-name").textContent = data.name;
        setAvatar(data.name, data.profile_photo);
        document.getElementById("stat-donations").textContent = data.total_donations || 0;
        document.getElementById("stat-lives").textContent = data.lives_saved || 0;
        document.getElementById("stat-helped").textContent = data.total_donations || 0;
        const toggle = document.getElementById("donate-toggle");
        toggle.checked = data.available_to_donate;
        updateToggleText(data.available_to_donate);
        if (!data.health_eligible) {
            toggle.disabled = true;
            document.getElementById("toggle-status-text").textContent = "Donation restricted (health conditions)";
        }
        if (data.cooldown_active) {
            toggle.disabled = true;
            document.getElementById("toggle-status-text").textContent = `Cooldown active until ${data.next_eligible_date?.split('T')[0]}`;
        }
        const badge = document.querySelector(".verified-badge");
        if (badge) badge.style.display = data.verified_donor ? "inline-flex" : "none";
    }
}

function setAvatar(name, photoUrl) {
    const img = document.getElementById("user-avatar-img");
    const initials = document.getElementById("user-avatar-initials");
    if (!img || !initials) return;
    if (photoUrl) {
        img.src = photoUrl;
        img.style.display = "block";
        initials.style.display = "none";
    } else {
        img.style.display = "none";
        const letters = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : "?";
        initials.textContent = letters;
        initials.style.display = "block";
    }
}

function updateToggleText(status) {
    const text = document.getElementById("toggle-status-text");
    if (text) text.textContent = status ? "You will receive SOS alerts" : "Turn on to receive SOS alerts";
}

async function toggleDonate() {
    const toggle = document.getElementById("donate-toggle");
    const { ok, data } = await apiCall("/auth/toggle-donate", "POST");
    if (ok) {
        toggle.checked = data.available_to_donate;
        updateToggleText(data.available_to_donate);
        showToast(data.available_to_donate ? "You are now available to donate!" : "Donation availability turned off", data.available_to_donate ? "success" : "info");
    } else {
        toggle.checked = !toggle.checked;
        showToast(data.error, "error");
    }
}

async function detectLocation() {
    try {
        const pos = await getUserLocation();
        const address = await reverseGeocode(pos.lat, pos.lng);
        const short = address.split(",").slice(0,2).join(",");
        document.getElementById("location-text").textContent = short;
        document.getElementById("sos-location").textContent = short;
        window._userLat = pos.lat;
        window._userLng = pos.lng;
        loadNearbyHospitals(pos.lat, pos.lng);
        loadDashboardMap(pos.lat, pos.lng);
    } catch {
        document.getElementById("location-text").textContent = "Location unavailable";
        document.getElementById("sos-location").textContent = "Enable location";
    }
}

async function loadBloodRequests() {
    const { ok, data } = await apiCall("/blood/requests");
    const container = document.getElementById("request-list");
    if (!ok || !data.length) {
        container.innerHTML = '<div class="empty-state"><div style="font-size:32px;margin-bottom:8px;color:var(--gray-300);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div><p>No active blood requests nearby</p></div>';
        return;
    }
    container.innerHTML = data.slice(0,4).map(req => `
        <div class="request-item" onclick="location.href='request.html'" style="cursor:pointer;">
            <div style="width:32px;height:32px;background:var(--red-pale);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--red)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <div class="req-info">
                <div class="req-blood">${req.blood_group_needed} Blood Required
                    <span class="urgency-tag ${req.urgency === 'critical' ? 'urgent' : req.urgency === 'urgent' ? 'high-priority' : 'normal-tag'}">${req.urgency?.toUpperCase()}</span>
                </div>
                <div class="req-hospital">${req.hospital_name}</div>
            </div>
            <div class="req-right">
                <div class="req-time">${timeAgo(req.created_at)}</div>
            </div>
        </div>
    `).join("");
}

async function loadDonorMatches() {
    const container = document.getElementById("donor-match-grid");
    const { ok, data } = await apiCall("/auth/donors");
    if (!ok || !data.length) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray-400);">No donors available nearby</div>';
        return;
    }
    container.innerHTML = data.slice(0,4).map(d => `
        <div class="donor-match-item">
            <div class="donor-match-top">
                <div class="donor-avatar" style="background:${avatarColor(d.name)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;border-radius:50%;overflow:hidden;">
                    ${d.profile_photo
                        ? `<img src="${d.profile_photo}" style="width:100%;height:100%;object-fit:cover;" />`
                        : `<span>${d.name[0].toUpperCase()}</span>`
                    }
                </div>
                <div>
                    <div class="donor-match-name">${d.name}</div>
                    <span class="donor-bg-tag">${d.blood_group}</span>
                </div>
                <span class="top-match-tag">Available</span>
            </div>
            <div class="donor-match-footer">
                <span class="match-pct">Eligible</span>
                <button class="req-btn" onclick="location.href='request.html'">Request</button>
            </div>
        </div>
    `).join("");
}

function avatarColor(name) {
    const colors = ["#e53935","#d81b60","#8e24aa","#3949ab","#1e88e5","#00897b","#43a047","#fb8c00"];
    let hash = 0;
    for (let c of (name || "")) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

async function loadNearbyHospitals(lat, lng) {
    const container = document.getElementById("hospital-list");
    if (!lat || !lng) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);">Enable location for nearby hospitals</div>';
        return;
    }
    const key = 'AIzaSyCLR_LjKXQeEH6hteqo1msycx6MecMqNHU';
    try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=hospital&key=${key}`);
        const data = await res.json();
        if (!data.results?.length) {
            container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);">No hospitals found nearby</div>';
            return;
        }
        container.innerHTML = data.results.slice(0, 3).map(h => `
            <div class="hospital-item">
                <div class="hospital-img" style="background:var(--red-pale);color:var(--red);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;">H</div>
                <div class="hospital-info">
                    <div class="hospital-name">${h.name}</div>
                    <div class="hospital-addr">${h.vicinity}</div>
                    <div class="hospital-status">
                        <span class="${h.opening_hours?.open_now ? 'open' : 'closed-status'}">
                            ${h.opening_hours?.open_now ? 'Open' : 'Closed'}
                        </span>
                    </div>
                </div>
                <button class="call-btn" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${h.geometry.location.lat},${h.geometry.location.lng}','_blank')">Dir</button>
            </div>
        `).join("");
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);">Could not load hospitals</div>';
    }
}

async function loadAlertCount() {
    const { ok, data } = await apiCall("/donor/alerts");
    if (ok && data.length) {
        const alertEl = document.getElementById("alert-count");
        const notifEl = document.getElementById("notif-count");
        if (alertEl) alertEl.textContent = data.length;
        if (notifEl) notifEl.textContent = data.length;
    }
}

function handleSOS() {
    document.getElementById("sos-modal").classList.remove("hidden");
}
function closeSOS() {
    document.getElementById("sos-modal").classList.add("hidden");
}

async function submitSOS() {
    const bloodGroup = document.getElementById("sos-blood-group").value;
    const hospital = document.getElementById("sos-hospital").value.trim();
    const urgency = document.getElementById("sos-urgency").value;

    if (!bloodGroup || !hospital) {
        showToast("Please fill all fields", "error");
        return;
    }

    const btn = document.getElementById("sos-submit-btn");
    btn.disabled = true;

    const { ok, data } = await apiCall("/blood/request", "POST", {
        blood_group_needed: bloodGroup,
        hospital_name: hospital,
        urgency,
        hospital_lat: window._userLat || 0,
        hospital_lng: window._userLng || 0
    });

    if (ok) {

        await apiCall("/blood/proximity-community-alert", "POST", {
            blood_group_needed: bloodGroup,
            hospital_name: hospital,
            lat: window._userLat || 0,
            lng: window._userLng || 0,
            radius_km: 10
        });

        closeSOS();

        const count = data.donors_alerted || 0;
        showToast(
          `🚨 Emergency alert sent! ${count} nearby donor${count !== 1 ? 's' : ''} notified via SMS.`,
         "success"
      );

        loadBloodRequests();
    } else {
        showToast(data.error || "SOS failed", "error");
    }

    btn.disabled = false;
}
function loadDashboardMap(lat, lng) {
    const preview = document.getElementById('map-preview');
    if (!preview) return;
    preview.innerHTML = `<iframe width="100%" height="100%" style="border:none;border-radius:10px;"
        src="https://maps.google.com/maps?q=hospitals+near+${lat},${lng}&output=embed"
        allowfullscreen allow="geolocation"></iframe>`;
}