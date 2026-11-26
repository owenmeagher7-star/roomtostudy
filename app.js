// RoomtoStudy – StFX Edition (robust version)

const ROOMS = [
  { id: "lib-pod", name: "Study Pod", building: "Angus L. Macdonald Library", category: "library", capacity: 1, note: "Soundproof · 1st floor" },
  { id: "lib-sr1", name: "Study Room 1", building: "Angus L. Macdonald Library", category: "library", capacity: 6, note: "Bookable" },
  { id: "lib-sr2", name: "Study Room 2", building: "Angus L. Macdonald Library", category: "library", capacity: 6, note: "Bookable" },
  { id: "lib-sr3", name: "Study Room 3", building: "Angus L. Macdonald Library", category: "library", capacity: 4, note: "Bookable" },
  { id: "lib-sr4", name: "Study Room 4", building: "Angus L. Macdonald Library", category: "library", capacity: 4, note: "Bookable" },
  { id: "lib-sr5", name: "Study Room 5", building: "Angus L. Macdonald Library", category: "library", capacity: 8, note: "Bookable" },
  { id: "lib-main", name: "Main Floor Seating", building: "Angus L. Macdonald Library", category: "library", capacity: 40, note: "Open seating" },
  { id: "lib-quiet", name: "Quiet Study Area", building: "Angus L. Macdonald Library", category: "library", capacity: 20, note: "Silent preferred" },
  { id: "well-golden", name: "The Golden Chapel", building: "Wellspring (Morrison Hall)", category: "wellspring", capacity: 12, note: "Quiet study" },
  { id: "well-gather", name: "Gathering Room", building: "Wellspring (Morrison Hall)", category: "wellspring", capacity: 16, note: "Sofas & tables" },
  { id: "res-bishops", name: "Bishop's Hall Lounge", building: "Bishop's Hall", category: "residence", capacity: 14, note: "Residence study" },
  { id: "res-somers", name: "Somers Hall Study", building: "Somers Hall", category: "residence", capacity: 10, note: "Residence study" },
  { id: "res-mac", name: "MacIsaac Hall Lounge", building: "MacIsaac Hall", category: "residence", capacity: 12, note: "Residence study" },
  { id: "res-ollie", name: "Oland Hall Study", building: "Oland Hall", category: "residence", capacity: 10, note: "Residence study" }
];
// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyCLiY1eDLyQY1FZdUNYJf3HC3-hPTfhNp4",
  authDomain: "teo-project-679ad.firebaseapp.com",
  databaseURL: "https://teo-project-679ad-default-rtdb.firebaseio.com",
  projectId: "teo-project-679ad",
  storageBucket: "teo-project-679ad.firebasestorage.app",
  messagingSenderId: "583737240437",
  appId: "1:583737240437:web:1aa71f91631cdb43f5013c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ========== LIVE SENSOR CONNECTION ==========
// Change this if your Study Room 5 has a different ID in the code
const LIVE_ROOM_ID = "lib-sr5";   // ← most likely this one

function connectLiveSensors() {
  // Listen to Sound sensor
  db.ref("/sensors/sound").on("value", (snapshot) => {
    const data = snapshot.val();
    if (!data || !roomState[LIVE_ROOM_ID]) return;

    const level = data.peak_to_peak ?? 0;
    let status = "quiet";
    if (level > 55) status = "loud";
    else if (level > 35) status = "moderate";

    roomState[LIVE_ROOM_ID].soundLevel = level;
    roomState[LIVE_ROOM_ID].soundStatus = status;

    renderRooms();
    renderStatus();
    updateStats();
  });

  // Listen to Force sensor
  db.ref("/sensors/force").on("value", (snapshot) => {
    const data = snapshot.val();
    if (!data || !roomState[LIVE_ROOM_ID]) return;

    const occupied = (data.raw ?? 0) >= 21;   // same threshold as your dashboard

    roomState[LIVE_ROOM_ID].occupied = occupied;
    roomState[LIVE_ROOM_ID].seatsUsed = occupied ? 1 : 0;

    renderRooms();
    renderStatus();
    updateStats();
  });
}

// Start listening when the page loads
connectLiveSensors();
var roomState = {};
var currentFilter = "all";
var STORAGE_KEY = "roomtostudy_stfx_v2";

function loadCheckins() {
  try {
    var data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveCheckins(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-40)));
  } catch (e) {}
}

