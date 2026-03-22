// --- FIREBASE CONFIGURATION ---
// IMPORTANT: Please create a free Firebase project, enable Realtime Database (Test Mode),
// and paste your configuration object here.
const firebaseConfig = {
  // apiKey: "YOUR_API_KEY",
  // authDomain: "YOUR_AUTH_DOMAIN",
  // databaseURL: "YOUR_DATABASE_URL",
  // projectId: "YOUR_PROJECT_ID",
  // storageBucket: "YOUR_STORAGE_BUCKET",
  // messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  // appId: "YOUR_APP_ID"
};

let db = null;
if (firebaseConfig.apiKey && typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}
// ------------------------------

const pages = ["page1","page2","page3","page4"];
const SETTINGS_KEY = "nist_mess_settings";
const defaultSettings = {
  isBookingOpen: true,
  openMonday: true,
  openSaturday: false,
  specialSundayBreakfast: false,
  everydayStart: "18:00",
  everydayEnd: "21:30",
  saturdayStart: "13:30",
  saturdayEnd: "16:30",
  specialStart: "18:00",
  specialEnd: "21:30",
  tokenLink: "https://nist-university-admin.example.com"
};
let adminSettings = { ...defaultSettings };

const dayTimeMap = {
  Monday:["Day"],
  Tuesday:["Night"],
  Wednesday:["Night"],
  Thursday:["Night"],
  Friday:["Night"],
  Saturday:["Day"],
  Sunday:["Day","Night"],
  "Special Breakfast (Mon-Fri)": ["Day"]
};

const bookingToTokenDays = {
  Sunday:["Monday","Special Breakfast (Mon-Fri)"],
  Monday:["Tuesday"],
  Tuesday:["Wednesday"],
  Wednesday:["Thursday"],
  Thursday:["Friday"],
  Friday:["Saturday"],
  Saturday:["Sunday"]
};

const menuByDayTime = {
  "Monday|Day": { veg:["Paneer"], nonveg:["Egg Curry"] },
  "Tuesday|Night": { veg:["Baby Corn Chilli","Aloo Gobi Masala"], nonveg:["Egg Curry"] },
  "Wednesday|Night": { veg:["Paneer Curry"], nonveg:["Chicken Curry","Chicken Chilli"] },
  "Thursday|Night": { veg:["Mixed Veg"], nonveg:["Chicken Curry"] },
  "Friday|Night": { veg:["Paneer Masala"], nonveg:["Fish Curry","Fish Fry"] },
  "Saturday|Day": { veg:["Paneer"], nonveg:["Egg Curry"] },
  "Sunday|Day": { veg:["Mushroom Curry"], nonveg:["Egg Curry"] },
  "Sunday|Night": { veg:["Paneer Do Pyaza"], nonveg:["Chicken Butter Masala"] },
  "Special Breakfast (Mon-Fri)|Day": { veg:["Vegetable Upma","Poha"], nonveg:["Egg Sandwich","Egg Bhurji"] }
};

let studentData = {};

const studentForm = document.getElementById("studentForm");
const dayForm = document.getElementById("dayForm");
const menuForm = document.getElementById("menuForm");
const error1 = document.getElementById("error1");
const error2 = document.getElementById("error2");
const error3 = document.getElementById("error3");

const daySelect = document.getElementById("day");
const timeSelect = document.getElementById("time");
const foodType = document.getElementById("foodType");
const menuItem = document.getElementById("menuItem");
const selectedDay = document.getElementById("selectedDay");
const selectedTime = document.getElementById("selectedTime");

const steps = ["step1dot","step2dot","step3dot","step4dot"].map(id=>document.getElementById(id));

let isSavingSettings = false;

