document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  loadUserInfo();
  detectLocation();
  loadMyRequests();
  setupForm();
});

function loadUserInfo() {
  const user = getUser();
  if (user.name) {
    document.getElementById("user-avatar").textContent = user.name[0].toUpperCase();
    document.getElementById("patient-name").value = user.name;
  }
}

async function detectLocation() {
  try {
    const pos = await getUserLocation();
    const address = await reverseGeocode(pos.lat, pos.lng);
    document.getElementById("location-text").textContent = address.split(",").slice(0,2).join(",");
    document.getElementById("hospital-address").placeholder = address;
    window._userLat = pos.lat;
    window._userLng = pos.lng;
  } catch {
    document.getElementById("location-text").textContent = "Location unavailable";
  }
}

async function detectHospitalLocation() {
  const btn = document.getElementById("detect-btn");
  btn.textContent = "📍 Detecting...";
  btn.disabled = true;
  try {
    const pos = await getUserLocation();
    const address = await reverseGeocode(pos.lat, pos.lng);
    document.getElementById("hospital-address").value = address;
    document.getElementById("hospital-lat").value = pos.lat;
    document.getElementById("hospital-lng").value = pos.lng;
    showToast("Location detected!", "success");
  } catch {
    showToast("Location access denied. Enter manually.", "error");
  }
  btn.textContent = "📍 Detect";
  btn.disabled = false;
}

function setupForm() {
  document.getElementById("request-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const bloodGroup = document.querySelector('input[name="blood_group"]:checked')?.value;
    const urgency = document.querySelector('input[name="urgency"]:checked')?.value || "critical";
    const patientName = document.getElementById("patient-name").value.trim();
    const hospitalName = document.getElementById("hospital-name").value.trim();
    const hospitalAddress = document.getElementById("hospital-address").value.trim();
    const lat = document.getElementById("hospital-lat").value || window._userLat || 0;
    const lng = document.getElementById("hospital-lng").value || window._userLng || 0;
    const notes = document.getElementById("notes").value.trim();

    if (!bloodGroup) { showToast("Please select blood group needed", "error"); return; }
    if (!patientName) { showToast("Please enter patient name", "error"); return; }
    if (!hospitalName) { showToast("Please enter hospital name", "error"); return; }

    const btn = document.getElementById("submit-btn");
    btn.classList.add("btn-loading"); btn.disabled = true;

    const { ok, data } = await apiCall("/blood/request", "POST", {
      blood_group_needed: bloodGroup,
      urgency,
      patient_name: patientName,
      hospital_name: hospitalName,
      hospital_address: hospitalAddress,
      hospital_lat: parseFloat(lat) || 0,
      hospital_lng: parseFloat(lng) || 0,
      notes
    });

    btn.classList.remove("btn-loading"); btn.disabled = false;

    if (ok) {
      document.getElementById("donors-alerted-count").textContent = data.donors_alerted || 0;
      document.getElementById("success-modal").classList.remove("hidden");
      document.getElementById("request-form").reset();
      loadMyRequests();
    } else {
      showToast(data.error || "Request failed. Try again.", "error");
    }
  });
}

async function loadMyRequests() {
  const container = document.getElementById("my-requests-list");
  const { ok, data } = await apiCall("/blood/my-requests");
  if (!ok || !data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No requests yet. Create your first request above.</p></div>';
    return;
  }
  const statusColors = { searching: "var(--yellow)", donor_found: "var(--green)", completed: "var(--gray-400)", cancelled: "var(--red)" };
  const statusIcons = { searching: "🔍", donor_found: "✅", completed: "🏆", cancelled: "❌" };
  container.innerHTML = data.map(req => `
    <div style="border:1.5px solid var(--gray-200);border-radius:10px;padding:16px;margin-bottom:12px;transition:var(--transition);" onmouseover="this.style.borderColor='var(--red-light)'" onmouseout="this.style.borderColor='var(--gray-200)'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;font-weight:800;color:var(--red);">${req.blood_group_needed}</span>
          <span class="urgency-tag ${req.urgency === 'critical' ? 'urgent' : req.urgency === 'urgent' ? 'high-priority' : 'normal-tag'}">${req.urgency}</span>
        </div>
        <span style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:${statusColors[req.status] || 'var(--gray-400)'}">
          ${statusIcons[req.status] || '?'} ${req.status.replace('_',' ').toUpperCase()}
        </span>
      </div>
      <div style="font-size:13px;color:var(--gray-600);margin-bottom:4px;">🏥 ${req.hospital_name}</div>
      <div style="font-size:12px;color:var(--gray-400);">👤 ${req.patient_name} · ${timeAgo(req.created_at)}</div>
      ${req.matched_donors?.length ? `<div style="font-size:12px;color:var(--green);margin-top:6px;">✅ ${req.matched_donors.length} donor(s) alerted</div>` : ''}
    </div>
  `).join("");
}
async function sendCommunityAlert() {
  const bloodGroup = document.querySelector('input[name="blood_group"]:checked')?.value;
  const hospital = document.getElementById("hospital-name").value.trim();
  if (!bloodGroup || !hospital) { showToast("Select blood group and hospital first", "error"); return; }
  const btn = document.getElementById("community-btn");
  btn.textContent = "📡 Sending..."; btn.disabled = true;
  const { ok, data } = await apiCall("/blood/proximity-community-alert", "POST", {
    blood_group_needed: bloodGroup,
    hospital_name: hospital,
    lat: window._userLat || 0,
    lng: window._userLng || 0,
    radius_km: 500
  });
  btn.textContent = "📡 Send Community Proximity Alert"; btn.disabled = false;
  if (ok) {
    showToast(`🏘️ Community alerted! ${data.alerts_sent} donors in ${data.radius_km}km notified!`, "success");
  } else {
    showToast(data.error || "Alert failed", "error");
  }
}