import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import "./chat-system.js";
import {
  getDatabase, ref, onValue, update, remove, push, set, get, query, orderByChild, equalTo, limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";
import { listenPlanFeatures } from "./plan_features.js";

// ==========================================
// 🚀 1. URL PARAMETRLARI VA XAVFSIZLIK 
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const viewAsId = urlParams.get('viewAs');
const restIdFromUrl = urlParams.get('rest') || urlParams.get('id');

let currentRestaurantId = restIdFromUrl || localStorage.getItem("restaurantId");
let currentUserId = localStorage.getItem("userId");

if (viewAsId && restIdFromUrl) {
  currentRestaurantId = restIdFromUrl;
  currentUserId = viewAsId;

  localStorage.setItem("restaurantId", restIdFromUrl);
  localStorage.setItem("userId", viewAsId);
  localStorage.setItem("role", "waiter");
  localStorage.setItem("isViewingAsAdmin", "true");

  window.currentWaiterId = viewAsId;
  console.log(t("admin_waiter_logged_in", "✅ Admin kuzatuvchi (Ofitsiant) sifatida muvaffaqiyatli kirdi."));
} else {
  const role = localStorage.getItem("role");

  if (!currentRestaurantId || !currentUserId || role !== "waiter") {
    console.warn(t("no_permission_redirect", "🚫 Ruxsat yo'q. Login sahifasiga yo'naltirilmoqda..."));
    window.location.replace("login.html");
  } else {
    window.currentWaiterId = currentUserId;
  }
}

// BASE_PATH viewAsId bloki currentRestaurantId ni to'g'rilaganidan keyin aniqlanadi
let BASE_PATH = `restaurants/${currentRestaurantId}`;

/* =========================
   FIREBASE
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCGCCIP3eFg40bOEENDLGcrw9c484ySCHQ",
  authDomain: "restoran-30d51.firebaseapp.com",
  databaseURL: "https://restoran-30d51-default-rtdb.firebaseio.com",
  projectId: "restoran-30d51",
  storageBucket: "restoran-30d51.firebasestorage.app",
  messagingSenderId: "862261129762",
  appId: "1:862261129762:web:5577e6821b4ad7ea4e507b",
  measurementId: "G-8NG56H5ZGG"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const auth = getAuth(app);
let lastLiveTablesSignature = "";
let lastAssignedOrdersSignature = "";

/* =========================
   OBUNA HOLATINI TEKSHIRISH 
========================= */
window.checkSubscriptionStatus = async function (restId) {
  if (!restId) return false;

  try {
    const snap = await get(ref(db, `restaurants/${restId}/subscription`));

    if (snap.exists()) {
      const sub = snap.val();
      const now = Date.now();

      const expireTime = sub.expireDate || sub.expireAt || sub.endDate;

      if (sub.status === "active" && expireTime > now) {
        return true;
      } else {
        alert(t("sub_expired_alert", "⚠️ Obuna muddati yakunlangan! Iltimos, to'lovni amalga oshiring."));
        window.location.replace("login.html");
        return false;
      }
    } else {
      console.warn(t("sub_info_not_found", "Obuna ma'lumotlari topilmadi."));
      return true;
    }
  } catch (error) {
    console.error(t("sub_check_error", "Obuna tekshiruvida xato:"), error);
    return true;
  }
};

/* =========================
   ROLE CHECK
========================= */
const userRole = localStorage.getItem("role");
if (userRole !== "waiter" && userRole !== "admin") {
  location.href = "login.html";
}

const waiterId = currentUserId;
const waiterName = localStorage.getItem("name") || t("role_waiter", "Ofitsiant");

let isWaiterAvailable = false;

/* =========================
   ELEMENTS
========================= */
const myAssignedBox = document.getElementById("myAssignedOrders");
const myDeliveredBox = document.getElementById("myDeliveredOrders");
const newBadge = document.getElementById("newBadge");
const waiterCallsBox = document.getElementById("waiterCalls");
const cleaningBox = document.getElementById("cleaningAlerts");
const stockAlertBox = document.getElementById("stockAlerts");

const statTodayDelivered = document.getElementById("statTodayDelivered");
const statTotalDelivered = document.getElementById("statTotalDelivered");
const statTodayRevenue = document.getElementById("statTodayRevenue");
const statAvgOrder = document.getElementById("statAvgOrder");
const statTables = document.getElementById("statTables");
const statLoyalCustomers = document.getElementById("statLoyalCustomers");

const toggleInput = document.getElementById("waiterAvailabilityToggle");
const statusText = document.getElementById("myStatusText");

const liveTablesBox = document.getElementById("liveTablesGrid");
const paymentRequestsBox = document.getElementById("paymentRequests");

const statActiveTables = document.getElementById("statActiveTables");
const statReadyToServe = document.getElementById("statReadyToServe");
const statBillsPending = document.getElementById("statBillsPending");

let ordersCache = {};
let tablesCache = {};
let paymentRequestsCache = {};
let chartInstance = null;
/* =========================
   OVOZLI SIGNAL TIZIMI (Waiter)
========================= */
let audioContext = null;
let userInteracted = false;
let _waiterPendingSound = false; // Foydalanuvchi bosmagunicha kutuvchi signal

// AudioContext faqat foydalanuvchi gesture dan keyin yaratiladi
function _waiterGetAudioCtx() {
  if (audioContext && audioContext.state === "running") return audioContext;
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => { });
    return audioContext;
  }
  if (!userInteracted) return null; // Gesture bo'lmasa — yaratmaymiz
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  } catch (e) { return null; }
}

// Foydalanuvchi birinchi gesture da unlock + kutayotgan signal ijro etiladi
(function () {
  const unlock = () => {
    userInteracted = true;
    if (!audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => { });
    }
    // Agar signal kelgan bo'lsa — hozir ijro etamiz
    if (_waiterPendingSound) {
      _waiterPendingSound = false;
      setTimeout(() => _playWaiterNewOrderBeep(), 100);
    }
    document.removeEventListener("click", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    document.removeEventListener("touchstart", unlock, true);
    document.removeEventListener("touchend", unlock, true);
  };
  document.addEventListener("click", unlock, true);
  document.addEventListener("keydown", unlock, true);
  document.addEventListener("touchstart", unlock, true);
  document.addEventListener("touchend", unlock, true);
})();

// Eski kod bilan moslik uchun saqlaymiz
function initAudio() {
  // intentionally empty — AudioContext faqat _waiterGetAudioCtx() orqali yaratiladi
}

function _waiterBeep(freq, duration, gain, delay) {
  const ctx = _waiterGetAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(gain, ctx.currentTime + delay);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch (e) { }
}

function _playWaiterNewOrderBeep() {
  [0, 0.25, 0.50, 0.85, 1.10].forEach((d, i) => {
    _waiterBeep(i % 2 === 0 ? 1000 : 750, 0.20, 0.85, d);
  });
}

// Oddiy bildirishnoma signali
function playNotificationSound() {
  if (!userInteracted) return; // Gesture bo'lmasa ishlamasin
  _waiterBeep(800, 0.18, 0.5, 0.00);
  _waiterBeep(600, 0.18, 0.4, 0.25);
}