async function loadAdminSettings() {
  if (isSavingSettings) return;
  
  // Protocol check: If file://, show warning
  if (window.location.protocol === 'file:') {
    showProtocolWarning();
  }

  try {
    const r = await fetch('/api/settings');
    if (r.ok) {
      const j = await r.json();
      adminSettings = { ...defaultSettings, ...j.settings };
      globalBookingOpen = adminSettings.isBookingOpen ?? true;
      updateDayTime();
      setAdminUI();
      updateTimeLimitUI();
      
      const sBadge = document.getElementById("statusBadge");
      if (sBadge) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sBadge.innerHTML = `<span style="width:6px; height:6px; background:#10b981; border-radius:50%;"></span> Synced: ${timeStr}`;
        sBadge.style.background = "#f0fdf4";
        sBadge.style.color = "#166534";
      }
    }
  } catch (e) {
    const sBadge = document.getElementById("statusBadge");
    if (sBadge) {
      sBadge.innerHTML = '<span style="width:6px; height:6px; background:#ef4444; border-radius:50%;"></span> SERVER DISCONNECTED';
      sBadge.style.background = "#fef2f2";
      sBadge.style.color = "#991b1b";
    }
    console.warn("Server unreachable. Make sure node server.js is running and you use http://localhost:8080");
  }
}

async function checkDatabaseStatus() {
  const dbBadge = document.getElementById("dbStatusBadge");
  const dbDot = document.getElementById("dbStatusDot");
  if (!dbBadge || !dbDot) return;

  try {
    const r = await fetch('/api/status');
    if (r.ok) {
      const j = await r.json();
      if (j.status === "connected") {
        dbBadge.innerHTML = `<span style="width:6px; height:6px; background:#10b981; border-radius:50%;"></span> DB: Connected (${j.dbName})`;
        dbBadge.style.background = "#f0fdf4";
        dbBadge.style.color = "#166534";
        dbBadge.style.borderColor = "#bbf7d0";
      } else {
        dbBadge.innerHTML = `<span style="width:6px; height:6px; background:#f59e0b; border-radius:50%;"></span> DB: ${j.status.toUpperCase()}`;
        dbBadge.style.background = "#fffbeb";
        dbBadge.style.color = "#92400e";
        dbBadge.style.borderColor = "#fde68a";
      }
    } else {
      throw new Error();
    }
  } catch (e) {
    dbBadge.innerHTML = `<span style="width:6px; height:6px; background:#ef4444; border-radius:50%;"></span> DB: Error`;
    dbBadge.style.background = "#fef2f2";
    dbBadge.style.color = "#991b1b";
    dbBadge.style.borderColor = "#fecaca";
  }
}

function showProtocolWarning() {
  if (document.getElementById("protocolWarning")) return;
  const warning = document.createElement("div");
  warning.id = "protocolWarning";
  warning.style = "position:fixed; top:0; left:0; right:0; background:#fef2f2; border-bottom:1px solid #ef4444; padding:15px; text-align:center; z-index:10000; color:#991b1b; font-weight:bold; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);";
  warning.innerHTML = `
    ⚠️ YOU ARE OPENING THE FILE DIRECTLY. THE SYSTEM WILL NOT WORK.<br>
    Please use: <a href="http://localhost:8080" style="color:#2563eb; text-decoration:underline;">http://localhost:8080</a> in your browser.
  `;
  document.body.prepend(warning);
}

async function saveAdminSettings() {
  isSavingSettings = true;
  try {
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminSettings)
    });
    if (!r.ok) throw new Error("Server responded with " + r.status);
    console.log("Settings saved.");
  } catch (e) {
    alert("Connection Error: Could not save settings to server.");
    console.error(e);
  } finally {
    isSavingSettings = false;
  }
}

function setAdminUI() {
  // Update Badge and Indicator
  const badge = document.getElementById("adminBookingStatusBadge");
  const indicator = document.getElementById("statusIndicator");
  if (badge) badge.textContent = globalBookingOpen ? "Open" : "Closed";
  if (indicator) indicator.style.backgroundColor = globalBookingOpen ? "var(--success)" : "var(--danger)";

  // Update Checkboxes
  const mon = document.getElementById("adminMondayOpen");
  const sat = document.getElementById("adminSaturdayOpen");
  const spec = document.getElementById("adminSpecialSundayBreakfast");
  if (mon) mon.checked = !!adminSettings.openMonday;
  if (sat) sat.checked = !!adminSettings.openSaturday;
  if (spec) spec.checked = !!adminSettings.specialSundayBreakfast;

  // Update Time Inputs
  const inputs = ["everydayStart", "everydayEnd", "saturdayStart", "saturdayEnd", "specialStart", "specialEnd"];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = adminSettings[id] || "";
    }
  });
}
function isDayOpen(day){
  if(day === "Monday") return adminSettings.openMonday;
  if(day === "Saturday") return adminSettings.openSaturday;
  return ["Tuesday","Wednesday","Thursday","Friday","Sunday"].includes(day);
}