function generateSensorData() {
  for (var i = 0; i < ROOMS.length; i++) {
    var room = ROOMS[i];
    var soundLevel = Math.min(85, Math.round(20 + Math.random() * 45));
    var soundStatus = "quiet";
    if (soundLevel >= 50) soundStatus = "loud";
    else if (soundLevel >= 36) soundStatus = "moderate";

    var busy = (room.category === "library" && room.capacity > 10) || room.id === "well-gather";
    var occupied = Math.random() < (busy ? 0.48 : 0.3);
    var seatsUsed = 0;
    if (occupied) {
      seatsUsed = Math.max(1, Math.floor(Math.random() * Math.min(room.capacity, 8)));
    }

    roomState[room.id] = {
      soundLevel: soundLevel,
      soundStatus: soundStatus,
      occupied: occupied,
      seatsUsed: seatsUsed,
      capacity: room.capacity
    };
  }
}

function label(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderRooms() {
  var grid = document.getElementById("rooms-grid");
  if (!grid) return;

  var html = "";
  for (var i = 0; i < ROOMS.length; i++) {
    var room = ROOMS[i];
    if (currentFilter !== "all" && room.category !== currentFilter) continue;

    var state = roomState[room.id] || { soundStatus: "quiet", occupied: false, seatsUsed: 0, capacity: room.capacity };
    var seatsText = state.occupied
      ? state.seatsUsed + "/" + state.capacity + " seats"
      : "Empty";

    html += '<div class="room-card ' + state.soundStatus + '" data-id="' + room.id + '">';
    html += '<div class="building">' + room.building + '</div>';
    html += '<div class="name">' + room.name + '</div>';
    html += '<div class="meta">';
    html += '<span class="badge ' + state.soundStatus + '">' + label(state.soundStatus) + '</span>';
    html += '<span class="badge ' + (state.occupied ? "occupied" : "empty") + '">' + (state.occupied ? "Occupied" : "Empty") + '</span>';
    html += '</div>';
    html += '<div class="seats">' + seatsText + (room.note ? " · " + room.note : "") + '</div>';
    html += '</div>';
  }
  grid.innerHTML = html || "<p style='text-align:center;color:#6b7280;'>No spaces match this filter.</p>";

  // Click handlers
  var cards = grid.querySelectorAll(".room-card");
  for (var j = 0; j < cards.length; j++) {
    cards[j].onclick = function () {
      var id = this.getAttribute("data-id");
      var select = document.getElementById("room-select");
      if (select) select.value = id;

      var all = grid.querySelectorAll(".room-card");
      for (var k = 0; k < all.length; k++) all[k].classList.remove("selected");
      this.classList.add("selected");

      var checkin = document.getElementById("checkin");
      if (checkin) checkin.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }
}

function renderStatus() {
  var grid = document.getElementById("status-grid");
  if (!grid) return;

  var html = "";
  for (var i = 0; i < ROOMS.length; i++) {
    var room = ROOMS[i];
    var state = roomState[room.id] || { soundStatus: "quiet", occupied: false, seatsUsed: 0, capacity: room.capacity, soundLevel: 30 };
    var seatsText = state.occupied ? state.seatsUsed + " of " + state.capacity : "Empty";

    html += '<div class="status-card">';
    html += '<div class="status-card-top">';
    html += '<div><h3>' + room.name + '</h3><div class="building-tag">' + room.building + '</div></div>';
    html += '<span class="badge ' + state.soundStatus + '">' + label(state.soundStatus) + '</span>';
    html += '</div>';
    html += '<div class="status-metrics">';
    html += '<div class="metric"><span>Sound level</span><strong>~' + state.soundLevel + ' dB</strong></div>';
    html += '<div class="metric"><span>Occupancy</span><strong><span class="badge ' + (state.occupied ? "occupied" : "empty") + '">' + (state.occupied ? "Occupied" : "Empty") + '</span></strong></div>';
    html += '<div class="metric"><span>Seats</span><strong>' + seatsText + '</strong></div>';
    html += '</div></div>';
  }
  grid.innerHTML = html;
}

function updateStats() {
  var quiet = 0, empty = 0, active = 0;
  for (var id in roomState) {
    if (roomState[id].soundStatus === "quiet") quiet++;
    if (!roomState[id].occupied) empty++;
    active += roomState[id].seatsUsed || 0;
  }
  var elQ = document.getElementById("stat-quiet");
  var elE = document.getElementById("stat-empty");
  var elA = document.getElementById("stat-active");
  if (elQ) elQ.textContent = quiet;
  if (elE) elE.textContent = empty;
  if (elA) elA.textContent = active;
}

function populateSelect() {
  var select = document.getElementById("room-select");
  if (!select) return;
  var html = '<option value="">Select a space…</option>';
  for (var i = 0; i < ROOMS.length; i++) {
    html += '<option value="' + ROOMS[i].id + '">' + ROOMS[i].name + ' — ' + ROOMS[i].building + '</option>';
  }
  select.innerHTML = html;
}

function setDefaultTimes() {
  var now = new Date();
  var later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  function fmt(d) {
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  var cin = document.getElementById("checkin-time");
  var cout = document.getElementById("checkout-time");
  if (cin && !cin.value) cin.value = fmt(now);
  if (cout && !cout.value) cout.value = fmt(later);
}

function renderActivity() {
  var list = document.getElementById("activity-list");
  if (!list) return;
  var checkins = loadCheckins().reverse().slice(0, 6);
  if (checkins.length === 0) {
    list.innerHTML = '<div class="activity-item">No recent check-ins yet. Be the first!</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < checkins.length; i++) {
    var c = checkins[i];
    var room = null;
    for (var j = 0; j < ROOMS.length; j++) {
      if (ROOMS[j].id === c.room) { room = ROOMS[j]; break; }
    }
    var name = room ? room.name : c.room;
    var inT = new Date(c.checkin).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    var outT = new Date(c.checkout).toLocaleString([], { hour: "2-digit", minute: "2-digit" });
    html += '<div class="activity-item"><span><strong>' + name + '</strong> · ' + inT + ' → ' + outT + '</span><span>Anonymous</span></div>';
  }
  list.innerHTML = html;
}

function refreshAll() {
  generateSensorData();
  renderRooms();
  renderStatus();
  updateStats();
  var el = document.getElementById("last-updated");
  if (el) el.textContent = "just now";
}

function init() {
  generateSensorData();
  populateSelect();
  renderRooms();
  renderStatus();
  updateStats();
  setDefaultTimes();
  renderActivity();

  // Filters
  var filters = document.querySelectorAll(".filter");
  for (var i = 0; i < filters.length; i++) {
    filters[i].onclick = function () {
      for (var j = 0; j < filters.length; j++) filters[j].classList.remove("active");
      this.classList.add("active");
      currentFilter = this.getAttribute("data-filter");
      renderRooms();
    };
  }

  // Form
  var form = document.getElementById("checkin-form");
  if (form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      var roomId = document.getElementById("room-select").value;
      var checkin = document.getElementById("checkin-time").value;
      var checkout = document.getElementById("checkout-time").value;
      if (!roomId || !checkin || !checkout) return;
      if (new Date(checkout) <= new Date(checkin)) {
        alert("Check-out time must be after check-in time.");
        return;
      }

      var list = loadCheckins();
      list.push({ room: roomId, checkin: checkin, checkout: checkout, createdAt: new Date().toISOString() });
      saveCheckins(list);

      var roomName = roomId;
      for (var i = 0; i < ROOMS.length; i++) {
        if (ROOMS[i].id === roomId) { roomName = ROOMS[i].name; break; }
      }

      document.getElementById("success-msg").textContent =
        "You’re studying in " + roomName + " from " +
        new Date(checkin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        " until " +
        new Date(checkout).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        ". Enjoy the quiet!";

      form.classList.add("hidden");
      document.getElementById("success").classList.remove("hidden");
      renderActivity();
    };
  }

  var resetBtn = document.getElementById("reset-btn");
  if (resetBtn) {
    resetBtn.onclick = function () {
      form.classList.remove("hidden");
      document.getElementById("success").classList.add("hidden");
      form.reset();
      setDefaultTimes();
    };
  }

  var refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.onclick = function () {
      refreshBtn.textContent = "Refreshing…";
      refreshBtn.disabled = true;
      setTimeout(function () {
        refreshAll();
        refreshBtn.textContent = "↻ Refresh Sensors";
        refreshBtn.disabled = false;
      }, 350);
    };
  }

  // Auto refresh
  setInterval(refreshAll, 32000);
}

// Start when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
