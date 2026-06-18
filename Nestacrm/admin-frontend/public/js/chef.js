// chef.js
import { CATEGORY_DATA } from "./shared.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  get,
  set,
  push,
  remove,
  query,
  orderByChild,
  limitToLast,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";
import { listenPlanFeatures } from "./plan_features.js";

/* =========================
   CONFIG
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCGCCIP3eFg40bOEENDLGcrw9c484ySCHQ",
  authDomain: "restoran-30d51.firebaseapp.com",
  databaseURL: "https://restoran-30d51-default-rtdb.firebaseio.com",
  projectId: "restoran-30d51",
  storageBucket: "restoran-30d51.firebasestorage.app",
  messagingSenderId: "862261129762",
  appId: "1:862261129762:web:5577e6821b4ad7ea4e507b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

window.allOrders = {};
let headerTimerInterval = null;

const urlParams = new URLSearchParams(window.location.search);
const rId = urlParams.get('rest') || urlParams.get('id') || localStorage.getItem("restaurantId");

if (rId) localStorage.setItem("restaurantId", rId);
const viewAsId = urlParams.get('viewAs');
const restIdFromUrl = urlParams.get('rest') || urlParams.get('id');

let currentRestaurantId = restIdFromUrl || localStorage.getItem("restaurantId");
let currentChefId = localStorage.getItem("userId") ||
  localStorage.getItem("chefId") ||
  localStorage.getItem("uid");

let chefActive = true;
let currentLang = getLang();

if (viewAsId && restIdFromUrl) {
  currentRestaurantId = restIdFromUrl;
  currentChefId = viewAsId;

  localStorage.setItem("restaurantId", restIdFromUrl);
  localStorage.setItem("userId", viewAsId);
  localStorage.setItem("chefId", viewAsId);
  localStorage.setItem("role", "chef");
  localStorage.setItem("isViewingAsAdmin", "true");

  console.log(t("admin_login_success", "✅ Admin kuzatuvchi (Oshpaz) sifatida muvaffaqiyatli kirdi."));
} else {
  const role = localStorage.getItem("role");

  if (!currentRestaurantId || !currentChefId || (role !== "chef" && role !== "admin")) {
    console.warn(t("no_permission_redirecting", "🚫 Ruxsat yo'q. Login sahifasiga yo'naltirilmoqda..."));
    window.location.replace("login.html");
  }
}

const BASE_PATH = `restaurants/${currentRestaurantId}`;
window.updateGlobalChefTime = async function (mins) {
  await update(ref(db, BASE_PATH + "/settings"), { normalOrderBaseTime: Number(mins) });
};

window.toggleGlobalFastOrder = async function (isActive) {
  await update(ref(db, BASE_PATH + "/settings"), { fastOrderActive: isActive });
};

// ==========================================
// 📝 OSHPAZ HARAKATLARINI LOG QILISH
// ==========================================
window.logChefAction = async function (message) {
  const restId = localStorage.getItem("restaurantId");
  const chefName = localStorage.getItem("userName") || t("chef_label", "Oshpaz");

  try {
    const newLogRef = push(ref(db, `restaurants/${restId}/activityLogs`));
    await set(newLogRef, {
      action: "kitchen_update",
      description: `👨‍🍳 ${message}`,
      userName: chefName,
      createdAt: Date.now()
    });
  } catch (e) {
    console.error(t("log_write_error", "Log yozishda xato:"), e);
  }
};

window.moveOrder = async function (orderId, newStatus) {
  const restId = localStorage.getItem("restaurantId");
  const orderRef = ref(db, `restaurants/${restId}/orders/${orderId}`);

  const statusMap = {
    "cooking": "cooking",
    "preparing": "cooking",
    "tayyorlanmoqda": "cooking",
    "ready": "ready",
    "tayyor": "ready"
  };

  const finalStatus = statusMap[newStatus] || newStatus;

  try {
    await update(orderRef, {
      status: finalStatus,
      statusKey: finalStatus,
      updatedAt: Date.now()
    });

    if (typeof window.logChefAction === "function") {
      const statusText = finalStatus === "ready" ? t("status_ready", "tayyor") : t("status_cooking", "pishirilmoqda");
      await window.logChefAction(`#${orderId.slice(-4)} - ${t("status_updated")}: ${statusText}`);
    }
  } catch (error) {
    console.error("Status update error:", error);
  }
};

function getStoredChefId() {
  return String(
    localStorage.getItem("chefId") ||
    localStorage.getItem("userId") ||
    localStorage.getItem("uid") ||
    localStorage.getItem("currentUserId") ||
    localStorage.getItem("id") ||
    ""
  ).trim();
}

// ==============================
// 🔄 DİNAMIK ROL KUZATUVCHISI 
// ==============================
window.listenToMyRoleChange = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = currentChefId || localStorage.getItem("userId");

  if (!restId || !userId) {
    console.warn(t("role_watch_no_data", "Rolni kuzatish uchun ma'lumotlar yetarli emas."));
    return;
  }

  try {
    onValue(ref(db, `restaurants/${restId}/users/${userId}/role`), (snap) => {
      if (!snap.exists()) return;

      const newRole = snap.val();
      const currentLocalRole = localStorage.getItem("role") || "chef";

      if (newRole && newRole !== currentLocalRole) {
        localStorage.setItem("role", newRole);
        const currentPath = window.location.pathname.toLowerCase();

        if (newRole === "admin" && !currentPath.includes("admin.html")) {
          alert(t("admin_rights_granted", "👑 Sizga Asosiy Boshqaruvchi (Admin) huquqlari berildi!"));
          window.location.replace(`admin.html?id=${restId}`);
        }
        else if (newRole === "chef" && !currentPath.includes("chef.html")) {
          alert(t("role_changed_chef", "👨‍🍳 Rolingiz o'zgardi. Oshpaz paneliga qaytarilmoqdasiz..."));
          window.location.replace(`chef.html?id=${restId}`);
        }
        else if (newRole === "waiter" && !currentPath.includes("waiter.html")) {
          alert(t("role_changed_waiter", "🧑‍🍳 Rolingiz o'zgardi. Ofitsiant paneliga qaytarilmoqdasiz..."));
          window.location.replace(`waiter.html?id=${restId}`);
        }
      }
    });
  } catch (error) {
    console.error(t("role_watch_error", "Rolni kuzatishda xatolik:"), error);
  }
};

// ==========================================
// ⏳ OBUNA VA TARIFNI KUZATISH TAYMERI
// ==========================================
window.startChefSubscriptionTimer = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  let container = document.getElementById("subTimerContainer");
  if (!container) {
    const logo = document.querySelector(".chef-header .logo") || document.querySelector(".logo");
    if (logo) {
      container = document.createElement("div");
      container.id = "subTimerContainer";
      container.style.marginLeft = "20px";
      logo.parentNode.insertBefore(container, logo.nextSibling);
    } else return;
  }

  try {
    const infoSnap = await get(ref(db, `restaurants/${restId}/info/tariff`));
    const currentTariff = String(infoSnap.val() || "START").toUpperCase();

    onValue(ref(db, `restaurants/${restId}/subscription`), (snap) => {
      const subData = snap.val();
      const expireVal = subData?.expireDate || subData?.expireAt || subData?.endDate;

      if (!subData || !expireVal) return;

      const expiryDate = new Date(expireVal).getTime();
      const runTimer = () => {
        const now = new Date().getTime();
        const diff = expiryDate - now;

        if (diff <= 0) {
          container.innerHTML = `<div style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:10px; font-weight:700; font-size:11px; border:1px solid #f87171;">⚠️ ${t("subscription_expired", "MUDDAT TUGADI")}</div>`;
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let color = d < 2 ? "#dc2626" : (d < 7 ? "#d97706" : "#059669");

        container.innerHTML = `
                    <div style="background:#f8fafc; color:${color}; padding:5px 12px; border-radius:10px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                        <i class="fa-solid fa-clock" style="font-size:14px;"></i>
                        <div style="display:flex; flex-direction:column; line-height:1.1;">
                            <span style="font-size:8px; font-weight:800; opacity:0.6;">${t("tariff", "TARIF")}: ${currentTariff}</span>
                            <span style="font-size:12px; font-weight:700;">${d > 0 ? d + 'k ' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}</span>
                        </div>
                    </div>`;
      };

      if (window.chefSubInterval) clearInterval(window.chefSubInterval);
      window.chefSubInterval = setInterval(runTimer, 60000);
      runTimer();
    });
  } catch (e) { console.error(t("timer_error_log", "Timer error:"), e); }
};

/* =========================
   STATE
========================= */
let allOrders = {};
window.allOrders = allOrders;
let searchDebounceTimer = null;
const PERSONAL_CHEF_ROOM = currentChefId ? `dm_${currentChefId}` : "dm_unknown";
let currentChefChatRoom = localStorage.getItem("chefChatRoom") || PERSONAL_CHEF_ROOM;
let orderCountdownInterval = null;
let lastOrdersSignature = "";
let socketConnected = false;

window.listeners = {};
window.addEventListener('beforeunload', () => {
  Object.values(window.listeners || {}).forEach(unsub => unsub?.());
});

// ==========================================
// 📅 DAVOMAT (ATTENDANCE) TRACKER — CHEF
// ==========================================
(function initChefAttendance() {
  const restId = localStorage.getItem("restaurantId");
  const userId = localStorage.getItem("userId") || localStorage.getItem("chefId") || localStorage.getItem("uid");
  if (!restId || !userId) return;

  const todayKey = new Date().toISOString().slice(0, 10); // "2025-06-01"
  const attendRef = ref(db, `restaurants/${restId}/attendance/${todayKey}/${userId}`);

  // Sahifa ochilganda — "keldi" deb belgilash
  const now = Date.now();
  get(attendRef).then(snap => {
    const existing = snap.val() || {};
    const updates = {
      name: localStorage.getItem("userName") || "Oshpaz",
      role: "chef",
      date: todayKey,
      status: "present",
      lastSeen: now
    };
    // Birinchi marta kelganda onlineAt ni yozamiz, keyingilarda o'zgartirmaymiz
    if (!existing.onlineAt) updates.onlineAt = now;
    update(attendRef, updates).catch(() => {});
  });

  // Firebase onDisconnect — internet uzilsa avtomatik offlineAt yoziladi
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ onDisconnect }) => {
    onDisconnect(attendRef).update({
      status: "offline",
      offlineAt: Date.now(),
      lastSeen: Date.now()
    }).catch(() => {});
  });

  // Sahifa yopilganda lastSeen yangilash
  window.addEventListener("beforeunload", () => {
    const offNow = Date.now();
    // navigator.sendBeacon orqali sinxron emas, lekin eng ishonchli yo'l
    try {
      update(attendRef, { status: "offline", offlineAt: offNow, lastSeen: offNow }).catch(() => {});
    } catch (_) {}
  });

  // Har 2 daqiqada lastSeen yangilab turish (real-time online holati uchun)
  setInterval(() => {
    update(attendRef, { lastSeen: Date.now(), status: "present" }).catch(() => {});
  }, 2 * 60 * 1000);
})();

window.allChefs = {};
window.allMenu = {};
window.orderChatsByOrder = {};
window.chefChats = {};
window.tableStates = {};
window.delayedAlertedOrders = window.delayedAlertedOrders || new Set();
window.kitchenAuditLogs = window.kitchenAuditLogs || [];
window.kitchenNotifications = window.kitchenNotifications || [];
window.stopList = window.stopList || {};
window.orderTimelines = window.orderTimelines || {};
window.chefSettings = window.chefSettings || {};
window.__stopListAlertedOrders = window.__stopListAlertedOrders || new Set();
window.__kitchenNotificationTimer = null;
window.__kitchenRealtimeTimer = null;
window.__kitchenTickerTimer = null;

/* =========================
   OPTIONAL SOCKET.IO
========================= */
const SOCKET_URL =
  localStorage.getItem("socketUrl") ||
  document.documentElement.dataset.socketUrl ||
  window.location.origin;

const socket = typeof window.io === "function"
  ? window.io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true
  })
  : null;

function emitSocket(eventName, payload) {
  if (!socket || !socketConnected) return;
  try {
    socket.emit(eventName, payload);
  } catch (err) {
    console.warn(t("socket_emit_error", "Socket emit xatolik:"), err);
  }
}

function listenSocket() {
  if (!socket) return;

  socket.on("connect", () => {
    socketConnected = true;
    emitSocket("chef:join", {
      chefId: currentChefId,
      chefName: localStorage.getItem("name") || t("chef_label", "Chef"),
      role: "chef"
    });
    showNotification(`🟢 ${t("socket_connected", "Tizimga ulandi")}`);
  });

  socket.on("disconnect", () => {
    socketConnected = false;
    showNotification(`🟡 ${t("socket_disconnected", "Tarmoq uzildi")}`);
  });

  socket.on("chef:new-order", payload => {
    if (!payload) return;
    const targetChefId = String(payload.chefId || "").trim();
    if (targetChefId && targetChefId === String(currentChefId)) {
      playSound();
      showNotification(`🆕 ${t("new_order_arrived", "Yangi buyurtma")}: #${payload.orderNumber || payload.orderId || ""}`);
    }
  });

  socket.on("chef:status-updated", payload => {
    if (!payload?.orderId) return;
    showNotification(`🔄 ${t("status_label")}: ${payload.statusLabel || payload.status || ""}`);
  });

  socket.on("chef:chat-message", payload => {
    if (!payload) return;
    if (payload.senderId !== currentChefId) {
      playSound();
      showNotification(`💬 ${payload.senderName || t("chef_label", "Oshpaz")}: ${payload.text || ""}`);
    }
  });


}