function isSpecialSundayBreakfastOpen(){
  if(!adminSettings.specialSundayBreakfast) return false;
  const now = new Date();
  const min = parseTimeToMinutes(adminSettings.specialStart) ?? 18*60;
  const max = parseTimeToMinutes(adminSettings.specialEnd) ?? 21*60 + 30;
  const current = now.getHours() * 60 + now.getMinutes();
  return now.toLocaleDateString(undefined,{weekday:'long'}) === 'Sunday' && current >= min && current <= max;
}

function setAdminCheckboxes() {
  setAdminUI();
}

function parseTimeToMinutes(time){
  const parts = time.split(":");
  if(parts.length!==2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if(Number.isNaN(h)||Number.isNaN(m)) return null;
  return h*60 + m;
}

function isDailyWindowOpen() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const everydayStart = parseTimeToMinutes(adminSettings.everydayStart) ?? 18*60;
  const everydayEnd = parseTimeToMinutes(adminSettings.everydayEnd) ?? 21*60+30;
  const isEverydayOpen = minutes >= everydayStart && minutes <= everydayEnd;
  const saturdayStart = parseTimeToMinutes(adminSettings.saturdayStart) ?? 13*60+30;
  const saturdayEnd = parseTimeToMinutes(adminSettings.saturdayEnd) ?? 16*60+30;
  const isSaturdayOpen = now.toLocaleDateString(undefined,{weekday:'long'}) === 'Saturday' && minutes >= saturdayStart && minutes <= saturdayEnd;
  return isEverydayOpen || isSaturdayOpen;
}

function setActive(pageId) {
  pages.forEach(p=>{
    const el = document.getElementById(p);
    if(el) el.classList.remove("active");
  });
  const target = document.getElementById(pageId);
  if(target) target.classList.add("active");
  const idx = pages.indexOf(pageId);
  steps.forEach((s,i)=> {
    if(s) s.classList.toggle("active", i<=idx);
  });
}

function showError(el, msg) { el.textContent = msg; if(msg) setTimeout(()=>{el.textContent = "";}, 4000); }

