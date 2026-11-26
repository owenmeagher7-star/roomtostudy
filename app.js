// RoomtoStudy – StFX Edition (with live Firebase sensors for Study Room 5)

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
const LIVE_ROOM_ID = "lib-sr5";   // Study Room 5

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

    const occupied = (data.raw ?? 0) >= 21;

    roomState[LIVE_ROOM_ID].occupied = occupied;
    roomState[LIVE_ROOM_ID].seatsUsed = occupied ? 1 : 0;

    renderRooms();
    renderStatus();
    updateStats();
  });
}

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

    // Don't overwrite the live Study Room 5
    if (room.id === LIVE_ROOM_ID) {
      if (!roomState[room.id]) {
        roomState[room.id] = {
          soundLevel: 0,
          soundStatus: "quiet",
          occupied: false,
          seatsUsed: 0,
          capacity: room.capacity
        };
      }
      continue;
    }

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
    html += '<div class="metric"><span>Occupancy</span><strong><span class="badge ' + (state.occupied ? 