function ensureChefEnhancementLayout() {
  const header = document.querySelector(".chef-header");
  const main = document.querySelector("main.container");
  if (!header || !main) return;

  if (!document.getElementById("chefAllergyStyle")) {
    const s = document.createElement("style");
    s.id = "chefAllergyStyle";
    s.textContent = `
      .order-allergy-note {
        display: flex; align-items: flex-start; gap: 6px;
        margin-top: 10px; padding: 8px 10px;
        background: rgba(255, 200, 0, 0.12);
        border: 1.5px solid rgba(255, 200, 0, 0.45);
        border-radius: 8px; font-size: 13px; line-height: 1.4;
      }
      .allergy-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
      .allergy-text { color: #f5c518; font-weight: 600; word-break: break-word; }
      @keyframes chefShake {
        0%,100%{transform:translateX(0)}
        10%,30%,50%,70%,90%{transform:translateX(-4px)}
        20%,40%,60%,80%{transform:translateX(4px)}
      }
      .shake-anim { animation: chefShake 0.6s ease infinite; }
      .chef-card-countdown { transition: color 0.5s ease; }
    `;
    document.head.appendChild(s);
  }

  if (!document.getElementById("chefExtraFilters")) {
    const row = document.createElement("div");
    row.id = "chefExtraFilters";
    row.className = "chef-extra-filters";
    row.innerHTML = `
      <div class="chef-extra-filter-row">
        <select id="chefStatusFilter">
          <option value="all">${t("all_statuses", "Barcha statuslar")}</option>
          <option value="new">${t("status_new", "Yangi")}</option>
          <option value="accepted">${t("status_approved", "Tasdiqlangan")}</option>
          <option value="cooking">${t("status_cooking", "Tayyorlanmoqda")}</option>
          <option value="ready">${t("status_ready", "Tayyor")}</option>
          <option value="delayed">${t("delayed_order", "Kechikkan")}</option>
          <option value="mine">${t("my_orders", "Mening orderlarim")}</option>
        </select>
        <input id="chefTableFilter" type="text" placeholder="${t("table_number_placeholder", "Stol raqami...")}" />
        <input id="chefSearchInput" type="search" placeholder="${t("search_order_food", "Order / taom / note qidirish...")}" />
      </div>
    `;
    header.insertAdjacentElement("afterend", row);
  }

  if (!document.getElementById("chefDetailModal")) {
    const modal = document.createElement("div");
    modal.id = "chefDetailModal";
    modal.className = "chef-detail-modal";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="chef-detail-dialog">
        <div class="chef-detail-head">
          <h3>🍽 ${t("order_detail_title", "Order detail")}</h3>
          <button type="button" class="btn-close" onclick="closeChefOrderDetail()">✖</button>
        </div>
        <div id="chefDetailContent" class="chef-detail-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

document.addEventListener("input", (e) => {
  const ids = ["chefStatusFilter", "chefTableFilter", "chefSearchInput"];
  if (ids.includes(e.target.id)) {
    if (typeof renderChefOrders === "function") {
      renderChefOrders();
    }
  }
});

/* =========================
   DOM ELEMENTS
========================= */
const chefFilterEl = document.getElementById("chefFilter");
const categoryFilterEl = document.getElementById("categoryFilter");
const subFilterEl = document.getElementById("subFilter");
const langSelect = document.getElementById("langSelect");
const activeBox = document.getElementById("chefOrders");
const readyBox = document.getElementById("readyOrders");
const newOrdersBadge = document.getElementById("newOrdersBadge");
const myActiveCountEl = document.getElementById("myActiveCount");
const allChefsStatsEl = document.getElementById("allChefsStats");
const statsPanelEl = document.getElementById("statsPanel");
const chefChatRoomsDom = document.getElementById("chefChatRooms");
const chefChatMessagesDom = document.getElementById("chefChatMessages");
const chefChatInputDom = document.getElementById("chefChatInput");
const chefChatSendBtnDom = document.getElementById("chefChatSendBtn");
const chefChatTitleDom = document.getElementById("chefChatTitle");



/* =========================
   HELPERS
========================= */
/* =========================
   OVOZLI SIGNAL TIZIMI (Chef)
========================= */
let _chefAudioCtx = null;
let _chefUserInteracted = false;
let _chefPendingSound = false; // Foydalanuvchi bosmagunicha kutuvchi signal

// AudioContext faqat foydalanuvchi gesture dan keyin yaratiladi
function _chefGetAudioCtx() {
  if (_chefAudioCtx && _chefAudioCtx.state === "running") return _chefAudioCtx;
  if (_chefAudioCtx && _chefAudioCtx.state === "suspended") {
    _chefAudioCtx.resume().catch(() => {});
    return _chefAudioCtx;
  }
  if (!_chefUserInteracted) return null; // Gesture bo'lmasa — yaratmaymiz
  try {
    _chefAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _chefAudioCtx;
  } catch(e) { return null; }
}

// Foydalanuvchi birinchi gesture sida unlock + kutayotgan signal ijro etiladi
(function () {
  const unlock = async () => {
    _chefUserInteracted = true;
    // AudioContext yaratamiz (gesture ichida — sinxron)
    if (!_chefAudioCtx) {
      try { _chefAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    // resume() ni await bilan kutamiz — Chrome talabi
    if (_chefAudioCtx && _chefAudioCtx.state === "suspended") {
      try { await _chefAudioCtx.resume(); } catch(e) {}
    }
    document.removeEventListener("click", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    document.removeEventListener("touchstart", unlock, true);
    document.removeEventListener("touchend", unlock, true);
    // Agar signal kelgan bo'lsa — resume tugagandan keyin ijro etamiz
    if (_chefPendingSound) {
      _chefPendingSound = false;
      setTimeout(() => _playNewOrderBeep(), 50);
    }
  };
  document.addEventListener("click", unlock, true);
  document.addEventListener("keydown", unlock, true);
  document.addEventListener("touchstart", unlock, true);
  document.addEventListener("touchend", unlock, true);
})();

function _chefBeep(freq, duration, gain, delay) {
  const ctx = _chefGetAudioCtx();
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
  } catch(e) {}
}

function _playChefBeepPattern() {
  // 5 marta jiringlash
  _chefBeep(880, 0.18, 0.7, 0.00);
  _chefBeep(660, 0.18, 0.6, 0.22);
  _chefBeep(880, 0.18, 0.7, 0.55);
  _chefBeep(660, 0.18, 0.6, 0.77);
  _chefBeep(1100, 0.28, 0.8, 1.10);
}

function _playNewOrderBeep() {
  _chefBeep(880, 0.18, 0.7, 0.00);
  _chefBeep(660, 0.18, 0.6, 0.22);
  _chefBeep(880, 0.18, 0.7, 0.55);
  _chefBeep(660, 0.18, 0.6, 0.77);
  _chefBeep(1100, 0.28, 0.8, 1.10);
}

// WAV + Web Audio fallback — foydalanuvchi gesture sini tekshiradi
function _chefPlayAudio(isNewOrder) {
  if (window.chefSettings && window.chefSettings.soundEnabled === false) return;

  const tryWebAudio = () => {
    if (!_chefUserInteracted) {
      // Hali bosimagan — signalni queue ga qo'yamiz
      _chefPendingSound = true;
      return;
    }
    if (isNewOrder) _playNewOrderBeep();
    else _playChefBeepPattern();
  };

  // Avval WAV urinib ko'ramiz
  try {
    const audio = new Audio("/img/notify.wav?v=2");
    audio.volume = isNewOrder ? 1.0 : 0.85;
    const p = audio.play();
    if (p) {
      p.catch(() => tryWebAudio());
    } else {
      tryWebAudio();
    }
  } catch(e) {
    tryWebAudio();
  }
}

function playSound() {
  _chefPlayAudio(false);
}

// Yangi order uchun alohida kuchli signal
function playNewOrderSound() {
  _chefPlayAudio(true);
}

const STATUS_LABELS = {
  new: "new",
  approved: "approved",
  cooking: "cooking",
  ready: "ready",
  closed: "closed"
};

function getAssignedChefId(orderId, order = null) {
  const orderChefId = String(order?.chefId || "").trim();
  if (orderChefId) return orderChefId;
  const chatChefId = String(
    window.orderChatsByOrder?.[orderId]?.meta?.targetId || ""
  ).trim();
  if (chatChefId) return chatChefId;
  return "";
}

function getAssignedChefName(orderId, order = null) {
  const chefId = String(getAssignedChefId(orderId, order) || "");
  if (!chefId) return "—";
  return window.allChefs?.[chefId]?.name || chefId;
}

function getSelectedChef() {
  return chefFilterEl?.value || localStorage.getItem("chefFilter") || "all";
}

function getSelectedCategory() {
  return categoryFilterEl?.value || localStorage.getItem("categoryFilter") || "all";
}

function getSelectedSub() {
  return subFilterEl?.value || localStorage.getItem("subFilter") || "all";
}

function getLocale() {
  if (currentLang === "ru") return "ru-RU";
  if (currentLang === "en") return "en-GB";
  return "uz-UZ";
}

function escapeChatHTML(str = "") {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch] || ch));
}

function escapeJsString(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function formatClock(ts) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatOrderTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(getLocale(), {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function formatDuration(ms) {
  const totalMs = Number(ms || 0);
  if (!totalMs || totalMs < 0) return `0 ${t("minute_short", "daq")}`;
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} ${t("hour_short", "soat")} ${m} ${t("minute_short", "daq")}`;
  if (m > 0) return `${m} ${t("minute_short", "daq")} ${s} ${t("second_short", "soniya")}`;
  return `${s} ${t("second_short", "soniya")}`;
}

function formatMoney(amount, currency = "UZS") {
  const num = Number(amount || 0);
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "UZS" ? 0 : 2
    }).format(num);
  } catch (_) {
    return `${num.toLocaleString(getLocale())} ${currency}`;
  }
}

function isFastOrder(order) {
  return String(order?.priority || "").toLowerCase() === "fast";
}

function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeKitchenStatus(status) {
  const s = normalizeText(status);
  const map = {
    yangi: "new", new: "new",
    tasdiqlandi: "approved", approved: "approved",
    tayyorlanmoqda: "cooking", cooking: "cooking",
    tayyor: "ready", ready: "ready",
    yopildi: "closed", closed: "closed"
  };
  return map[s] || "new";
}

function getOrderStatus(order) {
  return normalizeKitchenStatus(order?.status || order?.statusKey);
}

function getStatusText(status) {
  const s = normalizeKitchenStatus(status);
  const map = {
    new: "status_created",
    approved: "status_admin_approved",
    cooking: "status_cooking",
    ready: "status_ready",
    closed: "status_closed"
  };
  return t(map[s] || "status_created", "Yaratildi");
}

function getMenuName(menu, fallback = "") {
  if (!menu) return fallback;
  if (typeof menu.name === "object" && menu.name !== null) {
    return menu.name[currentLang] || menu.name.uz || menu.name.ru || menu.name.en || fallback;
  }
  if (typeof menu.name === "string") return menu.name;
  return fallback;
}

// ─── Allergiya chiplarini joriy tilga o'girish ────────────────────────────────
// allergyNote Firebase da istalgan tilda matn sifatida saqlanadi
// Bu funksiya barcha tillardagi qiymatlarni teskari izlab, t() orqali joriy tilga o'giradi
const _CHIP_REVERSE_MAP = (() => {
  // key → [uz, ru, en] barcha mumkin qiymatlar (kichik harfda)
  const TABLE = {
    chip_no_salt:    ["tuzsiz",      "без соли",       "no salt"],
    chip_low_salt:   ["kam tuzli",   "мало соли",      "low salt"],
    chip_no_spicy:   ["achchiqsiz",  "без острого",    "not spicy"],
    chip_spicy:      ["achchiq",     "острое",         "spicy"],
    chip_no_onion:   ["piyozsiz",    "без лука",       "no onion"],
    chip_no_greens:  ["ko'katsiz",   "без зелени",     "no greens"],
    chip_no_oil:     ["yog'siz",     "без масла",      "no oil"],
    chip_vegetarian: ["vegetarian",  "вегетарианское", "vegetarian"],
  };
  const map = {};
  Object.entries(TABLE).forEach(([key, variants]) => {
    variants.forEach(v => { map[v] = key; });
  });
  return map;
})();

function translateAllergyNote(note) {
  if (!note) return "";
  return note
    .split(",")
    .map(part => {
      const trimmed = part.trim();
      const key = _CHIP_REVERSE_MAP[trimmed.toLowerCase()];
      return key ? t(key, trimmed) : trimmed;
    })
    .join(", ");
}

function getTranslatedItemName(item, menuItem = null, lang = currentLang || "uz") {
  if (menuItem?.name) {
    if (typeof menuItem.name === "object") {
      return menuItem.name[lang] || menuItem.name.uz || menuItem.name.ru || menuItem.name.en || "—";
    }
    return menuItem.name || "—";
  }
  if (item?.name) {
    if (typeof item.name === "object") {
      return item.name[lang] || item.name.uz || item.name.ru || item.name.en || "—";
    }
    return item.name || "—";
  }
  return "—";
}

function getOrderItemMenu(item) {
  const menuId = item.menuId || item.id || item.itemId;
  return window.allMenu?.[menuId] || null;
}

function getCategoryLabel(categoryId) {
  if (!categoryId) return "";
  const cat = CATEGORY_DATA?.categories?.find(c => c.id === categoryId);
  return cat ? (t(cat.nameKey) || categoryId) : categoryId;
}

function getSubcategoryLabel(subKey) {
  if (!subKey) return "";
  return t(subKey) || subKey;
}

function formatRemainingMs(ms) {
  if (!ms || ms <= 0) return `0 ${t("minute_short", "daq")}`;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} ${t("hour_short", "soat")} ${m} ${t("minute_short", "daq")}`;
  return `${m} ${t("minute_short", "daq")} ${s} ${t("second_short", "soniya")}`;
}

function formatRemainingTime(readyAt) {
  const diff = Number(readyAt || 0) - Date.now();
  if (diff <= 0) return `✅ ${t("ready_time_reached")}`;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `⏳ ${minutes}:${String(seconds).padStart(2, "0")} ${t("left_short", "qoldi")}`;
}

function getRemainingInfo(order) {
  const readyAt = Number(order?.readyAt || 0);
  if (!readyAt) {
    return {
      text: `⏳ ${t("time_not_set", "Vaqt belgilanmagan")}`,
      urgent: false,
      done: false,
      delayed: false,
      delayedMinutes: 0
    };
  }
  const diff = readyAt - Date.now();
  const urgent = diff > 0 && diff <= 5 * 60 * 1000;
  const done = diff <= 0;
  const delayedMinutes = done ? Math.floor(Math.abs(diff) / 60000) : 0;
  const delayed = delayedMinutes >= 20;
  if (done) {
    return {
      text: `✅ ${t("ready_time_reached", "Vaqt tugadi")}`,
      urgent: false,
      done: true,
      delayed,
      delayedMinutes
    };
  }
  return {
    text: `⏳ ${t("time_left_prefix", "Qoldi")}: ${formatRemainingMs(diff)}`,
    urgent,
    done: false,
    delayed: false,
    delayedMinutes: 0
  };
}

function showNotification(text) {
  const n = document.getElementById("notification");
  if (!n) {
    console.log(t("notification_log", "Notification:"), text);
    return;
  }
  n.innerText = text;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 3000);
}

function showChefNotification(text) {
  showNotification(text);
}

/* =========================
   SECURITY + BOOTSTRAP
========================= */
async function ensureChefUserExists() {
  if (!currentChefId) return;
  const userRef = ref(db, BASE_PATH + "/users/" + currentChefId);
  const snap = await get(userRef);
  if (snap.exists()) return;
  await set(userRef, {
    id: currentChefId,
    name: localStorage.getItem("name") || t("chef_label", "Oshpaz"),
    role: "chef",
    active: true,
    createdAt: Date.now()
  });
}

async function ensureChefAccess(requiredPermission = "kitchen_access") {
  const snap = await get(ref(db, `${BASE_PATH}/users/${currentChefId}`));

  if (!snap.exists()) {
    alert(t("user_not_found", "User topilmadi"));
    window.location.replace("login.html");
    throw new Error("User not found");
  }

  const user = snap.val() || {};
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  if (user.active === false) {
    alert(t("staff_inactive", "Sizning hisobingiz faolsizlantirilgan!"));
    window.location.replace("login.html");
    throw new Error("Inactive chef");
  }
  const isOwner = user.role === "admin";
  const isChef = user.role === "chef";
  const hasSpecificPermission = permissions.includes(requiredPermission);
  const hasGeneralPermission =
    permissions.includes("kitchen_access") ||
    permissions.includes("kitchen_manage") ||
    permissions.includes("all");

  const allowed = isOwner || isChef || hasSpecificPermission || hasGeneralPermission;

  if (!allowed) {
    alert(t("no_kitchen_permission", "Oshxona paneliga kirish uchun ruxsatingiz yo'q!"));
    window.location.replace("login.html");
    throw new Error("Permission denied");
  }

  return user;
}

/* =========================
   FILTERS
========================= */
function renderCategoryFilter() {
  if (!categoryFilterEl) return;
  const savedCategory = localStorage.getItem("categoryFilter") || "all";
  categoryFilterEl.innerHTML = `<option value="all">${t("all_categories", "Barcha kategoriyalar")}</option>`;
  (CATEGORY_DATA?.categories || []).forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = t(cat.nameKey);
    categoryFilterEl.appendChild(option);
  });
  categoryFilterEl.value = savedCategory;
}

function renderSubFilter(categoryId = "all") {
  if (!subFilterEl) return;
  const savedSub = localStorage.getItem("subFilter") || "all";
  subFilterEl.innerHTML = `<option value="all">${t("all_subcategories", "Barcha subkategoriyalar")}</option>`;
  if (categoryId === "all") {
    subFilterEl.value = "all";
    return;
  }
  const category = CATEGORY_DATA?.categories?.find(c => c.id === categoryId);
  (category?.sub || []).forEach(subKey => {
    const option = document.createElement("option");
    option.value = subKey;
    option.textContent = t(subKey);
    subFilterEl.appendChild(option);
  });
  const exists = [...subFilterEl.options].some(opt => opt.value === savedSub);
  subFilterEl.value = exists ? savedSub : "all";
}