async function fetchRecordsFromBackend(){
  if (db) {
    try {
      const snapshot = await db.ref('records').once('value');
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch(e) { console.error("Firebase read error", e); return []; }
  }
  
  try {
    const r = await fetch('/api/list');
    if(r.ok) {
      const j = await r.json();
      return j.records || [];
    }
    throw new Error("API responded with error " + r.status);
  } catch(e) {
    console.error("Server API disconnected. Submissions not synced.", e);
    return []; // Return empty list instead of local fallback to avoid confusion
  }
}

function getBookingDate() {
  return new Date().toISOString().slice(0,10);
}

async function isRollUsedOnDate(roll, bookingDate){
  const records = await fetchRecordsFromBackend();
  return records.some(r => {
    if(!r.roll) return false;
    const sameRoll = r.roll.toLowerCase() === roll.toLowerCase();
    if(!sameRoll) return false;
    if(r.bookingDate) return r.bookingDate === bookingDate;
    // For legacy records without bookingDate, fallback: compare day name to today day name.
    if(r.day){
      const todayDayName = new Date(bookingDate).toLocaleDateString(undefined,{weekday:'long'});
      return r.day === todayDayName;
    }
    return false;
  });
}

async function saveStudent(record) {
  try {
    const r = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const j = await r.json();
    if (j.success) {
      if (document.getElementById("page5")) showMessList(true);
      return true;
    } else {
      alert("Error: " + (j.message || "Submission failed."));
      return false;
    }
  } catch (e) {
    alert("CRITICAL ERROR: Could not connect to the Server. Make sure the server is running and you are using http://localhost:8080");
    console.error(e);
    return false;
  }
}

async function getSavedRecords(){
  return await fetchRecordsFromBackend();
}

let globalBookingOpen = true; // updated by firebase listener

function updateTimeLimitUI() {
  const info = document.getElementById("bookingWindowInfo");
  const anyInput = document.querySelectorAll("#studentForm input, #studentForm select, #studentForm button.primary");
  const dailyOpen = isDailyWindowOpen();

  // MASTER SWITCH CHECK
  if (!globalBookingOpen) {
    if (info) {
      info.innerHTML = `<div style="text-align:center;"><span style="color:var(--danger); font-weight:bold; font-size:1.1rem;">BOOKING IS CURRENTLY CLOSED</span><br><small style="color:var(--text-muted);">Wait for admin to open booking.</small></div>`;
      info.style.background = "#fff1f1";
      info.style.borderColor = "var(--danger)";
    }
    anyInput.forEach(i => i.disabled = true);
    return;
  }

  // If Master Switch is ON, enable the form
  anyInput.forEach(i => i.disabled = false);

  if (!dailyOpen) {
    if (info) {
      info.innerHTML = `<div style="text-align:center;"><span style="color:var(--success); font-weight:bold;">BOOKING OPEN (MANUAL OVERRIDE)</span><br><small style="color:var(--text-muted);">The admin has manually opened booking for you.</small></div>`;
      info.style.background = "#f0fdf4";
      info.style.borderColor = "var(--success)";
    }
  } else {
    if (info) {
      info.innerHTML = `<div style="text-align:center;"><span style="color:var(--success); font-weight:bold;">BOOKING OPEN</span><br><small style="color:var(--text-muted);">Automatic window is active.</small></div>`;
      info.style.background = "#f0fdf4";
      info.style.borderColor = "var(--success)";
    }
  }
}

function isBookingOpen() {
  return true;
}

function updateDayTime() {
  const now = new Date();
  const today = now.toLocaleDateString(undefined,{weekday:'long'});
  const tdDate = document.getElementById("todayDate");
  const tdDay = document.getElementById("todayDay");
  if(tdDate) tdDate.textContent = now.toLocaleDateString();
  if(tdDay) tdDay.textContent = today;
  if(!daySelect) return;

  daySelect.innerHTML = "";
  const hint = document.getElementById("dayHint");

  const dailyOpen = isDayOpen(today) && isDailyWindowOpen();
  const specialOpen = isSpecialSundayBreakfastOpen();
  
  // If Master Switch is ON, we allow selection even if schedule says no
  if (!globalBookingOpen && !dailyOpen && !specialOpen) {
    daySelect.disabled = true;
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `No booking available today (${today}).`;
    daySelect.append(opt);
    timeSelect.innerHTML = "<option value=''>No time slot available</option>";
    hint.textContent = `Today is ${today}. Booking is closed for this day or outside booking hours.`;
    return;
  }

  const tokenDays = bookingToTokenDays[today] ? [...bookingToTokenDays[today]] : [];
  if (today === 'Sunday' && specialOpen) {
    if(!tokenDays.includes("Special Breakfast (Mon-Fri)")) {
      tokenDays.push("Special Breakfast (Mon-Fri)");
    }
  }

  if(tokenDays.length === 0) {
    daySelect.disabled = true;
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No token days mapped for today's booking.";
    daySelect.append(opt);
    timeSelect.innerHTML = "<option value=''>No time slot available</option>";
    hint.textContent = "Contact admin to configure booking tokens.";
    return;
  }

  daySelect.disabled = false;
  daySelect.innerHTML = "<option value=''>Select token day</option>";
  tokenDays.forEach(day=>{
    const opt = document.createElement("option");
    opt.value = day;
    const label = day === "Special Breakfast (Mon-Fri)" ? "Special Breakfast token (Mon-Fri)" : `${day} token (booked today)`;
    opt.textContent = label;
    daySelect.append(opt);
  });
  hint.textContent = `Booking today (${today}). You can book tokens for: ${tokenDays.join(", ")}.`;
  updateTimeForDay(tokenDays[0]);
}

function updateTimeForDay(day){
  timeSelect.innerHTML = "";
  if(!day){ timeSelect.innerHTML = "<option value=''>Choose day first</option>"; return; }
  const slots = dayTimeMap[day] || [];
  if(slots.length===0){ timeSelect.innerHTML = "<option value=''>No slots available</option>"; return; }
  timeSelect.innerHTML = "<option value=''>Select time</option>";
  slots.forEach(t => { const opt = document.createElement("option"); opt.value=t; opt.textContent=t; timeSelect.append(opt); });
}

function fillMenuOptions(){
  const day = studentData.day; const time = studentData.time;
  const key = `${day}|${time}`;
  const choices = menuByDayTime[key];
  if(!choices){ menuItem.innerHTML = "<option value=''>No menu found</option>"; return; }
  selectedDay.value = day; selectedTime.value = time;
  menuItem.innerHTML = "<option value=''>Choose menu item</option>";
  if(foodType.value === "veg") choices.veg.forEach(i => { const opt=document.createElement("option"); opt.value=i; opt.textContent=i; menuItem.append(opt);} );
  if(foodType.value === "nonveg") choices.nonveg.forEach(i => { const opt=document.createElement("option"); opt.value=i; opt.textContent=i; menuItem.append(opt);} );
}

function generateTokenId(){
  const rand = Math.floor(Math.random()*9000)+1000;
  const now = Date.now().toString().slice(-5);
  return `NIST-${now}-${rand}`;
}

function renderToken() {
  const tokenDate = studentData.tokenDate || new Date().toLocaleString();
  studentData.tokenDate = tokenDate;
  studentData.tokenId = studentData.tokenId || generateTokenId();

  document.getElementById("tokenName").textContent = studentData.name;
  document.getElementById("tokenRoll").textContent = studentData.roll;
  document.getElementById("tokenMobile").textContent = studentData.mobile;
  document.getElementById("tokenHostel").textContent = studentData.hostel;
  document.getElementById("tokenRoom").textContent = studentData.room;
  document.getElementById("tokenDay").textContent = studentData.day;
  document.getElementById("tokenTime").textContent = studentData.time;
  document.getElementById("tokenFood").textContent = studentData.menuItem;
  document.getElementById("tokenId").textContent = studentData.tokenId;
  document.getElementById("tokenDate").textContent = studentData.tokenDate;
}

function getAdminFilters(){
  const h = document.getElementById("adminHostelFilter");
  const r = document.getElementById("adminRollFilter");
  const f = document.getElementById("adminFoodTypeFilter");
  const d = document.getElementById("adminDateFilter");
  return {
    hostel: h ? h.value : "all",
    roll: r ? r.value.trim().toLowerCase() : "",
    foodType: f ? f.value : "all",
    date: d ? d.value : ""
  };
}

async function showMessList(applyFilter = true) {
  const records = await getSavedRecords();
  const {hostel, roll, foodType, date} = getAdminFilters();
  const tbody = document.querySelector("#messTable tbody");
  tbody.innerHTML = "";

  let filtered = records;
  if(applyFilter){
    filtered = records.filter(r=>{
      let keep = true;
      if(hostel !== "all") keep = keep && r.hostel === hostel;
      if(roll) keep = keep && r.roll.toLowerCase().includes(roll);
      if(foodType !== "all") {
        const type = (r.foodType || "").toLowerCase();
        keep = keep && (type === foodType);
      }
      if(date) {
        keep = keep && ((r.bookingDate || "") === date);
      }
      return keep;
    });
  }

  const totalCount = filtered.length;
  const vegCount = filtered.filter(r=> (r.foodType || "").toLowerCase() === "veg").length;
  const nonvegCount = filtered.filter(r=> (r.foodType || "").toLowerCase() === "nonveg").length;
  document.getElementById("adminTotalCount").textContent = totalCount;
  document.getElementById("adminVegCount").textContent = vegCount;
  document.getElementById("adminNonVegCount").textContent = nonvegCount;

  if(filtered.length===0){ tbody.innerHTML = '<tr><td colspan="10" style="text-align:center">No submissions match filters</td></tr>'; return; }
  filtered.forEach(r => {
    const tr = document.createElement("tr");
    const foodTypeLabel = r.foodType ? (r.foodType.toLowerCase() === 'veg' ? 'Veg' : 'Non-Veg') : '--';
    const bookingDate = r.bookingDate || '--';
    const dayLabel = r.day || '--';
    const timeLabel = r.time || '--';
    const tokenId = r.tokenId || '--';
    const menuItem = r.menuItem || '--';
    
    tr.innerHTML = `
      <td>${r.name || '--'}</td>
      <td>${r.roll || '--'}</td>
      <td>${r.room || '--'}</td>
      <td>${r.hostel || '--'}</td>
      <td>${r.mobile || '--'}</td>
      <td>${dayLabel}</td>
      <td>${timeLabel}</td>
      <td>${foodTypeLabel}</td>
      <td>${menuItem}</td>
      <td>${bookingDate}</td>
      <td>${tokenId}</td>
    `;
    tbody.append(tr);
  });
 }

if (studentForm) {
  studentForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const name = studentForm.name.value.trim();
    const roll = studentForm.roll.value.trim();
    const room = studentForm.room.value.trim();
    const hostel = studentForm.hostel.value;
    const mobile = studentForm.mobile.value.trim();
    if(!name||!roll||!room||!hostel||!mobile){ showError(error1, "Please complete all required fields."); return; }
    if(!/^\d{10}$/.test(mobile)){ showError(error1, "Enter a 10-digit mobile number."); return; }
    studentData = { name, roll, room, hostel, mobile };
    setActive("page2");
  });
}

