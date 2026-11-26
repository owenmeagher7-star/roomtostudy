// RoomtoStudy – StFX Edition (Fixed)

const firebaseConfig = {
  apiKey: "AIzaSyCLiY1eDLyQY1FZdUNYJf3HC3-hPTfhNp4",
  authDomain: "teo-project-679ad.firebaseapp.com",
  databaseURL: "https://teo-project-679ad-default-rtdb.firebaseio.com",
  projectId: "teo-project-679ad",
  storageBucket: "teo-project-679ad.firebasestorage.app",
  messagingSenderId: "583737240437",
  appId: "1:583737240437:web:1aa71f91631cdb43f5013c"
};

const SHOW_DEMO_DATA = true;
const LIVE_ROOM_ID = "lib-sr5";

var ROOMS = [
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

var roomState = {};
var liveReadings = {};
var hardware = {};
var checkins = [];
var currentFilter = "all";
var db = null;
var demoCache = {};

function label(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function soundStatusFor(level) {
  if (level > 55) return "loud";
  if (level > 35) return "moderate";
  return "quiet";
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findRoom(id) {
  for (var i = 0; i < ROOMS.length; i++) {
    if (ROOMS[i].id === id) return ROOMS[i];
  }
  return null;
}

function formatTime(value) {
  var d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function toLocalInputValue(d) {
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function demoReading(room) {
  var soundLevel = Math.min(85, Math.round(20 + Math.random() * 45));
  var busy = (room.category === "library" && room.capacity > 10) || room.id === "well-gather";
  var occupied = Math.random() < (busy ? 0.48 : 0.3);
  var seatsUsed = occupied ? Math.max(1, Math.floor(Math.random() * Math.min(room.capacity, 8))) : 0;
  return { soundLevel: soundLevel, occupied: occupied, seatsUsed: seatsUsed };
}

function rebuildState() {
  roomState = {};
  for (var i = 0; i < ROOMS.length; i++) {
    var room = ROOMS[i];
    var r = liveReadings[room.id];
    var source = "none";
    var reading = null;

    if (room.id === LIVE_ROOM_ID && (hardware.sound || hardware.force)) {
      var level = hardware.sound ? (hardware.sound.peak_to_peak || 0) : 0;
      var occ = hardware.force ? (hardware.force.raw || 0) >= 21 : false;
      reading = { soundLevel: level, occupied: occ, seatsUsed: occ ? 1 : 0 };
      source = "live";
    } else if (r) {
      reading = {
        soundLevel: Number(r.soundLevel) || 0,
        occupied: !!r.occupied,
        seatsUsed: Number(r.seatsUsed) || (r.occupied ? 1 : 0)
      };
      source = "live";
    } else if (SHOW_DEMO_DATA) {
      if (!demoCache[room.id]) demoCache[room.id] = demoReading(room);
      reading = demoCache[room.id];
      source = "demo";
    }

    roomState[room.id] = {
      soundLevel: reading ? reading.soundLevel : 0,
      soundStatus: reading ? soundStatusFor(reading.soundLevel) : "quiet",
      occupied: reading ? reading.occupied : false,
      seatsUsed: reading ? reading.seatsUsed : 0,
      capacity: room.capacity,
      source: source
    };
  }
}

function refreshAll() {
  rebuildState();
  renderRooms();
  renderStatus();
  updateStats();
  var el = document.getElementById("last-updated");
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function renderRooms() {
  var grid = document.getElementById("rooms-grid");
  if (!grid) return;

  var html = "";
  for (var i = 0; i < ROOMS.length; i++) {
    var room = ROOMS[i];
    if (currentFilter !== "all" && room.category !== currentFilter) continue;

    var state = roomState[room.id] || { source: "none", soundStatus: "quiet", occupied: false, seatsUsed: 0, capacity: room.capacity };
    var noData = state.source === "none";
    var seatsText = noData ? "No sensor data yet" : (state.occupied ? state.seatsUsed + "/" + state.capacity + " seats" : "Empty");

    html += '<div class="room-card ' + (noData ? "" : state.soundStatus) + '" data-id="' + escapeHtml(room.id) + '">';
    html += '<div class="building">' + escapeHtml(room.building) + '</div>';
    html += '<div class="name">' + escapeHtml(room.name) + '</div>';
    html += '<div class="meta">';
    if (!noData) {
      html += '<span class="badge ' + state.soundStatus + '">' + label(state.soundStatus) + '</span>';
      html += '<span class="badge ' + (state.occupied ? "occupied" : "empty") + '">' + (state.occupied ? "Occupied" : "Empty") + '</span>';
    }
    html += '</div>';
    html += '<div class="seats">' + seatsText + (room.note ? " · " + escapeHtml(room.note) : "") + '</div>';
    html += '</div>';
  }
  grid.innerHTML = html || "<p style='text-align:center;color:#6b7280;'>No spaces match this filter.</p>";

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
    var state = roomState[room.id] || { source: "none", soundStatus: "quiet", occupied: false, seatsUsed: 0, capacity: room.capacity };
    var noData = state.source === "none";
    var seatsText = state.occupied ? state.seatsUsed + " of " + state.capacity : "Empty";
    var sourceText = state.source === "live" ? "Live sensor" : state.source === "demo" ? "Demo data" : "No data";

    html += '<div class="status-card">';
    html += '<div class="status-card-top">';
    html += '<div><h3>' + escapeHtml(room.name) + '</h3><div class="building-tag">' + escapeHtml(room.building) + '</div></div>';
    if (!noData) html += '<span class="badge ' + state.soundStatus + '">' + label(state.soundStatus) + '</span>';
    html += '</div>';
    html += '<div class="status-metrics">';
    html += '<div class="metric"><span>Sound level</span><strong>' + (noData ? "–" : "~" + state.soundLevel + " dB") + '</strong></div>';
    html += '<div class="metric"><span>Occupancy</span><strong>' + (noData ? "–" : '<span class="badge ' + (state.occupied ? "occupied" : "empty") + '">' + seatsText + '</span>') + '</strong></div>';
    html += '<div class="metric"><span>Capacity</span><strong>' + room.capacity + '</strong></div>';
    html += '<div class="metric"><span>Source</span><strong>' + sourceText + '</strong></div>';
    html += '</div></div>';
  }
  grid.innerHTML = html;
}

function updateStats() {
  var quiet = 0, empty = 0, active = 0;
  for (var i = 0; i < ROOMS.length; i++) {
    var s = roomState[ROOMS[i].id];
    if (!s || s.source === "none") continue;
    if (s.soundStatus === "quiet") quiet++;
    if (!s.occupied) empty++;
    active += s.seatsUsed || 0;
  }
  var set = function (id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("stat-quiet", quiet);
  set("stat-empty", empty);
  set("stat-active", active);
}

function populateRoomSelect() {
  var select = document.getElementById("room-select");
  if (!select) return;
  var html = '<option value="">Select a space…</option>';
  for (var i = 0; i < ROOMS.length; i++) {
    html += '<option value="' + escapeHtml(ROOMS[i].id) + '">' + escapeHtml(ROOMS[i].name) + ' – ' + escapeHtml(ROOMS[i].building) + '</option>';
  }
  select.innerHTML = html;
}

function renderActivity() {
  var list = document.getElementById("activity-list");
  if (!list) return;
  if (!checkins.length) {
    list.innerHTML = "<p style='color:#6b7280;'>No check-ins yet.</p>";
    return;
  }
  var html = "";
  var recent = checkins.slice(-8).reverse();
  for (var i = 0; i < recent.length; i++) {
    var c = recent[i];
    var room = findRoom(c.roomId);
    html += '<div class="activity-item"><span><strong>' + escapeHtml(room ? room.name : c.roomId) + '</strong></span>' +
      '<span>' + formatTime(c.checkIn) + ' → ' + formatTime(c.checkOut) + '</span></div>';
  }
  list.innerHTML = html;
}

function connectFirebase() {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK did not load");
    return;
  }
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();

  db.ref("/rooms").on("value", function (snap) {
    var data = snap.val();
    if (data) {
      var list = [];
      Object.keys(data).forEach(function (id) {
        var r = data[id] || {};
        list.push({
          id: id,
          name: r.name || id,
          building: r.building || "",
          category: r.category || "library",
          capacity: Number(r.capacity) || 1,
          note: r.note || ""
        });
      });
      ROOMS = list;
      populateRoomSelect();
    }
    refreshAll();
  });

  db.ref("/readings").on("value", function (snap) {
    liveReadings = snap.val() || {};
    refreshAll();
  });

  db.ref("/sensors/sound").on("value", function (snap) {
    hardware.sound = snap.val();
    refreshAll();
  });

  db.ref("/sensors/force").on("value", function (snap) {
    hardware.force = snap.val();
    refreshAll();
  });

  db.ref("/checkins").orderByChild("createdAt").limitToLast(40).on("value", function (snap) {
    var list = [];
    snap.forEach(function (child) {
      list.push(child.val());
    });
    checkins = list;
    renderActivity();
  });
}

function setupCheckin() {
  var form = document.getElementById("checkin-form");
  var success = document.getElementById("success");
  var successMsg = document.getElementById("success-msg");
  var resetBtn = document.getElementById("reset-btn");
  var inTime = document.getElementById("checkin-time");
  var outTime = document.getElementById("checkout-time");

  function setDefaultTimes() {
    var now = new Date();
    if (inTime) inTime.value = toLocalInputValue(now);
    if (outTime) outTime.value = toLocalInputValue(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  }
  setDefaultTimes();

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var roomId = document.getElementById("room-select").value;
      var checkIn = new Date(inTime.value);
      var checkOut = new Date(outTime.value);
      if (!roomId) return;
      if (checkOut <= checkIn) {
        alert("Check-out time must be after check-in time.");
        return;
      }

      var entry = {
        roomId: roomId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        createdAt: Date.now()
      };

      var done = function () {
        var room = findRoom(roomId);
        successMsg.textContent = (room ? room.name : roomId) + " until " + formatTime(entry.checkOut) + ".";
        form.style.display = "none";
        if (success) success.classList.remove("hidden");
      };

      if (db) {
        db.ref("/checkins").push(entry).then(done).catch(function (err) {
          console.error(err);
          alert("Could not save check-in.");
        });
      } else {
        checkins.push(entry);
        renderActivity();
        done();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      setDefaultTimes();
      form.style.display = "";
      if (success) success.classList.add("hidden");
    });
  }
}

function setupControls() {
  var filters = document.querySelectorAll(".filter");
  for (var i = 0; i < filters.length; i++) {
    filters[i].addEventListener("click", function () {
      for (var j = 0; j < filters.length; j++) filters[j].classList.remove("active");
      this.classList.add("active");
      currentFilter = this.getAttribute("data-filter");
      renderRooms();
    });
  }

  var refresh = document.getElementById("refresh-btn");
  if (refresh) {
    refresh.addEventListener("click", function () {
      demoCache = {};
      refreshAll();
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  populateRoomSelect();
  setupControls();
  setupCheckin();
  refreshAll();
  renderActivity();
  connectFirebase();
});