function fillChefFilter(users) {
  if (!chefFilterEl) return;
  const previousValue = chefFilterEl.value || localStorage.getItem("chefFilter") || "all";
  chefFilterEl.innerHTML = `<option value="all">${t("all_items", "Barchasi")}</option>`;
  Object.entries(users).forEach(([id, user]) => {
    if (user.role !== "chef") return;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${user.active !== false ? "🟢" : "🔴"} ${user.name || id}`;
    chefFilterEl.appendChild(option);
  });
  const exists = [...chefFilterEl.options].some(opt => opt.value === previousValue);
  chefFilterEl.value = exists ? previousValue : "all";
}

function matchesFilters(order) {
  const selectedChef = getSelectedChef();
  const selectedCategory = getSelectedCategory();
  const selectedSub = getSelectedSub();
  if (selectedChef !== "all") {
    if (String(order.chefId || "") !== String(selectedChef)) return false;
  }
  if (selectedCategory === "all" && selectedSub === "all") return true;
  const items = Object.values(order.items || {});
  return items.some(item => {
    const menu = getOrderItemMenu(item);
    if (!menu) return true;
    if (selectedCategory !== "all" && menu.category !== selectedCategory) return false;
    if (selectedSub !== "all" && menu.subcategory !== selectedSub) return false;
    return true;
  });
}

function filterChefOrdersByStatus(order) {
  const filterEl = document.getElementById("chefStatusFilter");
  const value = filterEl?.value || localStorage.getItem("chefStatusFilter") || window.chefSettings?.defaultFilter || "all";
  const status = getOrderStatus(order);
  const remaining = getRemainingInfo(order);
  if (value === "all") return true;
  if (value === "mine") return String(order?.chefId || "") === String(currentChefId);
  if (value === "delayed") return remaining.delayed;
  const normalizedStatus = normalizeKitchenStatus(status);
  const map = { new: ["new"], accepted: ["approved"], cooking: ["cooking"], ready: ["ready"] };
  return (map[value] || []).includes(normalizedStatus);
}

function filterChefOrdersByCategory(order) {
  const selectedCategory = getSelectedCategory();
  if (selectedCategory === "all") return true;
  return Object.values(order?.items || {}).some(item => {
    const menu = getOrderItemMenu(item) || {};
    return String(menu?.category || "") === String(selectedCategory);
  });
}

function filterChefOrdersByTable(order) {
  const value = normalizeText(document.getElementById("chefTableFilter")?.value || "");
  if (!value) return true;
  return normalizeText(order?.table) === value;
}

function filterChefOrdersByAssignedChef(order) {
  const selectedChef = getSelectedChef();
  if (selectedChef === "all") return true;
  return String(order?.chefId || "") === String(selectedChef);
}

function filterChefOrdersByDelay(order) {
  const value = document.getElementById("chefStatusFilter")?.value || "all";
  if (value !== "delayed") return true;
  return getRemainingInfo(order).delayed;
}

function searchChefOrders(orderId, order) {
  const query = normalizeText(document.getElementById("chefSearchInput")?.value || "");
  if (!query) return true;
  const textParts = [
    orderId, order?.table, order?.clientRequest, order?.lastClientMessage, order?.lastChefMessage,
    getAssignedChefName(orderId, order)
  ];
  Object.values(order?.items || {}).forEach(item => {
    const menu = getOrderItemMenu(item) || {};
    textParts.push(
      item?.name, getTranslatedItemName(item, menu, currentLang),
      menu?.name?.uz, menu?.name?.ru, menu?.name?.en,
      menu?.category, menu?.subcategory, item?.kitchenNote
    );
  });
  const haystack = normalizeText(textParts.filter(Boolean).join(" "));
  return haystack.includes(query);
}

function filterMyAssignedOrders(order) {
  const value = document.getElementById("chefStatusFilter")?.value || "all";
  if (value !== "mine") return true;
  return String(order?.chefId || "") === String(currentChefId);
}

function applyChefOrderFilters(orderId, order) {
  const status = getOrderStatus(order);
  const normalizedStatus = normalizeKitchenStatus(status);
  const allowed = ["new", "approved", "cooking", "ready"];
  if (!allowed.includes(normalizedStatus)) return false;
  if (!filterChefOrdersByStatus(order)) return false;
  if (!filterChefOrdersByCategory(order)) return false;
  if (!filterChefOrdersByAssignedChef(order)) return false;
  if (!filterChefOrdersByTable(order)) return false;
  if (!filterChefOrdersByDelay(order)) return false;
  if (!filterMyAssignedOrders(order)) return false;
  if (!searchChefOrders(orderId, order)) return false;
  return true;
}

function getOrderPriorityLabel(order) {
  const remaining = getRemainingInfo(order);
  if (remaining.delayed) return "critical";
  if (remaining.urgent) return "high";
  if (isFastOrder(order)) return "fast";
  if (String(order?.deliveryType || order?.orderType || "").toLowerCase().includes("delivery")) return "delivery";
  if (order?.reservationId || order?.isReservation === true) return "reservation";
  if (String(order?.customerType || order?.loyalty || "").toLowerCase().includes("vip")) return "vip";
  return "normal";
}

function sortChefOrdersByPriority(entries = []) {
  // Yangi buyurtmalar (new/yangi) har doim eng tepada turadi
  const NEW_STATUSES = ["new", "yangi", "pending", "queue", ""];
  const statusRank = { new: 0, yangi: 0, pending: 0, queue: 0, approved: 1, tasdiqlandi: 1, cooking: 2, tayyorlanmoqda: 2, ready: 3, tayyor: 3 };
  const priorityRank = { critical: 0, high: 1, fast: 2, delivery: 3, reservation: 4, vip: 5, normal: 6 };
  return [...entries].sort((a, b) => {
    const [idA, orderA] = a;
    const [idB, orderB] = b;
    const stA = normalizeKitchenStatus(orderA?.status || orderA?.statusKey || "");
    const stB = normalizeKitchenStatus(orderB?.status || orderB?.statusKey || "");
    // Yangi buyurtmalar har doim birinchi
    const aIsNew = NEW_STATUSES.includes(String(orderA?.status || orderA?.statusKey || "").toLowerCase());
    const bIsNew = NEW_STATUSES.includes(String(orderB?.status || orderB?.statusKey || "").toLowerCase());
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    // So'ng priority bo'yicha
    const pA = priorityRank[getOrderPriorityLabel(orderA)] ?? 999;
    const pB = priorityRank[getOrderPriorityLabel(orderB)] ?? 999;
    if (pA !== pB) return pA - pB;
    const sA = statusRank[stA] ?? 999;
    const sB = statusRank[stB] ?? 999;
    if (sA !== sB) return sA - sB;
    // Oxirida: yangi kelgan birinchi (createdAt kamayuvchi — eng yangi tepada)
    const tA = Number(orderA?.createdAt || 0);
    const tB = Number(orderB?.createdAt || 0);
    return tB - tA;
  });
}

function getChefVisibleOrders() {
  const orders = window.allOrders || allOrders || {};
  const entries = Object.entries(orders).filter(([orderId, order]) => applyChefOrderFilters(orderId, order));
  return sortChefOrdersByPriority(entries);
}

/* =========================
   RENDER ORDERS (ENHANCED)
========================= */
function getOrderCookStartTime(order) {
  return Number(order?.startedAt || order?.takenAt || order?.assignedAt || order?.createdAt || 0);
}

function getOrderWaitDuration(order) {
  const start = getOrderCookStartTime(order);
  if (!start) return 0;
  const end = Number(order?.finishedAt || Date.now());
  return Math.max(0, end - start);
}

function getPriorityBadgeHtml(order) {
  const p = getOrderPriorityLabel(order);
  const map = {
    critical: `<span class="priority-badge critical">🚨 ${t("priority_critical", "Kritik")}</span>`,
    high: `<span class="priority-badge high">⏰ ${t("priority_high", "Yuqori")}</span>`,
    fast: `<span class="priority-badge fast">⚡ ${t("priority_fast", "Tezkor")}</span>`,
    delivery: `<span class="priority-badge delivery">🛵 ${t("priority_delivery", "Yetkazish")}</span>`,
    reservation: `<span class="priority-badge reservation">📅 ${t("priority_reservation", "Band qilingan")}</span>`,
    vip: `<span class="priority-badge vip">👑 ${t("priority_vip", "VIP")}</span>`,
    normal: `<span class="priority-badge normal">🟢 ${t("priority_normal", "Oddiy")}</span>`
  };
  return map[p] || map.normal;
}

function getItemKitchenState(item = {}) {
  return normalizeText(item?.kitchenStatus || item?.status || "");
}

function getItemKitchenBadge(item = {}) {
  const state = getItemKitchenState(item);
  if (state === "prepared") return `<span class="item-kitchen-badge prepared">✅ ${t("item_badge_prepared", "Tayyorlandi")}</span>`;
  if (state === "delayed") return `<span class="item-kitchen-badge delayed">⏰ ${t("item_badge_delayed", "Kechikdi")}</span>`;
  if (state === "rejected") return `<span class="item-kitchen-badge rejected">❌ ${t("item_badge_rejected", "Rad etildi")}</span>`;
  return `<span class="item-kitchen-badge pending">🕓 ${t("item_badge_pending", "Kutmoqda")}</span>`;
}

function renderOrderItemsDetailed(orderId, order) {
  const items = Object.entries(order?.items || {});
  if (!items.length) return `<div class="detail-empty">${t("no_items", "Item yo'q")}</div>`;
  return items.map(([itemKey, item]) => {
    const menu = getOrderItemMenu(item) || {};
    const name = getTranslatedItemName(item, menu, currentLang);
    const qty = Number(item?.qty || 1);
    const note = item?.kitchenNote ? `<div class="item-kitchen-note">📝 ${escapeHtml(item.kitchenNote)}</div>` : "";
    const prepTime = Number(item?.prepTime || menu?.prepTime || 15);
    return `
      <div class="chef-item-row">
        <div class="chef-item-main">
          <div class="chef-item-title">
            <b>${escapeHtml(name)}</b>
            <span>x${qty}</span>
            ${getItemKitchenBadge(item)}
          </div>
          <div class="chef-item-meta">
            ${escapeHtml(getCategoryLabel(menu?.category))}${menu?.subcategory ? ` • ${escapeHtml(getSubcategoryLabel(menu.subcategory))}` : ""}
            • ${prepTime} ${t("minute_short", "daq")}
          </div>
          ${note}
        </div>
        <div class="chef-item-actions">
          <button type="button" onclick="toggleItemPrepared('${escapeJsString(orderId)}','${escapeJsString(itemKey)}')">✅</button>
          <button type="button" onclick="markDelayedItem('${escapeJsString(orderId)}','${escapeJsString(itemKey)}')">⏰</button>
          <button type="button" onclick="addKitchenNote('${escapeJsString(orderId)}','${escapeJsString(itemKey)}')">📝</button>
          <button type="button" onclick="rejectOrderItem('${escapeJsString(orderId)}','${escapeJsString(itemKey)}')">❌</button>
          <button type="button" onclick="toggleItemAvailability('${escapeJsString(menu?.id || item?.menuId || itemKey)}', false)">⛔</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderChefOrderCard(orderId, order, queueNumber) {
  const status = normalizeText(order.status || order.statusKey || "");
  const orderTime = formatDateTime(order.createdAt);
  const totalItems = Object.values(order.items || {}).reduce((acc, item) => acc + (Number(item.qty) || 1), 0);
  const isFast = !!order.isFastOrder;
  const isCooking = ["cooking", "tayyorlanmoqda"].includes(status);

  const timerHtml = isCooking ? `
    <div class="order-timer" data-start="${order.acceptedAt || order.createdAt}" data-limit="${order.prepTimeLimit || 15}">
      <i class="fa-regular fa-clock"></i> <span class="timer-val">00:00</span>
    </div>` : "";

  let actionHtml = "";
  if (status === "approved" || status === "tasdiqlandi" || status === "new") {
    actionHtml = `
      <div style="margin-top:10px;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:5px;font-weight:600;">
          ⏱ ${t("enter_ready_minutes","Tayyor bo'lish vaqti (daqiqa)")}
        </div>
        <div style="display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap;">
          ${[5,10,15,20,30].map(m =>
            `<button onclick="document.getElementById('time-input-${escapeHtml(orderId)}').value=${m}"
              style="padding:4px 10px;background:rgba(251,191,36,0.15);border:1.5px solid rgba(217,119,6,0.35);
              color:#92400e;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">${m}</button>`
          ).join("")}
        </div>
        <div style="display:flex;gap:7px;align-items:center;">
          <input id="time-input-${escapeHtml(orderId)}" type="number" min="1" max="120"
            placeholder="${t("minute_short","Daqiqa...")}"
            style="flex:1;padding:8px 10px;border-radius:9px;border:1.5px solid rgba(217,119,6,0.45);
            background:rgba(251,191,36,0.10);color:#1e293b;font-size:14px;font-weight:700;outline:none;"
            onkeydown="if(event.key==='Enter') window.startCooking('${escapeHtml(orderId)}')">
          <button onclick="window.startCooking('${escapeHtml(orderId)}')" 
            style="padding:9px 14px;background:linear-gradient(135deg,#16a34a,#22c55e);
            color:#fff;border:none;border-radius:10px;font-weight:800;font-size:13px;
            cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;
            box-shadow:0 3px 10px rgba(22,163,74,0.4);">
            <i class="fa-solid fa-play"></i> ${t("start_cooking_btn","BOSHLASH")}
          </button>
        </div>
      </div>`;
    } else if (isCooking) {
    // Countdown hisoblash
    const readyAt   = Number(order.readyAt || 0);
    const now0      = Date.now();
    const diffMs0   = readyAt - now0;
    const diffMins0 = Math.floor(diffMs0 / 60000);
    const diffSecs0 = Math.floor((diffMs0 % 60000) / 1000);
    const timerColor0 = diffMs0 <= 60000 ? "#ef4444" : diffMs0 <= 3*60000 ? "#f97316" : "#f59e0b";
    const timerTxt0   = readyAt
      ? (diffMs0 <= 0
          ? `⚠️ ${t("overdue_label","Kechikdi")} ${Math.abs(diffMins0)} ${t("minute_short","daq")}`
          : `⏱ ${diffMins0}:${String(diffSecs0).padStart(2,"0")} ${t("left_short","qoldi")}`)
      : `🔥 ${t("cooking_label","Tayyorlanmoqda...")}`;

    actionHtml = `
      <div style="margin-top:10px;">
        <!-- Countdown -->
        <div class="chef-card-countdown" data-ready-at="${readyAt || ""}" data-order-id="${escapeHtml(orderId)}"
          style="text-align:center;font-size:14px;font-weight:800;color:${timerColor0};padding:7px 10px;
          background:rgba(0,0,0,0.12);border-radius:10px;margin-bottom:8px;letter-spacing:0.5px;">
          ${timerTxt0}
        </div>
        <!-- Vaqt o'zgartirish: input + Yangilash -->
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
          ${[5,10,15,20,30].map(m => `<button
            onclick="document.getElementById('new-time-${escapeHtml(orderId)}').value=${m}"
            style="padding:4px 9px;background:rgba(251,191,36,0.15);border:1.5px solid rgba(217,119,6,0.35);
            color:#92400e;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">${m}</button>`).join("")}
          <input id="new-time-${escapeHtml(orderId)}" type="number" min="1" max="120"
            placeholder="${t("minute_short","Daq")}" value="${order.prepMinutes || ""}"
            style="width:60px;padding:5px 8px;border-radius:8px;border:1.5px solid rgba(217,119,6,0.40);
            background:rgba(251,191,36,0.10);color:#1e293b;font-size:13px;font-weight:700;outline:none;"
            onkeydown="if(event.key==='Enter') window.updateCookingTimer('${escapeHtml(orderId)}')">
          <button onclick="window.updateCookingTimer('${escapeHtml(orderId)}')" title="${t("update_timer","Vaqtni yangilash")}"
            style="padding:5px 10px;background:rgba(251,191,36,0.20);border:1.5px solid rgba(217,119,6,0.40);
            color:#92400e;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">
            🔄 ${t("update_timer","Yangilash")}
          </button>
        </div>
        <!-- Tayyor tugmasi -->
        <button class="btn-action btn-ready" onclick="markOrderReady('${orderId}')" style="width:100%;">
          <i class="fa-solid fa-check-double"></i> ${t("ready_order","TAYYOR ✅")}
        </button>
      </div>`;
  }

  const itemsHtml = Object.values(order.items || {}).map(item => {
    const menu = getOrderItemMenu(item) || {};
    const name = getTranslatedItemName(item, menu, currentLang);
    return `
      <div class="order-item-row">
        <span class="item-name">${escapeHtml(name)}</span>
        <span class="item-qty">x${item.qty}</span>
      </div>`;
  }).join("");

  return `
    <div class="order-card ${isFast ? 'fast-order' : ''} ${isCooking ? 'status-cooking' : ''}">
      <div class="card-glow"></div>
      <div class="order-card-header">
        <div class="order-info">
          <span class="order-number">#${queueNumber}</span>
          <span class="order-table">${t("table_short", "Stol")}: ${escapeHtml(String(order.table || order.tableNumber || "-"))}</span>
        </div>
        <div class="order-meta">
          <span class="order-time">${orderTime}</span>
        </div>
      </div>
      
      <div class="order-card-body">
        ${itemsHtml}
        ${order.allergyNote ? `
        <div class="order-allergy-note">
          <span class="allergy-icon">⚠️</span>
          <span class="allergy-text">${escapeHtml(translateAllergyNote(order.allergyNote))}</span>
        </div>` : ""}
      </div>
      
      <div class="order-card-footer">
        <div class="footer-stats">
          <span class="items-total"><i class="fa-solid fa-utensils"></i> ${totalItems}</span>
          ${timerHtml}
        </div>
        <div class="order-actions">
          ${actionHtml}
        </div>
      </div>
    </div>
  `;
}

window.updateStatus = async function (orderId, nextStatus) {
  const rId = localStorage.getItem("restaurantId");
  if (!rId) return;

  const orderRef = ref(db, `restaurants/${rId}/orders/${orderId}`);
  let updates = { status: nextStatus };

  if (nextStatus === 'cooking') {
    const timeInput = document.getElementById(`time-input-${orderId}`);
    const minutes = timeInput.value;
    if (!minutes) {
      alert(t("enter_prep_time", "Tayyor bo'lish vaqtini kiriting!"));
      return;
    }
    updates.prepTime = minutes;
    updates.cookingStartedAt = Date.now();
  }

  if (nextStatus === 'ready') {
    updates.finishedAt = Date.now();
  }

  try {
    await update(orderRef, updates);
  } catch (e) {
    console.error(t("error_label", "Xato:"), e);
  }
};

/**
 * @param {string} orderId 
 */
window.finishOrder = async function (orderId) {
  const isConfirmed = confirm(t("confirm_payment_text", "Mijoz to'lov qildimi? Buyurtma yakunlanadi va stol bo'shatiladi."));

  if (!isConfirmed) return;

  try {
    const restaurantId = localStorage.getItem("restaurantId");
    const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);

    await update(orderRef, {
      status: 'completed',
      paymentStatus: 'paid',
      completedAt: Date.now()
    });

    const orderData = window.allOrders[orderId];
    if (orderData && orderData.tableId) {
      const tableRef = ref(db, `restaurants/${restaurantId}/tables/${orderData.tableId}`);
      await update(tableRef, { status: 'empty' });
    }

    if (typeof showToast === "function") {
      showToast(t("order_completed", "Buyurtma muvaffaqiyatli yakunlandi!"), "success");
    }

  } catch (error) {
    console.error(t("payment_confirm_error_log", "To'lovni tasdiqlashda xatolik:"), error);
    alert(t("error_generic", "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring."));
  }
};

window.setOrderCookingTime = window.processChefAction;

// ============================================
// ⏱ OSHPAZ: VAQT KIRITIB TAYYOR DEYISH
// ============================================
window.markOrderReady = async function (orderId) {
  // Eski modal bo'lsa o'chiramiz
  const existingModal = document.getElementById("chefReadyTimeModal");
  if (existingModal) existingModal.remove();

  // Modal yaratamiz
  const modal = document.createElement("div");
  modal.id = "chefReadyTimeModal";
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999;
    display:flex; align-items:center; justify-content:center; padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#fff; border-radius:16px; padding:28px 24px; width:100%; max-width:360px;
                box-shadow:0 8px 32px rgba(0,0,0,0.18); text-align:center;">
      <div style="font-size:32px; margin-bottom:8px;">⏱</div>
      <h3 style="margin:0 0 6px; font-size:17px; color:#1e293b;">${t("ready_time_title", "Tayyorlanish vaqti")}</h3>
      <p style="margin:0 0 18px; font-size:13px; color:#64748b;">${t("ready_time_desc", "Ovqat necha daqiqada tayyor bo'ladi?")}</p>
      <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:20px;">
        <button onclick="
          var i=document.getElementById('chefReadyMinInput');
          var v=Math.max(1,parseInt(i.value||5)-1); i.value=v;
        " style="width:40px;height:40px;border-radius:50%;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:20px;cursor:pointer;font-weight:700;color:#475569;">−</button>
        <input id="chefReadyMinInput" type="number" value="15" min="1" max="120"
          style="width:80px;height:48px;text-align:center;font-size:22px;font-weight:800;
                 border:2px solid #3b82f6;border-radius:12px;color:#1e293b;outline:none;" />
        <button onclick="
          var i=document.getElementById('chefReadyMinInput');
          var v=Math.min(120,parseInt(i.value||5)+1); i.value=v;
        " style="width:40px;height:40px;border-radius:50%;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:20px;cursor:pointer;font-weight:700;color:#475569;">+</button>
        <span style="font-size:14px;color:#64748b;font-weight:600;">${t("minute_short", "daq")}</span>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('chefReadyTimeModal').remove()"
          style="flex:1;padding:12px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;
                 color:#64748b;font-weight:700;font-size:14px;cursor:pointer;">
          ${t("cancel_btn", "Bekor")}
        </button>
        <button id="chefReadyConfirmBtn"
          style="flex:2;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#16a34a,#22c55e);
                 color:#fff;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          ✅ ${t("confirm_ready", "Tasdiqlash")}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Confirm tugmasi
  document.getElementById("chefReadyConfirmBtn").onclick = async () => {
    const minutes = parseInt(document.getElementById("chefReadyMinInput")?.value || 15);
    if (isNaN(minutes) || minutes < 1) {
      alert(t("enter_valid_time", "To'g'ri vaqt kiriting!"));
      return;
    }

    modal.remove();

    const expectedReadyAt = Date.now() + minutes * 60 * 1000;

    await updateOrderKitchenStatus(
      orderId,
      "ready",
      {
        statusKey: "ready",
        statusLabel: t("status_ready", "Tayyor"),
        readyAt: expectedReadyAt,
        expectedReadyAt,
        prepMinutes: minutes,
        isNotified: false,
        notified: false
      }
    );

    if (typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    if (typeof showToast === "function") {
      showToast(`✅ ${t("order_ready", "Taom tayyor!")} ⏱ ${minutes} ${t("minute_short", "daq")}`, "success");
    }
  };

  // Modal tashqarisiga bosish — yopish
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
};

/* =========================
   ORDER STATUS ACTIONS
========================= */
async function createKitchenTimelineEvent(orderId, eventType, payload = {}) {
  if (!orderId || !eventType) return null;

  const actorName = window.allChefs?.[currentChefId]?.name || localStorage.getItem("name") || t("chef_label", "Chef");
  const actorRole = "chef";

  const eventRef = push(ref(db, `${BASE_PATH}/orderTimeline/${orderId}`));

  await set(eventRef, {
    orderId,
    eventType,
    payload,
    actorId: currentChefId,
    actorName,
    actorRole,
    createdAt: Date.now()
  });

  await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
    lastTimelineEventAt: Date.now(),
    lastTimelineEventType: eventType
  });

  return eventRef.key;
}

async function kitchenAudit(action, payload = {}, severity = "info") {
  const actorName = window.allChefs?.[currentChefId]?.name || localStorage.getItem("name") || t("chef_label", "Chef");
  await push(ref(db, BASE_PATH + "/activityLogs"), {
    userId: currentChefId, userName: actorName, userRole: "chef", module: "kitchen",
    action, target: String(payload.orderId || payload.productId || payload.itemId || ""),
    severity, description: action, payload, createdAt: Date.now()
  });
}

async function updateOrderKitchenStatus(
  orderId,
  nextStatus,
  extra = {}
) {

  await ensureChefAccess("kitchen_manage");

  const orderRef =
    ref(db, `${BASE_PATH}/orders/${orderId}`);

  const snap = await get(orderRef);

  if (!snap.exists()) return;

  const order = snap.val();

  const normalized =
    normalizeKitchenStatus(nextStatus);

  const now = Date.now();

  const current =
    getOrderStatus(order);

  const statusLabels = {

    new: t("status_new", "Yangi"),

    approved: t("status_approved", "Tasdiqlandi"),

    cooking: t("status_cooking", "Tayyorlanmoqda"),

    ready: t("status_ready", "Tayyor"),

    delivering: t("status_on_way", "Yetkazilmoqda"),

    closed: t("status_closed", "Yopildi"),

    cancelled: t("status_cancelled", "Bekor qilindi")

  };

  const patches = {

    status: normalized,

    statusKey: normalized,

    statusLabel:
      statusLabels[normalized] || normalized,

    updatedAt: now,

    updatedBy: currentChefId,

    ...extra

  };

  if (
    !order.chefId &&
    ["approved", "cooking", "ready"]
      .includes(normalized)
  ) {

    patches.chefId = currentChefId;

    patches.assignedAt = now;

  }

  if (
    normalized === "approved" &&
    !order.takenAt
  ) {

    patches.takenAt = now;

  }

  if (
    normalized === "cooking" &&
    !order.startedAt
  ) {

    patches.startedAt = now;

  }

  if (normalized === "ready") {

    patches.finishedAt = now;

  }

  if (
    normalized === "cooking" &&
    current === "ready"
  ) {

    patches.finishedAt = null;

  }

  if (normalized === "closed") {

    patches.closedAt = now;

  }

  await update(orderRef, patches);

  if (order?.table) {

    await writeTableState(order.table, {

      status:
        normalized === "ready"
          ? "ready"
          : normalized === "closed"
            ? "free"
            : "open",

      orderId:
        normalized === "closed"
          ? null
          : orderId,

      chefId:
        patches.chefId ||
        order.chefId ||
        currentChefId,

      kitchenStatus: normalized

    });

  }

  await createKitchenTimelineEvent(
    orderId,
    "order_status_changed",
    {
      from: current,
      to: normalized,
      assignedBy:
        extra.assignedBy || null,
      assignedAt:
        patches.assignedAt || null
    }
  );

  await kitchenAudit(
    "order_status_changed",
    {
      orderId,
      from: current,
      to: normalized,
      table: order.table || null
    }
  );

  if (
    normalized === "ready" &&
    order?.table
  ) {

    await push(
      ref(db, BASE_PATH + "/waiterCalls"),
      {
        table: order.table,
        orderId,

        message:
          `🪑 ${t("table_label")} ` +
          `${order.table}: ` +
          `${t("status_ready")}`,

        createdAt: now,

        status: "waiting",

        chefId: currentChefId,

        chefName:
          window.allChefs?.[currentChefId]
            ?.name || currentChefId
      }
    );

  }

  showChefNotification(
    `✅ ${t("status_label", "Status")
    }: ${statusLabels[normalized]
    }`
  );

}

window.updateChefOrderStatus = window.processChefAction;
window.changeOrderStatus = window.processChefAction;

window.acceptOrder = async function (orderId) {
  try {
    if (typeof updateOrderKitchenStatus === "function") {
      await updateOrderKitchenStatus(
        orderId,
        "approved",
        {
          statusKey: "approved",
          statusLabel: t("status_approved", "Tasdiqlandi"),
          approvedAt: Date.now()
        }
      );
    }

    if (typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    if (typeof showToast === "function") {
      showToast(t("order_accepted", "Buyurtma tasdiqlandi"), "success");
    }

  } catch (error) {
    console.error("Buyurtmani tasdiqlashda xato:", error);
    if (typeof showToast === "function") {
      showToast(t("error_generic", "Xatolik yuz berdi"), "error");
    }
  }
};

window.startCooking = async function (orderId) {
  const timeInput = document.getElementById(`time-input-${orderId}`);
  const inputVal  = parseInt(timeInput?.value);

  if (!inputVal || inputVal <= 0) {
    if (typeof showToast === "function")
      showToast(t("enter_ready_minutes","Iltimos, tayyor bo'lish vaqtini daqiqada kiriting!"), "warning");
    if (timeInput) {
      timeInput.focus();
      timeInput.style.border = "2px solid #ef4444";
      setTimeout(() => { if (timeInput) timeInput.style.border = ""; }, 1500);
    }
    return;
  }

  const minutes  = inputVal;
  const now      = Date.now();
  const readyAt  = now + (minutes * 60000);
  const restId   = localStorage.getItem("restaurantId") || currentRestaurantId;
  const orderRef = ref(db, `restaurants/${restId}/orders/${orderId}`);

  // Tugmani vaqtincha bloklash (ikki marta bosishdan saqlash)
  const startBtn = document.querySelector(`[onclick="window.startCooking('${orderId}')"]`);
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = "0.6";
    startBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ...`;
  }

  try {
    await update(orderRef, {
      status:           "cooking",
      statusKey:        "cooking",
      statusLabel:      t("status_cooking", "Tayyorlanmoqda"),
      readyAt:          readyAt,
      expectedReadyAt:  readyAt,
      prepMinutes:      minutes,
      cookingStartedAt: now,
      chefTimerSetAt:   now,
      updatedAt:        now
    });

    if (typeof showToast === "function")
      showToast(
        `⏱ ${minutes} ${t("minute_short","daqiqa")} — ${t("timer_started","taymer ishga tushdi")}`,
        "success"
      );

    if (typeof window.deductOrderInventory === "function")
      await window.deductOrderInventory(orderId);

  } catch (err) {
    console.error("Start cooking error:", err);
    if (typeof showToast === "function") showToast(t("error_generic","Xatolik"), "error");
    // Xato bo'lsa tugmani qayta yoqamiz
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = "";
      startBtn.innerHTML = `<i class="fa-solid fa-play"></i> ${t("start_cooking_btn","BOSHLASH")}`;
    }
  }
};