if (daySelect) {
  daySelect.addEventListener("change", ()=>{ updateTimeForDay(daySelect.value); });
}

if (dayForm) {
  dayForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const day = daySelect.value;
    const time = timeSelect.value;
    if(!day || !time){ showError(error2, "Please select day and time slot."); return; }
    const bookingDate = getBookingDate();
    if(await isRollUsedOnDate(studentData.roll, bookingDate)){
      showError(error2, "This roll number already has a token for today. Try again tomorrow.");
      return;
    }
    studentData.day = day;
    studentData.time = time;
    studentData.bookingDate = bookingDate;
    foodType.value = "";
    menuItem.innerHTML = "<option value=''>Choose food type first</option>";
    setActive("page3");
  });
}

if (foodType) {
  foodType.addEventListener("change", fillMenuOptions);
}

if (menuForm) {
  menuForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const type=foodType.value;
    const item=menuItem.value;
    if(!type||!item){ showError(error3, "Choose food type and menu item."); return; }
    studentData.foodType = type;
    studentData.menuItem = item;
    studentData.bookingDate = studentData.bookingDate || getBookingDate();
    renderToken();
    const record = { ...studentData };
    await saveStudent(record);
    setActive("page4");
  });
}

const backTo1 = document.getElementById("backTo1");
if (backTo1) {
  backTo1.addEventListener("click", ()=> setActive("page1"));
}
const backTo2 = document.getElementById("backTo2");
if (backTo2) {
  backTo2.addEventListener("click", ()=> setActive("page2"));
}