// Yangi buyurtma uchun kuchli signal
function playNewOrderSound() {
  const tryWebAudio = () => {
    if (!userInteracted) {
      // Hali bosimagan — signalni queue ga qo'yamiz
      _waiterPendingSound = true;
      return;
    }
    _playWaiterNewOrderBeep();
  };

  // Avval WAV urinib ko'ramiz
  try {
    const audio = new Audio("/img/notify.wav?v=2");
    audio.volume = 1.0;
    const p = audio.play();
    if (p) {
      p.catch(() => tryWebAudio());
    } else {
      tryWebAudio();
    }
  } catch (e) {
    tryWebAudio();
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* =========================
   WAITER AVAILABILITY (BO'SH/BAND)
========================= */
function listenMyStatus() {
  onValue(ref(db, `${BASE_PATH}/users/${waiterId}`), (snap) => {
    if (!snap.exists()) return;
    const user = snap.val();

    if (user.active === false) {
      alert(t("error_profile_blocked", "Admin sizning hisobingizni vaqtincha nofaol qildi!"));
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    isWaiterAvailable = user.isAvailable === true;

    if (toggleInput) toggleInput.checked = isWaiterAvailable;
    if (statusText) {
      statusText.innerText = isWaiterAvailable ? t("status_free_me", "🟢 Men Bo'shman") : t("status_busy_me", "🔴 Men Bandman");
      statusText.style.color = isWaiterAvailable ? "#22C55E" : "#EF4444";
    }
  });
}

window.toggleMyAvailability = async function (isChecked) {
  try {
    await update(ref(db, `${BASE_PATH}/users/${waiterId}`), {
      isAvailable: isChecked,
      updatedAt: Date.now()
    });
    showToast(isChecked ? t("toast_went_free", "Bo'sh holatga o'tdingiz. Yangi buyurtmalar keladi.") : t("toast_went_busy", "Band holatiga o'tdingiz."), "info");
  } catch (err) {
    console.error(t("err_update_availability", "Holatni yangilashda xato:"), err);
    if (toggleInput) toggleInput.checked = !isChecked;
    showToast(t("notify.error", "Xatolik yuz berdi!"), "error");
  }
}

/* =========================
   WAITER CALL SYSTEM
========================= */
let _cachedCalls = {};

function renderWaiterCalls(calls) {
  if (!waiterCallsBox) return;

  let htmlContent = "";

  Object.entries(calls).forEach(([id, call]) => {
    if (call.status === "waiting" || call.status === "acknowledged") {
      const isMyTable = call.waiterId === waiterId;
      const isUrgent = Date.now() - (call.timestamp || 0) > 60000;

      htmlContent += `
        <div class="waiter-call-card ${isUrgent ? 'urgent' : ''} ${call.status}" style="padding:15px; border-radius:8px; margin-bottom:10px; background:var(--bg-body); border:1px solid var(--border-color); ${isMyTable ? 'border: 2px solid #3B82F6;' : ''}">
          <div class="call-header" style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <strong style="color:var(--text-primary);">🪑 ${t("table_label", "Stol")} ${call.table}</strong>
            <span style="font-size:12px; color:var(--text-muted);">${new Date(call.timestamp || call.createdAt || Date.now()).toLocaleTimeString('uz-UZ')}</span>
          </div>
          <div class="call-body" style="margin-bottom:10px; color:var(--text-secondary);">
            <p>${t("client_calling_waiter", "Mijoz ofitsiantni chaqirmoqda")}</p>
          </div>
          <div class="call-actions">
            ${call.status === 'waiting' ? `
              <button onclick="acknowledgeCall('${id}')" style="background:#3B82F6; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%;">📋 ${t("accept_call", "Qabul qilish")}</button>
            ` : `
              <button onclick="resolveCall('${id}')" style="background:#22C55E; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%;">✅ ${t("resolve_call", "Hal qilish")}</button>
            `}
          </div>
        </div>
      `;
    }
  });

  waiterCallsBox.innerHTML = htmlContent ||
    `<p class="empty-state">${t("no_calls_yet", "Hozircha chaqiruvlar yo'q")}</p>`;
}

function listenWaiterCalls() {
  onValue(ref(db, BASE_PATH + "/waiterCalls"), (snap) => {
    _cachedCalls = snap.val() || {};

    Object.entries(_cachedCalls).forEach(([id, call]) => {
      if (call.status === "waiting" && !call.notified && isWaiterAvailable) {
        playNotificationSound();
        update(ref(db, `${BASE_PATH}/waiterCalls/${id}`), { notified: true });
      }
    });

    renderWaiterCalls(_cachedCalls);
  });
}

window.acknowledgeCall = async function (callId) {
  await update(ref(db, `${BASE_PATH}/waiterCalls/${callId}`), {
    status: "acknowledged",
    acknowledgedBy: waiterId,
    acknowledgedByName: waiterName,
    acknowledgedAt: Date.now()
  });
  showToast(t("toast_call_accepted", "Chaqiruv qabul qilindi"), 'success');
};

window.resolveCall = async function (callId) {
  await update(ref(db, `${BASE_PATH}/waiterCalls/${callId}`), {
    status: "resolved",
    resolvedBy: waiterId,
    resolvedAt: Date.now()
  });
  showToast(t("toast_call_resolved", "Chaqiruv yopildi"), 'success');
};

/* =========================
   REALTIME ORDERS & CHART
========================= */
function updateChartData(orders) {
  const canvas = document.getElementById("waiterChart");

  // Canvas hali DOM da yo'q bo'lsa — keyinroq qayta urinib ko'ramiz
  if (!canvas) {
    setTimeout(() => updateChartData(orders), 300);
    return;
  }

  // Chart.js yuklanmagan bo'lsa kutamiz
  if (typeof Chart === "undefined") {
    setTimeout(() => updateChartData(orders), 300);
    return;
  }

  let totalCount = 0;
  let deliveredCount = 0;

  for (const o of Object.values(orders)) {

    totalCount++;

    const s = String(o.status || "").toLowerCase();

    if (
      s === "yopildi" ||
      s === "closed" ||
      s === "yetkazildi"
    ) {
      deliveredCount++;
    }
  }

  const data = [
    totalCount - deliveredCount,
    deliveredCount
  ];

  if (!chartInstance) {

    chartInstance = new Chart(canvas, {

      type: 'doughnut',

      data: {
        labels: [
          t("total_orders", "Jami Buyurtmalar"),
          t("status_delivered", "Yetkazildi")
        ],

        datasets: [{
          data,
          backgroundColor: [
            '#FBBF24',
            '#22C55E'
          ],

          borderWidth: 0
        }]
      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        animation: false,

        responsiveAnimationDuration: 0,

        hover: {
          animationDuration: 0
        },

        interaction: {
          mode: null
        },

        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });

  } else {

    chartInstance.data.datasets[0].data = data;

    chartInstance.update('none');
  }
}

// Ilgari ko'rilgan order IDlarini saqlaymiz
let _waiterKnownOrderIds = null;

// ==========================================
// 📋 ORDER PANELLARINI RENDER QILISH (til o'zgarganda qayta chaqirish uchun)
// ==========================================
function renderOrderPanels(orders) {
  if (!myAssignedBox || !myDeliveredBox) return;

  let todayDelivered = 0;
  let todayRevenue = 0;
  let hasReadyForMe = false;
  let allTotalDelivered = 0;
  let allTotalRevenue = 0;
  let activeTablesSet = new Set();
  let readyToServeCount = 0;

  const today = new Date().toDateString();
  let assignedHtml = "";
  let deliveredHtml = "";

  const sortedOrders = Object.entries(orders).sort(([, a], [, b]) => {
    const newStatuses = ["new", "yangi", "pending", "kutilmoqda", "queue", ""];
    const aIsNew = newStatuses.includes(String(a.status || "").toLowerCase());
    const bIsNew = newStatuses.includes(String(b.status || "").toLowerCase());
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  for (const [orderId, order] of sortedOrders) {
    const sum = Object.values(order.items || {}).reduce((a, i) => a + i.price * i.qty, 0);
    const statusRaw = String(order.status || "").toLowerCase();
    const statusKeyRaw = String(order.statusKey || "").toLowerCase();

    if (!["yopildi", "closed", "yetkazildi", "bekor qilindi"].includes(statusRaw) && order.table) {
      activeTablesSet.add(order.table);
    }

    if (["yopildi", "closed", "yetkazildi"].includes(statusRaw)) {
      allTotalDelivered++;
      allTotalRevenue += order.finalTotal || order.total || sum;
    }

    const WAITER_ACTION_STATUSES = [
      "tayyor", "ready", "approved", "tasdiqlandi",
      "cooking", "tayyorlanmoqda", "preparing",
      "yetkazilmoqda", "delivering",
      "new", "yangi", "pending", "kutilmoqda",
      "qabul qilindi", "accepted"
    ];
    const isReadyStatus = WAITER_ACTION_STATUSES.includes(statusRaw) || WAITER_ACTION_STATUSES.includes(statusKeyRaw);
    const DONE_STATUSES = ["yopildi", "closed", "yetkazildi", "bekor qilindi", "to'landi", "eating", "cancelled"];
    const isActiveOrder = !DONE_STATUSES.includes(statusRaw) && !DONE_STATUSES.includes(statusKeyRaw) && order.items && Object.keys(order.items).length > 0;

    if (isReadyStatus) readyToServeCount++;

    if (isReadyStatus || isActiveOrder) {
      hasReadyForMe = true;
      const itemsList = Object.values(order.items || {}).map(i => `<li style="padding:4px 0; border-bottom:1px dashed var(--border-color);">${i.name?.uz || i.name} <strong style="color:#3B82F6;">x ${i.qty}</strong></li>`).join("");
      const badgeBg = isReadyStatus ? "#22C55E" : "#3B82F6";
      const badgeLabel = isReadyStatus ? t("status_ready", "TAYYOR") : (order.status || statusRaw).toUpperCase();

      assignedHtml += `
        <div class="order-card waiting" style="border: 2px solid ${badgeBg}; padding:15px; border-radius:12px; background:var(--bg-body);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="margin:0;">🪑 ${t("table_label", "Stol")} ${order.table} <span style="font-size:13px; color:var(--text-muted);">| #${order.orderNumber || orderId.slice(-4)}</span></h3>
            <span style="background:${badgeBg}; color:#fff; padding:3px 9px; border-radius:6px; font-size:12px; font-weight:bold;">${badgeLabel}</span>
          </div>
          <ul style="margin:0 0 10px 0; padding-left:0; font-size:14px; list-style:none;">${itemsList}</ul>
          <p style="margin:0 0 10px 0;">💰 ${sum.toLocaleString()} ${t("currency", "so'm")}</p>
          <button onclick="markAsDelivered('${orderId}', '${order.table}')" class="btn-pickup" style="background: #22C55E; width:100%; border:none; color:#fff; padding:10px; border-radius:8px; cursor:pointer; font-weight:600; transition:0.2s;">
            🏃‍♂️ ${t("mark_delivered", "Yetkazib berdim")}
          </button>
        </div>
      `;
    }

    if (order.waiterId === waiterId) {
      if (["yopildi", "closed", "yetkazildi"].includes(statusRaw)) {
        if (order.deliveredAt && new Date(order.deliveredAt).toDateString() === today) {
          todayDelivered++;
          todayRevenue += order.finalTotal || order.total || sum;
          deliveredHtml += `
            <div class="order-card delivered" style="border:1px solid var(--border-color); background:var(--bg-body); padding:15px; border-radius:12px;">
              <h3 style="margin:0 0 5px 0;">🪑 ${t("table_label", "Stol")} ${order.table}</h3>
              <p style="margin:0 0 5px 0; color:var(--text-muted); font-size:13px;">📦 #${order.orderNumber || orderId.slice(-4)}</p>
              <p style="color:#22C55E; font-weight:bold; margin:0 0 5px 0;">💰 ${(order.finalTotal || sum).toLocaleString()} ${t("currency", "so'm")}</p>
              <small style="color:var(--text-muted);">${t("time_label", "Vaqti:")} ${new Date(order.deliveredAt).toLocaleTimeString()}</small>
            </div>
          `;
        }
      }
    }
  }

  myAssignedBox.innerHTML = assignedHtml || `<p class="empty-state">${t("waiting_for_new_order", "Hozircha bo'shsiz. Yangi buyurtma kutilmoqda...")}</p>`;
  myDeliveredBox.innerHTML = deliveredHtml || `<p class="empty-state">${t("nothing_delivered_yet", "Hali hech narsa yetkazilmadi")}</p>`;

  if (newBadge) newBadge.classList.toggle("hidden", !hasReadyForMe);

  if (document.getElementById("myTodayDelivered")) document.getElementById("myTodayDelivered").innerText = todayDelivered;
  if (document.getElementById("myTodayRevenue")) document.getElementById("myTodayRevenue").innerText = todayRevenue.toLocaleString() + " " + t("currency", "so'm");

  if (statTodayDelivered) statTodayDelivered.innerText = todayDelivered;
  if (statTotalDelivered) statTotalDelivered.innerText = allTotalDelivered;
  if (statTodayRevenue) statTodayRevenue.innerText = todayRevenue.toLocaleString() + " " + t("currency", "so'm");
  if (statAvgOrder) statAvgOrder.innerText = allTotalDelivered > 0 ? Math.round(allTotalRevenue / allTotalDelivered).toLocaleString() + " " + t("currency", "so'm") : "0 " + t("currency", "so'm");
  if (statTables) statTables.innerText = activeTablesSet.size;
  if (statReadyToServe) statReadyToServe.innerText = readyToServeCount;

  const pendingPayments = Object.values(paymentRequestsCache).filter(r => !["approved", "paid"].includes(String(r.status || "").toLowerCase())).length;
  if (statBillsPending) statBillsPending.innerText = pendingPayments;
}

function listenOrders() {
  const recentOrdersQuery = query(ref(db, BASE_PATH + "/orders"), orderByChild("createdAt"), limitToLast(200));

  onValue(recentOrdersQuery, async (snap) => {
    const incoming = snap.val() || {};

    // Yangi buyurtmalarni aniqlaymiz
    if (_waiterKnownOrderIds !== null) {
      const newIds = Object.keys(incoming).filter(id => !_waiterKnownOrderIds.has(id));
      if (newIds.length > 0) {
        const reallyNew = newIds.filter(id => {
          const st = String(incoming[id]?.status || incoming[id]?.statusKey || "").toLowerCase();
          return ["new", "yangi", "pending", "queue", ""].includes(st);
        });
        if (reallyNew.length > 0) {
          playNewOrderSound();
          reallyNew.forEach(id => {
            const o = incoming[id];
            showToast(
              `🆕 ${t("new_order_arrived", "Yangi buyurtma")} — ${t("table_label", "Stol")} ${o.table || "?"} | #${o.orderNumber || id.slice(-4)}`,
              "info"
            );
          });
        }
      }
    }
    _waiterKnownOrderIds = new Set(Object.keys(incoming));

    ordersCache = incoming;
    updateChartData(ordersCache);

    // 🔍 DEBUG
    console.group("🔍 WAITER DEBUG — Barcha buyurtmalar:");
    Object.entries(ordersCache).forEach(([id, o]) => {
      const closed = ["yopildi", "closed", "yetkazildi", "bekor qilindi", "to'landi", "eating", "cancelled"];
      const isClosed = closed.includes(String(o.status || "").toLowerCase());
      console.log(`  ${isClosed ? "❌" : "✅"} id:${id.slice(-6)} | stol:${o.table} | status:"${o.status}" | statusKey:"${o.statusKey}"`);
    });
    console.groupEnd();

    renderOrderPanels(incoming);
  });
}

// ==========================================
// 🎁 VIP MIJOZLAR SONINI YUKLASH
// ==========================================
function listenLoyalCustomers() {
  onValue(ref(db, BASE_PATH + "/customers"), (snap) => {
    const customers = snap.val() || {};
    const vipCount = Object.values(customers).filter(c => c.isVip === true || c.vip === true || c.loyalty === "vip" || c.tier === "vip").length;
    if (statLoyalCustomers) statLoyalCustomers.innerText = vipCount;
  });
}

// ==========================================
// 🚀 BUYURTMANI YETKAZILDI DEB BELGILASH 
// ==========================================
window.markAsDelivered = async function (orderId, tableNumber) {
  if (!confirm(t("confirm_delivery", "Haqiqatan ham ushbu taomlarni mijozga eltib berdingizmi?"))) return;

  const now = Date.now();
  try {
    const currentWaiterId = window.currentWaiterId || localStorage.getItem("userId");
    const currentWaiterName = window.currentStaffRealName || localStorage.getItem("name") || t("role_waiter", "Ofitsiant");

    await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
      status: "yopildi",
      statusKey: "closed",
      statusLabel: t("status_delivered", "Yetkazildi"),
      waiterId: currentWaiterId,
      waiterName: currentWaiterName,
      deliveredAt: now
    });
    await update(ref(db, `${BASE_PATH}/tables/${tableNumber}`), {
      status: "eating",
      activeOrderId: orderId,
      kitchenStatus: "delivered",
      lastServedAt: now
    });

    showToast(t("toast_order_delivered", "✅ Buyurtma yetkazildi!"), "success");
  } catch (err) {
    console.error(t("delivery_error_log", "Yetkazishda xato:"), err);
    showToast(t("notify.error", "Xatolik yuz berdi!"), "error");
  }
};

function getTableNumberFromKey(tableId, table) { return table?.number ?? String(tableId).replace(/\D/g, ""); }
function getPaymentRequestForTable(tableNumber) {
  const list = Object.entries(paymentRequestsCache).filter(([, req]) => String(req.table) === String(tableNumber) && !["approved", "paid"].includes(String(req.status || "").toLowerCase())).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  return list[0] ? { id: list[0][0], ...list[0][1] } : null;
}

function normalizeTableStatus(tableId, table) {
  const raw = String(table?.status || "").toLowerCase();
  const tableNumber = getTableNumberFromKey(tableId, table);
  const paymentReq = getPaymentRequestForTable(tableNumber);

  if (["cleaning", "needs_cleaning"].includes(raw)) return "cleaning";
  if (paymentReq || raw === "billing") return "billing";
  if (raw === "eating") return "eating";
  if (raw === "ready") return "ready";
  if (raw === "busy") return "busy";
  return "free";
}

function checkCleaningAlerts() {
  if (!cleaningBox) return;

  let htmlContent = "";
  let needsCleaning = 0;

  Object.entries(tablesCache).forEach(([tableId, table]) => {
    if (table.status === "needs_cleaning") {
      needsCleaning++;
      htmlContent += `
        <div class="cleaning-card" style="border:1px solid #0EA5E9; background:var(--bg-body); padding:15px; border-radius:8px; margin-bottom:10px;">
          <div class="table-info">
            <h4 style="margin:0; color:var(--text-primary);">🪑 ${t("table_label", "Stol")} ${table.number || tableId}</h4>
            <span style="color:#EF4444; font-size:12px; font-weight:600;">${t("needs_cleaning", "Tozalanishi kerak")}</span>
          </div>
          <button onclick="startCleaning('${tableId}')" style="background:#0EA5E9; color:#fff; border:none; padding:8px; margin-top:10px; border-radius:6px; cursor:pointer; width:100%; font-weight:500;">🧹 ${t("start_cleaning_btn", "Boshlash")}</button>
        </div>`;
    } else if (table.status === "cleaning") {
      htmlContent += `
        <div class="cleaning-card in-progress" style="border:1px dashed #0EA5E9; background:var(--bg-body); padding:15px; border-radius:8px; margin-bottom:10px;">
          <div class="table-info">
            <h4 style="margin:0; color:var(--text-primary);">🪑 ${t("table_label", "Stol")} ${table.number || tableId}</h4>
            <span style="color:#0EA5E9; font-size:12px; font-weight:600;">${t("status_cleaning", "Tozalanmoqda")}</span>
            <small style="display:block; color:var(--text-muted); margin-top:5px;">
  ${t("staff_label", "Xodim")}: ${table.cleaningBy && table.cleaningBy !== "Главный администратор" && table.cleaningBy !== "Admin"
          ? table.cleaningBy
          : (window.currentStaffRealName || localStorage.getItem("name") || t("unknown_person", "Noma'lum"))
        }
</small>
          </div>
          <button onclick="finishCleaning('${tableId}')" style="background:#22C55E; color:#fff; border:none; padding:8px; margin-top:10px; border-radius:6px; cursor:pointer; width:100%; font-weight:500;">✨ ${t("ready_btn", "Tayyor")}</button>
        </div>`;
    }
  });

  cleaningBox.innerHTML = htmlContent || `<p class="empty-state">${t("no_cleaning_alerts", "Tozalash kerak stollar yo'q")}</p>`;
}

window.startCleaning = async function (tableId) {
  const realName = window.currentStaffRealName ||
    localStorage.getItem("name") ||
    t("role_waiter", "Ofitsiant");

  await update(ref(db, `${BASE_PATH}/tables/${tableId}`), {
    status: "cleaning",
    cleaningBy: realName,
    cleaningStartedAt: Date.now()
  });
  showToast(t("toast_cleaning_started", "Tozalash boshlandi"), 'info');
};

window.finishCleaning = async function (tableId) {
  await update(ref(db, `${BASE_PATH}/tables/${tableId}`), {
    status: "free",
    busy: false,
    cleaningBy: null,
    cleanedBy: waiterName,
    cleanedAt: Date.now(),
    activeOrderId: null,
    orderId: null,
    occupiedAt: null,
    currentSessionStart: null,
    kitchenStatus: null,
    updatedAt: Date.now()
  });
  showToast(t("toast_table_cleaned", "Stol tozalandi va bo'sh!"), 'success');
};

window.markTableFree = async function (tableId) {
  const snap = await get(ref(db, `${BASE_PATH}/tables/${tableId}`));
  const tableData = snap.val() || {};
  const currentStatus = String(tableData.status || "").toLowerCase();

  if (currentStatus !== "cleaning") {
    showToast(
      t("table_not_cleaning_warn", " Stol tozalanmoqda holatida emas! Avval tozalashni boshlang."),
      "warning"
    );
    return;
  }

  await update(ref(db, `${BASE_PATH}/tables/${tableId}`), {
    status: "free",
    busy: false,
    activeOrderId: null,
    orderId: null,
    occupiedAt: null,
    currentWaiterId: null,
    cleaningBy: null,
    cleanedBy: waiterName,
    cleanedAt: Date.now(),
    updatedAt: Date.now()
  });
  showToast(t("toast_table_freed", "Stol bo'shatildi"), "success");
};

/* =========================
   PAYMENT REQUESTS
========================= */
function listenPaymentRequests() {
  onValue(ref(db, BASE_PATH + "/paymentRequests"), (snap) => {
    paymentRequestsCache = snap.val() || {};
    if (!paymentRequestsBox) return;

    let htmlContent = "";

    Object.entries(paymentRequestsCache).forEach(([requestId, req]) => {
      if (["approved", "paid"].includes(req.status)) return;
      htmlContent += `
        <div class="order-card delivered" style="border:1px solid #EF4444; background:var(--bg-body); padding:15px; border-radius:12px;">
          <h3 style="color:#EF4444; margin:0 0 4px 0;">💳 ${t("table_label", "Stol")} ${req.table}</h3>
          <p style="font-size:11px; font-weight:700; margin:0 0 8px 0; padding:3px 8px; border-radius:5px; display:inline-block; ${req.requestedBy && !String(req.requestedBy).startsWith('waiter') ? 'background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;' : 'background:#F0F9FF; color:#0369A1; border:1px solid #BAE6FD;'};">👤 ${req.requestedBy && !String(req.requestedBy).startsWith('waiter') ? t("from_client_label", "Mijoz so'radi") : t("from_waiter_label", "Ofitsiant so'radi")}</p>
          <button onclick="approvePaymentRequest('${requestId}', '${req.tableId}')" style="background:#EF4444; color:#fff; border:none; padding:10px; border-radius:8px; width:100%; cursor:pointer; font-weight:600;">${t("accept_payment", "To'lov qabul")}</button>
        </div>`;
    });

    paymentRequestsBox.innerHTML = htmlContent || `<p class="empty-state">${t("no_payment_requests", "To'lov so'rovlari yo'q")}</p>`;
  });
}

// Hisob so'rash faqat mijoz tomonidan amalga oshiriladi (client.js -> requestBill)
// Ofitsiant sahifasidagi tugma faqat ko'rsatish uchun (disabled)

window.approvePaymentRequest = async function (requestId, tableId) {
  try {
    const reqSnap = await get(ref(db, `${BASE_PATH}/paymentRequests/${requestId}`));
    const reqData = reqSnap.exists() ? reqSnap.val() : {};

    await update(ref(db, `${BASE_PATH}/paymentRequests/${requestId}`), {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: waiterId
    });

    const targetTableId = tableId || reqData.tableId || reqData.table;

    if (targetTableId) {
      await update(ref(db, `${BASE_PATH}/tables/${targetTableId}`), {
        status: "cleaning",
        cleaningNeededAt: Date.now(),
        busy: false,
        activeOrderId: null
      });
    }

    // Buyurtma statusini "to'landi" ga o'tkazish
    const orderId = reqData.orderId;
    if (orderId) {
      const now = Date.now();
      await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
        status: "to'landi",
        paidAt: now,
        "payment/paid": true,
        "payment/approved": true,
        "payment/approvedAt": now
      });

      // FIX 4: To'lov tasdiqlanganda xodimlar KPI va komisyonini hisoblash
      try {
        const restId = localStorage.getItem("restaurantId");
        const monthKey = new Date().toISOString().slice(0, 7);
        const orderSnap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
        if (orderSnap.exists() && !orderSnap.val().kpiCalculated) {
          const order = orderSnap.val();
          const total = Number(order.finalTotal || order.total || order.totalPrice || 0);
          const staffIds = [order.waiterId, order.chefId].filter(Boolean);
          for (const sId of staffIds) {
            const userSnap = await get(ref(db, `restaurants/${restId}/users/${sId}`));
            if (userSnap.exists()) {
              const user = userSnap.val();
              const earned = (total * (Number(user.commissionPercent || 0))) / 100;
              const statsRef = ref(db, `restaurants/${restId}/finance/staff_stats/${sId}/${monthKey}`);
              const cur = (await get(statsRef)).val() || { totalEarned: 0, orderCount: 0 };
              await update(statsRef, {
                totalEarned: (cur.totalEarned || 0) + earned,
                orderCount: (cur.orderCount || 0) + 1,
                lastUpdate: now
              });
            }
          }
          await update(ref(db, `${BASE_PATH}/orders/${orderId}`), { kpiCalculated: true });
        }
      } catch (kpiErr) {
        console.error("KPI hisoblashda xato (waiter):", kpiErr);
      }
    }

    showToast(t("alerts.payment_approved", "To'lov tasdiqlandi. Stol tozalanishi kerak."), "success");
  } catch (err) {
    console.error(t("approve_payment_error_log", "To'lovni tasdiqlashda xatolik:"), err);
    showToast(t("notify.error", "Xatolik yuz berdi!"), "error");
  }
};

window.approveOrder = async function (orderId) {
  try {
    const orderRef = ref(db, `${BASE_PATH}/orders/${orderId}`);
    const orderSnap = await get(orderRef);

    if (!orderSnap.exists()) return;

    const now = Date.now();

    await update(orderRef, {
      status: "approved",
      statusKey: "approved",
      statusLabel: t("status_approved", "Tasdiqlandi"),
      confirmedAt: now,
      updatedAt: now,
      updatedBy: currentChefId || null
    });

    // inventory deduct faqat 1 marta
    const order = orderSnap.val();

    if (!order.inventoryDeducted) {
      if (typeof window.deductOrderInventory === "function") {
        await window.deductOrderInventory(orderId);
      }

      await update(orderRef, {
        inventoryDeducted: true,
        inventoryDeductedAt: now
      });
    }

    if (typeof showNotification === "function") {
      showNotification(
        `✅ ${t("a_order_approved_notify", "Buyurtma tasdiqlandi!")}`
      );
    }

  } catch (error) {
    console.error(t("error_log", "Xato:"), error);

    alert(
      t("notify.error", "Xatolik yuz berdi")
    );
  }
};

/* =========================
   STOCK ALERTS (STOP-LIST)
========================= */
function listenStockAlerts() {
  onValue(ref(db, BASE_PATH + "/inventoryAlerts"), (snap) => {
    const alerts = snap.val() || {};
    if (!stockAlertBox) return;

    let hasAlerts = false;
    let htmlContent = "";

    Object.entries(alerts).forEach(([id, alert]) => {
      if (!alert.acknowledged) {
        hasAlerts = true;
        htmlContent += `
          <div class="alert-card alert-warning" style="border-left:4px solid #FBBF24; background:rgba(251, 191, 36, 0.1); padding:12px; margin-bottom:10px; border-radius:6px;">
            <p style="margin:0 0 8px 0; font-size:14px; color:var(--text-primary);"><strong>${alert.productName}</strong> ${t("running_low", "kam qoldi!")}</p>
            <button onclick="acknowledgeStockAlert('${id}')" style="background:transparent; color:var(--text-primary); border:1px solid #FBBF24; padding:5px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600;">✓ ${t("got_it", "Tushundim")}</button>
          </div>`;
      }
    });

    if (!hasAlerts) {
      stockAlertBox.innerHTML = `<p class="empty-state">${t("no_stock_alerts", "Ogohlantirishlar yo'q")}</p>`;
    } else {
      stockAlertBox.innerHTML = htmlContent;
    }
  });
}

window.acknowledgeStockAlert = async function (alertId) {
  await update(ref(db, `${BASE_PATH}/inventoryAlerts/${alertId}`), { acknowledged: true });
};

/* =========================
   TAYYOR BUYURTMALARNI KUZATISH
   ⚠️ BU FUNKSIYA OLIB TASHLANDI — recentOrdersQuery bilan to'qnashar edi.
   Barcha tayyor buyurtmalar endi recentOrdersQuery ichida ko'rinadi (waiterId filteri yo'q).
========================= */
// function listenReadyOrders() { ... } — DISABLED

/* ==============================================
   RESTORAN SOZLAMALARI VA FOOTERNI YANGILASH
============================================== */
async function syncWaiterSettings() {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const database = (typeof db !== 'undefined') ? db : window.db;

    const settingsRef = ref(database, `restaurants/${restId}/settings`);

    onValue(settingsRef, (snap) => {
      if (snap.exists()) {
        const settings = snap.val();

        const headerTitle = document.querySelector('.header h1');
        if (headerTitle && settings.restaurantName) {
          headerTitle.innerText = `${t("waiter_panel", "Ofitsiant paneli")} | ${settings.restaurantName}`;
          document.title = `${t("role_waiter", "Ofitsiant")} | ${settings.restaurantName}`;
        }

        const hoursEl = document.getElementById("uiWaiterWorkingHours");
        const phoneEl = document.getElementById("uiWaiterContactPhone");

        if (hoursEl) hoursEl.innerText = settings.workingHours || "09:00 - 20:00";
        if (phoneEl) phoneEl.innerText = settings.contactPhone || "+998 90 123 45 67";
      }
    });
  } catch (error) {
    console.error(t("sync_error", "Sinxronizatsiyada xato:"), error);
  }
}

export function startSubscriptionMonitor(db, restId) {
  const restRef = ref(db, `restaurants/${restId}`);

  onValue(restRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const status = data.info?.status;
    const expireAt = data.subscription?.expireDate || data.subscription?.expireAt;
    const now = Date.now();
    const diffDays = Math.ceil((expireAt - now) / (1000 * 60 * 60 * 24));

    if (status === "blocked") {
      showBlockingOverlay(t("sub_paused_reason", "Ma'lum sabablarga ko'ra tarifingiz vaqtincha to'xtatildi."));
      return;
    }

    if (now > expireAt) {
      showBlockingOverlay(t("sub_expired_reason", "Tarifingiz muddati tugadi. Iltimos, xizmatni davom ettirish uchun to'lov qiling."));
      return;
    }

    if (diffDays <= 5 && diffDays > 0) {
      showWarningBanner(diffDays);
    } else {
      hideWarningBanner();
    }
  });
}

function showBlockingOverlay(message) {
  let overlay = document.getElementById("blocking-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "blocking-overlay";
    overlay.innerHTML = `
      <div class="blocking-content">
        <i class="fa-solid fa-lock" style="font-size: 50px; color: #EF4444; margin-bottom: 20px;"></i>
        <h2 id="blocking-message"></h2>
        <p>${t("contact_super_admin", "Ma'lumot uchun Super Admin bilan bog'laning.")}</p>
        <a href="https://t.me/nestacrm_admin" class="btn-contact">${t("contact_super_admin_btn", "Super Admin bilan bog'lanish")}</a>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  document.getElementById("blocking-message").innerText = message;
  overlay.style.display = "flex";
}

function showWarningBanner(days) {
  let banner = document.getElementById("expiry-warning-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "expiry-warning-banner";
    document.body.prepend(banner);
  }

  banner.innerHTML = `
    <div style="background: #FFF7ED; color: #9A3412; padding: 12px; text-align: center; border-bottom: 2px solid #FDBA74; font-weight: 500;">
      <i class="fa-solid fa-triangle-exclamation"></i> 
      ${t("sub_expiring_in", "Tarifingiz muddati tugashiga {days} kun qoldi, iltimos obuna muddatini yangilang, aks holda tizim bloklanadi.").replace('{days}', days)}
      <a href="https://t.me/nestacrm_admin" style="margin-left: 15px; color: #C2410C; text-decoration: underline; font-weight: 700;">
        ${t("extend_sub_btn", "Muddatni uzaytirish")} <i class="fa-solid fa-arrow-right"></i>
      </a>
    </div>
  `;
  banner.style.display = "block";
}

const currentRestId = localStorage.getItem("restaurantId");

function startSecurityMonitor() {
  const database = window.db || (typeof db !== 'undefined' ? db : null);

  if (!database) {
    console.warn(t("firebase_not_ready", "⚠️ Firebase bazasi hali tayyor emas, qayta urinib ko'riladi..."));
    setTimeout(startSecurityMonitor, 1000);
    return;
  }

  const restId = localStorage.getItem("restaurantId");

  if (!restId) {
    console.error(t("rest_id_not_found", "❌ Restoran ID topilmadi!"));
    return;
  }

  try {
    const statusRef = ref(database, `restaurants/${restId}/info/status`);

    onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      const overlay = document.getElementById("system-block-overlay");

      if (status === "blocked") {
        if (overlay) overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
        console.warn(t("system_blocked_by_admin", "🚫 Tizim Super Admin tomonidan bloklandi!"));
      } else {
        if (overlay) overlay.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });

    console.log(t("security_monitor_started", "🔒 Xavfsizlik monitori muvaffaqiyatli ishga tushdi."));
  } catch (err) {
    console.error(t("monitor_start_error", "❌ Monitor ishga tushishida xato:"), err);
  }
}

startSecurityMonitor();

/* =========================
   CHAT SYSTEM INITIALIZATION
========================= */
async function getWaiterChatOptions(userId, restaurantId) {
  return [
    { icon: "📢", label: t("chat_admin_group", "Admin (Guruh)"), type: "admin_group" },
    { icon: "👨‍💼", label: t("chat_admin_private", "Admin bilan (Shaxsiy)"), type: "admin_private" },
    { icon: "👨‍🍳", label: t("chat_with_chef", "Oshpaz bilan chat"), type: "chef" }
  ];
}

async function getWaiterChatId(option, waiterId, restaurantId) {
  if (option.type === "admin_group") return "waiter_group";
  if (option.type === "admin_private") return `admin_waiter_${waiterId}`;
  if (option.type === "chef") return "chef_waiter_group";

  return null;
}

window.initChatFloatingUI = function () {
  const old = document.getElementById("chat-toggle-button");
  if (old) old.remove();

  const chatBtn = document.createElement("div");
  chatBtn.id = "chat-toggle-button";
  chatBtn.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:99999; cursor:pointer; width:60px; height:60px; background:#2563EB; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.3s ease;";
  chatBtn.innerHTML = '<i class="fa-solid fa-comment-dots"></i>';
  document.body.appendChild(chatBtn);

  const mainFab = document.getElementById("chatFab");
  if (mainFab) mainFab.style.display = "none";

  chatBtn.onclick = () => {
    const hiddenFab = document.getElementById("chatFab");
    const chatModal = document.getElementById("chatModal");

    if (hiddenFab) {
      hiddenFab.click();

      setTimeout(() => {
        const isVisible = chatModal && (chatModal.style.display === "flex" || chatModal.style.display === "block");

        chatBtn.innerHTML = isVisible
          ? '<i class="fa-solid fa-xmark"></i>'
          : '<i class="fa-solid fa-comment-dots"></i>';

        chatBtn.style.background = isVisible ? "#EF4444" : "#2563EB";
      }, 150);
    } else {
      showToast(t("chat_system_loading", "Chat tizimi yuklanmoqda..."), "warning");
    }
  };
};

window.initWaiterChat = async function () {
  const activeId = window.currentWaiterId || localStorage.getItem("userId");

  if (typeof window.initChatSystem === "function") {
    if (!activeId) {
      console.error(t("waiter_chat_error_no_id", "Chat xatosi: Waiter ID topilmadi."));
      return;
    }

    try {
      await window.initChatSystem({
        currentRestaurantId: currentRestaurantId,
        currentUserId: activeId,
        currentRole: "waiter",
        db: db,
        getChatOptions: getWaiterChatOptions,
        getChatId: getWaiterChatId
      });

      window.initChatFloatingUI();
      console.log(t("waiter_chat_connected", "✅ Ofitsiant chat tizimi muvaffaqiyatli ulandi."));
    } catch (err) {
      console.error(t("waiter_chat_init_error", "Chatni boshlashda xato:"), err);
    }
  } else {
    setTimeout(window.initWaiterChat, 1000);
  }
};

function safeInit() {
  const database = window.db || db;
  if (!database) {
    setTimeout(safeInit, 500);
    return;
  }
  startSecurityMonitor();
}

// ==========================================
// 🔄 DİNAMIK ROL KUZATUVCHISI
// ==========================================
window.listenToMyRoleChange = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = localStorage.getItem("userId");

  if (!restId || !userId) return;

  try {
    onValue(ref(db, `restaurants/${restId}/users/${userId}/role`), (snap) => {
      if (!snap.exists()) return;

      const newRole = snap.val();
      const currentLocalRole = localStorage.getItem("role");

      if (newRole && newRole !== currentLocalRole) {
        localStorage.setItem("role", newRole);
        const currentPath = window.location.pathname.toLowerCase();

        if (newRole === "admin" && !currentPath.includes("admin.html")) {
          alert(t("role_changed_admin", "👑 Sizga Asosiy Boshqaruvchi (Admin) huquqlari berildi!"));
          window.location.replace("admin.html");
        }
        else if (newRole === "chef" && !currentPath.includes("chef.html")) {
          alert(t("role_changed_chef", "👨‍🍳 Rolingiz o'zgardi. Oshpaz paneliga o'tilmoqda..."));
          window.location.replace("chef.html");
        }
        else if (newRole === "waiter" && !currentPath.includes("waiter.html")) {
          alert(t("role_changed_waiter", "🧑‍🍳 Rolingiz o'zgardi. Ofitsiant paneliga qaytarilmoqdasiz..."));
          window.location.replace("waiter.html");
        }
      }
    });
  } catch (error) {
    console.error(t("role_watch_error", "Rolni kuzatishda xatolik:"), error);
  }
};

/* =======================================
   OFITSIANT PANELIGA KIRISHNI TEKSHIRISH 
========================================== */
async function checkWaiterAccess() {
  const currentRestId = localStorage.getItem("restaurantId");
  if (!currentRestId) return;

  try {
    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (!database) {
      setTimeout(checkWaiterAccess, 1000);
      return;
    }
    const snap = await get(ref(database, `restaurants/${currentRestId}/subscription`));

    if (snap.exists()) {
      const subData = snap.val();
      const currentPlan = (subData.plan || subData.planId || "START").toUpperCase();
      console.log(t("waiter_tariff_log", "📊 Ofitsiant tarifi:"), currentPlan);
    }
  } catch (error) {
    console.error(t("tariff_check_error", "❌ Tarifni tekshirishda tizim xatosi:"), error);
  }
}

async function runFinalSecurityChecks() {
  if (!currentRestaurantId) return;

  try {
    const snap = await get(ref(db, `restaurants/${currentRestaurantId}/subscription`));
    const subData = snap.val() || {};
    const currentPlan = (subData.plan || subData.planId || "START").toUpperCase();

    if (currentPlan === "START") {
      console.log(t("start_tariff_granted", "START tarifida ofitsiant paneliga ruxsat berildi."));
    }
  } catch (error) {
    console.error(t("security_check_error", "Xavfsizlik tekshiruvida xatolik:"), error);
  }
}

/* =========================
   TV VA FULLSCREEN REJIMLARI
========================= */
// ── TV MODE ─────────────────────────────────────────────────────────────────
window.toggleWaiterTVMode = function () {
  const isTV = document.body.classList.toggle("tv-mode");
  localStorage.setItem("waiterTVMode", isTV ? "1" : "0");
  applyWaiterTVMode(isTV);
  // TV rejimida fullscreen ham yoqiladi
  if (isTV && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  }
  updateWaiterTVButton();
};

function applyWaiterTVMode(isTV) {
  // TV rejimida keraksiz panellarni yashiramiz
  const hideSelectors = [
    ".waiter-sidebar", ".waiter-stats-panel",
    ".lang-selector", "#langSelect",
    ".chart-section", "#myDeliveredOrders",
    ".header-sub", ".waiter-header-sub"
  ];
  hideSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.display = isTV ? "none" : "";
    });
  });

  document.querySelectorAll(".order-card").forEach(card => {
    card.style.fontSize = isTV ? "17px" : "";
    card.style.padding = isTV ? "20px" : "";
  });

  const grid = document.getElementById("myAssignedOrders");
  if (grid) {
    grid.style.gridTemplateColumns = isTV
      ? "repeat(auto-fill, minmax(360px, 1fr))"
      : "";
    grid.style.gap = isTV ? "20px" : "";
  }
}

function updateWaiterTVButton() {
  const isTV = document.body.classList.contains("tv-mode");
  const btn = document.getElementById("waiterTVBtn");
  if (!btn) return;
  btn.innerHTML = isTV
    ? `📺 ${t("tv_mode_off", "TV O'chirish")}`
    : `📺 ${t("tv_mode", "TV Rejimi")}`;
  btn.style.background = isTV
    ? "linear-gradient(135deg,#ef4444,#dc2626)"
    : "linear-gradient(135deg,#6366f1,#4f46e5)";
}

// ── FULLSCREEN ────────────────────────────────────────────────────────────────
window.toggleWaiterFullscreen = async function () {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.error(t("fullscreen_error", "Fullscreen xato:") + " " + err.message);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof applyLang === "function") {
      applyLang();
      console.log(t("translations_applied_waiter", "🌍 Tarjimalar ofitsiant paneliga qo'llanildi."));
    }
  }, 500);
  // TV rejimini tiklash
  if (localStorage.getItem("waiterTVMode") === "1") {
    document.body.classList.add("tv-mode");
    setTimeout(() => { applyWaiterTVMode(true); updateWaiterTVButton(); }, 300);
  }
  document.addEventListener("fullscreenchange", updateWaiterFullscreenButton);
  document.addEventListener("fullscreenchange", updateWaiterTVButton);
});

function updateWaiterFullscreenButton() {
  const btn = document.getElementById('fsBtn');
  if (btn) {
    btn.innerHTML = document.fullscreenElement
      ? '<i class="fa-solid fa-compress"></i>'
      : '<i class="fa-solid fa-expand"></i>';
  }
}

function applyWaiterTranslations() {
  if (typeof applyLang === "function") {
    applyLang();
  }
}

function applyPermissions(p) {
  if (!p.finance) {
    const financeBtn = document.querySelector('a[href="#reports"]');
    if (financeBtn) financeBtn.style.display = "none";
  }

  if (!p.kds) {
    const kdsSection = document.getElementById("kds-link");
    if (kdsSection) {
      kdsSection.classList.add("locked-feature");
      kdsSection.innerHTML += ' <i class="fa-solid fa-lock"></i>';
      kdsSection.onclick = () => alert(t("feature_not_in_tariff", "Ushbu funksiya sizning tarifingizda mavjud emas!"));
    }
  }
}

function listenTablesLive() {
  onValue(ref(db, BASE_PATH + "/tables"), (snap) => {
    tablesCache = snap.val() || {};
    renderLiveTables();
    checkCleaningAlerts();
  });
}

function renderLiveTables() {
  if (!liveTablesBox) return;
  const entries = Object.entries(tablesCache || {});

  let htmlContent = "";
  let activeTables = 0, readyToServe = 0, billsPending = 0;

  entries.forEach(([tableId, table]) => {
    const tableNumber = getTableNumberFromKey(tableId, table);
    const status = normalizeTableStatus(tableId, table);
    const paymentReq = getPaymentRequestForTable(tableNumber);

    if (!["free", "cleaning"].includes(status)) activeTables++;
    if (status === "ready") readyToServe++;
    if (status === "billing") billsPending++;

    let borderColor = "var(--border-color)";
    let badgeColor = "var(--text-muted)";

    if (status === "billing") { borderColor = "#EF4444"; badgeColor = "#EF4444"; }
    else if (status === "cleaning") { borderColor = "#0EA5E9"; badgeColor = "#0EA5E9"; }
    else if (status === "eating") { borderColor = "#3B82F6"; badgeColor = "#3B82F6"; }
    else if (status === "ready") { borderColor = "#22C55E"; badgeColor = "#22C55E"; }

    htmlContent += `
      <div class="order-card table-card ${status}" style="border:2px solid ${borderColor}; background:var(--bg-body); padding:16px; border-radius:12px;">
        <div class="order-info">
          <h3 style="margin:0 0 8px 0; color:var(--text-primary);">🪑 ${t("table_label", "Stol")} ${tableNumber}</h3>
          <p style="margin:0 0 5px 0; color:var(--text-secondary); font-size:14px;"><strong>${t("status_label", "Status")}:</strong> <span style="text-transform:capitalize; color:${badgeColor}; font-weight:600;">${t("table_status_" + status, status)}</span></p>
          ${paymentReq ? `<p style="color:#DC2626; font-size:12px; font-weight:700; margin:0 0 6px 0; background:#FEF2F2; border:1px solid #FECACA; border-radius:6px; padding:4px 10px; display:inline-flex; align-items:center; gap:4px;">🔔 ${t("client_bill_requested", "Mijoz hisob so'radi")}</p>` : ""}
          <div class="call-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button disabled title="${t('bill_disabled_hint', 'Hisob faqat mijoz tomonidan so\'raladi')}" style="background:#FEF9C3; color:#92400E; border:1.5px solid #FDE68A; padding:6px 12px; border-radius:6px; cursor:not-allowed; font-weight:500; opacity:0.65;">💳 ${t("request_bill_btn", "Hisob so'rash")}</button>
            <button onclick="startCleaning('${tableId}')" style="background:#0EA5E9; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:500;">🧼 ${t("start_cleaning_btn", "Tozalash")}</button>
            <button onclick="markTableFree('${tableId}')" style="background:var(--text-muted); color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:500;">${t("mark_free_btn", "Bo'sh")}</button>
          </div>
        </div>
      </div>
    `;
  });

  liveTablesBox.innerHTML = htmlContent || `<p class="empty-state">${t("no_tables_found", "Stollar topilmadi")}</p>`;

  if (statActiveTables) statActiveTables.innerText = activeTables;
  // statReadyToServe va statBillsPending listenOrders ichida boshqariladi
}

// ==========================================
// 🏷 OFITSIANT SAHIFASI SARLAVHASINI YANGILASH
// ==========================================
window.loadWaiterHeader = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = window.currentWaiterId || localStorage.getItem("userId");

  if (!restId || !userId) return;

  try {
    const database = typeof window.db !== "undefined" ? window.db : db;

    const [settingsSnap, infoSnap, userSnap] = await Promise.all([
      get(ref(database, `restaurants/${restId}/settings`)),
      get(ref(database, `restaurants/${restId}/info`)),
      get(ref(database, `restaurants/${restId}/users/${userId}`))
    ]);

    const settings = settingsSnap.val() || {};
    const info = infoSnap.val() || {};
    const user = userSnap.val() || {};

    const restName = settings.restaurantName || info.name || t("unknown_restaurant", "Noma'lum Restoran");
    const staffName = user.name ? user.name : t("role_waiter", "Ofitsiant");

    window.currentStaffRealName = staffName;

    const dynamicText = `— ${staffName} (${t("role_waiter", "Ofitsiant")}) | ${restName}`;

    const dynamicSpan = document.getElementById('dynamicHeaderText');
    if (dynamicSpan) {
      dynamicSpan.innerText = dynamicText;
    }

    document.title = `NestaCRM ${dynamicText}`;

  } catch (error) {
    console.error(t("header_load_error", "Sarlavhani yuklashda xatolik:"), error);
  }
};

// ==========================================
// 📅 DAVOMAT (ATTENDANCE) TRACKER — WAITER
// ==========================================
(function initWaiterAttendance() {
  const restId = localStorage.getItem("restaurantId");
  const userId = localStorage.getItem("userId") || localStorage.getItem("uid");
  if (!restId || !userId) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const attendRef = ref(db, `restaurants/${restId}/attendance/${todayKey}/${userId}`);

  const now = Date.now();
  get(attendRef).then(snap => {
    const existing = snap.val() || {};
    const updates = {
      name: localStorage.getItem("userName") || "Ofitsiant",
      role: "waiter",
      date: todayKey,
      status: "present",
      lastSeen: now
    };
    if (!existing.onlineAt) updates.onlineAt = now;
    update(attendRef, updates).catch(() => {});
  });

  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ onDisconnect }) => {
    onDisconnect(attendRef).update({
      status: "offline",
      offlineAt: Date.now(),
      lastSeen: Date.now()
    }).catch(() => {});
  });

  window.addEventListener("beforeunload", () => {
    const offNow = Date.now();
    try {
      update(attendRef, { status: "offline", offlineAt: offNow, lastSeen: offNow }).catch(() => {});
    } catch (_) {}
  });

  setInterval(() => {
    update(attendRef, { lastSeen: Date.now(), status: "present" }).catch(() => {});
  }, 2 * 60 * 1000);
})();

let waiterInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {

  if (waiterInitialized) return;
  waiterInitialized = true;

  // 🔍 KIMDIR myAssignedOrders ni tozalayotganini ushlaymiz
  const _assignedEl = document.getElementById('myAssignedOrders');
  if (_assignedEl) {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          const html = _assignedEl.innerHTML;
          const isEmpty = html.includes('empty-state') || html.trim() === '';
          console.log('%c[MutationObserver] myAssignedOrders ozgardi:',
            isEmpty ? 'color:red;font-weight:bold' : 'color:green;font-weight:bold',
            isEmpty ? 'BOSHATILDI' : 'TOLDIRILDI',
            'Yangi content:', html.slice(0, 100)
          );
          if (isEmpty) console.trace('Kim tozaladi?');
        }
      }
    }).observe(_assignedEl, { childList: true, subtree: false });
    console.log('🔍 MutationObserver ishga tushdi — myAssignedOrders kuzatilmoqda');
  }

  const restId = localStorage.getItem("restaurantId");

  const isSubActive = await window.checkSubscriptionStatus(restId);

  if (!isSubActive) return;

  try {

    const database = window.db || db;

    const langSelect = document.getElementById("langSelect");

    if (langSelect) {

      langSelect.value = getLang();

      applyLang();

      langSelect.addEventListener("change", e => {
        setLang(e.target.value);
      });
    }

    onLangChange(() => {

      applyLang();

      // Chat UI matnlarini yangilash (til o'zgarganda)
      const chatSelTitle = document.getElementById("chatSelectionTitle");
      if (chatSelTitle) chatSelTitle.textContent = t("chat_selection_title", "Tanlang:");
      const _chatBackBtn = document.getElementById("chatBackBtn");
      if (_chatBackBtn) _chatBackBtn.textContent = `← ${t("chat_back_btn", "Orqaga")}`;
      const _chatInput = document.getElementById("chatInput");
      if (_chatInput) _chatInput.placeholder = t("chat_input_placeholder", "Xabar yozing...");
      document.querySelectorAll(".chat-option").forEach((el, i) => {
        const sp = el.querySelector("span:last-child");
        const labels = [t("chat_admin_group","Admin (Guruh)"),t("chat_admin_private","Admin bilan (Shaxsiy)"),t("chat_with_chef","Oshpaz bilan chat")];
        if (sp && labels[i]) sp.textContent = labels[i];
      });

      const roleText = t("role_waiter", "Ofitsiant");

      document.title = window.currentStaffRealName
        ? `NestaCRM — ${window.currentStaffRealName} (${roleText})`
        : `NestaCRM — ${roleText}`;

      if (typeof renderLiveTables === "function") renderLiveTables();
      if (typeof checkCleaningAlerts === "function") checkCleaningAlerts();
      renderWaiterCalls(_cachedCalls);

      if (Object.keys(ordersCache || {}).length > 0) {
        renderOrderPanels(ordersCache);
      } else {
        if (myAssignedBox && myAssignedBox.querySelector(".empty-state")) {
          myAssignedBox.innerHTML = `<p class="empty-state">${t("waiting_for_new_order", "Hozircha bo'shsiz. Yangi buyurtma kutilmoqda...")}</p>`;
        }
        if (myDeliveredBox && myDeliveredBox.querySelector(".empty-state")) {
          myDeliveredBox.innerHTML = `<p class="empty-state">${t("nothing_delivered_yet", "Hali hech narsa yetkazilmadi")}</p>`;
        }
      }
      updateWaiterTVButton();
    });

    const listeners = [
      listenOrders,
      listenMyStatus,
      listenWaiterCalls,
      listenPaymentRequests,
      listenStockAlerts,
      listenTablesLive,
      listenLoyalCustomers
    ];

    listeners.forEach(fn => {

      if (typeof fn === "function") {
        fn();
      }
    });

    if (typeof syncWaiterSettings === "function") {
      syncWaiterSettings();
    }

    if (typeof window.listenToMyRoleChange === "function") {
      window.listenToMyRoleChange();
    }

    if (typeof window.loadWaiterHeader === "function") {
      await window.loadWaiterHeader();
    }

    // Restoran logotipi va footer ma'lumotlarini yuklash
    if (typeof window.loadWaiterRestaurantBranding === "function") {
      await window.loadWaiterRestaurantBranding();
    }

    if (typeof checkWaiterAccess === "function") {
      checkWaiterAccess();
    }

    if (typeof window.initWaiterChat === "function") {
      window.initWaiterChat();
    }


    // ── TV va Fullscreen tugmalarini headerga qo'shish ──
    (function injectWaiterTVButtons() {
      if (document.getElementById("waiterTVBtn")) return;

      if (!document.getElementById("waiterTVBtnStyles")) {
        const s = document.createElement("style");
        s.id = "waiterTVBtnStyles";
        s.textContent = `
          #waiterTVBtn, #waiterFSBtn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 16px; border: none; border-radius: 10px;
            font-size: 13px; font-weight: 700; cursor: pointer;
            transition: transform .15s, opacity .15s; color: #fff;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
          }
          #waiterTVBtn { background: linear-gradient(135deg,#6366f1,#4f46e5); }
          #waiterFSBtn { background: linear-gradient(135deg,#0ea5e9,#0284c7); }
          #waiterTVBtn:hover, #waiterFSBtn:hover { transform: scale(1.04); opacity: .92; }

          body.tv-mode #myAssignedOrders {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
            gap: 20px !important;
          }
          body.tv-mode .order-card {
            font-size: 17px !important;
            padding: 20px !important;
            border-radius: 16px !important;
          }
          body.tv-mode .order-card h3 { font-size: 20px !important; font-weight: 800 !important; }
          body.tv-mode .order-card li { font-size: 15px !important; padding: 6px 0 !important; }
          body.tv-mode .btn-pickup { font-size: 16px !important; padding: 14px !important; }
          body.tv-mode #myDeliveredOrders,
          body.tv-mode .chart-section,
          body.tv-mode .lang-selector { display: none !important; }
          body.tv-mode #waiterTVBtn { background: linear-gradient(135deg,#ef4444,#dc2626) !important; }
        `;
        document.head.appendChild(s);
      }

      const tvBtn = document.createElement("button");
      tvBtn.id = "waiterTVBtn";
      tvBtn.innerHTML = "📺 " + t("tv_mode", "TV Rejimi");
      tvBtn.onclick = window.toggleWaiterTVMode;

      const fsBtn = document.createElement("button");
      fsBtn.id = "waiterFSBtn";
      fsBtn.innerHTML = "⛶ " + t("fullscreen_btn", "To'liq ekran");
      fsBtn.onclick = window.toggleWaiterFullscreen;

      const wrap = document.createElement("div");
      wrap.id = "waiterTVBtnWrap";
      wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-left:auto;";
      wrap.appendChild(tvBtn);
      wrap.appendChild(fsBtn);

      const target = document.querySelector(".header-actions") ||
        document.querySelector(".waiter-header") ||
        document.querySelector("header");
      if (target) target.appendChild(wrap);

      updateWaiterTVButton();
    })();

    console.log("✅ Waiter panel initialized successfully");

  } catch (error) {

    console.error(
      t("page_init_error", "Sahifani ishga tushirishda xato:"),
      error
    );
  }
});

/* =========================
   WAITER: FOOTER VA HEADER LOGOTIPINI YUKLASH
========================= */
window.loadWaiterRestaurantBranding = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const snap = await get(ref(db, `restaurants/${restId}/settings`));
    if (!snap.exists()) return;

    const settings = snap.val();

    const footerDiv = document.querySelector('.support-footer') || document.querySelector('.waiter-footer') || document.querySelector('footer');
    if (footerDiv) {
      let brandingBlock = footerDiv.querySelector('.waiter-branding-info');
      if (!brandingBlock) {
        brandingBlock = document.createElement('div');
        brandingBlock.className = 'waiter-branding-info';
        brandingBlock.style.cssText = `
          display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
          padding: 10px 16px; background: rgba(0,0,0,0.03);
          border-top: 1px solid var(--border-color, #e2e8f0);
          font-size: 13px; color: var(--text-muted, #64748b);
        `;
        footerDiv.appendChild(brandingBlock);
      }

      brandingBlock.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    } else {
      let waiterFooter = document.getElementById('waiterDynamicFooter');
      if (!waiterFooter) {
        waiterFooter = document.createElement('div');
        waiterFooter.id = 'waiterDynamicFooter';
        waiterFooter.style.cssText = `
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; gap: 20px;
          padding: 8px 20px; background: var(--bg-card, #fff);
          border-top: 1px solid var(--border-color, #e2e8f0);
          font-size: 13px; color: var(--text-muted, #64748b);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
        `;
        document.body.appendChild(waiterFooter);
      }

      waiterFooter.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }

  } catch (error) {
    console.error(t("branding_load_error_log", "Branding yuklashda xato:"), error);
  }
};

(function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;
  onValue(ref(db, `restaurants/${restId}/settings`), (snap) => {
    if (!snap.exists()) return;
    const settings = snap.val();

    const footerBranding = document.querySelector('.waiter-branding-info');
    if (footerBranding) {
      footerBranding.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }
    const dynamicFooter = document.getElementById('waiterDynamicFooter');
    if (dynamicFooter) {
      dynamicFooter.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }

    if (settings.restaurantLogoUrl) {
      const logoImg = document.getElementById('waiterRestaurantLogoImg');
      if (logoImg) {
        logoImg.src = settings.restaurantLogoUrl;
      }
    }
  });
})();