window.markAsReady = window.markOrderReady;

// ─── Cooking vaqtini yangilash (oshpaz qo'lda o'zgartirsa) ───────────────────
window.updateCookingTimer = async function (orderId) {
  const input = document.getElementById(`new-time-${orderId}`);
  const inputVal = parseInt(input?.value);
  if (!inputVal || inputVal <= 0) {
    if (typeof showToast === "function") showToast(t("enter_ready_minutes","Daqiqa kiriting!"), "warning");
    if (input) input.focus();
    return;
  }
  const readyAt = Date.now() + (inputVal * 60000);
  const restId  = localStorage.getItem("restaurantId") || currentRestaurantId;
  try {
    await update(ref(db, `restaurants/${restId}/orders/${orderId}`), {
      readyAt,
      expectedReadyAt: readyAt,
      prepMinutes: inputVal,
      updatedAt:   Date.now()
    });
    if (typeof showToast === "function") showToast(`⏱ ${inputVal} ${t("minute_short","daqiqa")} — ${t("timer_started","taymer yangilandi")}`, "success");
  } catch (err) {
    console.error("updateCookingTimer error:", err);
    if (typeof showToast === "function") showToast(t("error_generic","Xatolik"), "error");
  }
};

window.returnOrderToCooking =
  async function (orderId) {

    await updateOrderKitchenStatus(
      orderId,
      "cooking",
      {
        statusKey: "cooking",
        statusLabel: t("status_return_cooking", "Qayta tayyorlanmoqda"),
        returnedToCookingAt: Date.now()
      }
    );

  };

window.reopenReadyOrder =
  async function (orderId) {

    await updateOrderKitchenStatus(
      orderId,
      "cooking",
      {
        statusKey: "cooking",
        statusLabel: t("status_reopened", "Qayta ochildi"),
        reopenedAt: Date.now()
      }
    );

  };

window.takeOrder = async function (orderId) {
  const snap = await get(ref(db, BASE_PATH + "/orders/" + orderId));
  if (!snap.exists()) return;
  const order = snap.val();
  if (order.chefId) { alert(t("order_already_taken", "Ushbu buyurtma allaqachon boshqa oshpaz tomonidan olingan!")); return; }
  const now = Date.now();
  await update(ref(db, BASE_PATH + "/orders/" + orderId), {
    chefId: currentChefId, status: "approved", statusKey: "approved", statusLabel: "approved",
    takenAt: now, updatedAt: now, assignedAt: now
  });
  if (order.table) await writeTableState(order.table, { status: "open", orderId, chefId: currentChefId, kitchenStatus: "approved" });
  emitSocket("chef:new-order", { orderId, orderNumber: order.orderNumber || orderId, chefId: currentChefId, table: order.table || null });
  if (typeof window.deductOrderInventory === "function") {
    await window.deductOrderInventory(orderId);
  }
  showNotification(t("order_taken", "Buyurtma qabul qilindi"));
};

window.claimOrder = window.takeOrder;

window.sendChefInlineReply = async function (orderId) {
  const input = document.getElementById(`chefReplyInput_${orderId}`);
  const text = input?.value.trim();
  if (!text) return;
  const myChefId = String(currentChefId || "").trim();
  if (!myChefId) return;
  const orderSnap = await get(ref(db, BASE_PATH + "/orders/" + orderId));
  if (!orderSnap.exists()) return;
  const order = orderSnap.val();
  const orderChefId = String(order.chefId || "").trim();
  if (orderChefId !== myChefId) { alert(t("not_your_order", "Bu sizning buyurtmangiz emas!")); return; }
  const senderName = window.allChefs?.[myChefId]?.name || t("chef_label", "Oshpaz");
  const now = Date.now();
  await update(ref(db, `${BASE_PATH}/orderChats/${orderId}/chef/meta`), {
    orderId, orderNumber: order.orderNumber || null, table: order.table || null,
    clientId: order.clientId || null, targetId: myChefId, targetRole: "chef",
    chefName: senderName, lastMessage: text, lastSenderRole: "chef", updatedAt: now, status: "open"
  });
  await push(ref(db, `${BASE_PATH}/orderChats/${orderId}/chef/messages`), {
    text, senderId: myChefId, senderRole: "chef", senderName, orderId, table: order.table || null, createdAt: now
  });
  await update(ref(db, `${BASE_PATH}/orders/${orderId}`), { lastChefMessage: text, lastChefMessageAt: now });
  emitSocket("chef:chat-message", { orderId, text, senderId: myChefId, senderName, createdAt: now });
  input.value = "";
};

/* =========================
   ITEM-LEVEL ACTIONS
========================= */
function resolveOrderItemKey(order, itemId) {
  if (!order?.items) return "";
  if (order.items[itemId]) return itemId;
  const found = Object.entries(order.items).find(([key, item]) => String(item?.menuId || item?.id || item?.itemId || key) === String(itemId));
  return found?.[0] || "";
}

async function updateOrderItemStatus(orderId, itemId, patch = {}) {
  const snap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
  if (!snap.exists()) return "";
  const order = snap.val();
  const resolvedKey = resolveOrderItemKey(order, itemId);
  if (!resolvedKey) return "";
  await update(ref(db, `${BASE_PATH}/orders/${orderId}/items/${resolvedKey}`), { ...patch, updatedAt: Date.now(), updatedBy: currentChefId });
  return resolvedKey;
}

window.toggleItemPrepared = async function (orderId, itemId) {
  const snap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
  if (!snap.exists()) return;
  const order = snap.val();
  const resolvedKey = resolveOrderItemKey(order, itemId);
  if (!resolvedKey) return;
  const currentItem = order?.items?.[resolvedKey] || {};
  const nextState = getItemKitchenState(currentItem) === "prepared" ? "pending" : "prepared";
  await updateOrderItemStatus(orderId, resolvedKey, { kitchenStatus: nextState, preparedAt: nextState === "prepared" ? Date.now() : null });
  await createKitchenTimelineEvent(orderId, "item_toggled_prepared", { itemId: resolvedKey, kitchenStatus: nextState });
  await kitchenAudit("item_toggled_prepared", { orderId, itemId: resolvedKey, kitchenStatus: nextState });
  renderChefOrders();
};

window.markDelayedItem = async function (orderId, itemId) {
  await updateOrderItemStatus(orderId, itemId, { kitchenStatus: "delayed", delayedAt: Date.now() });
  await createKitchenTimelineEvent(orderId, "item_delayed", { itemId });
  await kitchenAudit("item_delayed", { orderId, itemId });
  renderChefOrders();
};

window.addKitchenNote = async function (orderId, itemId, note) {
  const finalNote = typeof note === "string" ? note : prompt(t("enter_kitchen_note", "Kitchen note kiriting:"));
  if (!finalNote) return;
  const resolvedKey = await updateOrderItemStatus(orderId, itemId, { kitchenNote: finalNote });
  await createKitchenTimelineEvent(orderId, "item_note_added", { itemId: resolvedKey || itemId, note: finalNote });
  await kitchenAudit("item_note_added", { orderId, itemId: resolvedKey || itemId, note: finalNote });
  renderChefOrders();
};

window.rejectOrderItem = async function (orderId, itemId, reason = "Rejected") {
  const finalReason = reason || prompt(t("enter_reject_reason", "Sabab kiriting:")) || t("default_rejected", "Rad etildi");
  const resolvedKey = await updateOrderItemStatus(orderId, itemId, { kitchenStatus: "rejected", rejectedReason: finalReason, rejectedAt: Date.now() });
  await createKitchenTimelineEvent(orderId, "item_rejected", { itemId: resolvedKey || itemId, reason: finalReason });
  await kitchenAudit("item_rejected", { orderId, itemId: resolvedKey || itemId, reason: finalReason });
  renderChefOrders();
};

window.markAllItemsPrepared = async function (orderId) {
  const snap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
  if (!snap.exists()) return;
  const order = snap.val();
  const ops = Object.keys(order?.items || {}).map(key => update(ref(db, `${BASE_PATH}/orders/${orderId}/items/${key}`), { kitchenStatus: "prepared", preparedAt: Date.now(), updatedAt: Date.now(), updatedBy: currentChefId }));
  await Promise.all(ops);
  await createKitchenTimelineEvent(orderId, "all_items_prepared", {});
  await kitchenAudit("all_items_prepared", { orderId });
  renderChefOrders();
};

/* =========================
   STOP-LIST
========================= */
function renderStopList() {
  const root = document.getElementById("stopListBoard");
  if (!root) return;
  const items = Object.entries(window.stopList || {}).filter(([_, item]) => item?.active !== false).sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0));
  root.innerHTML = `<div class="chef-widget-head">⛔ ${t("stop_list_title", "Stop-list")}</div><div class="chef-widget-body">${items.length ? items.map(([id, item]) => `<div class="stop-row"><div><b>${escapeHtml(item?.name || id)}</b><small>${formatDateTime(item?.updatedAt || item?.createdAt)}</small></div><button type="button" onclick="removeFromStopList('${escapeJsString(id)}')">♻️</button></div>`).join("") : `<div class="detail-empty">${t("stop_list_empty", "Stop-list bo'sh")}</div>`}</div>`;
}

async function loadStopList() {
  const snap = await get(ref(db, BASE_PATH + "/stopList"));
  window.stopList = snap.val() || {};
  renderStopList();
  return window.stopList;
}

window.addToStopList = async function (productId, productName) {
  await ensureChefAccess("kitchen_manage");

  const updates = {};
  updates[`${BASE_PATH}/stopList/${productId}`] = {
    productId, name: productName, active: true,
    updatedAt: Date.now(), updatedBy: currentChefId, source: "chef"
  };
  updates[`${BASE_PATH}/menu/${productId}/active`] = false;

  await update(ref(db), updates);
  await kitchenAudit("stop_list_added", { productId, name: productName }, "warning");
};

window.removeFromStopList = async function (productId) {
  const updates = {};
  updates[`${BASE_PATH}/stopList/${productId}`] = null;
  updates[`${BASE_PATH}/menu/${productId}/active`] = true;

  await update(ref(db), updates);
  await kitchenAudit("stop_list_removed", { productId }, "info");
};

window.toggleItemAvailability = async function (productId, active) {
  await update(ref(db, `${BASE_PATH}/menu/${productId}`), { active: !!active, updatedAt: Date.now(), updatedBy: currentChefId });
  if (active) await window.removeFromStopList(productId);
  else { const name = window.allMenu?.[productId]?.name?.[currentLang] || window.allMenu?.[productId]?.name || productId; await window.addToStopList(productId, name); }
};

/* =========================
   KITCHEN NOTIFICATIONS
========================= */
function buildKitchenNotifications() {
  const list = [];
  const entries = getChefVisibleOrders();
  entries.forEach(([orderId, order]) => {
    const remaining = getRemainingInfo(order);
    const isMine = String(getAssignedChefId(orderId, order)) === String(currentChefId);
    if (isMine && ["new", "approved"].includes(getOrderStatus(order))) list.push({ id: `new_${orderId}`, type: "new_order", createdAt: Number(order?.createdAt || Date.now()), text: `🆕 ${t("new_order", "Yangi order")} #${orderId}` });
    if (remaining.delayed) list.push({ id: `delay_${orderId}`, type: "delay", createdAt: Date.now(), text: `🚨 ${t("delayed_order_alert", "Kechikkan order")} #${orderId}` });
    if (order?.clientRequest) list.push({ id: `note_${orderId}`, type: "note", createdAt: Number(order?.updatedAt || order?.createdAt || Date.now()), text: `📝 ${t("note_exists", "Note mavjud:")} #${orderId}` });
    const stopHits = Object.values(order?.items || {}).filter(item => { const menuId = item?.menuId || item?.id || item?.itemId; return menuId && window.stopList?.[menuId]?.active !== false; });
    if (stopHits.length) list.push({ id: `stop_${orderId}`, type: "stoplist", createdAt: Date.now(), text: `⛔ ${t("stop_list_item_order", "Stop-list item order")} #${orderId}` });
  });
  Object.entries(window.stopList || {}).forEach(([productId, item]) => { if (item?.active !== false) list.push({ id: `stopitem_${productId}`, type: "stop_item", createdAt: Number(item?.updatedAt || item?.createdAt || Date.now()), text: `⛔ ${t("stop_list_title", "Stop-list")}: ${item?.name || productId}` }); });
  return list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 20);
}

function loadKitchenNotifications() {
  window.kitchenNotifications = buildKitchenNotifications();
  renderKitchenNotifications();
  return window.kitchenNotifications;
}

function renderKitchenNotifications() {
  const root = document.getElementById("kitchenNotificationsPanel");
  if (!root) return;
  const readIds = new Set(getKitchenReadNotifications());
  const items = window.kitchenNotifications || [];
  root.innerHTML = `<div class="chef-widget-head">🔔 ${t("kitchen_notifications", "Kitchen notifications")}</div><div class="chef-widget-body">${items.length ? items.map(item => `<div class="kitchen-note-row ${readIds.has(item.id) ? "is-read" : ""}"><div>${escapeHtml(item.text)}</div><div class="kitchen-note-actions"><small>${formatDateTime(item.createdAt)}</small><button type="button" onclick="markKitchenNotificationRead('${escapeJsString(item.id)}')">✓</button></div></div>`).join("") : `<div class="detail-empty">${t("no_notifications", "Notification yo'q")}</div>`}</div>`;
}

function getKitchenReadNotifications() {
  try { return JSON.parse(localStorage.getItem("kitchenReadNotifications") || "[]"); } catch (_) { return []; }
}
function setKitchenReadNotifications(ids) { localStorage.setItem("kitchenReadNotifications", JSON.stringify(ids || [])); }
window.markKitchenNotificationRead = function (id) { const ids = new Set(getKitchenReadNotifications()); ids.add(id); setKitchenReadNotifications([...ids]); renderKitchenNotifications(); };

/* =========================
   STATS
========================= */
function calculateAllStats() {
  const stats = {};
  const orders = window.allOrders || allOrders || {};
  if (!orders || !Object.keys(orders).length) return stats;

  Object.entries(orders).forEach(([id, order]) => {
    const chefId = order.chefId || "unassigned";
    if (!stats[chefId]) {
      stats[chefId] = { active: 0, ready: 0, totalWorkMinutes: 0, total: 0, fast: 0, normal: 0 };
    }

    const status = normalizeKitchenStatus(order.status);

    if (status === 'cooking' || status === 'preparing' || status === 'approved') {
      stats[chefId].active++;
    }

    const isToday = new Date(order.createdAt).toLocaleDateString() === new Date().toLocaleDateString();
    if (status === 'ready' && isToday) {
      stats[chefId].ready++;
    }

    if (order.acceptedAt && order.readyAt) {
      const diff = Math.round((order.readyAt - order.acceptedAt) / 60000);
      if (diff > 0) stats[chefId].totalWorkMinutes += diff;
    }

    if (isFastOrder(order)) stats[chefId].fast++;
    else stats[chefId].normal++;

    stats[chefId].total++;
  });
  return stats;
}