const printTokenBtn = document.getElementById("printToken");
if (printTokenBtn) {
  printTokenBtn.addEventListener("click", ()=> window.print());
}
const copyLinkBtn = document.getElementById("copyTokenLink");
if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", ()=>{
    const link = studentData.tokenLink || "";
    if(!link){
      alert("No token link available. Generate a token first.");
      return;
    }
    navigator.clipboard.writeText(link).then(()=>{
      alert("Token link copied to clipboard.");
    }).catch(()=>{
      prompt("Copy this token link:", link);
    });
  });
}
const downloadTokenBtn = document.getElementById("downloadToken");
if (downloadTokenBtn) {
  downloadTokenBtn.addEventListener("click", ()=>{
    const div = document.getElementById("tokenCard");
    const html = `<html><head><title>Mess Token</title><style>body{font-family:Arial;}</style></head><body>${div.outerHTML}</body></html>`;
    const blob = new Blob([html],{type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${studentData.roll || 'token'}-mess-token.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

const ADMIN_PASSWORD = "nist"; // simplified for test
async function openAdminView(){
  window.location.href = 'admin.html';
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded. Initializing...");

  // --- Handle Admin Auth Overlay on admin.html ---
  const adminOverlay = document.getElementById("adminLoginOverlay");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminPwInput = document.getElementById("adminPasswordInput");
  const adminLoginError = document.getElementById("adminLoginError");

  if (adminOverlay && adminLoginBtn) {
    console.log("Admin Overlay detected. Attaching login listener.");
    adminLoginBtn.addEventListener("click", () => {
      const pw = adminPwInput.value;
      if (pw === "nist2026" || pw === "nist") {
        console.log("Login successful.");
        adminOverlay.style.display = "none";
        const page5 = document.getElementById("page5");
        if(page5) page5.classList.add("active");
        showMessList(true);
      } else {
        console.log("Login failed.");
        adminLoginError.textContent = "Incorrect password. (Try 'nist')";
      }
    });
    
    // Also allow Enter key
    adminPwInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") adminLoginBtn.click();
    });
  }

  // --- NEW: Attach Open/Close Listeners Immediately ---
  const openBtn = document.getElementById("adminOpenBookingBtn");
  const closeBtn = document.getElementById("adminCloseBookingBtn");
  if (openBtn) {
    console.log("Attaching Open Booking listener");
    openBtn.addEventListener("click", async () => {
      console.log("Open Booking clicked");
      adminSettings.isBookingOpen = true;
      globalBookingOpen = true;
      setAdminUI();
      await saveAdminSettings();
      await loadAdminSettings();
    });
  }
  if (closeBtn) {
    console.log("Attaching Close Booking listener");
    closeBtn.addEventListener("click", async () => {
      console.log("Close Booking clicked");
      adminSettings.isBookingOpen = false;
      globalBookingOpen = false;
      setAdminUI();
      await saveAdminSettings();
      await loadAdminSettings();
    });
  }

  const syncBtn = document.getElementById("manualSyncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      syncBtn.textContent = "Syncing...";
      await loadAdminSettings();
      syncBtn.textContent = "Sync Now";
    });
  }

  // --- Shared Initialization ---
  await loadAdminSettings();
  updateDayTime();

  // If we are on index.html (student page)
  if (document.getElementById("page1")) {
    console.log("Initializing student page...");
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      try {
        studentData = JSON.parse(decodeURIComponent(escape(atob(tokenParam))));
        renderToken();
        document.querySelector(".progress-wrap").style.display = "none";
        const showListBtn = document.getElementById("showList");
        if (showListBtn) {
          showListBtn.textContent = "New Token Booking";
          const clone = showListBtn.cloneNode(true);
          showListBtn.parentNode.replaceChild(clone, showListBtn);
          clone.addEventListener("click", (e) => { e.preventDefault(); window.location.href = window.location.pathname; });
        }
        setActive("page4");
        return;
      } catch (e) {
        console.error("Invalid token link", e);
      }
    }
    setActive("page1");
  }

  // --- Admin Page Specific Init ---
  if (document.getElementById("page5")) {
    console.log("Initializing admin filter listeners...");
    const dateEl = document.getElementById("adminDateFilter");
  const dateVal = dateEl ? dateEl.value : "";
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().slice(0, 10);
  }
    showMessList(true); // Load data immediately on admin page
    const applyAdminFilterBtn = document.getElementById("applyAdminFilter");
  if(applyAdminFilterBtn){ applyAdminFilterBtn.addEventListener("click", async ()=>{ await showMessList(); }); }
  const adminHostelFilter = document.getElementById("adminHostelFilter");
  if(adminHostelFilter){ adminHostelFilter.addEventListener("change", async ()=>{ await showMessList(); }); }
  const adminRollFilter = document.getElementById("adminRollFilter");
  if(adminRollFilter){ adminRollFilter.addEventListener("input", async ()=>{ await showMessList(); }); }
  const adminFoodTypeFilter = document.getElementById("adminFoodTypeFilter");
  if(adminFoodTypeFilter){ adminFoodTypeFilter.addEventListener("change", async ()=>{ await showMessList(); }); }
  const adminDateFilter = document.getElementById("adminDateFilter");
  if(adminDateFilter){ adminDateFilter.addEventListener("change", async ()=>{ await showMessList(); }); }
  const adminDownloadBtn = document.getElementById("adminDownloadCSV");
  if(adminDownloadBtn){ adminDownloadBtn.addEventListener("click", async ()=>{
      const records = await getSavedRecords();
      const rows = ["Roll,Name,Hostel,Room,Mobile,BookingDate,Day,Time,FoodType,FoodItem"];
      records.forEach(r=> rows.push([r.roll,r.name,r.hostel,r.room,r.mobile,r.bookingDate||'',r.day||'',r.time,r.foodType||'',r.menuItem||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")));
      const blob = new Blob([rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mess-tokens.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }); }
  const adminClearBtn = document.getElementById("adminClearAll");
  if(adminClearBtn){ adminClearBtn.addEventListener("click", async ()=>{
      if(window.confirm('WARNING: This will clear ALL token records from the SERVER database. Continue?')) {
        // Since we don't have a DELETE all API, we'll inform the user or implement a simple one if needed.
        // For now, let's keep it simple or just warn that it's disabled for security if no API exists.
        alert("Clear All feature is currently disabled for Server Safety. Please manually edit submissions.json if needed.");
      }
    }); }
  const adminPrintBtn = document.getElementById("adminPrint");
  if(adminPrintBtn){ adminPrintBtn.addEventListener("click", ()=>{ window.print(); }); }
  // Shared UI buttons
  const showListBtn = document.getElementById("showList");
  if(showListBtn){ showListBtn.addEventListener("click", async ()=>{ await openAdminView(); }); }
  const adminLoginButton = document.getElementById("adminLoginPre");
  if(adminLoginButton){ adminLoginButton.addEventListener("click", async ()=>{ await openAdminView(); }); }
  const adminResetBtn = document.getElementById("adminResetTimeLimit");
  if(adminResetBtn){
    adminResetBtn.addEventListener("click", ()=>{
      updateTimeLimitUI();
      showError(error3, "Admin settings refreshed.");
    });
  }

  const mondayToggle = document.getElementById("adminMondayOpen");
  const saturdayToggle = document.getElementById("adminSaturdayOpen");
  const specialToggle = document.getElementById("adminSpecialSundayBreakfast");
  const everydayStart = document.getElementById("everydayStart");
  const everydayEnd = document.getElementById("everydayEnd");
  const saturdayStart = document.getElementById("saturdayStart");
  const saturdayEnd = document.getElementById("saturdayEnd");
  const specialStart = document.getElementById("specialStart");
  const specialEnd = document.getElementById("specialEnd");
  const updateWindowButton = document.getElementById("adminSaveTimeWindow");

  if(mondayToggle){
    mondayToggle.addEventListener("change", async ()=>{
      adminSettings.openMonday = mondayToggle.checked;
      await saveAdminSettings();
      updateDayTime();
      updateTimeLimitUI();
    });
  }
  if(saturdayToggle){
    saturdayToggle.addEventListener("change", async ()=>{
      adminSettings.openSaturday = saturdayToggle.checked;
      await saveAdminSettings();
      updateDayTime();
      updateTimeLimitUI();
    });
  }
  if(specialToggle){
    specialToggle.addEventListener("change", async ()=>{
      adminSettings.specialSundayBreakfast = specialToggle.checked;
      await saveAdminSettings();
      updateDayTime();
      updateTimeLimitUI();
    });
  }


  if(updateWindowButton){
    updateWindowButton.addEventListener("click", async (e)=>{
      e.preventDefault();
      if(everydayStart && everydayEnd && saturdayStart && saturdayEnd && specialStart && specialEnd){
        adminSettings.everydayStart = everydayStart.value || adminSettings.everydayStart;
        adminSettings.everydayEnd = everydayEnd.value || adminSettings.everydayEnd;
        adminSettings.saturdayStart = saturdayStart.value || adminSettings.saturdayStart;
        adminSettings.saturdayEnd = saturdayEnd.value || adminSettings.saturdayEnd;
        adminSettings.specialStart = specialStart.value || adminSettings.specialStart;
        adminSettings.specialEnd = specialEnd.value || adminSettings.specialEnd;
        await saveAdminSettings();
        updateTimeLimitUI();
        updateDayTime();
        showError(error3, "Time windows updated and active.");
      }
    });
  }

  attachAdminButtons();
  updateTimeLimitUI();

  // --- Real-time Polling for Multi-device Sync ---
  // Check settings every 5 seconds on all devices
  setInterval(async () => {
    await loadAdminSettings();
    await checkDatabaseStatus();
    updateDayTime(); // ensure day time mapping is accurate
  }, 5000);

  // If on Admin page, refresh records every 5 seconds
  if (document.getElementById("page5")) {
    setInterval(async () => {
      await showMessList(true);
    }, 5000);
  }
  } // Closing the block starting at line 679
});