function updateStatistics() {
  const allStats = calculateAllStats();
  const myStats = allStats[currentChefId] || { active: 0, fast: 0, normal: 0, ready: 0, total: 0, totalWorkMinutes: 0 };
  if (myActiveCountEl) { myActiveCountEl.textContent = myStats.active; myActiveCountEl.style.display = myStats.active > 0 ? "inline-flex" : "none"; }
  const statMyActiveEl = document.getElementById("statMyActive"), statMyFastEl = document.getElementById("statMyFast"), statMyNormalEl = document.getElementById("statMyNormal"), statMyReadyEl = document.getElementById("statMyReady"), statMyWorkTimeEl = document.getElementById("statMyWorkTime"), statMyTotalEl = document.getElementById("statMyTotal");
  if (statMyActiveEl) statMyActiveEl.textContent = myStats.active;
  if (statMyFastEl) statMyFastEl.textContent = myStats.fast;
  if (statMyNormalEl) statMyNormalEl.textContent = myStats.normal;
  if (statMyReadyEl) statMyReadyEl.textContent = myStats.ready;
  if (statMyWorkTimeEl) statMyWorkTimeEl.textContent = `${myStats.totalWorkMinutes} ${t("minute_short", "daq")}`;
  if (statMyTotalEl) statMyTotalEl.textContent = myStats.total;
  renderKitchenLoadSummary(allStats);
  renderAllChefsStats(allStats);
}

function renderKitchenLoadSummary(allStats) {
  const rows = Object.entries(allStats).sort((a, b) => b[1].active - a[1].active).map(([chefId, stat]) => { const chef = window.allChefs?.[chefId]; if (!chef) return ""; const me = chefId === currentChefId ? " me" : ""; return `<div class="chef-load-row${me}"><div class="chef-load-name">${chef.name || chefId}</div><div class="chef-load-meta">${stat.active} ${t("active_now", "faol")}</div><div class="chef-load-bar"><span style="width:${stat.loadPercent}%"></span></div></div>`; }).join("");
}

function renderAllChefsStats(allStats) {
  if (!allChefsStatsEl) return;
  const sortedChefs = Object.entries(allStats).sort((a, b) => { if (b[1].active !== a[1].active) return b[1].active - a[1].active; if (b[1].ready !== a[1].ready) return b[1].ready - a[1].ready; return b[1].totalWorkMinutes - a[1].totalWorkMinutes; });
  allChefsStatsEl.innerHTML = `<h4>${t("all_chefs_title", "Barcha oshpazlar")}</h4><div class="stats-legend"><div class="legend-item">${t("stats_active_short", "Faol")}</div><div class="legend-item">${t("stats_fast_short", "Tez")}</div><div class="legend-item">${t("stats_normal_short", "Oddiy")}</div><div class="legend-item">${t("stats_ready_short", "Tayyor")}</div><div class="legend-item">${t("stats_time_short", "Vaqt")}</div></div>${sortedChefs.map(([chefId, stats]) => { const chef = window.allChefs?.[chefId]; if (!chef) return ""; const isMe = chefId === currentChefId; const isActive = chef.active !== false; return `<div class="chef-stat-row ${isMe ? "my-row" : ""} ${!isActive ? "inactive" : ""}"><div class="chef-stat-name">${isMe ? "👨‍🍳" : "🧑‍🍳"} ${chef.name || chefId}${isMe ? `<span class="me-badge">${t("me_badge", "Men")}</span>` : ""}${!isActive ? `<span class="inactive-badge">${t("inactive_badge", "Faolsiz")}</span>` : ""}</div><div class="chef-stat-numbers"><span class="stat-badge active-badge">🔥 ${stats.active}</span><span class="stat-badge fast-badge">⚡ ${stats.fast}</span><span class="stat-badge normal-badge">🟢 ${stats.normal}</span><span class="stat-badge completed-badge">✅ ${stats.ready}</span><span class="stat-badge time-badge">⏱ ${stats.totalWorkMinutes} ${t("minute_short", "daq")}</span></div></div>`; }).join("")}`;
}

function updateNewOrdersBadge() {
  if (!newOrdersBadge) return;
  const selectedChef = getSelectedChef();
  const myId = String(currentChefId);
  const count = Object.entries(allOrders || {}).filter(([orderId, order]) => { if (!order) return false; const status = getOrderStatus(order); const orderChefId = String(getAssignedChefId(orderId, order) || ""); const pendingStatuses = ["new", "approved", "cooking"]; if (!pendingStatuses.includes(normalizeKitchenStatus(status))) return false; if (selectedChef !== "all") return orderChefId === String(selectedChef); return orderChefId === myId; }).length;
  newOrdersBadge.textContent = count;
  newOrdersBadge.style.display = count > 0 ? "inline-flex" : "none";
}

/* =========================
   TABLE STATUS
========================= */
function deriveTableStatusFromOrders(tableNumber) {
  const orders = Object.values(allOrders || {}).filter(order => String(order.table || "") === String(tableNumber));
  if (!orders.length) return "free";
  if (orders.some(order => getOrderStatus(order) === "ready")) return "ready";
  if (orders.some(order => ["new", "approved", "cooking"].includes(getOrderStatus(order)))) return "busy";
  return "free";
}

function getTableStatusLabel(status) { if (status === "ready") return t("table_ready_pickup", "Olib ketishga tayyor"); if (status === "busy") return t("table_busy", "Band"); return t("table_free", "Bo'sh"); }

window.confirmOrderTime = async function (orderId) {
  const input = document.getElementById(`time-input-${orderId}`);
  if (!input) return;

  const minutes = parseInt(input.value);

  if (!minutes || minutes <= 0) {
    alert(t("enter_prep_time", "Iltimos, tayyor bo'lish vaqtini kiriting!"));
    return;
  }

  const readyAt = Date.now() + (minutes * 60000);

  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) throw new Error(t("restaurant_id_missing", "Restaurant ID topilmadi"));

    const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);
    await update(orderRef, {
      readyAt: readyAt,
      status: "cooking",
      statusKey: "cooking"
    });

    if (typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    if (typeof showToast === "function") showToast(t("time_set_success", "Vaqt belgilandi"), "success");
  } catch (error) {
    console.error(t("time_save_error_log", "Vaqtni saqlashda xato:"), error);
    alert(t("error_generic", "Xatolik yuz berdi!"));
  }
};

window.saveChefTime = async function (orderId) {
  const input = document.getElementById(`time-input-${orderId}`);
  const minutes = parseInt(input.value);
  if (!minutes || minutes <= 0) return;

  const readyAt = Date.now() + (minutes * 60000);

  try {
    const restaurantId = localStorage.getItem("restaurantId");
    await update(ref(db, `restaurants/${restaurantId}/orders/${orderId}`), { readyAt });
    if (typeof showToast === "function") showToast(t("time_set_success", "Vaqt belgilandi"), "success");
  } catch (e) {
    console.error(t("time_save_error_log", "Vaqtni saqlashda xato:"), e);
  }
};

window.setOrderReadyTime = async function (orderId, minutes) {
  const restaurantId = new URLSearchParams(window.location.search).get('rest') || localStorage.getItem("restaurantId");
  const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);

  const now = Date.now();
  const readyAtTimestamp = now + (minutes * 60 * 1000);

  await update(orderRef, {
    status: "cooking",
    statusKey: "cooking",
    prepMinutes: minutes,
    readyAt: readyAtTimestamp,
    updatedAt: now,
    isNotified: false
  });

  if (typeof window.deductOrderInventory === "function") {
    await window.deductOrderInventory(orderId);
  }

  if (typeof showToast === "function") showToast(t("order_started", "Buyurtma boshlandi"), "success");
};

async function writeTableState(tableNo, patch = {}) {
  if (!tableNo) return;
  const tableRef = ref(db, `${BASE_PATH}/tables/${tableNo}`);
  const currentSnap = await get(tableRef);
  const current = currentSnap.exists() ? currentSnap.val() : {};

  await update(tableRef, {
    ...patch,
    updatedAt: Date.now(),
    busy: !["free", "cleaning"].includes(String(patch.status || current.status || "").toLowerCase())
  });
}

/* =========================
   CHEF CHAT
========================= */
function getChefChatRoomList() { return [{ id: PERSONAL_CHEF_ROOM, targetId: currentChefId, name: t("messages_to_me", "Menga kelgan xabarlar") }]; }
function getChefChatMessages(roomId) {
  if (roomId !== PERSONAL_CHEF_ROOM) return [];
  return (window.chefChats?.[roomId]?.messages || []).filter(msg => { const msgTargetId = String(msg?.targetId || window.chefChats?.[roomId]?.meta?.targetId || currentChefId); const msgSenderId = String(msg?.senderId || ""); return msgTargetId === String(currentChefId) || msgSenderId === String(currentChefId); });
}

function renderChefChatRooms() {
  if (!chefChatRoomsDom) return;
  const rooms = getChefChatRoomList();
  chefChatRoomsDom.innerHTML = rooms.map(room => { const unread = (window.chefChats?.[room.id]?.messages || []).filter(msg => msg.senderId !== currentChefId).length; return `<button type="button" class="chef-room-item ${room.id === currentChefChatRoom ? "active" : ""}" data-room-id="${room.id}"><span>${escapeHtml(room.name)}</span>${unread ? `<span class="chef-room-count">${unread}</span>` : ""}</button>`; }).join("");
  chefChatRoomsDom.querySelectorAll(".chef-room-item").forEach(btn => { btn.addEventListener("click", () => { currentChefChatRoom = btn.dataset.roomId || "kitchen"; localStorage.setItem("chefChatRoom", currentChefChatRoom); renderChefChatRooms(); renderChefChatMessages(); }); });
}

function renderChefChatMessages() {
  if (!chefChatMessagesDom || !chefChatTitleDom) return;

  const rooms = getChefChatRoomList();
  const room = rooms.find(item => item.id === currentChefChatRoom) || rooms[0];
  const messages = getChefChatMessages(currentChefChatRoom);

  chefChatTitleDom.textContent = room?.name || t("chef_chat_title", "Oshpaz Chat");

  chefChatMessagesDom.innerHTML = messages.length
    ? messages.slice(-50).map(msg => `
        <div class="chef-chat-message ${msg.senderId === currentChefId ? "me" : "other"}">
          <div class="chef-chat-text">${escapeHtml(msg.text || "")}</div>
          <div class="chef-chat-meta">${escapeHtml(msg.senderName || "")} • ${formatOrderTime(msg.createdAt)}</div>
        </div>`).join("")
    : `<div class="chef-chat-empty">${t("no_chef_messages", "Xabarlar yo'q")}</div>`;

  setTimeout(() => {
    chefChatMessagesDom.scrollTop = chefChatMessagesDom.scrollHeight;
  }, 100);
}

window.sendChefChatMessage = async function () {
  const text = chefChatInputDom?.value.trim();
  if (!text) return;
  const senderName = window.allChefs?.[currentChefId]?.name || localStorage.getItem("name") || t("chef_label");
  const now = Date.now();
  const roomId = PERSONAL_CHEF_ROOM;
  const chefChatPath = `restaurants/${currentRestaurantId}/chats/admin_chef_${currentChefId}`;
  await update(ref(db, `${chefChatPath}/meta`), { roomId, targetId: currentChefId, updatedAt: now });
  await push(ref(db, `${chefChatPath}/messages`), { text, senderId: currentChefId, senderRole: "chef", senderName, targetId: currentChefId, createdAt: now });
  emitSocket("chef:chat-message", { roomId, text, senderId: currentChefId, senderName, targetId: currentChefId, createdAt: now });
  if (chefChatInputDom) chefChatInputDom.value = "";
};

/* =========================
   SIDEBAR MENU
========================= */
function renderPrepMenuSidebar() {
  const box = document.getElementById("prepMenuList");
  if (!box) return;
  const items = Object.entries(window.allMenu || {}).filter(([_, item]) => item && item.active !== false).sort((a, b) => getMenuName(a[1], "").localeCompare(getMenuName(b[1], ""), getLocale()));
  box.innerHTML = items.map(([id, item]) => { const name = getMenuName(item, "—"); const img = item.imgUrl || item.img || "img/no-image.png"; const prepTime = Number(item.prepTime || 30); return `<div class="prep-item"><img src="${img}" onerror="this.src='img/no-image.png'"><div class="prep-info"><b>${escapeHtml(name)}</b><div><input type="number" min="1" class="prep-input" id="prep_${id}" value="${prepTime}"><span>${t("minute_short", "daq")}</span></div><button class="prep-save" onclick="savePrepTime('${id}')">💾 ${t("prep_save_btn", "Saqlash")}</button></div></div>`; }).join("");
}

window.savePrepTime = async function (menuId) {
  const input = document.getElementById("prep_" + menuId);
  if (!input) return;
  const prepTime = Number(input.value);
  if (!prepTime || prepTime < 1) { alert(t("prep_time_invalid", "Tayyorlash vaqti noto'g'ri!")); return; }

  await update(ref(db, `${BASE_PATH}/menu/${menuId}`), { prepTime });
  showNotification(`✅ ${t("prep_time_saved", "Vaqt saqlandi")}: ${prepTime} ${t("minute_short", "daq")}`);
};

/* =========================
   TV / FULLSCREEN / COUNTDOWNS
========================= */
// ── TV MODE (kengaytirilgan) ──────────────────────────────────────────────────
function injectChefTVStyles() {
  if (document.getElementById("chefTVModeStyles")) return;
  const s = document.createElement("style");
  s.id = "chefTVModeStyles";
  s.textContent = `
    /* ===== CHEF TV MODE ===== */
    body.tv-mode .chef-extra-filters,
    body.tv-mode .chef-chat-panel,
    body.tv-mode #statsPanel,
    body.tv-mode #prepMenuList,
    body.tv-mode #kitchenNotificationsPanel,
    body.tv-mode #kitchenAuditList,
    body.tv-mode #stopListBoard,
    body.tv-mode #chefsTodayStats,
    body.tv-mode #langSelect,
    body.tv-mode .lang-selector { display: none !important; }

    body.tv-mode #chefOrders,
    body.tv-mode #readyOrders {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) !important;
      gap: 18px !important;
    }
    body.tv-mode .order-card {
      font-size: 16px !important;
      padding: 18px !important;
      border-radius: 16px !important;
    }
    body.tv-mode .order-card h3,
    body.tv-mode .order-card-header { font-size: 18px !important; font-weight: 800 !important; }
    body.tv-mode .order-card li { font-size: 14px !important; padding: 5px 0 !important; }
    body.tv-mode .chef-item-row h4 { font-size: 15px !important; }
    body.tv-mode #tvModeBtn { background: linear-gradient(135deg,#ef4444,#dc2626) !important; }
  `;
  document.head.appendChild(s);
}

function applyChefTVMode(isTV) {
  const hideSelectors = [
    ".chef-extra-filters", ".chef-chat-panel", "#statsPanel",
    "#prepMenuList", "#kitchenNotificationsPanel", "#kitchenAuditList",
    "#stopListBoard", "#chefsTodayStats", "#langSelect", ".lang-selector"
  ];
  hideSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => { el.style.display = isTV ? "none" : ""; });
  });
  ["chefOrders", "readyOrders"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.gridTemplateColumns = isTV ? "repeat(auto-fill, minmax(340px, 1fr))" : "";
    el.style.gap = isTV ? "18px" : "";
  });
}

function updateChefTVButton() {
  const isTV = document.body.classList.contains("tv-mode");
  const btn = document.getElementById("tvModeBtn");
  if (!btn) return;
  btn.innerHTML = isTV
    ? `📺 ${t("tv_mode_off","TV O'chirish")}`
    : `📺 ${t("tv_mode","TV Rejimi")}`;
  btn.style.background = isTV
    ? "linear-gradient(135deg,#ef4444,#dc2626)"
    : "linear-gradient(135deg,#6366f1,#4f46e5)";
}

window.toggleTVMode = function () {
  const isTV = document.body.classList.toggle("tv-mode");
  localStorage.setItem("tvMode", isTV ? "1" : "0");
  applyChefTVMode(isTV);
  if (isTV && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  updateChefTVButton();
};

// ── FULLSCREEN ────────────────────────────────────────────────────────────────
window.toggleChefFullscreen = async function () {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen xato:", err.message);
  }
  setTimeout(updateChefFullscreenButton, 150);
};
window.toggleFullscreen = window.toggleChefFullscreen;
window.toggleStatsPanel = function () { if (!statsPanelEl) return; const isVisible = statsPanelEl.style.display === "block"; statsPanelEl.style.display = isVisible ? "none" : "block"; if (!isVisible) updateStatistics(); };
function updateChefFullscreenButton() { const btn = document.querySelector('.header-actions button[onclick*="toggleFullscreen"], .header-actions button[onclick*="toggleChefFullscreen"]'); if (btn) btn.textContent = document.fullscreenElement ? `⤢ ${t("fullscreen_btn", "To'liq ekran")}` : t("fullscreen_btn", "To'liq ekran"); }
function updateOrderCountdowns() {
  document.querySelectorAll(".order-card[data-ready-at]").forEach(card => {
    const readyAt = Number(card.dataset.readyAt || 0);
    const orderId = card.dataset.orderId || "";
    const timerEl = card.querySelector(".chef-order-timer div");
    const urgentEl = card.querySelector(".order-urgency-line");
    if (!readyAt || !timerEl) return;
    const diff = readyAt - Date.now();
    const delayedMinutes = diff < 0 ? Math.floor(Math.abs(diff) / 60000) : 0;
    const urgent = diff > 0 && diff <= 5 * 60 * 1000;
    const delayed = delayedMinutes >= 20;
    timerEl.textContent = formatRemainingTime(readyAt);
    card.classList.toggle("order-urgent", urgent);
    card.classList.toggle("order-delayed", delayed);
    card.classList.toggle("time-done", diff <= 0);
    if (urgentEl) {
      if (delayed) urgentEl.innerHTML = `🚨 ${t("delayed_order", "Kechikkan")} • ${delayedMinutes} ${t("minute_short", "daq")}`;
      else if (urgent) urgentEl.innerHTML = `🚨 ${t("urgent_order", "Tezkor")}`;
      else if (diff <= 0) urgentEl.innerHTML = `✅ ${t("ready_time_reached", "Vaqt tugadi")}`;
      else urgentEl.innerHTML = "";
    }
    if (delayed && orderId && !window.delayedAlertedOrders.has(orderId)) { window.delayedAlertedOrders.add(orderId); showNotification(`🚨 ${t("delayed_alert", "Kechikdi")} • #${orderId}`); }
  });

  // chef-card-countdown elementlarini yangilash
  document.querySelectorAll(".chef-card-countdown[data-ready-at]").forEach(el => {
    const readyAt = Number(el.dataset.readyAt || 0);
    if (!readyAt) return;
    const diff     = readyAt - Date.now();
    const diffMins = Math.floor(Math.abs(diff) / 60000);
    const diffSecs = Math.floor((Math.abs(diff) % 60000) / 1000);

    if (diff <= 0) {
      const overMin = Math.floor(Math.abs(diff) / 60000);
      el.textContent = `⚠️ ${t("overdue_label","Kechikdi")} ${overMin} ${t("minute_short","daq")}`;
      el.style.color = '#ef4444';
      el.classList.remove('shake-anim');
    } else if (diff <= 60000) {
      el.textContent = `⏱ 0:${String(Math.floor(diff/1000)).padStart(2,'0')} ${t("left_short","qoldi")}`;
      el.style.color = '#ef4444';
      el.classList.add('shake-anim');
    } else if (diff <= 3 * 60000) {
      el.textContent = `⏱ ${diffMins}:${String(diffSecs).padStart(2,'0')} ${t("left_short","qoldi")}`;
      el.style.color = '#ef4444';
      el.classList.remove('shake-anim');
    } else {
      el.textContent = `⏱ ${diffMins}:${String(diffSecs).padStart(2,'0')} ${t("left_short","qoldi")}`;
      el.style.color = '#f59e0b';
      el.classList.remove('shake-anim');
    }
  });
}
function startOrderCountdowns() { if (orderCountdownInterval) return; orderCountdownInterval = setInterval(updateOrderCountdowns, 1000); updateOrderCountdowns(); }

/* =========================
   REALTIME LISTENERS
========================= */
function listenUsers() {
  if (window.listeners?.users) window.listeners.users();
  window.listeners.users = onValue(ref(db, BASE_PATH + "/users"), snap => {
    const users = snap.val() || {};
    window.allChefs = {};
    Object.entries(users).forEach(([id, user]) => { if (user.role === "chef") window.allChefs[id] = user; });
    fillChefFilter(users);
    const me = users[currentChefId] || Object.values(users).find(u => String(u.id || "") === String(currentChefId));
    chefActive = me?.active !== false;
    renderChefChatRooms();
    renderChefChatMessages();
    refreshUI();
  });
}

function listenMenu() {
  if (window.listeners?.menu) window.listeners.menu();
  window.listeners.menu = onValue(ref(db, BASE_PATH + "/menu"), snap => { window.allMenu = snap.val() || {}; renderPrepMenuSidebar(); refreshUI(); });
}

// Ilgari ko'rilgan order IDlarini saqlaymiz — yangi orderlarni aniqlash uchun
let _chefKnownOrderIds = null;

function listenOrders() {
  if (window.listeners?.orders) {
    window.listeners.orders();
    window.listeners.orders = null;
  }

  const ordersRef = query(ref(db, BASE_PATH + "/orders"), orderByChild("createdAt"), limitToLast(500));

  window.listeners.orders = onValue(ordersRef, snap => {
    const incoming = snap.exists() ? (snap.val() || {}) : {};

    // Yangi buyurtmalarni aniqlaymiz
    if (_chefKnownOrderIds !== null) {
      const newIds = Object.keys(incoming).filter(id => !_chefKnownOrderIds.has(id));
      if (newIds.length > 0) {
        // Faqat "new" yoki "yangi" statusdagi orderlar uchun signal
        const reallyNew = newIds.filter(id => {
          const st = String(incoming[id]?.status || incoming[id]?.statusKey || "").toLowerCase();
          return ["new", "yangi", "pending", "queue", ""].includes(st);
        });
        if (reallyNew.length > 0) {
          playNewOrderSound();
          reallyNew.forEach(id => {
            const o = incoming[id];
            showNotification(
              `🆕 ${t("new_order_arrived", "Yangi buyurtma")} — ${t("table_label", "Stol")} ${o.table || "?"} | #${o.orderNumber || id.slice(-4)}`
            );
          });
        }
      }
    }
    // Birinchi yuklashda faqat ro'yxatni saqlaymiz (signal chiqarmaymiz)
    _chefKnownOrderIds = new Set(Object.keys(incoming));

    window.allOrders = incoming;
    allOrders = window.allOrders;

      if (typeof renderChefOrders === "function") {
        renderChefOrders();
      }

      if (typeof updateStatistics === "function") {
        updateStatistics();
      }

      updateKitchenRealtimeStats();
      updateNewOrdersBadge?.();
      loadKitchenNotifications?.();

      const hasQueueOrders = Object.values(window.allOrders || {}).some(o =>
        ["queue", "new", "yangi"].includes(normalizeText(o.status || o.statusKey)) && !o.chefId
      );
      if (hasQueueOrders && typeof assignNextFromQueue === "function") {
        assignNextFromQueue().catch(err => console.error(t("queue_error_log", "Queue error:"), err));
      }
  });
}

function listenOrderChats() {
  if (window.listeners?.orderChats) window.listeners.orderChats();
  window.listeners.orderChats = onValue(ref(db, BASE_PATH + "/orderChats"), snap => {
    const allChats = snap.val() || {};
    const nextChats = {};
    const myChefId = String(currentChefId || "").trim();
    const selectedChef = getSelectedChef();
    Object.entries(allChats).forEach(([orderId, rooms]) => {
      const chefRoom = rooms?.chef || {};
      const meta = chefRoom?.meta || {};
      const order = allOrders?.[orderId] || null;
      const assignedChefId = String(order?.chefId || meta.targetId || "").trim();
      if (!assignedChefId) return;
      if (selectedChef !== "all" && assignedChefId !== String(selectedChef).trim()) return;
      const messages = Object.entries(chefRoom?.messages || {}).map(([id, msg]) => ({ id, ...msg })).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
      nextChats[orderId] = { meta, messages };
    });
    window.orderChatsByOrder = nextChats;
    lastOrdersSignature = "";
    renderChefOrders();
  });
}

function listenChefChats() {
  if (window.listeners?.chefChats) window.listeners.chefChats();
  window.listeners.chefChats = onValue(ref(db, BASE_PATH + "/chats/admin_chef_" + currentChefId), snap => {
    const chatData = snap.val() || {};
    const messages = Object.entries(chatData?.messages || {})
      .map(([id, msg]) => ({ id, ...msg }))
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    window.chefChats = { [PERSONAL_CHEF_ROOM]: { meta: { ...(chatData?.meta || {}), targetId: currentChefId }, messages } };
    currentChefChatRoom = PERSONAL_CHEF_ROOM;
    localStorage.setItem("chefChatRoom", currentChefChatRoom);
    renderChefChatRooms();
    renderChefChatMessages();
  });
}

function listenTableStates() {
  if (window.listeners?.tables) window.listeners.tables();
  window.listeners.tables = onValue(ref(db, BASE_PATH + "/tables"), snap => { window.tableStates = snap.val() || {} });
}

function listenMyStatus() {
  if (!currentChefId) return;
  if (window.listeners?.myStatus) window.listeners.myStatus();

  window.listeners.myStatus = onValue(ref(db, BASE_PATH + "/users/" + currentChefId), snap => {
    const user = snap.val();
    chefActive = user ? user.active !== false : true;
  });
}

function listenOrderTimelines() {
  if (window.listeners?.timelines) window.listeners.timelines();
  window.listeners.timelines = onValue(ref(db, BASE_PATH + "/orderTimeline"), snap => { window.orderTimelines = snap.val() || {}; const modal = document.getElementById("chefDetailModal"); if (modal?.style.display === "flex") { const currentOrderId = document.getElementById("chefDetailContent")?.dataset?.orderId; if (currentOrderId && allOrders?.[currentOrderId]) renderChefOrderDetail(currentOrderId, allOrders[currentOrderId]); } });
}

function listenActivityLogs() {
  if (window.listeners?.logs) window.listeners.logs();
  window.listeners.logs = onValue(ref(db, BASE_PATH + "/activityLogs"), snap => {
    const rows = Object.entries(snap.val() || {}).map(([id, row]) => ({ id, ...row }));
    window.kitchenAuditLogs = rows.filter(row => String(row.module || "").toLowerCase() === "kitchen" || String(row.userRole || "").toLowerCase() === "chef");
    renderKitchenActionLog();
  });
}

function listenStopList() {
  if (window.listeners?.stopList) window.listeners.stopList();
  window.listeners.stopList = onValue(ref(db, BASE_PATH + "/stopList"), snap => {
    window.stopList = snap.val() || {};
    renderStopList();
    loadKitchenNotifications();
  });
}

function renderKitchenActionLog() {
  const root = document.getElementById("kitchenAuditList");
  if (!root) return;
  const logs = [...(window.kitchenAuditLogs || [])].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 30);
  root.innerHTML = `<div class="chef-widget-head">📜 ${t("kitchen_log", "Kitchen log")}</div><div class="chef-widget-body">${logs.length ? logs.map(log => `<div class="chef-chat-message other"><div class="chef-chat-text">${escapeHtml(log.action || "event")}${(log.payload?.orderId || log.target) ? ` • #${escapeHtml(log.payload?.orderId || log.target)}` : ""}</div><div class="chef-chat-meta">${escapeHtml(log.userName || log.actorName || "system")} • ${formatDateTime(log.createdAt)}</div></div>`).join("") : `<div class="chef-chat-empty">${t("no_kitchen_log", "Kitchen log yo'q")}</div>`}</div>`;
}

async function assignNextFromQueue() {
  if (!allOrders || !window.allChefs) return;
  const activeChefs = Object.entries(window.allChefs).filter(([_, chef]) => chef.active !== false);
  if (activeChefs.length === 0) return;

  const queueOrders = Object.entries(allOrders)
    .filter(([_, o]) => ["queue", "new", "yangi"].includes(normalizeText(o.status || o.statusKey)) && !o.chefId)
    .sort((a, b) => Number(a[1].queuedAt || a[1].createdAt || 0) - Number(b[1].queuedAt || b[1].createdAt || 0));

  if (queueOrders.length === 0) return;

  const [orderId] = queueOrders[0];
  const loads = activeChefs.map(([id]) => {
    const count = Object.values(allOrders).filter(o =>
      String(o.chefId) === String(id) &&
      ["new", "approved", "cooking"].includes(normalizeKitchenStatus(o.status))
    ).length;
    return { id, count };
  }).sort((a, b) => a.count - b.count);

  const selected = loads[0];

  await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
    chefId: selected.id,
    status: "new",
    statusKey: "new",
    assignedAt: Date.now(),
    updatedAt: Date.now()
  });
}

/* =========================
   SETTINGS
========================= */
const DEFAULT_CHEF_SETTINGS = { soundEnabled: true, autoPrint: false, compactMode: false, defaultFilter: "all", highlightLateOrders: true };
async function loadChefSettings() {
  const [globalSnap, localSnap] = await Promise.all([get(ref(db, "settings/kitchenDefaults")), get(ref(db, `chefSettings/${currentChefId}`))]);
  const globalDefaults = globalSnap.exists() ? globalSnap.val() : {};
  const localOverrides = localSnap.exists() ? localSnap.val() : {};
  window.chefSettings = { ...DEFAULT_CHEF_SETTINGS, ...globalDefaults, ...localOverrides };
  document.body.classList.toggle("compact-mode", !!window.chefSettings.compactMode);
  return window.chefSettings;
}

window.saveChefSettings = async function (patch = {}) {
  window.chefSettings = { ...DEFAULT_CHEF_SETTINGS, ...(window.chefSettings || {}), ...(patch || {}) };
  localStorage.setItem("chefSettings", JSON.stringify(window.chefSettings));
  await set(ref(db, `chefSettings/${currentChefId}`), window.chefSettings);
  document.body.classList.toggle("compact-mode", !!window.chefSettings.compactMode);
  renderKitchenStats();
  renderKitchenNotifications();
  showChefNotification(t("settings_saved", "⚙️ Settings saved"));
};

window.toggleKitchenSound = async () => window.saveChefSettings({ soundEnabled: !window.chefSettings?.soundEnabled });
window.toggleAutoPrint = async () => window.saveChefSettings({ autoPrint: !window.chefSettings?.autoPrint });
window.toggleCompactMode = async () => window.saveChefSettings({ compactMode: !window.chefSettings?.compactMode });
window.setDefaultKitchenFilter = async (value = "all") => { await window.saveChefSettings({ defaultFilter: value || "all" }); localStorage.setItem("chefStatusFilter", value || "all"); refreshUI(); };

/* =========================
   DETAIL MODAL (Tarjima ulangan)
========================= */
function renderChefOrderDetail(orderId, order) {
  const detail = document.getElementById("chefDetailContent");
  if (!detail || !order) return;
  detail.dataset.orderId = orderId;
  const status = normalizeKitchenStatus(getOrderStatus(order));
  const chefName = getAssignedChefName(orderId, order);
  const total = Object.values(order?.items || {}).reduce((sum, item) => { const menu = getOrderItemMenu(item) || {}; const price = Number(item?.price || menu?.price || 0); return sum + (price * Number(item?.qty || 1)); }, 0);

  detail.innerHTML = `
    <div class="chef-detail-grid">
      <div class="chef-detail-card">
        <h4>${t("basic_info", "Asosiy ma'lumot")}</h4>
        <div><b>${t("order", "Order ID")}:</b> #${escapeHtml(orderId)}</div>
        <div><b>${t("table", "Stol")}:</b> ${escapeHtml(order?.table || "-")}</div>
        <div><b>${t("order_status", "Status")}:</b> ${escapeHtml(t("status_" + status) || status)}</div>
        <div><b>${t("chef_label", "Chef")}:</b> ${escapeHtml(chefName)}</div>
        <div><b>${t("created_at", "Yaratildi")}:</b> ${formatDateTime(order?.createdAt)}</div>
        <div><b>${t("total_label", "Total")}:</b> ${formatMoney(total)}</div>
      </div>
      <div class="chef-detail-card">
        <h4>${t("special_request_label", "Special instructions")}</h4>
        ${renderOrderSpecialInstructions(order)}
      </div>
      <div class="chef-detail-card">
        <h4>${t("items_label", "Items")}</h4>
        ${renderOrderItemsDetailed(orderId, order)}
        <div class="chef-detail-actions">
          <button type="button" onclick="acceptOrder('${escapeJsString(orderId)}')">✅ ${t("approve", "Accept")}</button>
          <button type="button" onclick="startCooking('${escapeJsString(orderId)}')">🔥 ${t("status_cooking", "Start")}</button>
          <button type="button" onclick="markOrderReady('${escapeJsString(orderId)}')">🍽 ${t("status_ready", "Ready")}</button>
        </div>
      </div>
    </div>`;
}

function renderOrderSpecialInstructions(order) {
  const parts = [];
  if (order?.clientRequest) parts.push(`<div>📝 <b>${t("client_note", "Mijoz izohi:")}</b> ${escapeHtml(order.clientRequest)}</div>`);
  if (order?.allergyNote) parts.push(`<div>⚠️ <b>${t("allergy_note", "Allergiya:")}</b> ${escapeHtml(translateAllergyNote(order.allergyNote))}</div>`);
  if (order?.specialNote) parts.push(`<div>📌 <b>${t("special_note", "Special note:")}</b> ${escapeHtml(order.specialNote)}</div>`);
  if (order?.reservationNote) parts.push(`<div>📅 <b>${t("reservation_note", "Reservation note:")}</b> ${escapeHtml(order.reservationNote)}</div>`);
  return parts.length ? parts.join("") : `<div class="detail-empty">${t("no_extra_note", "Qo'shimcha izoh yo'q")}</div>`;
}

function renderOrderTimeline(orderId) {
  const rows = Object.entries(window.orderTimelines?.[orderId] || {}).map(([id, row]) => ({ id, ...row })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (!rows.length) return `<div class="detail-empty">${t("no_timeline", "Timeline yo'q")}</div>`;
  return rows.map(row => `<div class="timeline-row"><div><b>${escapeHtml(row?.eventType || "event")}</b></div><small>${formatDateTime(row?.createdAt)}</small><div>${escapeHtml(row?.actorName || "system")}</div></div>`).join("");
}

window.openChefOrderDetail = function (orderId) { ensureChefEnhancementLayout(); const modal = document.getElementById("chefDetailModal"); const order = allOrders?.[orderId]; if (!modal || !order) return; renderChefOrderDetail(orderId, order); modal.style.display = "flex"; };

window.closeChefOrderDetail = function () {
  const modal = document.getElementById("chefDetailModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
};

/* =========================
   STATS UI / REFRESH
========================= */
function calculateKitchenStats() {
  const orders = window.allOrders || allOrders || {};
  const entries = Object.entries(orders);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayStart = startOfDay.getTime();

  const stats = { total: entries.length, newOrders: 0, cooking: 0, ready: 0, delayed: 0, avgPrepMinutes: 0, completedToday: 0 };
  let completedCount = 0, totalCompletedMinutes = 0;

  entries.forEach(([_, order]) => {
    const status = getOrderStatus(order);
    const normalizedStatus = normalizeKitchenStatus(status);

    if (["new", "approved"].includes(normalizedStatus)) stats.newOrders += 1;
    if (normalizedStatus === "cooking") stats.cooking += 1;
    if (normalizedStatus === "ready") stats.ready += 1;
    if (getRemainingInfo(order).delayed) stats.delayed += 1;

    // Bugungi tugallangan buyurtmalar (ready yoki closed)
    const finishedAt = Number(order?.finishedAt || 0);
    const createdAt = Number(order?.createdAt || 0);
    const isToday = createdAt >= todayStart || finishedAt >= todayStart;
    if (isToday && ["ready", "closed"].includes(normalizedStatus)) {
      stats.completedToday += 1;
    }

    const duration = getOrderWaitDuration(order);
    if (duration > 0 && finishedAt > 0) {
      completedCount += 1;
      totalCompletedMinutes += Math.round(duration / 60000);
    }
  });

  stats.avgPrepMinutes = completedCount ? Math.round(totalCompletedMinutes / completedCount) : 0;
  return stats;
}
function calculateChefOwnStats() { return calculateAllStats?.()[currentChefId] || { active: 0, fast: 0, normal: 0, ready: 0, total: 0, totalWorkMinutes: 0, delayed: 0, loadPercent: 0 }; }
function renderKitchenStats() {
  const stats = calculateKitchenStats();

  // ① Header kartochkalarini yangilash (rasmda ko'rinadi)
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl("statNewOrders",       stats.newOrders);
  setEl("statCooking",         stats.cooking);
  setEl("statReady",           stats.ready);
  setEl("statDelayed",         stats.delayed);
  setEl("statAvgPrepMinutes",  stats.avgPrepMinutes ? `${stats.avgPrepMinutes} min` : "0 min");
  setEl("statCompletedToday",  stats.completedToday);

  // data-stat attribute orqali ham qo'llab-quvvatlash
  document.querySelectorAll("[data-stat]").forEach(el => {
    const key = el.dataset.stat;
    if (key === "new")     el.textContent = stats.newOrders;
    if (key === "cooking") el.textContent = stats.cooking;
    if (key === "ready")   el.textContent = stats.ready;
    if (key === "delayed") el.textContent = stats.delayed;
    if (key === "avg")     el.textContent = `${stats.avgPrepMinutes} min`;
    if (key === "today")   el.textContent = stats.completedToday;
  });

  const root = document.getElementById("chefsTodayStats");
  if (root) {
    const cardHtml = (typeof renderChefPerformanceCard === "function") ? renderChefPerformanceCard() : "";
    root.innerHTML = `
      <div class="kitchen-stats-grid">
        <div class="stat-card"><b>🆕 ${t("new_label", "Yangi")}</b><span>${stats.newOrders}</span></div>
        <div class="stat-card"><b>🔥 ${t("cooking_label", "Pishirilmoqda")}</b><span>${stats.cooking}</span></div>
        <div class="stat-card"><b>✅ ${t("ready_label", "Tayyor")}</b><span>${stats.ready}</span></div>
        <div class="stat-card"><b>🚨 ${t("delayed_label", "Kechikkan")}</b><span>${stats.delayed}</span></div>
        <div class="stat-card"><b>⏱ ${t("avg_prep_label", "O'rtacha vaqt")}</b><span>${stats.avgPrepMinutes} ${t("minute_short", "min")}</span></div>
        <div class="stat-card"><b>📦 ${t("today_label", "Bugun")}</b><span>${stats.completedToday}</span></div>
      </div>`;
  }
}

function renderChefPerformanceCard() {
  const mine = calculateChefOwnStats();

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("myLoad",       mine.active);
  setEl("myReadyCount", mine.ready);
  setEl("myWorkTime",   `${mine.totalWorkMinutes} min`);

  document.querySelectorAll("[data-mystat]").forEach(el => {
    const key = el.dataset.mystat;
    if (key === "load")  el.textContent = mine.active;
    if (key === "ready") el.textContent = mine.ready;
    if (key === "time")  el.textContent = `${mine.totalWorkMinutes} min`;
  });
}

window.updateStatistics = updateStatistics;
window.calculateAllStats = calculateAllStats;

function updateKitchenRealtimeStats() { renderKitchenStats(); if (typeof updateStatistics === "function") updateStatistics(); }
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => { const key = el.dataset.i18n; if (key) el.textContent = t(key); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { const key = el.dataset.i18nTitle; if (key) el.title = t(key); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { const key = el.dataset.i18nPlaceholder; if (key) el.placeholder = t(key); });
  document.title = t("chef_document_title", `NestaCRM — ${t("chef_page_title", "Oshpaz paneli")}`);
}
function applyChefPageTranslations() { applyStaticTranslations(); updateChefFullscreenButton(); renderKitchenStats(); renderKitchenNotifications(); renderStopList(); renderKitchenActionLog(); renderCategoryFilter?.(); renderSubFilter?.(getSelectedCategory?.() || "all"); renderChefFilters(); }
function renderChefFilters() {
  ensureChefEnhancementLayout();
  const statusEl = document.getElementById("chefStatusFilter"), tableEl = document.getElementById("chefTableFilter"), searchEl = document.getElementById("chefSearchInput");
  if (statusEl) {
    const savedVal = localStorage.getItem("chefStatusFilter") || window.chefSettings?.defaultFilter || "all";
    statusEl.innerHTML = `
      <option value="all">${t("all_statuses", "Barcha statuslar")}</option>
      <option value="new">${t("status_new", "Yangi")}</option>
      <option value="accepted">${t("status_approved", "Tasdiqlangan")}</option>
      <option value="cooking">${t("status_cooking", "Tayyorlanmoqda")}</option>
      <option value="ready">${t("status_ready", "Tayyor")}</option>
      <option value="delayed">${t("delayed_order", "Kechikkan")}</option>
      <option value="mine">${t("my_orders", "Mening orderlarim")}</option>
    `;
    statusEl.value = savedVal;
  }
  if (tableEl) {
    tableEl.placeholder = t("table_number_placeholder", "Stol raqami...");
    tableEl.value = localStorage.getItem("chefTableFilter") || "";
  }
  if (searchEl) {
    searchEl.placeholder = t("search_order_food", "Order / taom / note qidirish...");
    searchEl.value = localStorage.getItem("chefSearch") || "";
  }
}

window.renderChefOrders = function () {
  const activeContainer = document.getElementById("chefOrders");
  const readyContainer = document.getElementById("readyOrders");
  if (!activeContainer || !readyContainer) return;

  activeContainer.innerHTML = '';
  readyContainer.innerHTML = '';

  const visibleEntries = getChefVisibleOrders();

  if (visibleEntries.length === 0) {
    activeContainer.innerHTML = `<p class="empty-state">${t("no_orders", "Hozircha buyurtmalar kelmadi...")}</p>`;
    readyContainer.innerHTML = `<p class="empty-state">${t("no_ready_orders", "Tayyor buyurtmalar yo'q")}</p>`;
    return;
  }

  let hasActive = false;
  let hasReady = false;

  visibleEntries.forEach(([orderId, order]) => {
    const status = normalizeKitchenStatus(order.status || order.statusKey || 'new');

    if (['new', 'approved', 'cooking'].includes(status)) {
      const card = buildChefOrderCard(orderId, order, false);
      if (card) { activeContainer.appendChild(card); hasActive = true; }
    } else if (status === 'ready') {
      const card = buildChefOrderCard(orderId, order, true);
      if (card) { readyContainer.appendChild(card); hasReady = true; }
    }
  });

  if (!hasActive) {
    activeContainer.innerHTML = `<p class="empty-state">${t("no_active_matches", "Mos faol buyurtmalar topilmadi")}</p>`;
  }
  if (!hasReady) {
    readyContainer.innerHTML = `<p class="empty-state">${t("no_ready_matches", "Mos tayyor buyurtmalar topilmadi")}</p>`;
  }
};

const renderChefOrders = window.renderChefOrders;

function buildChefOrderCard(orderId, order, isReady) {
  const div = document.createElement('div');
  div.className = `order-card ${isReady ? 'ready-card-style' : ''}`;

  const status = normalizeKitchenStatus(order.status || order.statusKey || '');
  const isCooking = status === 'cooking';
  const tableNum = order.tableNo || order.table || '?';

  let tableBadgeBg = '#ef4444';
  let tableStatusText = t("status_busy", "YANGI 🔴");

  if (isCooking) {
    tableBadgeBg = '#f59e0b';
    tableStatusText = t("status_cooking_badge", "JARAYONDA 🟡");
  } else if (isReady) {
    tableBadgeBg = '#10b981';
    tableStatusText = t("status_ready_badge", "TAYYOR 🟢");
  }

  let itemsHtml = '';
  if (order.items) {
    itemsHtml = Object.values(order.items).map(item => {
      const menu = getOrderItemMenu(item) || {};
      const name = getTranslatedItemName(item, menu, currentLang);
      const itemImg = item.image || item.img || menu.imgUrl || menu.img || 'img/logo (2).svg';
      const catText = getCategoryLabel(menu.category || item.category || '');
      const subCatText = menu.subcategory ? ` / ${getSubcategoryLabel(menu.subcategory)}` : '';
      const fullCategory = (catText || subCatText) ? `${catText}${subCatText}` : t("food_label", "Taom");

      return `
        <div class="chef-item-row" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed rgba(255,255,255,0.08);">
          <img src="${escapeHtml(itemImg)}" alt="${escapeHtml(name)}" style="width:55px;height:55px;border-radius:10px;object-fit:cover;" onerror="this.src='img/logo (2).svg'">
          <div style="flex:1;min-width:0;">
            <h4 style="margin:0 0 4px 0;font-size:15px;color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</h4>
            <span style="font-size:11px;color:#92400e;background:rgba(251,191,36,0.18);border:1px solid rgba(217,119,6,0.30);padding:2px 8px;border-radius:999px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(fullCategory)}</span>
          </div>
          <div style="font-size:16px;font-weight:800;color:#3b82f6;padding-left:8px;">x${Number(item.qty || item.quantity || 1)}</div>
        </div>`;
    }).join('');
  }

  // ── vaqt kiritish bloki (yangi va cooking+vaqtsiz holatlarda) ──────────────
  function _timeInputBlock(fnName) {
    return `
      <div style="margin-top:14px;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">
          ⏱ ${t("enter_ready_minutes","Tayyor bo'lish vaqti")}
        </div>
        <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
          ${[5,10,15,20,30].map(m =>
            `<button onclick="document.getElementById('time-input-${escapeHtml(orderId)}').value=${m}"
              style="padding:5px 11px;background:rgba(251,191,36,0.15);border:1.5px solid rgba(217,119,6,0.35);
              color:#92400e;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
              ${m} ${t("minute_short","daq")}</button>`).join("")}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;
            background:rgba(251,191,36,0.10);padding:10px 12px;border-radius:12px;
            border:1.5px solid rgba(217,119,6,0.30);">
          <i class="fa-solid fa-hourglass-start" style="color:#d97706;font-size:15px;flex-shrink:0;"></i>
          <input type="number" id="time-input-${escapeHtml(orderId)}"
            placeholder="${t("enter_ready_minutes","Daqiqa kiriting...")}" min="1" max="120"
            style="flex:1;background:transparent;border:none;color:#1e293b;font-size:16px;
            font-weight:700;outline:none;min-width:0;"
            onkeydown="if(event.key==='Enter'){window.${fnName}('${escapeJsString(orderId)}');}">
          <span style="color:#d97706;font-size:12px;flex-shrink:0;">${t("minute_short","daq")}</span>
        </div>
        <button id="start-btn-${escapeHtml(orderId)}"
          onclick="window.${fnName}('${escapeJsString(orderId)}')"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#16a34a,#22c55e);
          color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:800;font-size:15px;
          display:flex;align-items:center;justify-content:center;gap:8px;
          box-shadow:0 4px 14px rgba(22,163,74,0.35);transition:transform .15s ease;"
          onmouseover="this.style.transform='scale(1.02)'"
          onmouseout="this.style.transform='scale(1)'">
          <i class="fa-solid fa-play"></i> ${t("start_cooking_btn","BOSHLASH")}
        </button>
      </div>`;
  }

  let footerAction = '';
  if (!isReady) {
    const readyAtVal = Number(order.readyAt || 0);

    // ── yangi/tasdiqlangan yoki cooking lekin vaqt hali kiritilmagan ──
    if (!isCooking || (isCooking && !readyAtVal)) {
      footerAction = _timeInputBlock(isCooking ? "startCookingFromCard" : "startCookingFromCard");

    } else {
      // ── cooking + readyAt belgilangan: countdown + yangilash + TAYYOR ──
      const now = Date.now();
      const diffMs = readyAtVal - now;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      let timerColor = '#f59e0b';
      let timerClass = '';
      if (diffMs <= 0) { timerColor = '#ef4444'; timerClass = 'kechikdi'; }
      else if (diffMs <= 60000) { timerColor = '#ef4444'; timerClass = 'shake-anim'; }
      else if (diffMs <= 3 * 60000) { timerColor = '#ef4444'; }
      const timerTxt = diffMs <= 0
        ? `⚠️ ${t("overdue_label","Kechikdi")} ${Math.abs(diffMins)} ${t("minute_short","daq")}`
        : `⏱ ${diffMins}:${String(diffSecs).padStart(2,'0')} ${t("left_short","qoldi")}`;

      footerAction = `
        <div style="margin-top:14px;">
          <div class="chef-card-countdown ${timerClass}"
            data-ready-at="${readyAtVal}" data-order-id="${escapeHtml(orderId)}"
            style="text-align:center;font-size:15px;font-weight:800;color:${timerColor};
            padding:8px;background:rgba(0,0,0,0.15);border-radius:10px;
            margin-bottom:10px;letter-spacing:0.5px;">
            ${timerTxt}
          </div>
          <!-- Vaqtni yangilash -->
          <div style="display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap;">
            ${[5,10,15,20,30].map(m =>
              `<button onclick="document.getElementById('new-time-${escapeHtml(orderId)}').value=${m}"
                style="padding:4px 9px;background:rgba(251,191,36,0.15);border:1.5px solid rgba(217,119,6,0.35);
                color:#92400e;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">
                ${m}</button>`).join("")}
            <input id="new-time-${escapeHtml(orderId)}" type="number" min="1" max="120"
              placeholder="${t("minute_short","Daq")}" value="${order.prepMinutes || ""}"
              style="width:56px;padding:4px 8px;border-radius:8px;border:1.5px solid rgba(217,119,6,0.40);
              background:rgba(251,191,36,0.10);color:#1e293b;font-size:13px;font-weight:700;outline:none;"
              onkeydown="if(event.key==='Enter') window.updateCookingTimer('${escapeHtml(orderId)}')">
            <button onclick="window.updateCookingTimer('${escapeHtml(orderId)}')"
              style="padding:5px 10px;background:rgba(251,191,36,0.20);border:1.5px solid rgba(217,119,6,0.40);
              color:#92400e;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
              🔄 ${t("update_timer","Yangilash")}
            </button>
          </div>
          <button onclick="processChefAction('${escapeJsString(orderId)}', 'ready')"
            style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);
            color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:800;font-size:14px;
            display:flex;align-items:center;justify-content:center;gap:8px;
            box-shadow:0 4px 14px rgba(16,185,129,0.35);">
            <i class="fa-solid fa-check-double"></i> ${t("mark_as_ready", "TAYYOR ✅")}
          </button>
        </div>`;
    }
  } else {
    footerAction = `
      <div style="margin-top:12px;font-size:12px;color:#10b981;text-align:center;font-style:italic;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(16,185,129,0.05);padding:8px;border-radius:8px;">
        <i class="fa-solid fa-bell fa-bounce"></i> ${t("waiting_waiter", "Ofitsiant kutilmoqda...")}
      </div>`;
  }

  div.innerHTML = `
    <div class="order-card-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="background:${tableBadgeBg};color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:6px;">
        ${t("table_title", "STOL")} ${escapeHtml(String(tableNum))} — ${tableStatusText}
      </span>
      <span style="font-size:12px;color:#94a3b8;">
        <i class="fa-regular fa-clock"></i> ${formatOrderTime(order.createdAt)}
      </span>
    </div>
    <div class="order-card-body">${itemsHtml}${order.allergyNote ? `<div class="order-allergy-note"><span class="allergy-icon">⚠️</span><span class="allergy-text">${escapeHtml(translateAllergyNote(order.allergyNote))}</span></div>` : ""}</div>
    ${footerAction}`;

  return div;
}

window.buildChefOrderCard = buildChefOrderCard;
window.processChefAction = async function (orderId, nextStatus) {
  const restaurantId = localStorage.getItem("restaurantId");
  if (!restaurantId) return;

  const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);

  let updates = {
    status: nextStatus,
    statusKey: nextStatus,
    updatedAt: Date.now(),
    chefId: currentChefId
  };

  if (nextStatus === 'cooking') {
    const timeInput = document.getElementById(`time-input-${orderId}`);
    const minutes = parseInt(timeInput?.value);

    if (!minutes || minutes <= 0) {
      if (typeof showToast === "function") {
        showToast(t("invalid_time", "Iltimos, tayyor bo'lish vaqtini kiriting!"), "warning");
      } else {
        alert(t("invalid_time", "Iltimos, tayyor bo'lish vaqtini kiriting!"));
      }
      return;
    }

    updates.prepMinutes = minutes;
    updates.readyAt = Date.now() + (minutes * 60000);
    updates.cookingStartedAt = Date.now();
  }

  if (nextStatus === 'ready') {
    updates.finishedAt = Date.now();
    updates.readyAt = Date.now();
    updates.isNotified = false;
    updates.notified = false;
  }

  try {
    await update(orderRef, updates);

    if ((nextStatus === "approved" || nextStatus === "cooking") &&
        typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    if (typeof window.logChefAction === "function") {
      const statusText = nextStatus === 'ready'
        ? t("status_ready", "tayyor")
        : t("status_cooking", "pishirilmoqda");
      await window.logChefAction(
        `#${orderId.slice(-4)} — ${t("status_updated", "Status yangilandi")}: ${statusText}`
      );
    }

    if (typeof showToast === "function") {
      const msg = nextStatus === 'cooking'
        ? t("order_cooking", "Buyurtma pishirish boshlandi")
        : t("order_ready_toast", "Buyurtma tayyor!");
      showToast(msg, "success");
    }

  } catch (error) {
    console.error(t("firebase_status_error_log", "Firebase status yangilashda xato:"), error);
    if (typeof showToast === "function") {
      showToast(t("error_generic", "Xatolik yuz berdi"), "error");
    }
  }
};
window.updateChefOrderStatus = window.processChefAction;
window.changeOrderStatus      = window.processChefAction;
window.changeChefOrderStatus  = window.processChefAction;
window.updateOrderStatus      = window.processChefAction;

/* ==========================================
   🚀 BOSHLASH TUGMASI — startCookingFromCard
   ========================================== */
window.startCookingFromCard = async function(orderId) {
  const timeInput = document.getElementById(`time-input-${orderId}`);
  const inputVal  = parseInt(timeInput?.value);

  if (!inputVal || inputVal <= 0) {
    if (typeof showToast === "function") {
      showToast(t("enter_ready_minutes", "Iltimos tayyor bo'lish vaqtini daqiqada kiriting!"), "warning");
    } else {
      alert(t("enter_ready_minutes", "Tayyor bo'lish vaqtini daqiqada kiriting!"));
    }
    if (timeInput) timeInput.focus();
    return;
  }

  const minutes     = inputVal;
  const now         = Date.now();
  const readyAt     = now + (minutes * 60000);
  const restId      = localStorage.getItem("restaurantId") || currentRestaurantId;
  const orderRef    = ref(db, `restaurants/${restId}/orders/${orderId}`);

  try {
    await update(orderRef, {
      status:           "cooking",
      statusKey:        "cooking",
      statusLabel:      t("status_cooking", "Tayyorlanmoqda"),
      readyAt:          readyAt,
      prepMinutes:      minutes,
      cookingStartedAt: now,
      startedAt:        now,
      updatedAt:        now,
      chefId:           currentChefId,
      updatedBy:        currentChefId
    });

    // Kitchen ticker uchun overdue observer — har 10 soniyada tekshiramiz
    window.__overdueChecked = window.__overdueChecked || new Set();
    const overdueKey = `overdue_${orderId}`;
    if (!window.__overdueCheckTimers) window.__overdueCheckTimers = {};
    if (window.__overdueCheckTimers[overdueKey]) clearInterval(window.__overdueCheckTimers[overdueKey]);

    window.__overdueCheckTimers[overdueKey] = setInterval(async () => {
      const now2 = Date.now();
      if (now2 < readyAt) return; // Hali vaqt o'tmagan

      const overdueMins = Math.floor((now2 - readyAt) / 60000);
      const alertKey    = `overdue_alerted_${orderId}_${overdueMins}`;
      if (window.__overdueChecked.has(alertKey)) return;
      window.__overdueChecked.add(alertKey);

      // Har 5 daqiqada bitta ogohlantirish yetarli
      if (overdueMins % 5 !== 0) return;

      const snap2 = await get(ref(db, `restaurants/${restId}/orders/${orderId}`));
      if (!snap2.exists()) { clearInterval(window.__overdueCheckTimers[overdueKey]); return; }
      const ord2 = snap2.val();
      if (!["cooking","tayyorlanmoqda"].includes(normalizeKitchenStatus(ord2.status||''))) {
        clearInterval(window.__overdueCheckTimers[overdueKey]); return;
      }

      // Oshpazga ogohlantirish push
      const notifMsg = `⚠️ ${t("overdue_chef_alert","Buyurtma kechikdi")}! Stol ${ord2.table||''} — ${overdueMins} ${t("minute_short","daqiqa")} kechikdi!`;
      showNotification(notifMsg);
      if (typeof showToast === "function") showToast(notifMsg, "error");

      // Firebasega log
      await push(ref(db, `${BASE_PATH}/activityLogs`), {
        action:      "order_overdue_alert",
        description: notifMsg,
        orderId,
        table:       ord2.table || null,
        overdueMins,
        chefId:      currentChefId,
        createdAt:   Date.now()
      });
    }, 10000);

    if (typeof showToast === "function") showToast(`⏳ ${t("timer_started", "Taymer ishga tushdi")} — ${minutes} ${t("minute_short", "daqiqa")}`, "success");

  } catch(err) {
    console.error(t("cooking_start_error_log", "startCookingFromCard error:"), err);
    if (typeof showToast === "function") showToast(t("error_generic","Xatolik yuz berdi"), "error");
  }
};

function refreshUI() {
  ensureChefEnhancementLayout();
  applyChefPageTranslations();
  renderPrepMenuSidebar?.();
  renderChefOrders();
  renderChefChatRooms?.();
  renderChefChatMessages?.();
  updateKitchenRealtimeStats();
  updateNewOrdersBadge?.();
  loadKitchenNotifications();
}

function startKitchenTicker() {
  if (window.__kitchenTickerTimer) return;
  window.__kitchenTickerTimer = setInterval(() => {
    updateOrderCountdowns();
    highlightLateOrders();
  }, 1000);
}

function highlightLateOrders() {
  const enabled = window.chefSettings?.highlightLateOrders !== false;
  document.querySelectorAll(".chef-order-card[data-order-id]").forEach(card => {
    const orderId = card.dataset.orderId;
    const order = allOrders?.[orderId];
    if (!order) return;
    const remaining = getRemainingInfo(order);
    card.classList.toggle("order-delayed", enabled && remaining.delayed);
    card.classList.toggle("order-urgent", enabled && remaining.urgent);
  });
}

function startKitchenNotificationsAutoRefresh() { if (window.__kitchenNotificationTimer) return; window.__kitchenNotificationTimer = setInterval(loadKitchenNotifications, 10000); }

/* =========================
   EVENTS
========================= */
function bindEvents() {
  if (window.__chefEnhancementEventsBound) return;
  window.__chefEnhancementEventsBound = true;
  if (langSelect) {
    langSelect.value = getLang();
    langSelect.addEventListener("change", e => setLang(e.target.value));
  }
  onLangChange(lang => {
    currentLang = lang;
    if (langSelect) langSelect.value = lang;
    renderCategoryFilter();
    lastOrdersSignature = "";
    refreshUI();
    // Chat menyu opsiyalarini qayta yuklash (til o'zgarganda)
    if (typeof window.initChatSystem === "function") {
      window.initChatSystem({
        currentRestaurantId: currentRestaurantId || localStorage.getItem("restaurantId"),
        currentUserId: currentChefId,
        currentRole: "chef",
        db: db,
        getChatOptions: getChefChatOptions,
        getChatId: getChefChatId
      });
    }
  });
  chefFilterEl?.addEventListener("change", e => { localStorage.setItem("chefFilter", e.target.value); refreshUI(); });
  categoryFilterEl?.addEventListener("change", e => { localStorage.setItem("categoryFilter", e.target.value); localStorage.setItem("subFilter", "all"); renderSubFilter(e.target.value); refreshUI(); });
  subFilterEl?.addEventListener("change", e => { localStorage.setItem("subFilter", e.target.value); refreshUI(); });
  document.addEventListener("change", e => { if (e.target?.id === "chefStatusFilter") { localStorage.setItem("chefStatusFilter", e.target.value); refreshUI(); } });
  document.addEventListener("input", e => {
    if (e.target?.id === "chefSearchInput") {
      localStorage.setItem("chefSearch", e.target.value);
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(renderChefOrders, 300);
    }
  });

  chefChatSendBtnDom?.addEventListener("click", () => window.sendChefChatMessage?.());
  chefChatInputDom?.addEventListener("keydown", e => { if (e.key === "Enter") window.sendChefChatMessage?.(); });
  document.addEventListener("click", e => { if (statsPanelEl && !statsPanelEl.contains(e.target) && !e.target.closest(".btn-stats-toggle")) statsPanelEl.style.display = "none"; if (e.target?.id === "chefDetailModal") window.closeChefOrderDetail(); });
  document.addEventListener("fullscreenchange", updateChefFullscreenButton);
  if (localStorage.getItem("tvMode") === "1") document.body.classList.add("tv-mode");
}

function startChefSecurityMonitor() {
  const statusRef = ref(db, `${BASE_PATH}/info/status`);

  onValue(statusRef, (snapshot) => {
    const status = snapshot.val();
    const overlay = document.getElementById("system-block-overlay");

    if (overlay) {
      const icon = overlay.querySelector('i');
      const title = overlay.querySelector('h1');
      const desc = overlay.querySelector('p');

      if (status === "blocked") {
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
        if (icon) { icon.className = "fa-solid fa-lock"; icon.style.color = "#ef4444"; }
        if (title) title.innerText = t("system_blocked_title", "Tizim vaqtincha bloklangan");
      } else if (status === "paused") {
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
        if (icon) { icon.className = "fa-solid fa-circle-pause"; icon.style.color = "#f59e0b"; }
        if (title) title.innerText = t("system_paused_title", "Obuna vaqtincha to'xtatilgan");
        if (desc) desc.innerText = t("system_paused_desc", "Restoraningiz faoliyati vaqtincha to'xtatib qo'yilgan.");
      } else {
        overlay.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }
  });
}

async function getChefChatOptions() {
  return [
    { icon: "👨‍💼", label: t("chat_with_admin_private", "Admin bilan (Shaxsiy)"), type: "admin_private" },
    { icon: "📢", label: t("chat_with_admin_group", "Admin (Guruh)"), type: "admin_group" },
    { icon: "🤵", label: t("chat_with_waiter", "Ofitsiant bilan chat"), type: "waiter" }
  ];
}

async function getChefChatId(option, userId) {
  if (option.type === "admin_group") return `chef_group`;
  if (option.type === "admin_private") return `admin_chef_${currentChefId}`;
  if (option.type === "waiter") return `waiter_group`;
  return null;
}

// ==========================================
// 💬 CHAT UI TUGMASINI BOSHQARISH
// ==========================================
window.initChatFloatingUI = function () {
  const old = document.getElementById("chat-toggle-button");
  if (old) old.remove();

  const chatBtn = document.createElement("div");
  chatBtn.id = "chat-toggle-button";
  chatBtn.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999; cursor:pointer; width:60px; height:60px; background:linear-gradient(135deg,#2563eb,#3b82f6); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; box-shadow:0 4px 16px rgba(37,99,235,0.40); transition: all 0.3s ease;";
  chatBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95l4.782-1.388A9.954 9.954 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
  document.body.appendChild(chatBtn);

  const defaultFab = document.getElementById("chatFab");
  if (defaultFab) defaultFab.style.display = "none";

  chatBtn.onclick = () => {
    const mainFab = document.getElementById("chatFab");
    const chatModal = document.querySelector(".chat-modal");

    if (mainFab) {
      mainFab.click();
      setTimeout(() => {
        const isActive = chatModal && (chatModal.style.display === "flex" || chatModal.classList.contains("active"));

        chatBtn.innerHTML = isActive
          ? '<i class="fa-solid fa-xmark" style="color:#ffffff !important;"></i>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95l4.782-1.388A9.954 9.954 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';

        chatBtn.style.background = isActive ? "#ef4444" : "linear-gradient(135deg,#2563eb,#3b82f6)";
        chatBtn.style.color = "white";
      }, 100);
    } else {
      console.error(t("chat_system_not_found_log", "Chat tizimi (#chatFab) topilmadi! chat-system.js yuklanganini tekshiring."));
      if (typeof showToast === "function") showToast(t("chat_system_loading", "Chat tizimi yuklanmoqda..."), "warning");
    }
  };
};

// ==========================================
// 🏷 OSHPAZ SAHIFASI SARLAVHASINI YANGILASH
// ==========================================
window.loadChefHeader = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = typeof currentChefId !== "undefined" ? currentChefId : localStorage.getItem("userId");

  if (!restId || !userId) return;

  try {
    const [settingsSnap, infoSnap, userSnap] = await Promise.all([
      get(ref(db, `restaurants/${restId}/settings`)),
      get(ref(db, `restaurants/${restId}/info`)),
      get(ref(db, `restaurants/${restId}/users/${userId}`))
    ]);

    const settings = settingsSnap.val() || {};
    const info     = infoSnap.val()     || {};
    const user     = userSnap.val()     || {};

    const restName  = settings.restaurantName || info.name || t("unknown_restaurant", "Noma'lum Restoran");
    const staffName = user.name || localStorage.getItem("userName") || t("chef_label", "Oshpaz");
    const roleLabel = t("chef_label", "Oshpaz");

    // ── Sahifa title ──
    document.title = `NestaCRM — ${staffName} (${roleLabel}) | ${restName}`;

    // ── CSS (bir marta) ──
    if (!document.getElementById("chefHeaderTitleStyle")) {
      const s = document.createElement("style");
      s.id = "chefHeaderTitleStyle";
      s.textContent = `
        #chefHeaderTitle {
          display: inline-flex;
          align-items: center;
          gap: 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 520px;
        }
        #chefHeaderTitle .cht-brand {
          color: var(--primary, #16a34a);
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.3px;
        }
        #chefHeaderTitle .cht-sep {
          color: var(--text-muted, #94a3b8);
          margin: 0 5px;
          font-weight: 400;
        }
        #chefHeaderTitle .cht-name {
          color: var(--text-primary, #1e293b);
        }
        #chefHeaderTitle .cht-role {
          color: var(--text-muted, #64748b);
          font-weight: 500;
          font-size: 13px;
        }
        #chefHeaderTitle .cht-pipe {
          color: var(--text-muted, #cbd5e1);
          margin: 0 6px;
        }
        #chefHeaderTitle .cht-rest {
          color: var(--primary, #16a34a);
          font-weight: 600;
          font-size: 14px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 640px) {
          #chefHeaderTitle { font-size: 12px; max-width: 260px; }
          #chefHeaderTitle .cht-brand { font-size: 13px; }
          #chefHeaderTitle .cht-rest { max-width: 110px; }
        }
      `;
      document.head.appendChild(s);
    }

    // ── Mavjud element bo'lsa yangilaymiz, bo'lmasa yaratamiz ──
    let titleEl = document.getElementById("chefHeaderTitle");

    if (!titleEl) {
      titleEl = document.createElement("div");
      titleEl.id = "chefHeaderTitle";

      // Logotipni topamiz — uning yoniga (keyin) qo'yamiz
      const logo = document.querySelector(".chef-header .logo, .chef-header .brand, .chef-header .logo-wrap, header .logo, .header .logo");
      if (logo) {
        logo.insertAdjacentElement("afterend", titleEl);
      } else {
        // Logotip topilmasa header ga birinchi child sifatida qo'shamiz
        const header = document.querySelector(".chef-header, header.header, header");
        if (header) header.prepend(titleEl);
      }
    }

    titleEl.innerHTML = `
      <span class="cht-brand">NestaCRM</span>
      <span class="cht-sep">—</span>
      <span class="cht-name">${escapeHtml(staffName)}</span>
      <span class="cht-role">&nbsp;(${escapeHtml(roleLabel)})</span>
      <span class="cht-pipe">|</span>
      <span class="cht-rest" title="${escapeHtml(restName)}">${escapeHtml(restName)}</span>
    `;

  } catch (error) {
    console.error(t("header_load_error_log", "Sarlavhani yuklashda xatolik:"), error);
  }
};

// ==========================================
// 👨‍Chef (OSHPAZ) PANELINI INITIALIZATSIYA QILISH
// ==========================================
async function initChef() {
  if (window.__chefInitStarted) return;
  window.__chefInitStarted = true;

  ensureChefEnhancementLayout();
  try {
    await ensureChefUserExists();
    await ensureChefAccess("kitchen_access");
  } catch (e) { return; }

  await window.startChefSubscriptionTimer();

  applyChefPageTranslations();
  renderChefFilters();
  bindEvents();
  listenSocket();
  listenUsers();
  listenMenu();
  listenOrders();
  listenOrderChats();
  listenTableStates();
  listenMyStatus();
  listenStopList();
  listenOrderTimelines();
  listenActivityLogs();

  if (typeof window.initChatSystem === "function") {
    // viewAs orqali kirilganda currentChefId to'g'ri URL parametridan o'rnatilgan
    window.initChatSystem({
      currentRestaurantId: currentRestaurantId || localStorage.getItem("restaurantId"),
      currentUserId: currentChefId,
      currentRole: "chef",
      db: db,
      getChatOptions: getChefChatOptions,
      getChatId: getChefChatId
    });

    setTimeout(window.initChatFloatingUI, 1000);
  }

  if (typeof window.listenToMyRoleChange === "function") {
    window.listenToMyRoleChange();
  }

  if (typeof window.loadChefHeader === "function") {
    await window.loadChefHeader();
  }

  // Restoran logotipi va footer ma'lumotlarini yuklash
  if (typeof window.loadChefRestaurantBranding === "function") {
    await window.loadChefRestaurantBranding();
  }

  try {
    await assignNextFromQueue();
  } catch (err) {
    console.error(t("queue_error_log", "Queue error:"), err);
  }

  startKitchenTicker();
  startKitchenNotificationsAutoRefresh();
  updateKitchenRealtimeStats();
  startChefSecurityMonitor();

  if (!window.__kitchenRealtimeTimer) {
    window.__kitchenRealtimeTimer = setInterval(updateKitchenRealtimeStats, 10000);
  }

  // ── TV va Fullscreen tugmalarini headerga qo'shish ──────────────────────────
  (function injectChefTVButtons() {
    if (document.getElementById("chefTVBtnWrap")) return;

    const tvBtn = document.createElement("button");
    tvBtn.id = "tvModeBtn";
    tvBtn.innerHTML = "📺 " + t("tv_mode", "TV Rejimi");
    tvBtn.onclick = window.toggleTVMode;
    tvBtn.style.cssText = "display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:transform .15s,opacity .15s;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,0.2);background:linear-gradient(135deg,#6366f1,#4f46e5);";

    const fsBtn = document.createElement("button");
    fsBtn.id = "chefFSBtn";
    fsBtn.innerHTML = "⛶ " + t("fullscreen_btn", "To'liq ekran");
    fsBtn.onclick = window.toggleChefFullscreen;
    fsBtn.style.cssText = "display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:transform .15s,opacity .15s;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,0.2);background:linear-gradient(135deg,#0ea5e9,#0284c7);";

    const wrap = document.createElement("div");
    wrap.id = "chefTVBtnWrap";
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-left:auto;";
    wrap.appendChild(tvBtn);
    wrap.appendChild(fsBtn);

    const target = document.querySelector(".header-actions") ||
                   document.querySelector(".chef-header") ||
                   document.querySelector("header");
    if (target) target.appendChild(wrap);

    injectChefTVStyles();
    updateChefTVButton();
  })();

  // TV rejimini tiklash
  if (localStorage.getItem("tvMode") === "1") {
    document.body.classList.add("tv-mode");
    setTimeout(() => { applyChefTVMode(true); updateChefTVButton(); }, 300);
  }

  document.addEventListener("fullscreenchange", () => {
    updateChefFullscreenButton();
    updateChefTVButton();
  });
}

document.addEventListener("DOMContentLoaded", initChef);

/* =========================
   CHEF: FOOTER VA HEADER LOGOTIPINI YUKLASH
========================= */
window.loadChefRestaurantBranding = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const snap = await get(ref(db, `restaurants/${restId}/settings`));
    if (!snap.exists()) return;

    const settings = snap.val();

    // ── 1. FOOTER: ish vaqti va telefon ──
    const footerDiv = document.querySelector('.support-footer') || document.querySelector('.chef-footer') || document.querySelector('footer');
    if (footerDiv) {
      // Footer ichida branding blok bor yoki yo'q tekshirish
      let brandingBlock = footerDiv.querySelector('.chef-branding-info');
      if (!brandingBlock) {
        brandingBlock = document.createElement('div');
        brandingBlock.className = 'chef-branding-info';
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
      // Footer element yo'q — dynamic yaratamiz
      let chefFooter = document.getElementById('chefDynamicFooter');
      if (!chefFooter) {
        chefFooter = document.createElement('div');
        chefFooter.id = 'chefDynamicFooter';
        chefFooter.style.cssText = `
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; gap: 20px;
          padding: 8px 20px; background: var(--bg-card, #fff);
          border-top: 1px solid var(--border-color, #e2e8f0);
          font-size: 13px; color: var(--text-muted, #64748b);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
        `;
        document.body.appendChild(chefFooter);
      }

      chefFooter.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }

    if (settings.restaurantLogoUrl) {
      let logoImg = document.getElementById('chefRestaurantLogoImg');
      if (!logoImg) {
        logoImg = document.createElement('img');
        logoImg.id = 'chefRestaurantLogoImg';
        logoImg.alt = 'Restoran logotipi';
        logoImg.style.cssText = `
          height: 40px; width: 40px; object-fit: contain;
          border-radius: 8px; flex-shrink: 0;
        `;

        const logoWrap = document.querySelector('.chef-header .logo-wrap')
          || document.querySelector('.chef-header .logo')
          || document.querySelector('.chef-header .brand')
          || document.querySelector('header .logo')
          || document.querySelector('header');

        if (logoWrap) {
          logoWrap.style.display = 'flex';
          logoWrap.style.alignItems = 'center';
          logoWrap.style.gap = '8px';
          logoWrap.insertBefore(logoImg, logoWrap.firstChild);
        }
      }
      logoImg.src = settings.restaurantLogoUrl;
    }

  } catch (error) {
    console.error(t("branding_load_error_log", "Branding yuklashda xato:"), error);
  }
};

// Chef paneli tayyor bo'lganda branding ma'lumotlarini yuklash
// loadChefHeader dan keyin chaqiriladi
window._origLoadChefHeader = window.loadChefHeader;
window.loadChefHeader = async function () {
  if (typeof window._origLoadChefHeader === "function") {
    await window._origLoadChefHeader();
  }
  if (typeof window.loadChefRestaurantBranding === "function") {
    await window.loadChefRestaurantBranding();
  }
};

// Real-time: admin sozlamalarni o'zgartirsa darhol aks ettirish
(function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;
  onValue(ref(db, `restaurants/${restId}/settings`), (snap) => {
    if (!snap.exists()) return;
    const settings = snap.val();

    // Footer yangilash
    const footerBranding = document.querySelector('.chef-branding-info');
    if (footerBranding) {
      footerBranding.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }
    const dynamicFooter = document.getElementById('chefDynamicFooter');
    if (dynamicFooter) {
      dynamicFooter.innerHTML = `
        <span>🕐 <b>${settings.workingHours || "09:00 - 20:00"}</b></span>
        <span>📞 <b>${settings.contactPhone || "+998 90 123 45 67"}</b></span>
      `;
    }

    if (settings.restaurantLogoUrl) {
      const logoImg = document.getElementById('chefRestaurantLogoImg');
      if (logoImg) {
        logoImg.src = settings.restaurantLogoUrl;
      }
    }
  });
})();

window.setCustomOrderReadyTime = async function (orderId) {
  const input = document.getElementById(`time-input-${orderId}`);
  if (!input) return;

  const minutes = parseInt(input.value);
  if (!minutes || minutes <= 0) {
    const errorMsg = (typeof t === "function")
      ? t("invalid_time", "Iltimos, to'g'ri daqiqa kiriting!")
      : "Iltimos, to'g'ri daqiqa kiriting!";

    if (typeof showToast === "function") {
      showToast(errorMsg, "warning");
    } else {
      alert(errorMsg);
    }
    return;
  }

  if (typeof window.setOrderReadyTime === "function") {
    await window.setOrderReadyTime(orderId, minutes);
    input.value = '';
  } else {
    console.error("Xato: setOrderReadyTime funksiyasi topilmadi!");
  }
};