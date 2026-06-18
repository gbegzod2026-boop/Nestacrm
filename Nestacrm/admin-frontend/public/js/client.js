// client.js 
import { CATEGORY_DATA, ORDER_STATUS } from "./shared.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  onValue,
  runTransaction,
  off,
  onChildAdded
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";
import "./chat-system.js";

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

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

const auth = getAuth(app);
auth.languageCode = getLang();

const db = getDatabase(app);

const urlParams =
  new URLSearchParams(window.location.search);

let currentRestaurantId =
  urlParams.get("rest") ||
  localStorage.getItem("restaurantId");

if (!currentRestaurantId) {

  console.error(
    "❌ Restaurant ID topilmadi"
  );

  alert("Restaurant ID topilmadi");

  throw new Error(
    "Restaurant ID topilmadi"
  );
}

localStorage.setItem(
  "restaurantId",
  currentRestaurantId
);

localStorage.setItem(
  "clientRestaurantId",
  currentRestaurantId
);

console.log(
  "👉 Mijoz sahifasi ishga tushdi, Restoran ID:",
  currentRestaurantId
);

const BASE_PATH = `restaurants/${currentRestaurantId}`;

window.cart =
  JSON.parse(
    localStorage.getItem("cart") || "{}"
  );

console.log(
  "🛒 INITIAL CART:",
  window.cart
);

console.log(
  "🚀 Dastur ishga tushdi, menyuni yuklash boshlanmoqda..."
);

/* =========================
   CHAT SYSTEM INITIALIZATION 
========================= */
window.getClientChatOptions = async function (userId, restaurantId) {
  return [
    { icon: "👨‍🍳", label: t("chat_option_chef", "Oshpaz bilan aloqa"), type: "chef" },
  ];
};

function updateOrderTimeDisplay(order) {
  const headerReadyBox = document.getElementById("headerReadyBox");
  const headerTimerContainer = document.getElementById("header-timer-container");
  const clientReadyBox = document.getElementById("clientReadyBox");

  const headerReadyTime = document.getElementById("headerReadyTime");
  const headerReadyCountdown = document.getElementById("headerReadyCountdown");
  const headerCountdownText = document.getElementById("header-countdown-text");

  const clientReadyTime = document.getElementById("clientReadyTime");
  const clientTimer = document.getElementById("clientTimer");

  if (order && order.prepMinutes && order.expectedReadyAt) {
    if (headerReadyBox) headerReadyBox.style.display = "block";
    if (headerTimerContainer) headerTimerContainer.style.display = "block";
    if (clientReadyBox) clientReadyBox.style.display = "block";

    const readyDate = new Date(order.expectedReadyAt);
    const timeString = readyDate.toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (headerReadyTime) headerReadyTime.innerText = timeString;
    if (headerReadyCountdown) headerReadyCountdown.innerText = `${order.prepMinutes} min`;
    if (headerCountdownText) headerCountdownText.innerText = `${order.prepMinutes}:00`;

    if (clientReadyTime) clientReadyTime.innerHTML = `🍳 Tayyor bo'ladi: ${timeString}`;
    if (clientTimer) clientTimer.innerHTML = `⏳ Kutilmoqda: ${order.prepMinutes} min`;

  } else {
    if (headerReadyBox) headerReadyBox.style.display = "none";
    if (headerTimerContainer) headerTimerContainer.style.display = "none";
    if (clientReadyBox) clientReadyBox.style.display = "none";
  }
}

function openPaymentModal() {
  document.getElementById("paymentModal").style.display = "flex";
}

function closePaymentModal() {
  document.getElementById("paymentModal").style.display = "none";
}

window.getClientChatId = async function (option, clientId, restaurantId) {
  if (option.type === "waiter") {
    return `waiterChats/client_${clientId}`;
  }

  if (option.type === "chef") {
    const activeOrderId = localStorage.getItem("activeOrderId");
    if (!activeOrderId) {
      alert(t("active_order_not_found", "Faol buyurtma topilmadi"));
      return null;
    }

    try {
      const database = window.db || db;
      const orderSnap = await get(ref(database, `${BASE_PATH}/orders/${activeOrderId}`));

      if (!orderSnap.exists()) {
        alert(t("order_not_found", "Buyurtma topilmadi"));
        return null;
      }

      const order = orderSnap.val();
      const assignedChefId = order.chefId || order.assignedChefId;

      if (assignedChefId) {
        return `orderChats/${activeOrderId}/chef`;
      } else {
        alert(t("chef_not_assigned", "Buyurtmangizga hali oshpaz biriktirilmagan"));
        return null;
      }
    } catch (error) {
      console.error("Chat ID olishda xato:", error);
      return null;
    }
  }
  return null;
};

window.initClientNavigationChat = async function () {

  if (window.clientChatInitialized) return;

  window.clientChatInitialized = true;

  console.log("🚀 Initializing Client Chat System...");

  let clientId = localStorage.getItem("clientId");

  if (!clientId) {

    clientId = "client_" + safeUUID();

    localStorage.setItem("clientId", clientId);

    console.log("📝 Created new clientId:", clientId);

  } else {

    console.log("✅ Using existing clientId:", clientId);
  }

  window.BASE_PATH = BASE_PATH;

  // chat-system.js to'g'ridan import qilingani uchun setInterval shart emas
  if (typeof window.initChatSystem === "function") {
    console.log("✅ window.initChatSystem found");
    window.initChatSystem({
      currentRestaurantId,
      currentUserId: clientId,
      currentRole: "client",
      db,
      getChatOptions: window.getClientChatOptions,
      getChatId: window.getClientChatId
    })
      .then(() => {
        console.log("✅ Chat tizimi ulandi!");
      })
      .catch(err => {
        console.error("❌ Chat init error:", err);
      });
  } else {
    console.error("❌ chat-system.js yuklanmadi yoki initChatSystem eksport qilinmagan");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("📂 HTML to'liq yuklandi");
  if (typeof renderMenu === "function") {
    console.log("✅ renderMenu funksiyasi topildi");
  } else {
    console.error("❌ XATO: renderMenu funksiyasi topilmadi!");
  }
});

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getOrderStatusKey(order) {
  const raw = normalizeStatus(order?.status || order?.statusKey);

  const map = {
    // Yangi
    yangi: "yangi", new: "yangi",
    // Tasdiqlandi
    tasdiqlandi: "tasdiqlandi", approved: "tasdiqlandi",
    // Tayyorlanmoqda
    tayyorlanmoqda: "tayyorlanmoqda", cooking: "tayyorlanmoqda",
    // Tayyor
    tayyor: "tayyor", ready: "tayyor",
    // Yetkazilmoqda
    yetkazilmoqda: "yetkazilmoqda", delivering: "yetkazilmoqda", served: "yetkazilmoqda",
    // Yetkazildi
    yetkazildi: "yetkazildi", delivered: "yetkazildi",
    // To'landi
    "to'landi": "to'landi", tolandi: "to'landi", paid: "to'landi",
    // To'lov tasdiqlandi
    "to'lov tasdiqlandi": "to'lov tasdiqlandi", payment_confirmed: "to'lov tasdiqlandi",
    // Queue
    queue: "queue",
    // Yopildi
    yopildi: "yopildi", closed: "yopildi",
    // Bekor qilindi
    "bekor qilindi": "bekor qilindi", cancelled: "bekor qilindi",
    // Tozalanmoqda
    tozalanmoqda: "tozalanmoqda", cleaning: "tozalanmoqda", needs_cleaning: "tozalanmoqda"
  };

  return map[raw] || raw;
}

// HTTP (non-HTTPS) da crypto.randomUUID ishlamaydi — fallback
function safeUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let clientId = localStorage.getItem("clientId");

if (!clientId) {
  clientId = "CL_" + safeUUID();
  localStorage.setItem("clientId", clientId);
}

function checkDiscountFromURL() {

  const params = new URLSearchParams(window.location.search);

  const tableNo = params.get("tableNo");
  const tableId = params.get("tableId");
  const code = params.get("discount");

  const tableInput = document.getElementById("tableInput");

  // Stol saqlash
  if (tableNo) {
    localStorage.setItem("tableNo", tableNo);
  }

  // Table ID saqlash
  if (tableId) {
    localStorage.setItem("tableId", tableId);
  }

  // Restore
  const savedTableNo = localStorage.getItem("tableNo");

  // Inputga yozish
  if (tableInput && savedTableNo) {

    tableInput.value = savedTableNo;

    // editni bloklash
    tableInput.readOnly = true;

    // style class
    tableInput.classList.add("locked-table");

    // boshqa js o‘chirsa qayta yozadi
    setTimeout(() => {
      tableInput.value = savedTableNo;
    }, 300);
  }

  // discount bo‘lmasa stop
  if (!code) return;

  get(ref(db, BASE_PATH + "/discounts/" + code))
    .then((snap) => {

      if (!snap.exists()) {
        alert(t("discount_not_found"));
        return;
      }

      const data = snap.val();

      if (data.active === false) {
        alert(t("discount_inactive"));
        return;
      }

      if (data.used) {
        alert(t("discount_used"));
        return;
      }

      if (data.expireDate && Date.now() > data.expireDate) {
        alert(t("discount_expired"));
        return;
      }

      localStorage.setItem("discountPercent", data.percent);
      localStorage.setItem("discountCode", code);

      alert(`🎉 ${data.percent}% ${t("discount_activated")}`);

    })
    .catch((err) => {
      console.error("Discount check error:", err);
    });
}

const SUBMITTED_ORDER_FLAG = "client_has_submitted_order";

window.addEventListener("load", () => {
  checkDiscountFromURL();
  lockTableFromURL();
});

function lockTableFromURL() {
  const params = new URLSearchParams(window.location.search);
  const tableNo = params.get("tableNo") || localStorage.getItem("tableNo");
  const tableId = params.get("tableId");

  if (tableNo) localStorage.setItem("tableNo", tableNo);
  if (tableId) localStorage.setItem("tableId", tableId);

  const tableInput = document.getElementById("tableInput");
  if (!tableInput || !tableNo) return;

  const applyTableValue = () => {
    tableInput.value = tableNo;
    tableInput.readOnly = true;
    tableInput.disabled = true;
    tableInput.classList.add("locked-table");
  };

  applyTableValue();
  setInterval(applyTableValue, 1000);
}

function trackOrderAndStartTimer(restaurantId, orderId) {
  const db = getDatabase();
  const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);

  onValue(orderRef, (snapshot) => {
    const order = snapshot.val();
    // expectedReadyAt (oshpaz belgilagan vaqt) yoki readyAt dan foydalanamiz
    const countdownTarget = order?.expectedReadyAt || order?.readyAt;
    if (order && countdownTarget && Number(countdownTarget) > Date.now() - 3600000) {
      window.startHeaderCountdown(countdownTarget);
    } else {
      const timerBox = document.getElementById("header-timer-container");
      if (timerBox) timerBox.style.display = 'none';
    }
  });
}

let headerTimerInterval = null;

// ── Buyurtma tayyor bo'lganda header da necha daqiqada tayyorlanganini ko'rsatish ──
function showOrderReadyBanner(order) {
  // Countdown ni to'xtatamiz
  if (headerTimerInterval) {
    clearInterval(headerTimerInterval);
    headerTimerInterval = null;
  }

  const timerBox = document.getElementById("header-timer-container");
  const display = document.getElementById("header-countdown-text");
  const etaBox = document.getElementById("header-ready-eta");
  const timerIcon = timerBox ? timerBox.querySelector(".timer-icon") : null;
  const timerLabel = timerBox ? timerBox.querySelector("small") : null;

  // Necha daqiqada tayyorlanganini hisoblash
  const startedAt = Number(order.cookingStartedAt || order.acceptedAt || 0);
  const finishedAt = Number(order.updatedAt || Date.now());
  let tookMins = null;
  if (startedAt && finishedAt > startedAt) {
    tookMins = Math.round((finishedAt - startedAt) / 60000);
  } else if (order.prepMinutes) {
    tookMins = Number(order.prepMinutes);
  }

  if (timerBox) {
    timerBox.style.display = "flex";
    timerBox.style.background = "linear-gradient(135deg,rgba(22,163,74,0.18),rgba(34,197,94,0.10))";
    timerBox.style.border = "1.5px solid rgba(34,197,94,0.5)";
    timerBox.style.borderRadius = "14px";
  }

  if (timerIcon) timerIcon.textContent = "✅";

  if (timerLabel) {
    timerLabel.textContent = tookMins !== null
      ? `${tookMins} ${t("minute_short", "daqiqa")}da tayyorlandi`
      : t("ready_text", "Tayyor bo'ldi!");
    timerLabel.style.color = "#16a34a";
    timerLabel.style.fontSize = "11px";
  }

  if (display) {
    display.innerText = t("ready_text_emoji", "Tayyor! 🎉");
    display.style.color = "#22c55e";
    display.style.fontSize = "18px";
    display.classList.remove("client-countdown-shake", "client-countdown-red", "client-countdown-yellow");
  }

  // ETA blokini yashiramiz — endi "N daqiqada tayyorlandi" ko'rinadi
  if (etaBox) etaBox.style.display = "none";

  // headerReadyBox da ham yangilaymiz
  const hrb = document.getElementById("headerReadyBox");
  const hrl = document.querySelector(".header-ready-label");
  const hrt = document.getElementById("headerReadyTime");
  const hrc = document.getElementById("headerReadyCountdown");

  if (hrb) hrb.style.display = "block";
  if (hrl) { hrl.innerText = ""; }
  if (hrt) {
    hrt.innerText = tookMins !== null
      ? `✅ ${tookMins} ${t("minute_short", "daqiqa")}da`
      : "✅ Tayyor!";
    hrt.style.color = "#22c55e";
    hrt.style.fontSize = "16px";
  }
  if (hrc) {
    hrc.innerText = t("order_delivered_label", "Taomingiz keltirilyapti!");
    hrc.style.color = "#16a34a";
  }
}

window.startHeaderCountdown = function (readyAt) {
  const timerBox = document.getElementById("header-timer-container");
  const display = document.getElementById("header-countdown-text");

  if (!timerBox || !display) return;

  if (headerTimerInterval) {
    clearInterval(headerTimerInterval);
    headerTimerInterval = null;
  }

  if (!readyAt) {
    timerBox.style.display = 'none';
    const etaBox = document.getElementById("header-ready-eta");
    if (etaBox) etaBox.style.display = "none";
    return;
  }

  // readyAt butun order obyekti bo'lib kelsa (bug holatida) — xavfsiz qaytamiz
  if (typeof readyAt === 'object' && readyAt !== null) {
    const ts = readyAt.readyAt || readyAt.expectedReadyAt;
    if (!ts) { timerBox.style.display = 'none'; return; }
    readyAt = ts;
  }

  const readyAtNum = Number(readyAt);
  if (!readyAtNum || readyAtNum < Date.now() - 3600000) {
    // 1 soatdan eski yoki noto'g'ri — yashiramiz
    timerBox.style.display = 'none';
    return;
  }

  timerBox.style.display = 'flex';
  timerBox.classList.remove("pulse-animation");
  display.style.color = "";
  display.style.animation = "";

  // ETA vaqtini ko'rsatamiz (tayyor bo'lish soat:daqiqa)
  const etaBox = document.getElementById("header-ready-eta");
  const etaTime = document.getElementById("header-eta-time");
  if (etaBox && etaTime) {
    const etaDt = new Date(readyAtNum);
    etaTime.innerText = etaDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    etaBox.style.display = "block";
  }

  // Ensure CSS for client shake + red states exists
  if (!document.getElementById("clientCountdownStyles")) {
    const s = document.createElement("style");
    s.id = "clientCountdownStyles";
    s.textContent = `
      @keyframes clientShake {
        0%,100%{transform:translateX(0)}
        10%,30%,50%,70%,90%{transform:translateX(-5px)}
        20%,40%,60%,80%{transform:translateX(5px)}
      }
      .client-countdown-shake { animation: clientShake 0.5s ease infinite !important; }
      .client-countdown-red   { color: #ef4444 !important; }
      .client-countdown-yellow{ color: #f59e0b !important; }
    `;
    document.head.appendChild(s);
  }

  let overdueNotified = false;

  const updateTimer = () => {
    const now = Date.now();
    const diff = readyAtNum - now;

    if (diff <= 0) {
      // Vaqt tugadi
      clearInterval(headerTimerInterval);
      display.innerText = typeof t === "function" ? t("ready_text", "Tayyor! ✨") : "Tayyor! ✨";
      display.style.color = "#22c55e";
      display.style.animation = "";
      display.classList.remove("client-countdown-shake", "client-countdown-red", "client-countdown-yellow");
      timerBox.style.background = "linear-gradient(135deg,rgba(22,163,74,0.2),rgba(34,197,94,0.12))";
      timerBox.style.borderColor = "rgba(34,197,94,0.6)";
      timerBox.classList.add("pulse-animation");
      // headerReadyBox: countdown tugaganda "Tayyor bo'ldi" ko'rsatamiz
      const hrc = document.getElementById("headerReadyCountdown");
      if (hrc) { hrc.innerText = t("order_delivered_label", "Taomingiz keltirilyapti!"); hrc.style.color = "#16a34a"; }
      const hrl = document.querySelector(".header-ready-label");
      if (hrl) hrl.innerText = "";
      const hrt = document.getElementById("headerReadyTime");
      if (hrt) { hrt.innerText = "✅ Tayyor!"; hrt.style.color = "#22c55e"; }

      // Oshpazga bir marta overdue xabar yuborish
      if (!overdueNotified) {
        overdueNotified = true;
        const activeId = localStorage.getItem("activeOrderId");
        if (activeId && typeof db !== "undefined") {
          const restId = localStorage.getItem("restaurantId") || currentRestaurantId;
          get(ref(db, `restaurants/${restId}/orders/${activeId}`)).then(snap => {
            if (!snap.exists()) return;
            const ord = snap.val();
            const chefId = ord.chefId;
            if (!chefId) return;
            const msg = `⚠️ Vaqt tugadi! Stol ${ord.table || ''} buyurtmasi hali tayyorlanmadi. Mijoz kutmoqda!`;
            push(ref(db, `restaurants/${restId}/activityLogs`), {
              action: "client_countdown_expired",
              description: msg,
              orderId: activeId,
              table: ord.table || null,
              chefId,
              createdAt: Date.now()
            });
          }).catch(() => { });
        }
      }
      return;
    }

    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // 1 daqiqa qolganda — shake + qizil
    if (diff <= 60000) {
      display.classList.add("client-countdown-shake", "client-countdown-red");
      display.classList.remove("client-countdown-yellow");
      display.style.color = "#ef4444";
    }
    // 3 daqiqa qolganda — faqat qizil, shake yo'q
    else if (diff <= 3 * 60000) {
      display.classList.remove("client-countdown-shake", "client-countdown-yellow");
      display.classList.add("client-countdown-red");
      display.style.color = "#ef4444";
    }
    // Normal holatda — sariq
    else {
      display.classList.remove("client-countdown-shake", "client-countdown-red");
      display.classList.add("client-countdown-yellow");
      display.style.color = "";
    }
  };

  updateTimer();
  headerTimerInterval = setInterval(updateTimer, 1000);
};

/* =========================
   GLOBAL STATE
========================= */
let stopListData = {};
let tableNumber = null;
let confirmedTableNumber = null;
let currentOrderId = null;
let cartItems, cartTotal, cartCount, cartModal, tablesContainer;
let TOP_FOODS = [];
let filterCategory, filterSubcategory, filterTypeSelect, searchInput;
let currentPaymentTotal = 0;
let clientMenu;
let filterCategoryValue = "all";
let filterSubcategoryValue = "all";
let filterType = "all";
let searchQuery = "";
let clientTimerInterval = null;
let baseReadyAt = null;
let receiptShownForOrder = null;
let stopActiveOrderListener = null;
let allowReceiptOpen = false;
let currentBaseCookTime = 30;
let chatFab, headerReadyBox, headerReadyTime, headerReadyCountdown;
let clientChatModal, clientChatInfo, clientChatMessages, clientChatInput, clientChatSendBtn;
let clientChatQuickReplies = null;
let activeOrderData = null;
let hasSubmittedOrder = false;
const tableInput = document.getElementById("tableInput");
const orderStatus = document.getElementById("orderStatus");
const orderStatusBox = document.getElementById("orderStatusBox");
const receiptBox = document.getElementById("receiptBox");
let RESTAURANT_SETTINGS = {
  fastOrderActive: true,
  fastFee: 5,
  fastOrderMinusMinutes: 10,
  normalOrderBaseTime: 30,
  fastOrderMinAmount: 80000
};

const CLIENT_CHAT_QUICK_REPLY_CONFIG = [
  { key: "allergy", label: t("qr_allergy", "Menda ... ga allergiya bor"), template: t("qr_allergy_template", "Menda quyidagiga allergiya bor: "), kind: "allergy", requiresDetails: true },
  { key: "no-onion", label: t("qr_no_onion", "Piyozsiz"), template: t("qr_no_onion", "Piyozsiz"), kind: "preference" },
  { key: "no-greens", label: t("qr_no_greens", "Ko'katsiz"), template: t("qr_no_greens", "Ko'katsiz"), kind: "preference" },
  { key: "spicy", label: t("qr_spicy", "Achchiq"), template: t("qr_spicy", "Achchiq"), kind: "preference" }
];

onValue(ref(db, BASE_PATH + "/settings"), snap => {
  if (snap.exists()) {
    RESTAURANT_SETTINGS = { ...RESTAURANT_SETTINGS, ...snap.val() };
    updatePaymentSummary();
  }
});
if (localStorage.getItem("role") !== "client" && localStorage.getItem("role") !== "waiter" && localStorage.getItem("role") !== "admin" && localStorage.getItem("role") !== "manager" && localStorage.getItem("role") !== "superadmin") {
}

window.checkRestaurantSubscription = async function () {
  try {
    const snap = await get(ref(db, `restaurants/${currentRestaurantId}/subscription`));

    if (snap.exists()) {
      const data = snap.val();
      return true;
    }
    return true;
  } catch (error) {
    console.warn("⚠️ Litsenziya tekshirishda ruxsat yo'q, lekin test uchun menyu ochiladi.");
    return true;
  }
};

/* =========================
   INIT DOM
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const isSubActive = await window.checkRestaurantSubscription();
  if (!isSubActive) return;
  clientMenu = document.getElementById("clientMenu");
  filterCategory = document.getElementById("filterCategory");
  filterSubcategory = document.getElementById("filterSubcategory");
  filterTypeSelect = document.getElementById("filterType");
  searchInput = document.getElementById("menuSearch");
  tableNumber = localStorage.getItem("table");
  cartItems = document.getElementById("cartItems");
  cartTotal = document.getElementById("cartTotal");
  cartCount = document.getElementById("cartCount");
  cartModal = document.getElementById("cartModal");
  tablesContainer = document.getElementById("tablesContainer");
  chatFab = document.getElementById("chatFab");
  clientChatModal = document.getElementById("clientChatModal");
  clientChatInfo = document.getElementById("clientChatInfo");
  clientChatMessages = document.getElementById("clientChatMessages");
  clientChatInput = document.getElementById("clientChatInput");
  clientChatSendBtn = document.getElementById("clientChatSendBtn");
  clientChatQuickReplies = document.getElementById("clientChatQuickReplies");
  headerReadyBox = document.getElementById("headerReadyBox");
  headerReadyTime = document.getElementById("headerReadyTime");
  headerReadyCountdown = document.getElementById("headerReadyCountdown");
  ensureClientChatQuickReplies();

  const savedCart = localStorage.getItem("clientCart");
  const savedActiveOrderId = localStorage.getItem("activeOrderId");

  hasSubmittedOrder = sessionStorage.getItem(SUBMITTED_ORDER_FLAG) === "1";

  if (savedCart && savedActiveOrderId) {
    try { cart = JSON.parse(savedCart) || {}; } catch { cart = {}; }
  } else {
    cart = {};
    localStorage.removeItem("clientCart");
    localStorage.removeItem("lastOrderStatus");
  }

  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = getLang();
    langSelect.addEventListener("change", e => { setLang(e.target.value); });
  }

  onLangChange((lang) => {
    auth.languageCode = lang;
    applyLang();
    renderCategoryFilter();
    renderSubcategoryFilter();
    renderMenu();
    updateCart();
    applyClientPageTranslations();
    if (activeOrderData) updateStatusUI(getOrderStatusKey(activeOrderData));
  });

  const tableCheckBtn = document.getElementById("tableCheckBtn");
  const tableInputEl = document.getElementById("tableInput");

  const hasActiveOrderOnLoad = !!localStorage.getItem("activeOrderId");

  if (hasActiveOrderOnLoad) {
    confirmedTableNumber = localStorage.getItem("confirmedTable") || localStorage.getItem("table") || null;
    if (tableInputEl && confirmedTableNumber) tableInputEl.value = confirmedTableNumber;
  } else {
    confirmedTableNumber = null;
    tableNumber = null;
    localStorage.removeItem("table");
    localStorage.removeItem("confirmedTable");
    // Faol buyurtma yo'q — telefon va VIP ham tozalansin
    localStorage.removeItem("customerPhone");
    localStorage.removeItem("userPhone");
    // URL dan tableNo bor bo'lsa inputni tozalamay, URL qiymatini yozamiz
    const urlTableNo = new URLSearchParams(window.location.search).get("tableNo");
    if (tableInputEl) {
      if (urlTableNo) {
        tableInputEl.value = urlTableNo;
        tableInputEl.readOnly = true;
        tableInputEl.disabled = true;
        tableInputEl.classList.add("locked-table");
      } else {
        tableInputEl.value = "";
      }
    }
  }

  if (tableCheckBtn) {
    tableCheckBtn.onclick = async (e) => {
      e.preventDefault();
      await checkTable();
    };
  }

  tableInputEl?.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      e.preventDefault();
      await checkTable();
    }
  });

  tableInputEl?.addEventListener("input", () => {
    setTableStatusMessage("", "");

    const statusBox = document.getElementById("orderStatusBox");
    if (statusBox) statusBox.style.display = "none";
  });

  // Telefon raqam o'zgartirilsa yoki o'chirilsa VIP badge yashiriladi
  const phoneInputEl = document.getElementById("clientPhoneInput");
  if (phoneInputEl) {
    phoneInputEl.addEventListener("input", () => {
      if (!phoneInputEl.value.trim()) {
        hideAllVipElements();
        localStorage.removeItem("customerPhone");
        localStorage.removeItem("userPhone");
      }
    });
  }

  const orderBox = document.getElementById("orderStatusBox");

  if (receiptBox) receiptBox.style.display = "none";
  if (orderBox) orderBox.style.display = "none";

  if (receiptBox) {
    receiptBox.addEventListener("click", function (e) {
      if (e.target.id === "receiptBox") closeReceipt();
    });
  }

  allowReceiptOpen = false;

  applyLang();
  renderCategoryFilter();
  renderSubcategoryFilter();
  bindFilters();
  subscribeMenuRealtime();
  subscribeInventoryRealtime();

  onValue(ref(db, BASE_PATH + "/stopList"), snap => {
    stopListData = snap.val() || {};
    safeRenderMenu();
  });

  updateCart();
  renderMenu();
  applyClientPageTranslations();
  clearHeaderReadyInfo();

  restoreSubmittedOrderState().then(() => {
    listenActiveOrder();
    initClientChat();
  });

  // VIP badge faqat Tekshirish tugmasi bosilganda ko'rsatiladi
  // (checkAndShowVipBadge bu yerda chaqirilmaydi)

  get(ref(db, BASE_PATH + "/settings/maxTable")).then(snap => {
    if (!snap.exists()) return;
    const input = document.getElementById("tableInput");
    if (input) input.max = snap.val();
  });

  const initialReceiptBox = document.getElementById("receiptBox");
  const initialReceiptContent = document.getElementById("receiptContent");

  if (initialReceiptBox) {
    initialReceiptBox.style.display = "none";
  }
  if (initialReceiptContent) {
    initialReceiptContent.innerHTML = "";
  }

  // Initialize Universal Chat System
  initClientNavigationChat();
});

/* =========================
   UI XIZMAT FUNKSIYALARI
========================= */
function resetClientSession(paymentConfirmed = false) {
  stopClientChatRealtime();
  currentOrderId = null;
  hasSubmittedOrder = false;
  receiptShownForOrder = null;

  // Savat FAQAT admin to'lovni tasdiqlaganda tozalanadi
  if (paymentConfirmed) {
    cart = {};
    window.cart = {};
    localStorage.removeItem("clientCart");
    localStorage.removeItem("cart");
  }

  localStorage.removeItem("lastOrderStatus");
  sessionStorage.removeItem("client_has_submitted_order");
  localStorage.removeItem("activeOrderId");
  localStorage.removeItem("confirmedTable");
  localStorage.removeItem("table");
  localStorage.removeItem("receiptShown");
  // Telefon raqamni ham tozalaymiz — VIP yangi raqam kiritilganda qayta tekshirilsin
  localStorage.removeItem("customerPhone");
  localStorage.removeItem("userPhone");

  tableNumber = null;
  confirmedTableNumber = null;

  const tableInputEl = document.getElementById("tableInput");
  if (tableInputEl) tableInputEl.value = "";

  closeClientChat(true);
  closeReceipt();

  const statusBox = document.getElementById("orderStatusBox");
  if (statusBox) statusBox.style.display = "none";

  stopClientCountdown();
  clearHeaderReadyInfo();
  updateCart();
  renderMenu();
}

function stopClientCountdown() {
  if (clientTimerInterval) {
    clearInterval(clientTimerInterval);
    clientTimerInterval = null;
  }
  const timerEl = document.getElementById("clientTimer");
  if (timerEl) {
    timerEl.innerText = "";
    timerEl.style.color = "";
  }
  if (headerReadyCountdown) {
    headerReadyCountdown.innerText = "";
    headerReadyCountdown.style.color = "#f59e0b";
  }
}

function showHeaderReadyBox() {
  if (headerReadyBox) headerReadyBox.style.display = "block";
}

function hideHeaderReadyBox() {
  if (headerReadyBox) headerReadyBox.style.display = "none";
}

function clearHeaderReadyInfo() {
  hideHeaderReadyBox();
  if (headerReadyTime) headerReadyTime.innerText = "";
  if (headerReadyCountdown) {
    headerReadyCountdown.innerText = "";
    headerReadyCountdown.style.color = "#f59e0b";
  }
}

function updateHeaderReadyInfo(readyAt) {
  if (!headerReadyTime) return;
  showHeaderReadyBox();
  const dt = new Date(Number(readyAt || Date.now()));
  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Sarlavhani ko'rsatamiz
  const labelEl = document.querySelector(".header-ready-label");
  if (labelEl) labelEl.innerText = t("header_ready_title", "Tayyor bo'ladi:");

  // Aniq vaqtni ko'rsatamiz
  headerReadyTime.innerText = timeStr;

  // Qolgan daqiqalarni hisoblash
  const diffMs = Number(readyAt) - Date.now();
  const diffMins = Math.max(0, Math.ceil(diffMs / 60000));

  if (headerReadyCountdown) {
    if (diffMs <= 0) {
      headerReadyCountdown.innerText = t("ready_text", "✅ Tayyor!");
      headerReadyCountdown.style.color = "#22c55e";
    } else {
      headerReadyCountdown.innerText = `⏳ ~${diffMins} ${t("minute_short", "daqiqa")}`;
      headerReadyCountdown.style.color = diffMins <= 3 ? "#ef4444" : "#f59e0b";
    }
  }
}

function setPreviewReadyInfo(readyAt) {
  updateHeaderReadyInfo(readyAt);
  const readyEl = document.getElementById("clientReadyTime");
  const countdownEl = document.getElementById("clientTimer");

  if (readyEl) {
    const dt = new Date(readyAt);
    readyEl.innerText = `🍽 ${t("ready_time")}: ${dt.toLocaleTimeString()}`;
  }
  if (countdownEl) {
    countdownEl.innerText = `⏳ ${t("waiting_chef_start", "Oshpaz boshlashi kutilmoqda")}`;
    countdownEl.style.color = "#64748b";
  }
  if (headerReadyCountdown) {
    headerReadyCountdown.innerText = t("waiting_chef_start", "Oshpaz boshlashi kutilmoqda");
    headerReadyCountdown.style.color = "#64748b";
  }
}

/* =========================
   CATEGORY FILTERS & MENU
========================= */
function renderCategoryFilter() {
  if (!filterCategory) return;
  let htmlContent = `<option value="all">${t("all_categories")}</option>`;
  CATEGORY_DATA.categories.forEach(cat => {
    htmlContent += `<option value="${cat.id}">${t(cat.nameKey)}</option>`;
  });
  filterCategory.innerHTML = htmlContent;
}

function renderSubcategoryFilter() {
  const el = document.getElementById("filterSubcategory");
  if (!el) return;
  let htmlContent = `<option value="all">${t("all_subcategories")}</option>`;

  if (filterCategoryValue !== "all") {
    const cat = CATEGORY_DATA.categories.find(c => c.id === filterCategoryValue);
    if (cat) {
      cat.sub.forEach(subKey => {
        htmlContent += `<option value="${subKey}">${t(subKey)}</option>`;
      });
    }
  }
  el.innerHTML = htmlContent;
}

/* =============
   RENDER MENU 
================ */
function renderMenu() {
  if (!clientMenu) return;

  const lang = typeof getLang === "function" ? getLang() : "uz";

  let items = [];

  for (let key in (allMenu || {})) {
    if (allMenu[key] && typeof allMenu[key] === "object") {
      items.push({
        id: key,
        ...allMenu[key]
      });
    }
  }

  items = items.filter(
    i => stopListData[i.id] !== true && i.active !== false
  );

  if (searchQuery) {
    items = items.filter(i => {
      const n =
        typeof i.name === "object"
          ? (
            i.name[lang] ||
            i.name.uz ||
            i.name.ru ||
            i.name.en ||
            ""
          )
          : (i.name || "");

      return n.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  if (filterCategoryValue !== "all") {
    items = items.filter(
      i => String(i.category) === String(filterCategoryValue)
    );
  }

  if (filterSubcategoryValue !== "all") {
    items = items.filter(
      i => String(i.subcategory) === String(filterSubcategoryValue)
    );
  }

  if (filterType === "new") {
    items = items.filter(i => isNewFood(i));
  }

  if (filterType === "top") {
    items = items.filter(i => TOP_FOODS.includes(i.id));
  }

  clientMenu.innerHTML = items.length
    ? items.map(i => {

      const name =
        typeof i.name === "object"
          ? (
            i.name[lang] ||
            i.name.uz ||
            i.name.ru ||
            i.name.en ||
            "—"
          )
          : (i.name || "—");

      const itemId = String(i.id);

      const qty =
        Number(cart?.[itemId]?.qty || 0);

      const isNew =
        typeof isNewFood === "function"
          ? isNewFood(i)
          : false;

      const isTop = TOP_FOODS.includes(i.id);

      const safeCategories =
        (typeof CATEGORY_DATA !== "undefined" &&
          CATEGORY_DATA.categories)
          ? CATEGORY_DATA.categories
          : [];

      const catObj = safeCategories.find(
        c => String(c.id) === String(i.category)
      );

      const categoryName = catObj
        ? (
          typeof t === "function"
            ? t(catObj.nameKey)
            : catObj.nameKey
        )
        : (
          i.category ||
          (
            typeof t === "function"
              ? t("uncategorized")
              : "Kategoriyasiz"
          )
        );

      const subcategoryName =
        catObj?.sub?.includes(i.subcategory)
          ? (
            typeof t === "function"
              ? t(i.subcategory)
              : i.subcategory
          )
          : (i.subcategory || "—");

      const price = Number(i.price || 0).toLocaleString();

      // ── Tarkib (recipe) HTML ──
      let recipeHtml = "";
      const recipe = Array.isArray(i.recipe)
        ? i.recipe
        : (i.recipe && typeof i.recipe === "object" ? Object.values(i.recipe) : []);

      if (recipe.length > 0) {
        const inv = window.allInventory || {};
        const ingredientRows = recipe.map(ing => {
          const ingName = ing.name || (inv[ing.id] && inv[ing.id].name) || ing.id || "—";
          const ingUnit = ing.unit || (inv[ing.id] && inv[ing.id].unit) || "gr";
          const ingAmt = Number(ing.amount || 0);
          return `<li class="menu-card-ing-row">
            <span class="menu-card-ing-name">${ingName}</span>
            <span class="menu-card-ing-amount">${ingAmt} ${ingUnit}</span>
          </li>`;
        }).join("");

        recipeHtml = `
          <div class="menu-card-recipe">
            <button type="button"
              class="menu-card-recipe-toggle"
              onclick="(function(btn){
                var box = btn.nextElementSibling;
                var open = box.classList.toggle('open');
                btn.classList.toggle('active', open);
              })(this)">
              ${typeof t === "function" ? t("ingredients_label", "Tarkibi") : "Tarkibi"}
              <span class="menu-card-recipe-arrow">▾</span>
            </button>
            <ul class="menu-card-recipe-list">${ingredientRows}</ul>
          </div>`;
      }

      return `
          <div class="menu-card">

            ${isNew
          ? `<span class="badge-new">
                  🆕 ${typeof t === "function" ? t("badge_new") : "Yangi"}
                </span>`
          : ""
        }

            ${isTop
          ? `<span class="badge-top">
                  🔥 ${typeof t === "function" ? t("badge_top") : "Top"}
                </span>`
          : ""
        }

            ${(i.imgUrl || i.image || i.img)
          ? `<img class="menu-card-img"
                src="${i.imgUrl || i.image || i.img}"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                alt="${name}"
              >
              <div class="menu-card-img-placeholder" style="display:none;">🍽️</div>`
          : `<div class="menu-card-img-placeholder">🍽️</div>`
        }

            <div class="menu-card-body">
              <div class="menu-card-name">${name}</div>

              <div class="menu-card-category">
                📂 ${categoryName} / ${subcategoryName}
              </div>

              <div class="menu-card-price">
                💰 ${price} ${typeof t === "function" ? t("currency") : "UZS"}
              </div>

              ${recipeHtml}

              <div class="qty">
                <button type="button" onclick="changeQty('${itemId}', -1)">−</button>
                <span>${qty}</span>
                <button type="button" onclick="changeQty('${itemId}', 1)">+</button>
              </div>
            </div>

          </div>
        `;
    }).join("")
    : `
      <p class="empty">
        ${typeof t === "function"
      ? t("search_not_found")
      : "Kechirasiz, taom topilmadi"}
      </p>
    `;
}

/* =========================
   FILTER EVENTS
========================= */
function bindFilters() {
  filterCategory?.addEventListener("change", e => {
    filterCategoryValue = e.target.value;
    filterSubcategoryValue = "all";
    renderSubcategoryFilter();
    renderMenu();
  });

  filterSubcategory?.addEventListener("change", e => {
    filterSubcategoryValue = e.target.value;
    renderMenu();
  });

  filterTypeSelect?.addEventListener("change", e => {
    filterType = e.target.value;
    renderMenu();
  });

  searchInput?.addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase();
    renderMenu();
  });
}

/* =========================
   TARJIMALAR VA SAHIFA HOLATI
========================= */
function applyClientPageTranslations() {
  document.title = t("client_document_title", `NestaCRM — ${t("client_page_title")}`);

  const rawStatus = getOrderStatusKey(activeOrderData || {});

  if (activeOrderData?.readyAt) {
    updateHeaderReadyInfo(activeOrderData.readyAt);

    if (!shouldRunCountdownByStatus(rawStatus) && headerReadyCountdown) {
      headerReadyCountdown.innerText =
        t("waiting_chef_start", "Oshpaz boshlashi kutilmoqda");
      headerReadyCountdown.style.color = "#64748b";
    }
  } else {
    clearHeaderReadyInfo();
  }
}

/* =========================
   BUYURTMA HOLATINI TIKLASH 
========================= */
async function restoreSubmittedOrderState() {
  const savedActiveOrderId = localStorage.getItem("activeOrderId");
  const savedTable = String(localStorage.getItem("table") || "").trim();
  const statusBox = document.getElementById("orderStatusBox");

  if (!savedActiveOrderId) {
    resetClientSession();
    return;
  }

  try {
    const snap = await get(ref(db, BASE_PATH + "/orders/" + savedActiveOrderId));

    if (!snap.exists()) {
      resetClientSession();
      return;
    }

    const order = snap.val();
    const rawStatus = getOrderStatusKey(order);

    const orderClientId = String(order.clientId || "").trim();
    const myClientId = String(clientId || "").trim();
    const orderTable = String(order.table || "").trim();
    const clientMatch = orderClientId === myClientId;
    const tableMatch = !savedTable || orderTable === savedTable;
    const isMine = clientMatch && tableMatch;

    const isAlive = !["yopildi", "bekor qilindi", "closed", "cancelled"].includes(normalizeStatus(rawStatus));

    if (!isMine || !isAlive || order.tableClosed === true) {
      resetClientSession();
      return;
    }

    if (orderTable && !savedTable) {
      localStorage.setItem("table", orderTable);
      localStorage.setItem("confirmedTable", orderTable);
      confirmedTableNumber = orderTable;
      const tInp = document.getElementById("tableInput");
      if (tInp) tInp.value = orderTable;
    }

    if (order.expectedReadyAt || order.readyAt) startHeaderCountdown(order.expectedReadyAt || order.readyAt);

    currentOrderId = savedActiveOrderId;
    activeOrderData = { ...order, _id: savedActiveOrderId };
    hasSubmittedOrder = true;
    // sessionStorage ni ham tiklaymiz — sahifa yangilanganida ham ishlaydi
    sessionStorage.setItem("client_has_submitted_order", "1");

    updateStatusUI(rawStatus);

  } catch (err) {
    console.error("restoreSubmittedOrderState error:", err);
    if (statusBox) statusBox.style.display = "none";
  }
}

/* =========================
   CHAT VA YORDAMCHI FUNKSIYALAR 
========================= */
let activeClientChatPath = "";
let stopClientChatListener = null;
let activeClientChatOrderId = "";
let pendingClientQuickReplyKey = "";

function normalizeCustomerPhone(phone = "") {
  let cleaned = String(phone || "").replace(/\D/g, "");

  if (!cleaned) return "";

  if (cleaned.length === 12 && cleaned.startsWith("998")) {
    return "+" + cleaned;
  }
  if (cleaned.length === 9) {
    return "+998" + cleaned;
  }
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return "+998" + cleaned.slice(1);
  }

  return "+" + cleaned;
}

function normalizeCustomerMemoryList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|[,;]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function uniqueCustomerMemory(values = []) {
  const seen = new Set();
  return values.filter(item => {
    const normalized = String(item || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getClientChatQuickReply(key = "") {
  return CLIENT_CHAT_QUICK_REPLY_CONFIG.find(item => item.key === key) || null;
}

function setActiveClientQuickReply(key = "") {
  pendingClientQuickReplyKey = key || "";
  if (!clientChatQuickReplies) return;

  clientChatQuickReplies.querySelectorAll("[data-quick-reply-key]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.quickReplyKey === pendingClientQuickReplyKey);
  });
}

function ensureClientChatQuickReplyStyles() {
  if (document.getElementById("clientChatQuickReplyStyles")) return;

  const style = document.createElement("style");
  style.id = "clientChatQuickReplyStyles";
  style.textContent = `
    #clientChatQuickReplies {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0 12px;
    }
    #clientChatQuickReplies .client-chat-chip {
      border: 1px solid #ffd9d9;
      background: #fff5f5;
      color: #b42318;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      box-shadow: 0 6px 16px rgba(180, 35, 24, 0.08);
    }
    #clientChatQuickReplies .client-chat-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(180, 35, 24, 0.16);
    }
    #clientChatQuickReplies .client-chat-chip.active {
      background: linear-gradient(135deg, #ff5a5f, #d62828);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 12px 26px rgba(214, 40, 40, 0.28);
    }
  `;

  document.head.appendChild(style);
}

function renderClientChatQuickReplies() {
  if (!clientChatQuickReplies) return;

  clientChatQuickReplies.innerHTML = CLIENT_CHAT_QUICK_REPLY_CONFIG.map(item => `
    <button
      type="button"
      class="client-chat-chip ${item.key === pendingClientQuickReplyKey ? "active" : ""}"
      data-quick-reply-key="${item.key}"
    >
      ${escapeHTML(item.label)}
    </button>
  `).join("");

  clientChatQuickReplies.querySelectorAll("[data-quick-reply-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      const quickReply = getClientChatQuickReply(btn.dataset.quickReplyKey || "");
      if (!quickReply || !clientChatInput) return;

      setActiveClientQuickReply(quickReply.key);
      clientChatInput.value = quickReply.template;
      clientChatInput.focus();
      clientChatInput.setSelectionRange(clientChatInput.value.length, clientChatInput.value.length);
    });
  });
}

function ensureClientChatQuickReplies() {
  ensureClientChatQuickReplyStyles();
  if (!clientChatModal || clientChatQuickReplies) {
    renderClientChatQuickReplies();
    return;
  }

  const inputRow = clientChatModal.querySelector(".client-chat-input-row");
  if (!inputRow) return;

  clientChatQuickReplies = document.createElement("div");
  clientChatQuickReplies.id = "clientChatQuickReplies";
  inputRow.parentNode.insertBefore(clientChatQuickReplies, inputRow);
  renderClientChatQuickReplies();
}

function getCurrentClientPhoneNumber(order = null) {
  const fromOrder = normalizeCustomerPhone(
    order?.phoneNumber ||
    order?.customerPhone ||
    order?.clientPhone ||
    activeOrderData?.phoneNumber ||
    activeOrderData?.customerPhone ||
    activeOrderData?.clientPhone ||
    ""
  );

  if (fromOrder) return fromOrder;

  return normalizeCustomerPhone(
    localStorage.getItem("customerPhone") ||
    localStorage.getItem("userPhone") ||
    document.getElementById("clientPhoneInput")?.value ||
    ""
  );
}

function isAllergyMessage(text = "") {
  return /(аллерг|allerg|allergy)/i.test(String(text || ""));
}

function extractAllergyMemory(text = "") {
  const rawText = String(text || "").trim();
  const cleaned = rawText
    .replace(/^у\s+меня\s+аллергия\s+на\s*/i, "")
    .replace(/^аллергия\s*(на)?\s*/i, "")
    .replace(/^allergy\s*(to)?\s*/i, "")
    .replace(/^allergiya\s*(ga|na)?\s*/i, "")
    .trim();

  return cleaned || rawText;
}

async function saveCustomerChatMemory(text, order) {
  const quickReply = getClientChatQuickReply(pendingClientQuickReplyKey);
  const phone = getCurrentClientPhoneNumber(order);
  const messageText = String(text || "").trim();

  if (!phone || !messageText) {
    setActiveClientQuickReply("");
    return;
  }

  await saveCustomerToDatabase(phone);
  const customerRef = ref(db, `${BASE_PATH}/customers/${phone}`);
  const snap = await get(customerRef);
  const customerData = snap.exists() ? (snap.val() || {}) : {};
  const patch = {
    phone,
    updatedAt: Date.now(),
    memoryUpdatedAt: Date.now()
  };

  if (!snap.exists()) {
    patch.visits = Number(customerData.visits || 0);
    patch.totalSpent = Number(customerData.totalSpent || 0);
    patch.personalDiscount = Number(customerData.personalDiscount || 0);
    patch.createdAt = customerData.createdAt || Date.now();
  }

  let shouldUpdateCustomer = false;

  if (quickReply?.kind === "allergy" || isAllergyMessage(messageText)) {
    const nextAllergy = extractAllergyMemory(messageText);
    const allergies = uniqueCustomerMemory([
      ...normalizeCustomerMemoryList(customerData.allergies),
      nextAllergy
    ]);

    if (allergies.length) {
      patch.allergies = allergies;
      shouldUpdateCustomer = true;
      if (currentOrderId) {
        await update(ref(db, `${BASE_PATH}/orders/${currentOrderId}`), {
          allergyNote: allergies.join(", "),
          updatedAt: Date.now()
        });
      }
    }
  }

  if (quickReply?.kind === "preference") {
    const preferences = uniqueCustomerMemory([
      ...normalizeCustomerMemoryList(customerData.preferences),
      messageText
    ]);

    if (preferences.length) {
      patch.preferences = preferences;
      shouldUpdateCustomer = true;
    }
  }

  if (shouldUpdateCustomer) {
    await update(customerRef, patch);
  }

  setActiveClientQuickReply("");
}

function stopClientChatRealtime() {
  if (stopClientChatListener) {
    stopClientChatListener();
    stopClientChatListener = null;
  }
  activeClientChatPath = "";
  activeClientChatOrderId = "";
}

function startClientChatRealtime(order) {
  if (!order || !order._id) return;

  const orderId = String(order._id).trim();
  const chefId = String(order.chefId || "").trim();

  if (!orderId || !chefId) return;

  const nextPath = `${BASE_PATH}/orderChats/${orderId}/chef`;

  if (
    activeClientChatOrderId === orderId &&
    activeClientChatPath === nextPath &&
    stopClientChatListener
  ) {
    return;
  }

  stopClientChatRealtime();

  activeClientChatOrderId = orderId;
  activeClientChatPath = nextPath;

  stopClientChatListener = onValue(
    ref(db, `${nextPath}/messages`),
    snap => {
      renderClientChatMessages(snap.val() || {});
    }
  );
}

function initClientChat() {
  if (!chatFab || !clientChatModal) return;

  ensureClientChatQuickReplies();

  chatFab.addEventListener("click", async () => {
    if (!currentOrderId) {
      alert(t("place_order_first"));
      return;
    }

    clientChatModal.style.display = "flex";
    await openClientChefChat();
  });

  clientChatSendBtn?.addEventListener("click", sendClientMessageToChef);

  clientChatInput?.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      e.preventDefault();
      await sendClientMessageToChef();
    }
  });

  clientChatInput?.addEventListener("input", () => {
    if (!clientChatInput?.value.trim()) {
      setActiveClientQuickReply("");
    }
  });

  clientChatModal.addEventListener("click", e => {
    if (e.target.id === "clientChatModal") {
      closeClientChat();
    }
  });
}

async function openClientChefChat() {
  const order = await getActiveOrderFresh();

  if (!order) {
    alert(t("active_order_not_found"));
    return;
  }

  if (!canClientAccessOrder(order)) {
    alert(t("own_order_only_chat"));
    return;
  }

  const chefId = String(order.chefId || "").trim();

  if (!chefId) {
    alert(t("chef_not_assigned"));
    return;
  }

  let chefName = getChefDefaultName();
  const chefSnap = await get(ref(db, BASE_PATH + "/users/" + chefId));
  if (chefSnap.exists()) {
    chefName = chefSnap.val()?.name || chefName;
  }

  activeClientChatPath = `${BASE_PATH}/orderChats/${currentOrderId}/chef`;

  if (clientChatInfo) {
    clientChatInfo.innerHTML = `
  <b>👨‍🍳 ${escapeHTML(chefName)}</b><br>
  ${t("order_label")} #${order.orderNumber || "-"} | ${t("table_label")} ${order.table || "-"}
`;
  }

  await update(ref(db, activeClientChatPath + "/meta"), {
    orderId: currentOrderId,
    orderNumber: order.orderNumber || null,
    table: order.table || null,
    clientId,
    targetId: chefId,
    targetRole: "chef",
    chefName,
    updatedAt: Date.now(),
    status: "open"
  });

  // ✅ Agar buyurtmada allergyNote bo'lsa va hali yuborilmagan bo'lsa — oshpazga avto-xabar
  const allergyNote = order.allergyNote || "";
  const allergyAlreadySent = localStorage.getItem(`allergyMsgSent_${currentOrderId}`);
  if (allergyNote && !allergyAlreadySent) {
    await push(ref(db, activeClientChatPath + "/messages"), {
      text: `⚠️ Maxsus so'rov: ${allergyNote}`,
      senderId: clientId,
      senderRole: "client",
      senderName: getClientSenderName(order.table),
      orderId: currentOrderId,
      table: order.table || null,
      createdAt: Date.now(),
      isAutoAllergyMsg: true
    });
    localStorage.setItem(`allergyMsgSent_${currentOrderId}`, "1");
  }

  startClientChatRealtime(order);
}

function renderClientChatMessages(messagesObj) {
  if (!clientChatMessages) return;

  const arr = Object.values(messagesObj || {})
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  if (!arr.length) {
    clientChatMessages.innerHTML =
      `<div class="client-chat-empty">${t("no_messages_yet")}</div>`;
    return;
  }

  clientChatMessages.innerHTML = arr.map(msg => {
    const mine = msg.senderRole === "client";
    const sender =
      msg.senderRole === "chef"
        ? `👨‍🍳 ${escapeHTML(msg.senderName || t("chef_label"))}`
        : escapeHTML(msg.senderName || t("client_label"));

    return `
      <div class="client-chat-msg ${mine ? "mine" : "theirs"}">
        <div>${escapeHTML(msg.text || "")}</div>
        <div class="client-chat-meta">
          ${sender} • ${formatChatTime(msg.createdAt)}
        </div>
      </div>
    `;
  }).join("");

  clientChatMessages.scrollTop = clientChatMessages.scrollHeight;
}

async function sendClientMessageToChef() {
  const text = clientChatInput?.value.trim();
  if (!text) return;

  const order = await getActiveOrderFresh();
  if (!order || !canClientAccessOrder(order)) {
    alert(t("chat_not_yours"));
    return;
  }

  if (!activeClientChatPath) {
    await openClientChefChat();
    if (!activeClientChatPath) return;
  }

  await push(ref(db, activeClientChatPath + "/messages"), {
    text,
    senderId: clientId,
    senderRole: "client",
    senderName: getClientSenderName(order.table),
    orderId: currentOrderId,
    table: order.table || null,
    createdAt: Date.now()
  });

  await update(ref(db, activeClientChatPath + "/meta"), {
    orderId: currentOrderId,
    orderNumber: order.orderNumber || null,
    table: order.table || null,
    clientId,
    targetId: order.chefId || null,
    targetRole: "chef",
    lastMessage: text,
    lastSenderRole: "client",
    updatedAt: Date.now(),
    status: "open"
  });

  await update(ref(db, BASE_PATH + "/orders/" + currentOrderId), {
    lastClientMessage: text,
    lastClientMessageAt: Date.now()
  });

  try {
    await saveCustomerChatMemory(text, order);
  } catch (error) {
    console.error("Client chat memory save error:", error);
  }

  clientChatInput.value = "";
  setActiveClientQuickReply("");
}

function closeClientChat(force = false) {
  if (clientChatModal) {
    clientChatModal.style.display = "none";
  }
  if (clientChatInput) clientChatInput.value = "";
  setActiveClientQuickReply("");
  if (force) {
    stopClientChatRealtime();
  }
}

function canClientAccessOrder(order) {
  const myTable = String(localStorage.getItem("table") || tableNumber || "").trim();
  const myClientId = String(clientId || "").trim();

  if (!order) return false;

  return (
    String(order.clientId || "").trim() === myClientId &&
    String(order.table || "").trim() === myTable &&
    String(currentOrderId || "").trim() === String(order._id || currentOrderId || "").trim()
  );
}

function formatChatTime(ts) {
  const d = new Date(ts || Date.now());
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function getActiveOrderFresh() {
  if (!currentOrderId) return null;

  if (activeOrderData?._id === currentOrderId) {
    if (!canClientAccessOrder(activeOrderData)) return null;
    return activeOrderData;
  }

  const snap = await get(ref(db, BASE_PATH + "/orders/" + currentOrderId));
  if (!snap.exists()) return null;

  const order = {
    ...snap.val(),
    _id: currentOrderId
  };

  if (!canClientAccessOrder(order)) return null;

  return order;
}

function escapeHTML(str = "") {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function getClientSenderName(table) {
  return `${t("client_label")} (${t("table_label")} ${table || "-"})`;
}

function getChefDefaultName() {
  return t("chef_label");
}

function shouldRunCountdownByStatus(status) {
  const s = normalizeStatus(status);
  return s === "tayyorlanmoqda" || s === "cooking";
}

function playNotificationSound() {
  const audio = new Audio("/img/notify.wav");
  audio.play().catch(() => { });
}

/* =========================
   CART LOGIC
========================= */
function getMaxQtyByStock(menuId) {
  const menu = window.allMenu && (window.allMenu[menuId] || window.allMenu[String(menuId)]);
  if (!menu) return Infinity;

  const recipe = Array.isArray(menu.recipe) ? menu.recipe : (menu.recipe ? Object.values(menu.recipe) : []);
  if (!recipe || recipe.length === 0) return Infinity;

  const inv = window.allInventory || {};
  let maxQty = Infinity;

  for (const ing of recipe) {
    const ingId = ing.id;
    const needed = Number(ing.amount || 0);
    const recipeUnit = ing.unit || "gr";
    if (!ingId || needed <= 0) continue;

    const invData = inv[ingId];
    if (!invData) continue;

    let currentStock = parseFloat(invData.stock ?? 0);
    const stockUnit = invData.unit || "gr";

    const toGrams = (val, unit) => {
      if (unit === "kg") return val * 1000;
      if (unit === "l") return val * 1000;
      return val;
    };

    const stockInBase = toGrams(currentStock, stockUnit);
    const neededInBase = toGrams(needed, recipeUnit);

    const possible = Math.floor(stockInBase / neededInBase);
    if (possible < maxQty) maxQty = possible;
  }

  return maxQty === Infinity ? Infinity : maxQty;
}

function changeQty(id, delta) {

  try {

    id = String(id);

    console.log(
      "🖱 CLICK:",
      id,
      delta
    );

    // INIT
    if (
      !window.cart ||
      typeof window.cart !== "object"
    ) {
      window.cart = {};
    }

    const cart = window.cart;

    // Faqat miqdor oshirilayotganda tekshirish
    if (delta > 0) {
      const currentQty = Number(cart[id]?.qty || 0);
      const newQty = currentQty + Number(delta);

      // Masalliq zaxirasini tekshirish
      const maxAllowed = getMaxQtyByStock(id);

      if (maxAllowed !== Infinity && newQty > maxAllowed) {
        if (maxAllowed <= 0) {
          // Masalliq tugagan
          const menuItem = window.allMenu && (window.allMenu[id] || window.allMenu[String(id)]);
          const name = menuItem
            ? (typeof menuItem.name === "object"
              ? (menuItem.name.uz || menuItem.name.ru || menuItem.name.en || "Taom")
              : (menuItem.name || "Taom"))
            : "Taom";
          const msg = typeof t === "function"
            ? t("stock_out_cant_order", `"${name}" uchun masalliq tugagan, buyurtma berib bo'lmaydi.`).replace("{name}", name)
            : `"${name}" uchun masalliq tugagan, buyurtma berib bo'lmaydi.`;
          alert(msg);
          return;
        } else {
          // Yetarli masalliq faqat maxAllowed ta uchun
          const menuItem = window.allMenu && (window.allMenu[id] || window.allMenu[String(id)]);
          const name = menuItem
            ? (typeof menuItem.name === "object"
              ? (menuItem.name.uz || menuItem.name.ru || menuItem.name.en || "Taom")
              : (menuItem.name || "Taom"))
            : "Taom";
          const msg = typeof t === "function"
            ? t("stock_limited_order", `Siz faqat ${maxAllowed} ta buyurtma bera olasiz (masalliq yetarli emas).`)
              .replace("{max}", maxAllowed)
              .replace("{name}", name)
            : `Siz faqat ${maxAllowed} ta "${name}" buyurtma bera olasiz (masalliq yetarli emas).`;
          alert(msg);

          // Maksimal ruxsat etilgan miqdorga o'rnatamiz
          if (!cart[id]) cart[id] = { qty: 0 };
          cart[id].qty = maxAllowed;

          window.cart = cart;
          localStorage.setItem("cart", JSON.stringify(cart));

          if (typeof updateCart === "function") updateCart();
          if (typeof renderCart === "function") renderCart();
          if (typeof renderMenu === "function") renderMenu();
          return;
        }
      }
    }

    // CREATE ITEM
    if (!cart[id]) {

      cart[id] = {
        qty: 0
      };
    }

    // UPDATE QTY
    cart[id].qty += Number(delta);

    // REMOVE IF 0
    if (cart[id].qty <= 0) {
      delete cart[id];
    }

    // SAVE
    window.cart = cart;

    localStorage.setItem(
      "cart",
      JSON.stringify(cart)
    );

    console.log(
      "✅ UPDATED CART:",
      cart
    );

    console.log(
      "💾 LOCALSTORAGE:",
      localStorage.getItem("cart")
    );

    // UI UPDATE
    if (
      typeof updateCart === "function"
    ) {
      updateCart();
    }

    if (
      typeof renderCart === "function"
    ) {
      renderCart();
    }

    if (
      typeof renderMenu === "function"
    ) {
      renderMenu();
    }

  } catch (err) {

    console.error(
      "❌ changeQty ERROR:",
      err
    );
  }
}

window.changeQty = changeQty;

function removeFromCart(id) {

  id = String(id);

  delete cart[id];

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

  updateCart();

  if (typeof renderMenu === "function") {
    renderMenu();
  }
}

window.removeFromCart = removeFromCart;

function updateCart() {
  if (!cartItems || !cartTotal || !cartCount) return;

  // ── Savat CSS (bir marta inject) ──────────────────────────────
  if (!document.getElementById("_cartCardStyles")) {
    const s = document.createElement("style");
    s.id = "_cartCardStyles";
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');

      /* ══════════════════════════════════════════
         NestaCRM — Savat karta (v3 — screenshot match)
         Uses CSS variables from client.css
         ══════════════════════════════════════════ */

      .nc-cart-empty {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 12px; padding: 48px 20px;
        color: var(--text-muted); font-size: 15px; font-weight: 500; text-align: center;
      }
      .nc-cart-empty-icon { font-size: 56px; line-height: 1; }

      /* ── Karta asosi ── */
      .nc-cart-card {
        background: #ffffff;
        border: 1.5px solid rgba(34,197,94,0.15);
        border-radius: 18px;
        margin-bottom: 12px;
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        transition: box-shadow .22s, transform .18s;
      }
      .nc-cart-card:last-child { margin-bottom: 0; }
      .nc-cart-card:hover {
        box-shadow: 0 6px 20px rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
        transform: translateY(-1px);
      }

      /* ── Karta ichki: rasm chap, kontent o'ng ── */
      .nc-cart-card-top {
        display: grid;
        grid-template-columns: 110px 1fr;
        align-items: stretch;
        min-height: 110px;
      }
      @media (max-width: 400px) {
        .nc-cart-card-top { grid-template-columns: 88px 1fr; }
        .nc-cart-img-wrap { width: 88px; }
        .nc-cart-img, .nc-cart-img-placeholder { width: 88px; height: 88px; }
      }

      /* Rasm ustuni */
      .nc-cart-img-wrap {
        width: 110px;
        min-width: 110px;
        flex-shrink: 0;
        overflow: hidden;
        align-self: stretch;
        display: block;
        position: relative;
      }
      .nc-cart-img {
        width: 110px;
        height: 110px;
        object-fit: cover;
        display: block;
      }
      .nc-cart-img-placeholder {
        width: 110px;
        height: 110px;
        display: flex; align-items: center; justify-content: center;
        font-size: 38px;
        background: linear-gradient(140deg, #f0fdf4, #dcfce7);
      }

      /* Kontent bloki (o'ng tomon) */
      .nc-cart-body {
        padding: 12px 14px 10px 13px;
        display: flex; flex-direction: column; gap: 6px; min-width: 0;
      }

      /* Nom + O'chirish qatori */
      .nc-cart-top {
        display: flex; align-items: flex-start;
        justify-content: space-between; gap: 6px;
      }
      .nc-cart-name {
        font-family: 'Sora', sans-serif;
        font-size: 15px; font-weight: 800;
        color: #1a2e1a; line-height: 1.3; flex: 1;
        overflow: hidden; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      .nc-cart-del {
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.18);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0;
        transition: background .15s, transform .15s;
        font-size: 12px; line-height: 1; color: rgba(239,68,68,0.65);
      }
      .nc-cart-del:hover { background: rgba(239,68,68,0.14); color: #ef4444; transform: scale(1.12); }
      .nc-cart-del:active { transform: scale(0.9); }

      /* Kategoriya nishonlari */
      .nc-cart-cats { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
      .nc-cat-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11px; font-weight: 600;
        padding: 3px 10px; border-radius: 20px; white-space: nowrap;
      }
      .nc-cat-badge.cat {
        background: #f0fdf4; color: #15803d;
        border: 1.5px solid rgba(34,197,94,0.25);
      }
      .nc-cat-badge.sub {
        background: #eff6ff; color: #1d4ed8;
        border: 1.5px solid rgba(59,130,246,0.25);
      }

      /* Allergen teglari */
      .nc-cart-props { display: flex; flex-wrap: wrap; gap: 5px; }
      .nc-prop-tag {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 10.5px; font-weight: 600;
        padding: 3px 9px; border-radius: 30px;
        background: #fff7ed; color: #c2410c;
        border: 1.5px solid #fed7aa; white-space: nowrap;
      }

      /* ── Ajratgich + footer: narx & qty bir qatorda ── */
      .nc-cart-divider {
        height: 1px;
        background: rgba(34,197,94,0.12);
        margin: 0;
      }
      .nc-cart-footer {
        display: flex; align-items: center;
        justify-content: space-between; gap: 10px;
        padding: 9px 14px 11px 13px;
        background: transparent;
      }

      /* Narx bloki */
      .nc-price-wrap { text-align: left; }
      .nc-cart-price-main {
        font-family: 'Sora', sans-serif;
        font-size: 17px; font-weight: 900;
        color: #15803d; white-space: nowrap; line-height: 1.2;
      }
      .nc-cart-price-currency {
        font-size: 12px; font-weight: 700; color: #15803d;
      }
      .nc-cart-price-unit {
        font-size: 11.5px; color: #9ca3af;
        font-weight: 500; white-space: nowrap; margin-top: 1px;
      }

      /* Qty +/- tugmalari — footerda */
      .nc-cart-qty-row {
        display: flex; align-items: center; gap: 0;
        background: #f3f4f6;
        border-radius: 12px;
        padding: 3px;
        flex-shrink: 0;
      }
      .nc-cart-qty-btn {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: #ffffff;
        border: 1.5px solid rgba(34,197,94,0.25);
        border-radius: 9px;
        color: #15803d; font-size: 20px; font-weight: 700;
        cursor: pointer; line-height: 1; flex-shrink: 0;
        transition: background .15s, border-color .15s, transform .12s;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      }
      .nc-cart-qty-btn:hover { background: #f0fdf4; border-color: #22c55e; }
      .nc-cart-qty-btn:active { background: #dcfce7; transform: scale(0.9); }
      .nc-cart-qty-num {
        font-family: 'Sora', sans-serif;
        font-size: 15px; font-weight: 900;
        color: #1a2e1a; user-select: none;
        min-width: 28px; text-align: center;
      }
    `;
    document.head.appendChild(s);
  }

  let htmlContent = "";
  let total = 0;
  let count = 0;
  const lang = getLang();

  const PROP_ICONS = {
    "spicy": "🌶️", "achchiq": "🌶️", "no-spicy": "🌶️", "achchiqsiz": "🌶️",
    "vegan": "🥗", "vegetarian": "🥗",
    "gluten": "🌾", "gluten-free": "🌾",
    "dairy": "🥛", "sut": "🥛", "no-dairy": "🥛",
    "nut": "🥜", "yongoq": "🥜",
    "halal": "☪️", "kosher": "✡️",
    "tuzsiz": "🧂", "kam-tuzli": "🧂",
    "piyozsiz": "🧅", "kokatsiz": "🌿", "yogsiz": "🫙",
  };

  function getPropIcon(tag) {
    const k = String(tag).toLowerCase().replace(/\s+/g, "-");
    for (const [key, ico] of Object.entries(PROP_ICONS)) {
      if (k.includes(key)) return ico;
    }
    return "⚠️";
  }

  const entries = Object.entries(cart);

  if (entries.length === 0) {
    htmlContent = `
      <div class="nc-cart-empty">
        <span>🛒</span>
        <div>${t("cart_empty", "Savat bo\'sh")}</div>
      </div>`;
  }

  entries.forEach(([id, c]) => {
    const m = allMenu[id] || allMenu[String(id)] || allMenu[Number(id)];
    if (!m) return;

    const name = m.name?.[lang] || m.name?.uz || m.name?.ru || m.name?.en || "—";
    const price = Number(m.price || 0);
    const qty = Number(c.qty || 0);
    const sum = price * qty;
    const imgSrc = m.imgUrl || m.img || m.image || "";

    total += sum;
    count += qty;

    // Kategoriya nomi (CATEGORY_DATA dan olish)
    const safeCategories = (typeof CATEGORY_DATA !== "undefined" && CATEGORY_DATA.categories)
      ? CATEGORY_DATA.categories : [];
    const catObj = safeCategories.find(cc => String(cc.id) === String(m.category));
    const catName = catObj
      ? (typeof t === "function" ? t(catObj.nameKey) : catObj.nameKey)
      : (m.category || "");
    const subName = m.subcategory
      ? (typeof t === "function" ? t(m.subcategory) || m.subcategory : m.subcategory)
      : "";

    // Kategoriya nishonlari
    const catBadges = [
      catName ? `<span class="nc-cat-badge cat">📂 ${catName}</span>` : "",
      subName ? `<span class="nc-cat-badge sub">🏷 ${subName}</span>` : "",
    ].join("");

    // Allergen/xususiyat teglari
    const allergens = Array.isArray(m.allergens) ? m.allergens
      : (m.allergens && typeof m.allergens === "object" ? Object.values(m.allergens) : []);
    const tags = Array.isArray(m.tags) ? m.tags
      : (m.tags && typeof m.tags === "object" ? Object.values(m.tags) : []);
    const allProps = [...allergens, ...tags].filter(Boolean);
    const propHtml = allProps.length > 0
      ? `<div class="nc-cart-props">${allProps.map(p =>
        `<span class="nc-prop-tag">${getPropIcon(p)} ${p}</span>`
      ).join("")}</div>`
      : "";

    htmlContent += `
      <div class="nc-cart-card">

        <div class="nc-cart-card-top">
          <div class="nc-cart-img-wrap">
            ${imgSrc
        ? `<img class="nc-cart-img" src="${imgSrc}" alt="${name}" onerror="this.outerHTML='<div class=\\'nc-cart-img-placeholder\\'>🍽️</div>'">`
        : `<div class="nc-cart-img-placeholder">🍽️</div>`
      }
          </div>
          <div class="nc-cart-body">
            <div class="nc-cart-top">
              <span class="nc-cart-name">${name}</span>
              <button class="nc-cart-del" onclick="removeFromCart('${id}')">✕</button>
            </div>
            ${catBadges ? `<div class="nc-cart-cats">${catBadges}</div>` : ""}
            ${propHtml}
          </div>
        </div>

        <div class="nc-cart-divider"></div>

        <div class="nc-cart-footer">
          <div class="nc-price-wrap">
            <div class="nc-cart-price-main">${sum.toLocaleString()} <span class="nc-cart-price-currency">${t("currency", "so'm")}</span></div>
            <div class="nc-cart-price-unit">${price.toLocaleString()} × ${qty}</div>
          </div>
          <div class="nc-cart-qty-row">
            <button class="nc-cart-qty-btn" onclick="changeQty('${id}',-1)">−</button>
            <span class="nc-cart-qty-num">${qty}</span>
            <button class="nc-cart-qty-btn" onclick="changeQty('${id}',1)">+</button>
          </div>
        </div>

      </div>
    `;
  });

  cartItems.innerHTML = htmlContent;

  const baseCookTime = calculateOrderCookTime(cart);
  currentBaseCookTime = baseCookTime;

  const result = calculatePriority(total, baseCookTime);
  cartTotal.innerText = result.finalTotal.toLocaleString();
  cartCount.innerText = count;

  const badge = document.getElementById("cartCount");
  if (badge) badge.style.display = count > 0 ? "flex" : "none";
}


window.allMenu = {};
let allMenu = window.allMenu;

function subscribeMenuRealtime() {

  onValue(
    ref(db, BASE_PATH + "/menu"),
    snap => {

      const data =
        snap.val() || {};

      window.allMenu = data;
      allMenu = data;

      console.log(
        "✅ MENU UPDATED:",
        allMenu
      );

      safeRenderMenu();

      updateCart();
    }
  );
}

// ---- Inventory (masalliqlar zaxirasi) real-time tinglash ----
function subscribeInventoryRealtime() {
  if (!window.allInventory) window.allInventory = {};

  onValue(
    ref(db, BASE_PATH + "/inventory"),
    snap => {
      window.allInventory = snap.val() || {};
      // Menyu qayta renderlanmaydi, faqat xotira yangilanadi
      console.log("✅ INVENTORY UPDATED:", Object.keys(window.allInventory).length, "masalliq");
    }
  );
}

let renderLock = false;

function safeRenderMenu() {

  if (renderLock) return;

  renderLock = true;

  requestAnimationFrame(() => {

    if (
      typeof renderMenu ===
      "function"
    ) {

      renderMenu();
    }

    renderLock = false;
  });
}

/* =========================
   ORDER PLACEMENT
========================= */
async function createClientTimelineEvent(orderId, eventMessage) {
  const timelineRef = ref(db, `${BASE_PATH}/orderTimeline/${orderId}`);
  const newEvent = {
    orderId: orderId,
    eventType: "client_action",
    payload: { message: eventMessage },
    actorId: clientId,
    actorName: t("client_label", "Mijoz"),
    actorRole: "client",
    createdAt: Date.now()
  };
  await push(timelineRef, newEvent);
}

window.currentRewardNote = "";
window.currentRewardDiscount = 0;

/* =========================
   BUYURTMA YUBORISH 
========================= */
/* =========================
   ALLERGIYA / OVQAT XUSUSIYATI MODALI
========================= */
window.__clientAllergyModalResolve = null;

window.openAllergyModal = function () {
  return new Promise((resolve) => {
    window.__clientAllergyModalResolve = resolve;

    let modal = document.getElementById("clientAllergyModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "clientAllergyModal";
      modal.innerHTML = `
        <style>
          #clientAllergyModal {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: flex-end; justify-content: center;
            animation: fadeInAllergy 0.2s ease;
          }
          @keyframes fadeInAllergy { from { opacity: 0 } to { opacity: 1 } }
          #clientAllergyBox {
            background: #fff; width: 100%; max-width: 480px;
            border-radius: 20px 20px 0 0;
            padding: 24px 20px 32px;
            animation: slideUpAllergy 0.3s ease;
          }
          @keyframes slideUpAllergy { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          #clientAllergyBox h3 {
            margin: 0 0 6px; font-size: 17px; font-weight: 700; color: #111;
          }
          #clientAllergyBox p {
            margin: 0 0 16px; font-size: 13px; color: #666;
          }
          .allergy-chips {
            display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;
          }
          .allergy-chip {
            padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
            border: 2px solid #e0e0e0; background: #f5f5f5; cursor: pointer;
            transition: all 0.2s; user-select: none;
          }
          .allergy-chip.selected {
            border-color: #168a5f; background: #e7f6ef; color: #168a5f;
          }
          .allergy-custom-row {
            display: flex; gap: 8px; margin-bottom: 18px;
          }
          #allergyCustomInput {
            flex: 1; padding: 10px 14px; border: 1.5px solid #ddd; border-radius: 12px;
            font-size: 14px; outline: none; font-family: inherit;
          }
          #allergyCustomInput:focus { border-color: #168a5f; }
          .allergy-custom-add {
            padding: 10px 14px; background: #168a5f; color: white; border: none;
            border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600;
          }
          .allergy-actions {
            display: flex; gap: 10px;
          }
          .allergy-skip-btn {
            flex: 1; padding: 13px; border: 1.5px solid #ddd; background: #f5f5f5;
            border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;
          }
          .allergy-confirm-btn {
            flex: 2; padding: 13px; background: linear-gradient(135deg, #168a5f, #0f6f4d);
            color: white; border: none; border-radius: 12px;
            font-size: 14px; font-weight: 700; cursor: pointer;
          }
          .allergy-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; min-height: 0; }
          .allergy-tag {
            background: #168a5f; color: white; padding: 4px 10px 4px 12px;
            border-radius: 20px; font-size: 12px; display: flex; align-items: center; gap: 6px;
          }
          .allergy-tag-remove { cursor: pointer; font-size: 14px; line-height: 1; }
        </style>
        <div id="clientAllergyBox">
          <h3>🍽️ ${t('special_requests_title', "Maxsus so\'rovlar")}</h3>
          <p>${t('special_requests_desc', 'Ovqat xususiyatlarini belgilang (ixtiyoriy)')}</p>

          <div class="allergy-chips">
            <div class="allergy-chip" data-value="${t('chip_no_salt', 'Tuzsiz')}">🧂 ${t('chip_no_salt', 'Tuzsiz')}</div>
            <div class="allergy-chip" data-value="${t('chip_low_salt', 'Kam tuzli')}">🧂 ${t('chip_low_salt', 'Kam tuzli')}</div>
            <div class="allergy-chip" data-value="${t('chip_no_spicy', 'Achchiqsiz')}">🌶️ ${t('chip_no_spicy', 'Achchiqsiz')}</div>
            <div class="allergy-chip" data-value="${t('chip_spicy', 'Achchiq')}">🌶️ ${t('chip_spicy', 'Achchiq')}</div>
            <div class="allergy-chip" data-value="${t('chip_no_onion', 'Piyozsiz')}">🧅 ${t('chip_no_onion', 'Piyozsiz')}</div>
            <div class="allergy-chip" data-value="${t('chip_no_greens', "Ko\'katsiz")}">🌿 ${t('chip_no_greens', "Ko\'katsiz")}</div>
            <div class="allergy-chip" data-value="${t('chip_no_oil', "Yog\'siz")}">🫙 ${t('chip_no_oil', "Yog\'siz")}</div>
            <div class="allergy-chip" data-value="${t('chip_vegetarian', 'Vegetarian')}">🥗 ${t('chip_vegetarian', 'Vegetarian')}</div>
          </div>

          <div class="allergy-tags" id="allergyTagList"></div>

          <div class="allergy-custom-row">
            <input id="allergyCustomInput" type="text" placeholder="${t('allergy_custom_placeholder', "O\'zingiz yozing (masalan: sut allergiyasi)...")}" maxlength="80" />
            <button class="allergy-custom-add" id="allergyCustomAddBtn">+ ${t('allergy_add_btn', "Qo\'sh")}</button>
          </div>

          <div class="allergy-actions">
            <button class="allergy-skip-btn" id="allergySkipBtn">${t('allergy_skip_btn', "O\'tkazib yuborish")}</button>
            <button class="allergy-confirm-btn" id="allergyConfirmBtn">✅ ${t('order_button', 'Buyurtma berish')}</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // State
    const selectedTags = new Set();
    const tagListEl = modal.querySelector("#allergyTagList");
    const customInput = modal.querySelector("#allergyCustomInput");

    function renderTags() {
      tagListEl.innerHTML = [...selectedTags].map(v =>
        `<div class="allergy-tag">${v} <span class="allergy-tag-remove" data-val="${v}">×</span></div>`
      ).join("");
      tagListEl.querySelectorAll(".allergy-tag-remove").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedTags.delete(btn.dataset.val);
          // deselect chip if exists
          modal.querySelectorAll(".allergy-chip").forEach(c => {
            if (c.dataset.value === btn.dataset.val) c.classList.remove("selected");
          });
          renderTags();
        });
      });
    }

    // Chip clicks
    modal.querySelectorAll(".allergy-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const val = chip.dataset.value;
        if (chip.classList.contains("selected")) {
          chip.classList.remove("selected");
          selectedTags.delete(val);
        } else {
          chip.classList.add("selected");
          selectedTags.add(val);
        }
        renderTags();
      });
    });

    // Custom add
    modal.querySelector("#allergyCustomAddBtn").addEventListener("click", () => {
      const val = customInput.value.trim();
      if (!val) return;
      selectedTags.add(val);
      customInput.value = "";
      renderTags();
    });
    customInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const val = customInput.value.trim();
        if (!val) return;
        selectedTags.add(val);
        customInput.value = "";
        renderTags();
      }
    });

    // Skip
    modal.querySelector("#allergySkipBtn").addEventListener("click", () => {
      modal.remove();
      resolve("");
    });

    // Confirm
    modal.querySelector("#allergyConfirmBtn").addEventListener("click", () => {
      const note = [...selectedTags].join(", ");
      modal.remove();
      resolve(note);
    });

    modal.addEventListener("click", e => {
      if (e.target === modal) { modal.remove(); resolve(""); }
    });
  });
};

async function sendOrder() {
  const orderContext = { aborted: false };

  try {
    const clientId = localStorage.getItem("clientId") || "anonymous";

    const tableOk = await checkTable();
    if (!tableOk) {
      alert("Iltimos, avval stol raqamini tasdiqlang!");
      return;
    }

    let cart = window.cart;
    if (!cart || Object.keys(cart).length === 0) {
      cart = JSON.parse(localStorage.getItem("cart") || "{}");
      window.cart = cart;
    }
    if (!cart || Object.keys(cart).length === 0) {
      alert(t("cart_empty", "Savat bo'sh!"));
      return;
    }

    if (!window.allMenu || Object.keys(window.allMenu).length === 0) {
      alert("Menyu hali yuklanmagan. Internet aloqasini tekshiring.");
      return;
    }

    const tableStr = String(
      confirmedTableNumber ||
      localStorage.getItem("confirmedTable") ||
      window.tableNumber ||
      ""
    ).trim();

    if (!tableStr) {
      alert("Stol raqami aniqlanmadi. Sahifani yangilang.");
      return;
    }
    let total = 0;
    const items = {};
    const menuData = window.allMenu || {};

    Object.entries(cart).forEach(([id, c]) => {
      const m = menuData[id];
      if (!m) {
        console.warn(`[sendOrder] Menu item ${id} not found, skipping`);
        return;
      }
      const price = Number(m.price) || 0;
      const qty = Number(c.qty || c.count || 0);
      if (qty <= 0) return;

      total += price * qty;
      items[id] = {
        id,
        name: m.name || "Noma'lum",
        price,
        qty,
        category: m.category || "Kategoriyasiz"
      };
    });

    if (Object.keys(items).length === 0) {
      alert("Savatdagi mahsulotlar menyu ma'lumotlaridan topilmadi.");
      return;
    }

    const allergyNote = await window.openAllergyModal();

    const baseCookTime = calculateOrderCookTime(cart);
    let finalPrice = total;
    let discountAmount = 0;
    let discountPercent = 0;
    let isOneTimeDiscount = false;

    try {
      const discountInfo = await calculateDiscount(total);
      finalPrice = Number(discountInfo?.finalPrice) || total;
      discountAmount = Number(discountInfo?.discountAmount) || 0;
      discountPercent = Number(discountInfo?.discountPercent) || 0;
      isOneTimeDiscount = discountInfo?.isOneTime === true;
    } catch (discountErr) {
      console.warn("[sendOrder] Discount failed, proceeding with full price:", discountErr);
    }

    const newOrderRef = push(ref(db, BASE_PATH + "/orders"));
    const newOrderId = newOrderRef.key;

    const counterRef = ref(db, BASE_PATH + "/meta/orderCounter");
    const counterRes = await runTransaction(counterRef, n => (n || 0) + 1);
    const orderNumber = counterRes.snapshot.val();

    // Telefon raqamni barcha manbalardan olamiz
    const rawPhone = (
      document.getElementById("clientPhoneInput")?.value?.trim() ||
      localStorage.getItem("customerPhone") ||
      localStorage.getItem("userPhone") ||
      ""
    );
    const customerPhone = normalizeCustomerPhone(rawPhone);

    // Telefon raqamni localStorage ga saqlaymiz
    if (customerPhone) {
      localStorage.setItem("customerPhone", customerPhone);
    }

    const orderPayload = {
      orderNumber,
      table: tableStr,
      items,
      total: finalPrice,
      originalTotal: total,
      discount: discountAmount,
      clientId,
      createdAt: Date.now(),
      status: "yangi",
      cookTimeEstimate: baseCookTime,
      ...(allergyNote ? { allergyNote } : {}),
      ...(customerPhone ? { customerPhone, clientPhone: customerPhone } : {})
    };

    const updates = {};
    updates[`${BASE_PATH}/meta/orderCounter`] = orderNumber;
    updates[`${BASE_PATH}/orders/${newOrderId}`] = orderPayload;
    updates[`${BASE_PATH}/tables/${tableStr}/status`] = "busy";
    updates[`${BASE_PATH}/tables/${tableStr}/busy`] = true;
    updates[`${BASE_PATH}/tables/${tableStr}/orderId`] = newOrderId;
    updates[`${BASE_PATH}/tables/${tableStr}/occupiedAt`] = Date.now();
    // Telefon raqamni stolga ham yozamiz (admin panel uchun)
    if (customerPhone) {
      updates[`${BASE_PATH}/tables/${tableStr}/customerPhone`] = customerPhone;
    }

    await update(ref(db), updates);

    // ── Bir martalik chegirma ishlatilgan bo'lsa ──
    if (isOneTimeDiscount && customerPhone) {
      try {
        const cleanD = customerPhone.replace(/\D/g, "");
        const custKey = cleanD.startsWith("998") ? `+${cleanD}` : `+998${cleanD.slice(-9)}`;
        const custRef = ref(db, `${BASE_PATH}/customers/${custKey}`);
        const custSnap = await get(custRef);
        const custData = custSnap.exists() ? custSnap.val() : {};
        const pending = Number(custData.pendingDiscount || 0);

        // Ishlatilgan chegirmani o'chiramiz, pendingDiscount ni faollashtaramiz
        await update(custRef, {
          personalDiscount: pending,         // keyingi chegirma faolga o'tadi
          pendingDiscount: 0,               // queue bo'shatildi
          personalDiscountUsedAt: Date.now(),
          personalDiscountUsedOnOrder: newOrderId
        });
        console.log(`✅ personalDiscount ishlatildi. Yangi faol: ${pending}%`);
      } catch (e) {
        console.warn("personalDiscount yangilashda xatolik:", e);
      }
    }

    // ── VIP chegirma ishlatilgan bo'lsa — sanagichni oshiramiz ──
    if (discountPercent > 0 && !isOneTimeDiscount && customerPhone) {
      try {
        const cleanD = customerPhone.replace(/\D/g, "");
        const custKey = cleanD.startsWith("998") ? `+${cleanD}` : `+998${cleanD.slice(-9)}`;
        const custRef = ref(db, `${BASE_PATH}/customers/${custKey}`);
        const custSnap = await get(custRef);
        const custData = custSnap.exists() ? custSnap.val() : {};

        if (custData.isVip === true && custData.vipOrdersTotal > 0) {
          const newUsed = Number(custData.vipOrdersUsed || 0) + 1;
          const vipFinished = newUsed >= Number(custData.vipOrdersTotal || 0);

          const vipUpdate = {
            vipOrdersUsed: newUsed,
            vipLastUsedAt: Date.now(),
            vipLastUsedOnOrder: newOrderId
          };
          if (vipFinished) {
            // VIP xaridlar tugadi — VIP olib tashlanadi
            vipUpdate.isVip = false;
          }

          await update(custRef, vipUpdate);
          console.log(`👑 VIP xarid #${newUsed}/${custData.vipOrdersTotal} ishlatildi. ${vipFinished ? "VIP tugadi!" : ""}`);

          // Header badge ni yangilaymiz
          if (typeof window.checkVipStatus === "function") {
            setTimeout(window.checkVipStatus, 500);
          }
        }
      } catch (e) {
        console.warn("VIP sanagichni yangilashda xatolik:", e);
      }
    }

    orderContext.orderId = newOrderId;
    orderContext.orderNumber = orderNumber;
    orderContext.paymentTotal = finalPrice;
    orderContext.baseCookTime = baseCookTime;

    currentPaymentTotal = finalPrice;
    currentBaseCookTime = baseCookTime;
    currentOrderId = newOrderId;

    localStorage.setItem("activeOrderId", newOrderId);
    localStorage.setItem("currentOrderId", newOrderId);
    localStorage.setItem("lastOrderContext", JSON.stringify(orderContext));
    localStorage.setItem("clientCart", JSON.stringify(window.cart || {}));
    sessionStorage.setItem("client_has_submitted_order", "1");
    hasSubmittedOrder = true;
    activeOrderData = { ...orderPayload, _id: newOrderId };
    updateStatusUI("yangi");
    listenActiveOrder();

    if (typeof toggleCart === "function") {
      const cartModal = document.getElementById("cartModal");
      if (cartModal && cartModal.style.display !== "none") {
        toggleCart();
      }
    }

    showNotification("✅ " + t("order_accepted_success", "Buyurtmangiz muvaffaqiyatli qabul qilindi!"));

  } catch (err) {
    console.error("❌ sendOrder ERROR:", err);

    if (orderContext?.orderId) {
      console.log("[sendOrder] Recovery info — orderId:", orderContext.orderId);
    }

    alert("Xatolik: " + (err.message || "Buyurtma yuborishda noma'lum xatolik yuz berdi"));
  }
}

function showOrderConfirmation(items, total, originalTotal, discount) {
  const safeTotal = Number(total) || 0;
  const itemsArray = Object.values(items || {});

  Swal.fire({
    html: `
        <div style="text-align: left; font-family: sans-serif; color: #333;">
            <h2 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                ${t('order_total', 'Buyurtma tasdiqlash')}
            </h2>

            <div style="margin-bottom: 15px; max-height: 200px; overflow-y: auto;">
                ${itemsArray.map(item => {
      const itemQty = Number(item.qty || 0);
      const itemPrice = Number(item.price || 0);
      const itemSum = itemQty * itemPrice;

      return `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                        <span>
                            <strong>${item.name || "Mahsulot"}</strong> 
                            <span style="color: #666;"> x ${itemQty}</span>
                        </span>
                        <span style="font-weight: 600;">${itemSum.toLocaleString()} so'm</span>
                    </div>`;
    }).join('')}
            </div>

            <div style="font-size: 1.4rem; font-weight: 800; color: #27ae60; text-align: center; margin: 20px 0; padding: 12px; background: #f8f9fa; border-radius: 10px; border: 1px dashed #27ae60;">
                ${safeTotal.toLocaleString()} so'm
            </div>

            <p style="font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 10px;">
                ${t('select_method', 'To\'lov usulini tanlang:')}
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <button type="button" onclick="window.selectedPaymentMethod='cash'; highlightPayBtn(this)" class="pay-btn" style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; cursor: pointer;">
                    💵 ${t('cash', 'Naqd')}
                </button>
                <button type="button" onclick="window.selectedPaymentMethod='card'; highlightPayBtn(this)" class="pay-btn" style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; cursor: pointer;">
                    💳 ${t('card', 'Karta')}
                </button>
                <button type="button" onclick="window.selectedPaymentMethod='click'; highlightPayBtn(this)" class="pay-btn" style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff; cursor: pointer;">
                    🔹 Click
                </button>
            </div>
        </div>
        `,
    showCancelButton: true,
    confirmButtonText: t('pay_btn', 'To\'lash'),
    cancelButtonText: t('cancel', 'Bekor qilish'),
    confirmButtonColor: '#27ae60',
    preConfirm: () => {
      if (!window.selectedPaymentMethod) {
        Swal.showValidationMessage('Iltimos, to\'lov usulini tanlang!');
        return false;
      }
      return window.selectedPaymentMethod;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      console.log("Tanlangan to'lov usuli:", result.value);
    }
  });
}

window.highlightPayBtn = function (el) {
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.style.borderColor = '#ddd';
    btn.style.background = '#fff';
  });
  el.style.borderColor = '#27ae60';
  el.style.background = '#f0fff4';
}

/* =========================
   PAYMENT LOGIC
========================= */
window.confirmPayment = async function () {
  const method = document.getElementById("paymentMethod")?.value || "cash";
  const selectedPriority = document.querySelector("input[name='priority']:checked")?.value || "normal";

  if (!currentOrderId) { alert(t("order_not_found")); return; }

  const result = calculatePriority(currentPaymentTotal, currentBaseCookTime);

  let finalTotal = result.finalTotal;
  let totalDiscount = 0;

  const discountPercent = Number(localStorage.getItem("discountPercent") || 0);

  if (discountPercent > 0 && !result.isFast) {
    totalDiscount = Math.round(finalTotal * discountPercent / 100);
    finalTotal -= totalDiscount;
  } else if (window.currentRewardDiscount > 0 && !result.isFast) {
    totalDiscount = window.currentRewardDiscount;
    finalTotal -= totalDiscount;
  }

  const recalculatedReadyAt = Date.now() + result.cookTime * 60000;

  await update(ref(db, BASE_PATH + "/orders/" + currentOrderId), {
    total: finalTotal,
    finalTotal: finalTotal,
    originalTotal: currentPaymentTotal,
    fastFeeAmount: result.extraMoney || 0,
    discountAmount: totalDiscount || 0,
    priority: selectedPriority,
    cookTime: result.cookTime,
    baseCookTime: currentBaseCookTime,
    readyAt: recalculatedReadyAt,
    updatedAt: Date.now()
  });

  await update(ref(db, BASE_PATH + "/orders/" + currentOrderId + "/payment"), {
    method,
    requested: true,
    paid: false,
    time: Date.now(),
    requestedAt: Date.now()
  });

  const orderSnap = await get(ref(db, BASE_PATH + "/orders/" + currentOrderId));
  if (orderSnap.exists()) {
    await set(ref(db, BASE_PATH + "/tables/" + orderSnap.val().table), {
      status: "busy",
      busy: true,
      orderId: currentOrderId,
      openedAt: Date.now()
    });
  }

  hasSubmittedOrder = true;
  sessionStorage.setItem("client_has_submitted_order", "1");
  updateStatusUI("queue");
  listenActiveOrder();

  const code = localStorage.getItem("discountCode");
  if (code) {
    await update(ref(db, BASE_PATH + "/discounts/" + code), { used: true });
    localStorage.removeItem("discountCode");
    localStorage.removeItem("discountPercent");
  }

  allowReceiptOpen = true;
  localStorage.setItem("receiptPendingOrderId", currentOrderId);

  showNotification(t("payment_request_sent", "To'lov so'rovi yuborildi"));
  closePayment();
};

function calculateOrderCookTime(itemsObj) {
  let maxPrep = 0;
  Object.entries(itemsObj || {}).forEach(([id, item]) => {
    const prep = Number(allMenu?.[id]?.prepTime || item?.prepTime || 30);
    if (prep > maxPrep) maxPrep = prep;
  });
  return maxPrep || 30;
}

/* =========================
   VAQT VA NARXNI HISBLASH 
========================= */
function calculatePriority(total, baseCookTime = 30) {
  const selectedPriority = document.querySelector("input[name='priority']:checked")?.value || "normal";
  let finalTotal = total;

  let cookTime = RESTAURANT_SETTINGS.normalOrderBaseTime || baseCookTime;

  let extraMoney = 0;
  let isFast = false;

  const meetsMinAmount = total >= (RESTAURANT_SETTINGS.fastOrderMinAmount || 80000);

  if (selectedPriority === "fast" && RESTAURANT_SETTINGS.fastOrderActive !== false && meetsMinAmount) {
    const percent = RESTAURANT_SETTINGS.fastFee || 5;
    const minusMins = RESTAURANT_SETTINGS.fastOrderMinusMinutes || 10;

    extraMoney = Math.round(total * percent / 100);
    finalTotal = total + extraMoney;
    cookTime = Math.max(cookTime - minusMins, 5);
    isFast = true;
  }

  return { finalTotal, cookTime, extraMoney, isFast };
}

/* =========================
   TO'LOV SUMMASINI YANGILASH VA EKRANGA CHIQARISH
========================= */
window.updatePaymentSummary = function () {
  const result = calculatePriority(currentPaymentTotal, currentBaseCookTime);

  const promoPercent = Number(localStorage.getItem("discountPercent") || 0);
  const vipPercent = Number(window.vipDiscountPercent || 0);

  const finalDiscountPercent = Math.max(promoPercent, vipPercent);

  let total = result.finalTotal;
  let discountAmount = 0;

  if (finalDiscountPercent > 0 && !result.isFast) {
    discountAmount = Math.round(total * finalDiscountPercent / 100);
    total -= discountAmount;
  }

  const paymentTotalEl = document.getElementById("paymentTotal");
  const breakdown = document.getElementById("priceBreakdown");

  if (paymentTotalEl) paymentTotalEl.innerText = total.toLocaleString() + " " + t("currency");

  if (breakdown) {
    const percent = RESTAURANT_SETTINGS.fastFee || 5;

    breakdown.innerHTML = `
      <div style="display:flex;justify-content:space-between; margin-bottom:5px; font-size:14px; color:#555;">
        <span>${t("base_price", "Asosiy narx")}:</span>
        <span style="${discountAmount > 0 ? 'text-decoration: line-through;' : ''}">${Number(currentPaymentTotal).toLocaleString()} ${t("currency")}</span>
      </div>

      ${result.isFast ? `
        <div style="display:flex;justify-content:space-between;color:#dc3545; font-weight:bold; margin-bottom:5px;">
          <span>⚡ ${t("fast_service", "Tezkor xizmat")} (+${percent}%)</span>
          <span>+${result.extraMoney.toLocaleString()} ${t("currency")}</span>
        </div>
      ` : ""}

      ${discountAmount > 0 ? `
        <div style="display:flex;justify-content:space-between;color:#28a745; font-weight:bold; font-size: 15px; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px;">
<span>${vipPercent >= promoPercent && vipPercent > 0 ? '👑 ' + t("vip_discount", "VIP Chegirma") : '🎁 ' + t("promo_code", "Promokod")} (-${finalDiscountPercent}%):</span>          <span>-${discountAmount.toLocaleString()} ${t("currency")}</span>
        </div>
      ` : ""}
    `;
  }

  const newReadyAt = Date.now() + result.cookTime * 60000;
  const readyEl = document.querySelector(".payment-ready-time") || document.getElementById("clientReadyTime");
  const countdownEl = document.querySelector(".payment-countdown") || document.getElementById("clientTimer");
  const dt = new Date(newReadyAt);
  const timeString = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (readyEl) readyEl.innerHTML = `🍽 ${t("ready_at_text", "Tayyor bo'ladi")}: <b>${timeString}</b>`;
  if (countdownEl) countdownEl.innerHTML = `⏳ ${t("waiting_text", "Kutilmoqda")}: <b>${result.cookTime} ${t("minute_short", "daqiqa")}</b>`;
};

/* =========================
   TO'LOV OYNASINI OCHISH 
========================= */
window.currentPaymentPhoneKey = "";

function openPayment(total, orderNumber, orderItems, baseCookTime, phoneKey) {
  // Yangi window.openPayment ga yo'naltirish (promo kartochkalar shu yerda)
  if (typeof window.openPayment === "function") {
    window.openPayment(total, orderNumber, orderItems, baseCookTime, phoneKey);
  }
}

window.selectMyPromo = function (code) {
  const input = document.getElementById("cartPromoInput");
  if (input) {
    input.value = code;
    if (typeof window.applyClientPromo === "function") {
      window.applyClientPromo();
    }
  }
};

async function fetchAndRenderMyPromos(phone) {
  const container = document.getElementById("myPromosContainer");
  if (!container) return;
  container.innerHTML = `<p style='font-size:13px; color:#666;'>⏳ ${t("searching_promos", "Promokodlar qidirilmoqda...")}</p>`;

  const snap = await get(ref(db, BASE_PATH + "/discounts"));
  const allDiscounts = snap.val() || {};

  const normalizeP = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.slice(-9); };
  const myPromos = Object.values(allDiscounts).filter(d => {
    const usesLeft = d.usesLeft !== undefined ? Number(d.usesLeft) : (d.used ? 0 : 1);
    return normalizeP(d.ownerPhone) === normalizeP(phone) && !d.used && usesLeft > 0;
  });

  if (myPromos.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
        <div style="background: #eef8ee; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-top:0; color:#28a745; font-size:14px;">🎫 ${t("your_promos_title", "Sizning shaxsiy promokodlaringiz")}</h4>
            ${myPromos.map(p => {
              const isMulti  = (p.maxUses || 1) > 1;
              const usesLeft = p.usesLeft !== undefined ? p.usesLeft : 1;
              return `
                <div style="background:#fff; border:1px solid #c3e6cb; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#28a745; font-size:16px;">${p.code}</strong>
                        ${p.isVipPromo ? `<span style="font-size:10px;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 5px;margin-left:4px;">VIP</span>` : ""}
                        <br>
                        <span style="font-size:12px; color:#555;">-${p.percent}% ${t("discount_giving_text", "chegirma beradi")}</span>
                        ${isMulti ? `<span style="font-size:11px;color:#7c3aed;margin-left:6px;">· ${usesLeft}× ${t("uses_left_label","qoldi")}</span>` : ""}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button onclick="applyMyPromo('${p.code}', ${p.percent})" style="background:#28a745; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">${t("apply_btn", "Qo'llash")}</button>
                        <button onclick="giftPromoCode('${p.code}')" style="background:#ffc107; color:#000; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:12px;">${t("give_to_friend_btn", "Do'stimga berish")}</button>
                    </div>
                </div>`;
            }).join("")}
        </div>
    `;
}

window.applyMyPromo = function (code, percent) {
  localStorage.setItem("discountPercent", percent);
  localStorage.setItem("discountCode", code);
  showNotification(`✅ ${t("promo_applied", "Promokod qo'llanildi")}: -${percent}%`);
  updatePaymentSummary();
};

window.giftPromoCode = async function (code) {
  const newPhone = prompt(t("enter_friend_phone", "Do'stingizning telefon raqamini kiriting (+998...):"));
  if (!newPhone) return;

  const cleanPhone = newPhone.replace(/\D/g, "").slice(-9);
  if (cleanPhone.length < 9) {
    alert(t("invalid_phone_9", "Noto'g'ri raqam kiritildi! Faqat 9 xonali raqam kiriting."));
    return;
  }

  await update(ref(db, `${BASE_PATH}/discounts/${code}`), {
    ownerPhone: cleanPhone
  });

  showNotification(`🎁 ${t("promo_sent_success", "Promokod muvaffaqiyatli")} ${cleanPhone} ${t("number_suffix", "raqamiga yuborildi!")}`);

  if (localStorage.getItem("discountCode") === code) {
    localStorage.removeItem("discountCode");
    localStorage.removeItem("discountPercent");
    updatePaymentSummary();
  }

  fetchAndRenderMyPromos(window.currentPaymentPhoneKey);
};

async function loadMyPromos(phone) {
  const promoListEl = document.getElementById("availablePromos");
  if (!promoListEl || !phone) return;

  const snap = await get(ref(db, BASE_PATH + "/clients/" + phone + "/myPromos"));
  if (snap.exists()) {
    const promos = snap.val();
    let htmlContent = `<h4>${t("my_promos_title", "Mening promokodlarim:")}</h4>`;

    Object.entries(promos).forEach(([id, p]) => {
      if (p.status === "active") {
        htmlContent += `
          <div class="promo-item" onclick="applyPromo('${p.code}', ${p.percent})">
            <span>${p.code} (-${p.percent}%)</span>
            <button onclick="event.stopPropagation(); giftPromo('${id}', '${p.code}')">🎁 ${t("gift_btn", "Sovg'a qilish")}</button>
          </div>`;
      }
    });

    promoListEl.innerHTML = htmlContent;
  }
}

window.applyPromo = function (code, percent) {
  localStorage.setItem("discountPercent", percent);
  localStorage.setItem("discountCode", code);
  updatePaymentSummary();
  showNotification(`✅ ${code} ${t("promo_entered", "promokodi kiritildi!")}`);
};

window.giftPromo = async function (promoId, code) {
  const targetPhone = prompt(t("who_to_gift", "Promokodni kimga bermoqchisiz? (Telefon raqamini yozing):"));
  if (!targetPhone || targetPhone.length < 9) {
    alert(t("invalid_phone", "Noto'g'ri telefon raqami!"));
    return;
  }

  const targetKey = targetPhone.replace(/\D/g, "").slice(-9);
  const myPhone = document.getElementById("clientPhoneInput").value.replace(/\D/g, "").slice(-9);

  await remove(ref(db, `${BASE_PATH}/clients/${myPhone}/myPromos/${promoId}`));

  const snap = await get(ref(db, BASE_PATH + "/promocodes/" + code));
  if (snap.exists()) {
    const pData = snap.val();
    const newPromoId = "promo_" + Date.now();

    await update(ref(db, `${BASE_PATH}/clients/${targetKey}/myPromos/${newPromoId}`), {
      code: code,
      percent: pData.percent,
      status: "active"
    });
    await update(ref(db, BASE_PATH + "/promocodes/" + code), { ownerPhone: targetKey });

    alert(`🎁 ${t("promo_transferred_prefix", "Promokod")} ${targetKey} ${t("promo_transferred_suffix", "raqamiga muvaffaqiyatli o'tkazildi!")}`);
    loadMyPromos(myPhone);
  }
};

/* =========================
   TABLES & MISC
========================= */
async function checkTable() {

  const input =
    document.getElementById("tableInput");

  const value = String(
    input?.value ||
    confirmedTableNumber ||
    localStorage.getItem("table") ||
    ""
  ).trim();

  if (!value) {

    setTableStatusMessage(
      t(
        "enter_table_number",
        "Stol raqamini kiriting"
      ),
      "error"
    );

    return false;
  }

  const prevTable =
    localStorage.getItem("table");

  if (prevTable && prevTable !== value) {

    resetClientSession();

    if (input) {
      input.value = value;
    }
  }

  const tableRef =
    ref(db, BASE_PATH + "/tables/" + value);

  const tableSnap =
    await get(tableRef);

  const tableData =
    tableSnap.exists()
      ? (tableSnap.val() || {})
      : {};

  console.log("TABLE DATA:", tableData);

  const activeOrderId =
    localStorage.getItem("activeOrderId");

  const tableStatus = String(tableData.status || "").toLowerCase();

  // Band deb hisoblanadigan barcha holatlar
  const BUSY_STATUSES = ["busy", "occupied", "open", "active", "ready", "cooking", "billing"];
  const isBusy = tableData.busy === true || BUSY_STATUSES.includes(tableStatus);
  const isCleaning = tableStatus === "cleaning" || tableStatus === "needs_cleaning";
  const isBooked = tableStatus === "reserved" || tableStatus === "booked";

  // Shu stoLda faol order bor-yo'qligini tekshiramiz
  const tableHasActiveOrder = !!(tableData.orderId);

  const sameCurrentOrder =
    String(tableData.orderId || "") ===
    String(activeOrderId || "");

  // ❌ Tozalanmoqda — hech kim band qila olmaydi
  if (isCleaning) {
    setTableStatusMessage(
      t("table_is_cleaning", "Bu stol hozir tozalanmoqda, biroz kuting!"),
      "error"
    );
    return false;
  }

  // 🔒 Bron qilingan yoki band — avval bronni tekshiramiz
  if (isBooked || (isBusy && !sameCurrentOrder)) {
    // Bugungi sana
    const todayStr = new Date().toISOString().slice(0, 10);
    const restId = localStorage.getItem("restaurantId") || currentRestaurantId;

    let activeReservation = null;
    try {
      const resSnap = await get(ref(db, `restaurants/${restId}/reservations`));
      if (resSnap.exists()) {
        const allRes = resSnap.val();
        for (const key in allRes) {
          const r = allRes[key];
          if (
            r.date === todayStr &&
            String(r.tableNumber) === String(value) &&
            ["pending", "confirmed", "seated"].includes(r.status)
          ) {
            activeReservation = { ...r, _key: key };
            break;
          }
        }
      }
    } catch (e) {
      console.error("Bron tekshirishda xato:", e);
    }

    if (activeReservation) {
      // Bu stol bron ostida — telefon raqamini solishtir
      const phoneEl = document.getElementById("clientPhoneInput");
      const rawPhone = phoneEl?.value?.trim() || "";
      const cleanInput = rawPhone.replace(/\D/g, "");
      const cleanRes = (activeReservation.phone || "").replace(/\D/g, "");

      const phoneMatch =
        cleanInput.length >= 9 &&
        (cleanRes === cleanInput || cleanRes.endsWith(cleanInput.slice(-9)));

      if (phoneMatch) {
        // ✅ Bron egasi — o'tishga ruxsat, davom etamiz
        // (quyida tableNumber saqlanadi va success qaytariladi)
      } else {
        // ❌ Bron egasi emas — bloklash
        const guestHint = activeReservation.guestName
          ? ` (${activeReservation.guestName})`
          : "";
        setTableStatusMessage(
          t(
            "table_reserved_for_guest",
            `Bu stol bron qilingan${guestHint}. Bron raqamingizni kiriting yoki boshqa stol tanlang.`
          ),
          "error"
        );
        return false;
      }
    } else if (isBooked) {
      // Stol "reserved" lekin bugun uchun bron topilmadi — bloklash
      setTableStatusMessage(
        t("table_is_reserved", "Bu stol bron qilingan!"),
        "error"
      );
      return false;
    } else {
      // Oddiy band stol (bron yo'q) — bloklash
      setTableStatusMessage(
        t("table_is_busy", "Bu stol hozir band! Iltimos boshqa stol tanlang."),
        "error"
      );
      return false;
    }
  }

  // ❌ Faol order bor, o'z buyurtmasi emas — bloklash
  if (tableHasActiveOrder && !sameCurrentOrder && !isBooked && !isBusy) {
    setTableStatusMessage(
      t("table_is_busy", "Bu stol hozir band! Iltimos boshqa stol tanlang."),
      "error"
    );
    return false;
  }

  tableNumber = value;
  confirmedTableNumber = value;

  localStorage.setItem("table", value);
  localStorage.setItem("confirmedTable", value);

  if (input) {
    input.value = value;
  }

  // Telefon: faqat togri +998XXXXXXXXX formatini saqlaymiz
  const phoneEl = document.getElementById("clientPhoneInput");
  const rawInputPhone = phoneEl?.value?.trim() || "";
  if (rawInputPhone) {
    const savedPhone = normalizeCustomerPhone(rawInputPhone);
    const savedDigits = savedPhone.replace(/\D/g, "");
    if (savedPhone && savedDigits.length === 12 && savedDigits.startsWith("998")) {
      localStorage.setItem("customerPhone", savedPhone);
      localStorage.setItem("userPhone", savedPhone);
    } else {
      localStorage.removeItem("customerPhone");
      localStorage.removeItem("userPhone");
    }
  } else {
    localStorage.removeItem("customerPhone");
    localStorage.removeItem("userPhone");
  }

  // VIP badge: faqat telefon raqam kiritilgan va admin VIP bergan bo'lsa ko'rsatamiz
  await checkAndShowVipBadge();

  setTableStatusMessage(
    t("approved", "Tasdiqlandi"),
    "success"
  );

  return true;
}

function hideAllVipElements() {
  const vipBadge = document.getElementById("vipBadge");
  const headerBadge = document.getElementById("headerBadge");
  const vipBanner = document.getElementById("vip-banner");
  if (vipBadge) vipBadge.style.display = "none";
  if (headerBadge) headerBadge.style.display = "none";
  if (vipBanner) vipBanner.style.display = "none";
  window.vipDiscountPercent = 0;
}

async function checkAndShowVipBadge() {
  // Faqat checkTable() chaqirganidan keyin ishlaydi
  // localStorage dagi telefon o'sha sessiyada saqlangan bo'lishi kerak

  const phone = localStorage.getItem("customerPhone");

  // Telefon raqam yo'q — barcha VIP elementlarni yashiramiz
  if (!phone) {
    hideAllVipElements();
    return;
  }

  try {
    // Faqat aniq +998XXXXXXXXX (12 raqam) formatini qabul qilamiz
    const cleanDigits = phone.replace(/\D/g, "");

    if (cleanDigits.length !== 12 || !cleanDigits.startsWith("998")) {
      hideAllVipElements();
      return;
    }

    const normalizedKey = `+${cleanDigits}`;

    // Firebase da faqat shu aniq kalit ostidagi mijozni tekshiramiz
    const snap = await get(ref(db, `restaurants/${currentRestaurantId}/customers/${normalizedKey}`));

    if (!snap.exists()) {
      hideAllVipElements();
      return;
    }

    const customer = snap.val();

    // FAQAT admin tomonidan isVip=true qilib belgilangan mijoz
    const isAdminVip = customer.isVip === true;
    const vipDiscPct = Number(customer.vipDiscountPercent || 0);
    const vipTotal = Number(customer.vipOrdersTotal || 0);
    const vipUsed = Number(customer.vipOrdersUsed || 0);

    console.log("%cVIP tekshiruv", "color:gold;font-weight:bold", {
      phone: normalizedKey, isAdminVip, vipDiscPct, vipTotal, vipUsed
    });

    // vipTotal=0 bo'lsa (cheksiz) yoki vipUsed < vipTotal bo'lsa faol
    const isVipActive = isAdminVip && vipDiscPct > 0 && (vipTotal === 0 || vipUsed < vipTotal);

    if (isVipActive) {
      // VIP faol — badge, header va banner ko'rsatamiz
      window.vipDiscountPercent = vipDiscPct;

      const vipBadge = document.getElementById("vipBadge");
      if (vipBadge) {
        vipBadge.style.display = "";
        vipBadge.title = `VIP -${vipDiscPct}% chegirma`;
      }

      const headerBadge = document.getElementById("headerBadge");
      if (headerBadge) {
        headerBadge.innerHTML = `👑 VIP -${vipDiscPct}%`;
        headerBadge.style.display = "inline-block";
      }

      const banner = document.getElementById("vip-banner");
      const percentSpan = document.getElementById("vip-percent");
      if (banner) {
        if (percentSpan) percentSpan.innerText = vipDiscPct;
        banner.style.display = "block";
      }

      if (typeof updatePaymentSummary === "function") updatePaymentSummary();
    } else {
      hideAllVipElements();
    }
  } catch (err) {
    console.error("VIP badge tekshirishda xatolik:", err);
    hideAllVipElements();
  }
}

async function markTableAsOccupied(tableId, tableNo) {
  if (!tableId) return;
  await update(ref(db, `${BASE_PATH}/tables/${tableId}`), {
    status: "occupied",
    currentSessionStart: Date.now(),
    lastActivity: Date.now()
  });
}

window.callWaiter = async function () {
  const table = String(confirmedTableNumber || localStorage.getItem("tableNo") || "").trim();
  const tableId = localStorage.getItem("tableId");

  if (!table) {
    showNotification(t("please_confirm_table_first", "Iltimos, avval stol raqamini tasdiqlang!"));
    return;
  }

  try {
    const callRef = push(ref(db, BASE_PATH + "/waiterCalls"));
    await set(callRef, {
      table: table,
      tableId: tableId || table,
      message: `🪑 ${t("table_label", "Stol")} ${table}: ${t("client_calling_waiter", "Mijoz ofitsiantni chaqirmoqda")}`,
      status: "waiting",
      timestamp: Date.now(),
      clientId: clientId,
      notified: false
    });

    showNotification("✅ " + t("waiter_called_success", "Ofitsiant chaqirildi! Tez orada kelishadi."));
  } catch (err) {
    console.error("Xatolik:", err);
  }
};

function setTableStatusMessage(text, type = "error") {
  const tableStatus = document.getElementById("tableStatus");
  if (!tableStatus) return;
  tableStatus.textContent = text || "";
  tableStatus.className = `table-status-msg ${type}`;
}

function showNotification(text) {
  const n = document.getElementById("notification");
  if (!n) return;
  n.innerText = text;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 3000);
}

function toggleCart() {
  if (cartModal) cartModal.style.display = cartModal.style.display === "block" ? "none" : "block";
}

function isNewFood(item) {
  if (!item?.createdAt) return false;
  return Date.now() - item.createdAt < 3 * 24 * 60 * 60 * 1000;
}

function getTranslatedItemName(item, menuItem = null, lang = getLang()) {
  const target = menuItem?.name || item?.name;
  if (typeof target === "object") return target[lang] || target.uz || target.ru || target.en || "—";
  return target || "—";
}

/* =========================
   LISTEN ACTIVE ORDER 
========================= */
function listenActiveOrder() {
  const activeId = localStorage.getItem("activeOrderId");
  if (!activeId) return;

  stopActiveOrderListener = onValue(ref(db, BASE_PATH + "/orders/" + activeId), async snap => {
    const order = snap.val();

    if (!order) {
      resetClientSession();
      return;
    }

    activeOrderData = { ...order, _id: activeId };
    const rawStatus = getOrderStatusKey(order);

    const isAlive = !["yopildi", "bekor qilindi", "closed", "cancelled"].includes(normalizeStatus(rawStatus));

    if (!isAlive || order.tableClosed === true) {
      const isSuccess = rawStatus.includes("yopildi") || rawStatus.includes("closed");
      const isPaymentApproved = order.payment?.approved === true || order.payment?.paid === true;

      if (isSuccess && typeof window.showFeedbackModal === "function") {
        window.showFeedbackModal(activeId);
      }

      // Savat faqat to'lov admin tomonidan tasdiqlangan bo'lsa tozalanadi
      resetClientSession(isPaymentApproved);
      showNotification(isSuccess ? t("thanks_for_purchase", "Xaridingiz uchun rahmat!") : t("order_cancelled", "Buyurtma bekor qilindi"));
      return;
    }

    // Stol holati "free" bo'lsa — session tugadi deb hisoblaymiz
    const tableNo = order.table || localStorage.getItem("table");
    if (tableNo) {
      const tableSnap = await get(ref(db, BASE_PATH + "/tables/" + tableNo));
      if (tableSnap.exists()) {
        const tableData = tableSnap.val();
        const tableStatus = String(tableData.status || "").toLowerCase();

        if (tableStatus === "free" && (rawStatus === "to'landi" || rawStatus === "paid")) {
          // Stol tozalanib bo'ldi — sessiyani yopamiz, savat ham tozalanadi
          if (typeof window.showFeedbackModal === "function") {
            window.showFeedbackModal(activeId);
          }
          resetClientSession(true);
          showNotification(t("thanks_for_purchase", "Xaridingiz uchun rahmat! Tez orada ko'rishguncha."));
          return;
        }

        if (tableStatus === "cleaning" || tableStatus === "needs_cleaning") {
          // Stol tozalanmoqda — mijozga ko'rsatamiz
          hasSubmittedOrder = true;
          updateStatusUI("tozalanmoqda");
          return;
        }
      }
    }

    hasSubmittedOrder = true;
    updateStatusUI(rawStatus);

    // Oshpaz expectedReadyAt yoki readyAt yozganda countdown header da ko'rinadi
    const countdownTs = order.expectedReadyAt || order.readyAt;
    const prepMins = Number(order.prepMinutes || 0);
    const isCookingStatus = ["tayyorlanmoqda", "cooking"].includes(rawStatus);
    const isReadyStatus = ["tayyor", "ready"].includes(rawStatus);

    if (isReadyStatus) {
      // ── TAYYOR: necha daqiqada tayyorlanganini ko'rsatamiz ──
      showOrderReadyBanner(order);
    } else if (countdownTs && isCookingStatus) {
      // ── COOKING + oshpaz vaqt kiritdi: countdown ──
      startHeaderCountdown(countdownTs);
      updateHeaderReadyInfo(countdownTs);

      // headerReadyBox ni ko'rsatamiz
      const hrb = document.getElementById("headerReadyBox");
      if (hrb) hrb.style.display = "block";

      // header-timer-container ni ko'rsatamiz
      const timerBox = document.getElementById("header-timer-container");
      if (timerBox) {
        timerBox.style.display = "flex";
        timerBox.style.background = "linear-gradient(135deg,rgba(22,163,74,0.1),rgba(16,185,129,0.06))";
        timerBox.style.border = "1.5px solid rgba(34,197,94,0.3)";
        timerBox.style.borderRadius = "14px";
      }

      // prepMinutes belgisi (oshpaz kiritgan daqiqa)
      const timerLabel = document.getElementById("chef-prep-label");
      if (timerLabel && prepMins > 0) {
        timerLabel.textContent = `⏱ ${prepMins} ${t("minute_short", "daqiqa")} ichida tayyor`;
        timerLabel.style.color = "#16a34a";
      }

      const readyEl = document.getElementById("clientReadyTime");
      const timerEl = document.getElementById("clientTimer");
      if (readyEl) {
        const dt = new Date(countdownTs);
        readyEl.innerText = `🍽 ${t("ready_at_label", "Tayyor bo'ladi")}: ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (timerEl) {
        const diff = Number(countdownTs) - Date.now();
        if (diff > 0) {
          const remMins = Math.ceil(diff / 60000);
          timerEl.innerText = `⏳ ~${remMins} ${t("minute_short", "daqiqa")}`;
        } else {
          timerEl.innerText = `✅ ${t("ready_text", "Tayyor!")}`;
        }
      }
    } else if (isCookingStatus && !countdownTs) {
      // ── Cooking boshlandi lekin oshpaz vaqt kiritisini kutmoqda ──
      const timerBox = document.getElementById("header-timer-container");
      const display = document.getElementById("header-countdown-text");
      if (timerBox) {
        timerBox.style.display = "flex";
        timerBox.style.background = "rgba(245,158,11,0.15)";
        timerBox.style.border = "1.5px solid rgba(245,158,11,0.4)";
        timerBox.style.borderRadius = "12px";
        timerBox.style.padding = "6px 14px";
        timerBox.style.gap = "8px";
        timerBox.style.alignItems = "center";
      }
      if (display) {
        display.style.color = "#f59e0b";
        display.style.animation = "";
        display.classList.remove("client-countdown-shake", "client-countdown-red");
        display.innerText = "🔥 " + t("cooking_label", "Tayyorlanmoqda...");
      }
    } else if (!isCookingStatus && !isReadyStatus) {
      // ── Boshqa statuslarda yashiramiz ──
      const timerBox = document.getElementById("header-timer-container");
      if (timerBox) timerBox.style.display = "none";
    }

    const isReceiptReady = (order.payment?.paid === true || order.payment?.approved === true);
    const alreadyShown = localStorage.getItem("receiptShown");

    if (isReceiptReady && alreadyShown !== activeId) {
      localStorage.setItem("receiptShown", activeId);
      // Admin to'lovni tasdiqladi — savat tozalanadi
      cart = {};
      window.cart = {};
      localStorage.removeItem("clientCart");
      localStorage.removeItem("cart");
      if (typeof updateCart === "function") updateCart();

      setTimeout(() => {
        showReceipt(order);

        if (typeof window.showFeedbackModal === "function") {
          setTimeout(() => {
            window.showFeedbackModal(activeId);
          }, 1500);
        }

      }, 500);
    }
  });

  // Stol holatini real-time kuzatish (cleaning → free bo'lganda sessiyani yopish)
  const tableNo = localStorage.getItem("table");
  if (tableNo) {
    let tableWasCleaning = false;
    onValue(ref(db, BASE_PATH + "/tables/" + tableNo), async (tableSnap) => {
      if (!tableSnap.exists()) return;
      const tableData = tableSnap.val();
      const tableStatus = String(tableData.status || "").toLowerCase();

      if (tableStatus === "cleaning" || tableStatus === "needs_cleaning") {
        tableWasCleaning = true;
        if (hasSubmittedOrder) {
          updateStatusUI("tozalanmoqda");
        }
      } else if (tableStatus === "free" && tableWasCleaning) {
        // Stol tozalanib bo'ldi, sessiyani yopamiz — savat ham tozalanadi
        tableWasCleaning = false;
        const activeOrderId = localStorage.getItem("activeOrderId");
        if (activeOrderId && typeof window.showFeedbackModal === "function") {
          window.showFeedbackModal(activeOrderId);
        }
        setTimeout(() => {
          resetClientSession(true);
          showNotification(t("table_cleaned_ready", "Stol tozalandi! Xaridingiz uchun rahmat."));
        }, 1500);
      }
    });
  }
}

/* =========================
   CHEK (RECEIPT) FUNKSIYALARI 
========================= */
async function showReceipt(order) {
  const box = document.getElementById("receiptBox");
  const content = document.getElementById("receiptContent");

  if (!box || !content) return;

  if (!order || !order.items) return;

  const lang = getLang();
  const currency = t("currency") || "UZS";
  const restaurantName = RESTAURANT_SETTINGS.restaurantName || t("restaurant_name", "Restoran nomi va manzili");

  const subtotal = Number(order.originalTotal || 0);
  const fastFee = Number(order.fastFeeAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const finalTotal = Number(order.total || order.finalTotal || 0);

  const orderDate = new Date(order.createdAt || Date.now());
  const dateStr = orderDate.toLocaleDateString('ru-RU').replace(/\./g, '-');
  const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Mijozning nechinchi tashrifini aniqlash
  let visitCount = null;
  try {
    const cId = localStorage.getItem("clientId") || order.clientId;
    const rId = localStorage.getItem("restaurantId") || order.restaurantId;
    if (cId && rId) {
      const ordersSnap = await get(ref(db, `restaurants/${rId}/orders`));
      if (ordersSnap.exists()) {
        const allOrders = ordersSnap.val();
        const paidOrders = Object.values(allOrders).filter(o =>
          (o.clientId === cId || o.userId === cId) &&
          (o.status === "to'landi" || o.status === "paid" ||
            o.paymentStatus === "paid" || o.paymentStatus === "confirmed")
        );
        visitCount = paidOrders.length + 1; // +1 joriy tashrif
      }
    }
  } catch (e) {
    console.warn("Tashrif sanashda xato:", e);
  }

  const visitHtml = visitCount
    ? `<div style="margin-top: 4px; font-size: 12px; color: #555;">${visitCount}-${t("visit_suffix", "chi tashrif")} 🏅</div>`
    : "";

  let itemsHtml = Object.values(order.items).map(i => {
    const menuItem = allMenu[i.id || i.menuId || i.itemId] || {};
    const name = getTranslatedItemName(i, menuItem, lang);
    const price = Number(i.price || 0);
    const qty = Number(i.qty || 0);
    const sum = price * qty;

    return `
      <div style="display:flex; justify-content:space-between; font-size: 13px; margin-bottom: 4px;">
        <div style="flex:2.5; text-align:left; word-wrap: break-word; padding-right: 5px;">${name}</div>
        <div style="flex:1; text-align:center;">${qty.toFixed(1)}</div>
        <div style="flex:1.5; text-align:right;">${sum.toLocaleString()}</div>
      </div>
    `;
  }).join("");

  content.innerHTML = `
    <div class="receipt-wrapper" style="padding: 20px; display: flex; flex-direction: column; align-items: center;">
      
      <div id="real-receipt" style="background: #fff; width: 100%; max-width: 340px; padding: 20px; font-family: 'Courier New', Courier, monospace; color: #000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-size: 13px; line-height: 1.4;">
        
        <div style="text-align: center; margin-bottom: 20px;">
  ${RESTAURANT_SETTINGS.restaurantLogoUrl
    ? `<img src="${RESTAURANT_SETTINGS.restaurantLogoUrl}" alt="Logo" style="max-width:120px; max-height:90px; height:auto; object-fit:contain; border-radius:12px;" />`
    : `<div style="font-family:'Courier New',monospace; font-size:15px; font-weight:700; color:#111;">${restaurantName}</div>`
  }
</div>  

        <div style="margin-bottom: 15px;">
          <div style="display:flex; justify-content:space-between;">
            <span>${t("receipt_label", "Chek")} # ${order.orderNumber || order.orderNo || order.checkNo || (order._id ? String(order._id).substring(0, 6) : null) || (order.id ? String(order.id).replace(/\D/g, '').slice(-4) : null) || "—"}</span>
            <span>${t("table_label", "Stol")} # ${order.table ?? "-"}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>${dateStr} ${t("opened_label", "Ochildi")} ${timeStr}</span>
          </div>
          <div style="margin-top: 5px;">${t("dear_customer", "Xurmatli mijoz")}${visitHtml}</div>
        </div>

        <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>
        <div style="display:flex; justify-content:space-between; font-weight: bold; margin-bottom: 5px;">
          <div style="flex:2.5; text-align:left;">${t("food_label", "Taom")}</div>
          <div style="flex:1; text-align:center;">${t("qty_label", "Miqdor")}</div>
          <div style="flex:1.5; text-align:right;">${t("amount_label", "Summa")}</div>
        </div>
        <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

        <div style="margin-bottom: 10px;">
          ${itemsHtml}
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 10px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between;">
            <span>${t("base_label", "Asosiy")}:</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          ${fastFee > 0 ? `
          <div style="display:flex; justify-content:space-between;">
            <span>${t("fast_service_label", "Tezkor xizmat")}:</span>
            <span>+${fastFee.toLocaleString()}</span>
          </div>` : ""}
          ${discount > 0 ? `
          <div style="display:flex; justify-content:space-between;">
            <span>${t("discount_label", "Chegirma")}:</span>
            <span>-${discount.toLocaleString()}</span>
          </div>` : ""}
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 15px; display:flex; justify-content:space-between; font-size: 15px;">
          <span>${t("total_label", "Jami")}:</span>
          <span>${finalTotal.toLocaleString()}</span>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight: bold;">
          <span>${t("payment_type_label", "To'lov turi")} (${currency.toUpperCase()}):</span>
          <span>${finalTotal.toLocaleString()}</span>
        </div>

        <div style="text-align: center; font-size: 12px; margin-top: 10px;">
          ${t("thanks_for_purchase", "Xaridingiz uchun rahmat!")}<br>
          ${t("glad_to_serve", "Xizmat ko'rsatishdan mamnunmiz.")}
        </div>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; justify-content: center;">
        <button onclick="downloadReceiptPNG()" style="background: #28a745; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px;">
          🖼 ${t("download_png", "PNG Yuklash")}
        </button>
        <button onclick="downloadReceiptPDF()" style="background: #007bff; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px;">
          📄 ${t("download_pdf", "PDF Yuklash")}
        </button>
        <button onclick="closeReceipt()" style="background: #dc3545; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px;">
          ✖ ${t("close_btn", "Yopish")}
        </button>
      </div>
    </div>
  `;

  box.style.display = "flex";
}

function closeReceipt() {
  const box = document.getElementById("receiptBox");
  const content = document.getElementById("receiptContent");
  if (box) box.style.display = "none";
  if (content) content.innerHTML = "";
}

window.downloadReceiptPNG = function () {
  const element = document.getElementById("real-receipt");
  if (!element) { alert(t("receipt_not_found", "Chek topilmadi!")); return; }

  if (typeof html2canvas === 'undefined') {
    alert(t("download_failed_refresh", "Yuklab olish tizimi ishga tushmadi. Sahifani yangilang."));
    return;
  }

  html2canvas(element, { scale: 3, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => {
    const link = document.createElement("a");
    link.download = `Chek_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }).catch(err => {
    console.error("PNG yuklash xatosi:", err);
    alert(t("png_download_failed", "Xatolik yuz berdi!"));
  });
};

window.downloadReceiptPDF = function () {
  const element = document.getElementById("real-receipt");
  if (!element) { alert(t("receipt_not_found", "Chek topilmadi!")); return; }

  if (typeof html2pdf === 'undefined') {
    alert(t("download_failed_refresh", "Yuklab olish tizimi ishga tushmadi. Sahifani yangilang."));
    return;
  }

  const opt = {
    margin: 5,
    filename: `Chek_${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 1 },
    html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" }
  };

  html2pdf().set(opt).from(element).save();
};

window.showReceipt = showReceipt;
window.closeReceipt = closeReceipt;

function generateDiscountCode() {
  return "DISC-" +
    safeUUID()
      .slice(0, 8)
      .toUpperCase();
}

function updateStatusUI(status) {
  const orderStatusBox = document.getElementById("orderStatusBox");
  if (!hasSubmittedOrder || !orderStatusBox) return;

  const raw = normalizeStatus(status);

  orderStatusBox.style.display = "block";

  /* ── CSS (bir marta inject) ── */
  if (!document.getElementById("_otrStyles")) {
    const s = document.createElement("style");
    s.id = "_otrStyles";
    s.textContent = `
      .otr-wrap{width:100%;padding:16px 16px 18px;background:#fff;border-radius:16px;
        box-shadow:0 4px 20px rgba(0,0,0,0.08);box-sizing:border-box;
        font-family:'Segoe UI',Tahoma,sans-serif}
      .otr-title{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
        letter-spacing:.07em;margin-bottom:16px}
      .otr-steps{display:flex;align-items:flex-start;justify-content:space-between;
        position:relative;padding:0 2px}
      .otr-steps::before{content:"";position:absolute;top:17px;left:18px;right:18px;
        height:2px;background:#e5e7eb;z-index:0}
      .otr-bar{position:absolute;top:17px;left:18px;height:2px;
        background:linear-gradient(90deg,#10b981,#34d399);z-index:1;
        transition:width .6s cubic-bezier(.4,0,.2,1)}
      .otr-step{display:flex;flex-direction:column;align-items:center;gap:6px;
        flex:1;z-index:2;min-width:0}
      .otr-ico{width:36px;height:36px;border-radius:50%;background:#f3f4f6;
        border:2px solid #e5e7eb;display:flex;align-items:center;justify-content:center;
        font-size:14px;transition:all .35s ease;flex-shrink:0}
      .otr-step.done .otr-ico{background:#d1fae5;border-color:#10b981;font-size:13px}
      .otr-step.active .otr-ico{background:#10b981;border-color:#10b981;color:#fff;
        box-shadow:0 0 0 5px rgba(16,185,129,.18);animation:otrP 2s infinite}
      .otr-step.error .otr-ico{background:#fee2e2;border-color:#ef4444}
      .otr-lbl{font-size:9px;font-weight:600;color:#9ca3af;text-align:center;
        line-height:1.2;max-width:52px;word-break:break-word}
      .otr-step.done  .otr-lbl{color:#10b981}
      .otr-step.active .otr-lbl{color:#059669;font-weight:700}
      .otr-step.error  .otr-lbl{color:#ef4444}
      .otr-msg{margin-top:14px;padding:10px 14px;border-radius:10px;font-size:13px;
        font-weight:600;text-align:center}
      .otr-msg.s0{background:#f3f4f6;color:#6b7280}
      .otr-msg.s1{background:#eff6ff;color:#1d4ed8}
      .otr-msg.s2{background:#fff7ed;color:#ea580c}
      .otr-msg.s3{background:#ecfdf5;color:#059669}
      .otr-msg.s4{background:#faf5ff;color:#7c3aed}
      .otr-msg.s5{background:#f0fdf4;color:#15803d}
      .otr-msg.s6{background:#fffbeb;color:#d97706}
      .otr-msg.s7{background:#d1fae5;color:#065f46}
      .otr-msg.err{background:#fee2e2;color:#dc2626}
      .otr-msg.cln{background:#e0f2fe;color:#0369a1}
      @keyframes otrP{0%,100%{box-shadow:0 0 0 5px rgba(16,185,129,.18)}
        50%{box-shadow:0 0 0 9px rgba(16,185,129,.07)}}
    `;
    document.head.appendChild(s);
  }

  /* ── Asosiy 7 bosqich ── */
  const STEPS = [
    { icon: "🆕", label: t("st_new", "Yangi") },  // 0
    { icon: "✅", label: t("st_approved", "Tasdiqlandi") },  // 1
    { icon: "🔥", label: t("st_cooking", "Tayyorlanmoqda") },  // 2
    { icon: "🍽️", label: t("st_ready", "Tayyor") },  // 3
    { icon: "🛵", label: t("st_deliver", "Yetkazilmoqda") },  // 4
    { icon: "🏁", label: t("st_delivered", "Yetkazildi") },  // 5
    { icon: "💳", label: t("st_paid", "To‘landi") },  // 6
    { icon: "🎉", label: t("st_confirmed", "To‘lov tasdiqlandi") }, // 7
  ];

  /* ── Alohida holatlar (progress yo‘q) ── */
  const SPECIAL = {
    "tozalanmoqda": { cls: "cln", text: "🧹 " + t("cleaning_msg", "Stolingiz tozalanmoqda...") },
    "cleaning": { cls: "cln", text: "🧹 " + t("cleaning_msg", "Stolingiz tozalanmoqda...") },
    "needs_cleaning": { cls: "cln", text: "🧹 " + t("cleaning_msg", "Stolingiz tozalanmoqda...") },
    "bekor qilindi": { cls: "err", text: "❌ " + t("cancelled_msg", "Buyurtma bekor qilindi.") },
    "yopildi": { cls: "err", text: "📦 " + t("closed_msg", "Buyurtma yopildi.") },
  };

  if (SPECIAL[raw]) {
    const sp = SPECIAL[raw];
    orderStatusBox.innerHTML =
      `<div class="otr-wrap">` +
      `<div class="otr-title">🛒 ${t("status_label", "Buyurtma holati")}</div>` +
      `<div class="otr-msg ${sp.cls}" style="font-size:14px;">${sp.text}</div>` +
      `</div>`;
    return;
  }

  /* ── Status → indeks va xabar ── */
  const INFO = {
    "yangi": { idx: 0, cls: "s0", text: "🆕 " + t("st_new_msg", "Buyurtmangiz qabul qilindi!") },
    "queue": { idx: 0, cls: "s0", text: "🆕 " + t("st_new_msg", "Buyurtmangiz qabul qilindi!") },
    "tasdiqlandi": { idx: 1, cls: "s1", text: "✅ " + t("st_approved_msg", "Admin buyurtmangizni tasdiqladi!") },
    "tayyorlanmoqda": { idx: 2, cls: "s2", text: "🔥 " + t("st_cooking_msg", "Oshpaz taomingizni tayyorlamoqda...") },
    "tayyor": { idx: 3, cls: "s3", text: "🍽️ " + t("st_ready_msg", "Taomingiz tayyor!") },
    "yetkazilmoqda": { idx: 4, cls: "s4", text: "🛵 " + t("st_deliver_msg", "Ofitsiant taomingizni olib kelyapti...") },
    "yetkazildi": { idx: 5, cls: "s5", text: "🏁 " + t("st_delivered_msg", "Taomingiz yetkazildi! Ishtaha bilan!") },
    "to‘landi": { idx: 6, cls: "s6", text: "💳 " + t("st_paid_msg", "To‘lov so‘rovi yuborildi!") },
    "tolandi": { idx: 6, cls: "s6", text: "💳 " + t("st_paid_msg", "To‘lov so‘rovi yuborildi!") },
    "to‘lov tasdiqlandi": { idx: 7, cls: "s7", text: "🎉 " + t("st_confirmed_msg", "To‘lovingiz tasdiqlandi! Rahmat!") },
  };

  const info = INFO[raw] || { idx: 0, cls: "s0", text: "⏳ " + status };
  const curIdx = info.idx;
  const maxIdx = STEPS.length - 1;

  // ── Tayyorlanmoqda statusida vaqtga qarab progress hisoblash ──
  // Faqat cooking (idx=2) bo'lsa va oshpaz vaqt belgilagan bo'lsa
  const isCookingNow = curIdx === 2;
  const ord = activeOrderData || {};
  const cookStartedAt = Number(ord.cookingStartedAt || ord.acceptedAt || 0);
  const cookExpectedAt = Number(ord.expectedReadyAt || ord.readyAt || 0);
  const hasCookTimes = isCookingNow && cookStartedAt > 0 && cookExpectedAt > cookStartedAt;

  function calcCookPct() {
    if (!hasCookTimes) return (curIdx / maxIdx) * 100;
    const totalMs = cookExpectedAt - cookStartedAt;
    const elapsedMs = Date.now() - cookStartedAt;
    // step 2 → step 3 orasidagi foiz: [2/7 .. 3/7]
    const stepStart = 2 / maxIdx * 100;
    const stepEnd = 3 / maxIdx * 100;
    const frac = Math.min(Math.max(elapsedMs / totalMs, 0), 1);
    return stepStart + frac * (stepEnd - stepStart);
  }

  // Progress bar elementini ID bilan yasaymiz (live update uchun)
  const _barId = "otr-cook-bar";
  let pct = hasCookTimes ? calcCookPct() : (curIdx / maxIdx) * 100;

  let stepsHtml = `<div class="otr-bar" id="${_barId}" style="width:${pct}%"></div>`;
  STEPS.forEach((step, idx) => {
    const cls = idx < curIdx ? "done" : idx === curIdx ? "active" : "";
    const icon = idx < curIdx ? "✓" : step.icon;
    stepsHtml +=
      `<div class="otr-step ${cls}">` +
      `<div class="otr-ico">${icon}</div>` +
      `<div class="otr-lbl">${step.label}</div>` +
      `</div>`;
  });

  orderStatusBox.innerHTML =
    `<div class="otr-wrap">` +
    `<div class="otr-title">🛒 ${t("status_label", "Buyurtma holati")}</div>` +
    `<div class="otr-steps">${stepsHtml}</div>` +
    `<div class="otr-msg ${info.cls}">${info.text}</div>` +
    `</div>`;

  // ── Tayyorlanmoqda: progress barni real vaqtda yangilash ──
  if (window._otrCookBarTimer) {
    clearInterval(window._otrCookBarTimer);
    window._otrCookBarTimer = null;
  }
  if (hasCookTimes) {
    window._otrCookBarTimer = setInterval(() => {
      const barEl = document.getElementById(_barId);
      if (!barEl) { clearInterval(window._otrCookBarTimer); return; }
      // Status o'zgargan bo'lsa to'xtatamiz
      const curRaw = typeof normalizeStatus === 'function'
        ? normalizeStatus(activeOrderData?.status || activeOrderData?.statusKey || "")
        : "";
      const stillCooking = curRaw === "tayyorlanmoqda" || curRaw === "cooking";
      if (!stillCooking) { clearInterval(window._otrCookBarTimer); return; }
      const newPct = calcCookPct();
      barEl.style.width = newPct + "%";
    }, 1000);
  }
}
let confirmationResult = null;
let timerInterval = null;

window.simpleLogin = function () {
  const rawPhoneInput = document.getElementById('phoneNumber').value.trim();
  const phoneInput = normalizeCustomerPhone(rawPhoneInput);
  const phoneDigits = phoneInput.replace(/\D/g, "");

  if (!phoneInput || phoneDigits.length !== 12 || !phoneDigits.startsWith("998")) {
    alert(t("enter_full_number", "Raqamni to'liq kiriting! Masalan: 901234567 yoki +998901234567"));
    return;
  }

  localStorage.setItem("userPhone", phoneInput);
  localStorage.setItem("customerPhone", phoneInput);

  const _authSec = document.getElementById('auth-section');
  if (_authSec) _authSec.style.display = 'none';
  const menuSec = document.getElementById('menu-section');
  if (menuSec) {
    menuSec.style.display = 'block';
  }

  if (typeof renderMenu === "function") {
    renderMenu();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const savedPhone = localStorage.getItem("userPhone");
  if (savedPhone) {
    const _as = document.getElementById('auth-section');
    if (_as) _as.style.display = 'none';
    const _ms = document.getElementById('menu-section');
    if (_ms) _ms.style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-modal-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('paymentModal');
      if (modal) modal.style.display = 'none';
    });
  }
});

window.closePaymentModal = function () {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.style.display = 'none';

  if (typeof closeCheckoutModal === "function") closeCheckoutModal();
  if (typeof closeReceipt === "function") closeReceipt();
};

async function saveCustomerToDatabase(phoneNumber) {
  const normalizedPhone = normalizeCustomerPhone(phoneNumber);
  if (!normalizedPhone) return;

  const customerRef = ref(db, `restaurants/${currentRestaurantId}/customers/${normalizedPhone}`);
  const snap = await get(customerRef);

  if (!snap.exists()) {
    await set(customerRef, {
      phone: normalizedPhone,
      visits: 0,
      totalSpent: 0,
      personalDiscount: 0,
      createdAt: Date.now()
    });
  }
  localStorage.setItem("customerPhone", normalizedPhone);
}

async function calculateDiscount(cartTotalAmount, _phoneOverride) {
  // phoneOverride: openPayment'dan to'g'ridan-to'g'ri uzatilgan telefon (localStorage formatiga bog'liq emas)
  const phone = _phoneOverride
    || localStorage.getItem("customerPhone")
    || localStorage.getItem("userPhone")
    || window.currentPaymentPhoneKey
    || "";
  if (!phone) return { finalPrice: cartTotalAmount, discountPercent: 0, discountAmount: 0, isOneTime: false, isVipDiscount: false };

  try {
    // Telefon raqamni Firebase key formatiga o'tkazish — +998XXXXXXXXX (12 raqam)
    // 9 xonali (998 prefikssiz) va to'liq formatlarni qo'llab-quvvatlaymiz
    const cleanDigits = phone.replace(/\D/g, "");
    let normalizedKey;
    if (cleanDigits.length === 9) {
      normalizedKey = `+998${cleanDigits}`;
    } else if (cleanDigits.length === 12 && cleanDigits.startsWith("998")) {
      normalizedKey = `+${cleanDigits}`;
    } else if (cleanDigits.length === 13 && cleanDigits.startsWith("9989")) {
      // +9989... noto'g'ri, 12 ga kesib olamiz
      normalizedKey = `+${cleanDigits.slice(0, 12)}`;
    } else {
      return { finalPrice: cartTotalAmount, discountPercent: 0, discountAmount: 0, isOneTime: false, isVipDiscount: false };
    }

    const snap = await get(ref(db, `restaurants/${currentRestaurantId}/customers/${normalizedKey}`));

    let discountPercent = 0;
    let isOneTime = false;
    let isVipDiscount = false;
    let vipOrdersTotal = 0;
    let vipOrdersUsed = 0;

    if (snap.exists()) {
      const customer = snap.val();

      // ── Yangi VIP tizimi (admin tomonidan berilgan) ──
      const isAdminVip = customer.isVip === true;
      const vipDiscPct = Number(customer.vipDiscountPercent || 0);
      const vipTotal = Number(customer.vipOrdersTotal || 0);
      const vipUsed = Number(customer.vipOrdersUsed || 0);

      if (isAdminVip && vipDiscPct > 0 && (vipTotal === 0 || vipUsed < vipTotal)) {
        // VIP chegirma faol — faqat admin bergan
        discountPercent = vipDiscPct;
        isVipDiscount = true;
        isOneTime = false;
        vipOrdersTotal = vipTotal;
        vipOrdersUsed = vipUsed;
      }
      // Eski fallback olib tashlandi: faqat admin isVip=true bergan mijozga VIP ishlaydi
    }

    const discountAmount = Math.round((cartTotalAmount * discountPercent) / 100);
    const finalPrice = cartTotalAmount - discountAmount;

    return { finalPrice, discountPercent, discountAmount, isOneTime, isVipDiscount, vipOrdersTotal, vipOrdersUsed };
  } catch (error) {
    console.error("Chegirmani hisoblashda xatolik:", error);
    return { finalPrice: cartTotalAmount, discountPercent: 0, discountAmount: 0, isOneTime: false, isVipDiscount: false };
  }
}

async function updateCustomerVisit(totalPaid) {
  const phone = localStorage.getItem("customerPhone");
  if (!phone) return;

  const customerRef = ref(db, `restaurants/${currentRestaurantId}/customers/${phone}`);

  const snap = await get(customerRef);
  if (snap.exists()) {
    const currentData = snap.val();
    await update(customerRef, {
      visits: (currentData.visits || 0) + 1,
      totalSpent: (currentData.totalSpent || 0) + totalPaid,
      updatedAt: Date.now()
    });
  }
}

window.addTestCustomers = async function () {
  const exactPath = `restaurants/${currentRestaurantId}/customers`;
  const testData = {
    "+998901234567": { phone: "+998 90 123 45 67", visits: 5, totalSpent: 450000, personalDiscount: 0, createdAt: Date.now() },
    "+998947654321": { phone: "+998 94 765 43 21", visits: 12, totalSpent: 1250000, personalDiscount: 15, createdAt: Date.now() - 86400000 }
  };

  try {
    await update(ref(db, exactPath), testData);
    alert("✅ " + t("test_customers_added", "Test mijozlar yangi bazaga tushdi! Jadvalni yangilang."));
  } catch (error) {
    console.error("Xato:", error);
  }
}

/* =========================
   XISOB SO'RASH VA TO'LOV 
========================= */
window.requestBill = async function () {
  // ── currentOrderId yo'q bo'lsa, localStorage dan tiklashga urinamiz ──
  if (!currentOrderId || !activeOrderData) {
    const _savedId = localStorage.getItem("activeOrderId") || localStorage.getItem("currentOrderId");
    if (_savedId) {
      try {
        const _snap = await get(ref(db, BASE_PATH + "/orders/" + _savedId));
        if (_snap.exists()) {
          const _ord = _snap.val();
          const _st  = normalizeStatus(getOrderStatusKey(_ord));
          const _alive = !["yopildi", "bekor qilindi", "closed", "cancelled"].includes(_st);
          if (_alive && _ord.tableClosed !== true) {
            currentOrderId   = _savedId;
            activeOrderData  = { ..._ord, _id: _savedId };
            hasSubmittedOrder = true;
            sessionStorage.setItem("client_has_submitted_order", "1");
          } else {
            showNotification(t("active_order_not_found_alert", "Faol buyurtma topilmadi!"));
            return;
          }
        } else {
          showNotification(t("active_order_not_found_alert", "Faol buyurtma topilmadi!"));
          return;
        }
      } catch (_e) {
        console.warn("requestBill restore failed:", _e);
        showNotification(t("active_order_not_found_alert", "Faol buyurtma topilmadi!"));
        return;
      }
    } else {
      showNotification(t("active_order_not_found_alert", "Faol buyurtma topilmadi!"));
      return;
    }
  }

  const tableStr = String(confirmedTableNumber || activeOrderData.table || localStorage.getItem("table") || "").trim();

  // ── KASSA ID: avval mavjud kassaCode ni tekshiramiz ──
  let kassaCode = activeOrderData.kassaCode || null;

  if (!kassaCode) {
    // 4 xonali unikal raqam generatsiya qilamiz (1000–9999)
    kassaCode = String(Math.floor(1000 + Math.random() * 9000));

    // Firebase ga yozamiz
    await update(ref(db, BASE_PATH + "/orders/" + currentOrderId), {
      kassaCode: kassaCode,
      kassaCodeGeneratedAt: Date.now()
    });

    // activeOrderData ni ham yangilaymiz
    activeOrderData.kassaCode = kassaCode;
  }

  await set(push(ref(db, BASE_PATH + "/paymentRequests")), {
    table: tableStr,
    tableId: tableStr,
    orderId: currentOrderId,
    kassaCode: kassaCode,
    status: "requested",
    createdAt: Date.now(),
    requestedBy: clientId
  });

  await update(ref(db, `${BASE_PATH}/tables/${tableStr}`), { status: "billing" });

  const phone = activeOrderData.clientPhone
    || activeOrderData.customerPhone
    || activeOrderData.phoneNumber
    || localStorage.getItem("customerPhone")
    || localStorage.getItem("userPhone")
    || (typeof getCurrentClientPhoneNumber === "function" ? getCurrentClientPhoneNumber() : "")
    || document.getElementById("clientPhoneInput")?.value?.trim()
    || "";

  if (phone) {
    window.currentPaymentPhoneKey = phone;
    localStorage.setItem("customerPhone", phone);
  }

  console.log("💳 requestBill phone:", phone, "| kassaCode:", kassaCode);

  // ── KASSA ID MODAL: mijozga unikal raqamni ko'rsatamiz ──
  _showKassaCodeModal(kassaCode, activeOrderData.orderNumber || "", tableStr);
};

/* ─── Kassa ID modal ─── */
function _showKassaCodeModal(code, orderNumber, table) {
  const old = document.getElementById("_kassaCodeModal");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "_kassaCodeModal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:20px;";

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:24px;padding:36px 32px 28px;
      max-width:360px;width:100%;text-align:center;
      box-shadow:0 24px 64px rgba(0,0,0,0.22);position:relative;
      animation:_kcmPop .32s cubic-bezier(.34,1.56,.64,1) both;
    ">
      <style>
        @keyframes _kcmPop { from{transform:scale(.7);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes _kcmPulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.45)} 50%{box-shadow:0 0 0 14px rgba(34,197,94,0)} }
      </style>
      <button onclick="document.getElementById('_kassaCodeModal').remove()"
        style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#94a3b8;line-height:1;">✕</button>

      <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 16px;border:2px solid #bbf7d0;">🧾</div>

      <h2 style="margin:0 0 6px;font-size:19px;font-weight:800;color:#0f172a;">Kassaga boring!</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.5;">
        Quyidagi <strong>Kassa ID</strong> ni kassirga bering.<br>
        Stol <strong>${table || "—"}</strong>${orderNumber ? " · Buyurtma <strong>#" + orderNumber + "</strong>" : ""}
      </p>

      <div style="background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:18px;padding:22px 16px;margin-bottom:22px;animation:_kcmPulse 2s ease-in-out infinite;">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Kassa ID</div>
        <div style="font-size:58px;font-weight:900;color:#fff;letter-spacing:10px;font-variant-numeric:tabular-nums;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.18);">${code}</div>
      </div>

      <button onclick="
        navigator.clipboard && navigator.clipboard.writeText('${code}').then(()=>{
          this.textContent='✓ Nusxalandi!';this.style.background='#22c55e';this.style.color='#fff';
          setTimeout(()=>{this.textContent='📋 Raqamni nusxalash';this.style.background='';this.style.color='';},2000);
        });"
        style="width:100%;padding:11px;border:1.5px solid #e2e8f0;border-radius:11px;background:#f8fafc;color:#334155;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;">
        📋 Raqamni nusxalash
      </button>

      <button onclick="document.getElementById('_kassaCodeModal').remove()"
        style="width:100%;padding:11px;border:none;border-radius:11px;background:#f1f5f9;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;">
        Yopish
      </button>
      <p style="margin:14px 0 0;font-size:11px;color:#cbd5e1;">✅ Hisob so'rovi yuborildi</p>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

/* =========================
   TO'LOV IMITATSIYASI  
========================= */
window.simulatePayment = async function (method) {
  const amountEl = document.getElementById('paymentTotal');
  const amountText = amountEl ? amountEl.innerText : "0";
  const amount = parseInt(amountText.replace(/\D/g, '')) || 0;
  const restId = localStorage.getItem("restaurantId");

  const modalContent = document.querySelector(".payment-card");
  if (!modalContent) return;

  const originalHTML = modalContent.innerHTML;

  let brandColor = method.toLowerCase() === 'click' ? '#00a1ff' : (method.toLowerCase() === 'payme' ? '#33dac4' : '#28a745');

  modalContent.innerHTML = `
        <div style="text-align:center; padding: 50px 20px;">
            <div style="width: 65px; height: 65px; border: 6px solid #f3f3f3; border-top: 6px solid ${brandColor}; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <h3 style="margin-top:25px; color: #333; font-family: sans-serif;">${method} ${t("paying_via", "orqali to'lanmoqda...")}</h3>               
            <p style="color:#888; font-size: 14px; margin-top: 8px;">${t("dont_close_page", "Iltimos, sahifani yopmang yoki yangilamang.")}</p>
        </div>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        </style>
    `;

  await new Promise(res => setTimeout(res, 2500));

  try {

    if (currentOrderId) {
      await update(ref(db, `restaurants/${restId}/orders/${currentOrderId}/payment`), {
        paid: true,
        method: method,
        time: Date.now(),
        approved: true
      });

      // To'lovdan keyin stol "cleaning" (tozalanmoqda) holatiga o'tadi
      const orderSnap2 = await get(ref(db, `restaurants/${restId}/orders/${currentOrderId}`));
      if (orderSnap2.exists()) {
        const tableNo = orderSnap2.val().table;
        if (tableNo) {
          await update(ref(db, `restaurants/${restId}/tables/${tableNo}`), {
            status: "cleaning",
            cleaningNeededAt: Date.now(),
            busy: false
          });
        }
        // Buyurtma statusini "to'landi" ga o'tkazish
        await update(ref(db, `restaurants/${restId}/orders/${currentOrderId}`), {
          status: "to'landi",
          paidAt: Date.now()
        });
      }
    }

    modalContent.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <div style="width: 90px; height: 90px; background: #28a745; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 50px; margin: 0 auto; animation: popIn 0.5s ease-out forwards;">
                    ✓
                </div>
                <h2 style="margin-top:25px; color: #28a745;">${t("payment_success", "To'lov muvaffaqiyatli!")}</h2>
                <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-top: 20px;">
                    <p style="color:#555; font-size: 18px; margin: 0;">${t("total_paid", "Jami to'landi:")}</p>
                    <p style="color:#000; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${amount.toLocaleString()} UZS</p>
                </div>
                <p style="color:#aaa; font-size: 12px; margin-top: 15px;">Nesta CRM • ${t("approved_status", "Tasdiqlandi")}</p>
            </div>
        `;

    await new Promise(res => setTimeout(res, 2500));

    document.getElementById('paymentModal').style.display = 'none';
    modalContent.innerHTML = originalHTML;

    localStorage.removeItem("discountPercent");
    localStorage.removeItem("discountCode");

    // Savat tozalash listenActiveOrder orqali payment.approved bo'lganda avtomatik bo'ladi

    if (currentOrderId) {
      const snap = await get(ref(db, `restaurants/${restId}/orders/${currentOrderId}`));
      if (snap.exists() && typeof showReceipt === "function") {
        showReceipt(snap.val());
      }
    }

    setTimeout(() => {
      if (typeof openFeedbackModal === "function") openFeedbackModal();
    }, 6000);

  } catch (error) {
    console.error("To'lov xatosi:", error);

    modalContent.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <div style="width: 80px; height: 80px; background: #dc3545; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto; animation: popIn 0.3s ease-out forwards;">
                    ✕
                </div>
                <h2 style="margin-top:20px; color: #dc3545;">${t("error_occurred", "Xatolik yuz berdi")}</h2>
                <p style="color:#888; font-size: 15px; margin-top: 10px;">${t("payment_failed_reason", "Tarmoqda uzilish bo'ldi yoki hisobingizda mablag' yetarli emas. Iltimos, qayta urinib ko'ring.")}</p>
                <button onclick="document.getElementById('paymentModal').style.display='none'; document.querySelector('.payment-card').innerHTML=\`${originalHTML.replace(/`/g, '\\`')}\`;" style="margin-top: 25px; padding: 12px 25px; background: #eee; color: #333; font-weight: bold; border: none; border-radius: 8px; cursor: pointer;">${t("close_and_return", "Yopish va qaytish")}</button>
            </div>
        `;
  }
};

window.handlePaymentMethodChange = function (method) {
  const cardContainer = document.getElementById('card-input-container');
  if (cardContainer) {
    if (method === 'card') {
      cardContainer.style.display = 'block';
      cardContainer.style.animation = 'fadeIn 0.3s ease-in-out';
    } else {
      cardContainer.style.display = 'none';
    }
  }
};

window.openFeedbackModal = function () {
  const modal = document.getElementById('feedback-modal');
  if (modal) {
    modal.style.display = 'flex';
    initStars();
  }
};

/* =========================
   VIP MIJOZ STATUSINI TEKSHIRISH
========================= */
window.vipDiscountPercent = 0;

window.checkVipStatus = async function () {
  const rawPhone = localStorage.getItem("customerPhone") || localStorage.getItem("userPhone");
  if (!rawPhone) {
    hideAllVipElements();
    return;
  }

  // Telefon raqamni normallashtirish (+998XXXXXXXXX)
  const normalizedPhone = normalizeCustomerPhone(rawPhone);
  const _vd = normalizedPhone.replace(/\D/g, "");

  // Faqat aniq +998XXXXXXXXX (12 raqam) formatidagi raqamlarga ruxsat
  if (!normalizedPhone || _vd.length !== 12 || !_vd.startsWith("998")) {
    hideAllVipElements();
    return;
  }

  const restId = localStorage.getItem("restaurantId");

  try {
    const snap = await get(ref(db, `restaurants/${restId}/customers/${normalizedPhone}`));

    if (!snap.exists()) {
      hideAllVipElements();
      return;
    }

    if (snap.exists()) {
      const customer = snap.val();

      // ── Yangi VIP tizimi ──
      // Admin tomonidan berilgan VIP: isVip=true, vipDiscountPercent, vipOrdersTotal, vipOrdersUsed
      const isAdminVip = customer.isVip === true;
      const vipDiscPct = Number(customer.vipDiscountPercent || 0);
      const vipTotal = Number(customer.vipOrdersTotal || 0);
      const vipUsed = Number(customer.vipOrdersUsed || 0);
      const vipLeft = vipTotal - vipUsed;

      if (isAdminVip && vipDiscPct > 0 && (vipTotal === 0 || vipLeft > 0)) {
        // VIP faol — badge va chegirma ko'rsatamiz
        window.vipDiscountPercent = vipDiscPct;


        const headerBadge = document.getElementById("headerBadge");
        if (headerBadge) {
          headerBadge.innerHTML = `👑 VIP -${vipDiscPct}% (${vipLeft} ta qoldi)`;
          headerBadge.style.display = "inline-block";
        }

        const banner = document.getElementById("vip-banner");
        const percentSpan = document.getElementById("vip-percent");
        if (banner && percentSpan) {
          percentSpan.innerText = vipDiscPct;
          banner.style.display = "block";
        }

        if (typeof updatePaymentSummary === "function") updatePaymentSummary();

      } else if (isAdminVip && vipTotal > 0 && vipLeft <= 0) {
        // VIP xaridlar tugagan — VIP olib tashlanadi
        await update(ref(db, `restaurants/${restId}/customers/${normalizedPhone}`), {
          isVip: false
        });
        window.vipDiscountPercent = 0;

        const headerBadge = document.getElementById("headerBadge");
        if (headerBadge) headerBadge.style.display = "none";

        const banner = document.getElementById("vip-banner");
        if (banner) banner.style.display = "none";

      } else {
        // VIP yo'q — hech narsa ko'rsatmaymiz
        // (eski fallback olib tashlandi: faqat admin bergan VIP ishlaydi)
        window.vipDiscountPercent = 0;

        const headerBadge = document.getElementById("headerBadge");
        if (headerBadge) headerBadge.style.display = "none";

        const banner = document.getElementById("vip-banner");
        if (banner) banner.style.display = "none";
      }
    }
  } catch (error) {
    console.error("VIP statusni tekshirishda xato:", error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Sahifa ochilganda telefon raqamni tozalaymiz —
  // VIP badge FAQAT Tekshirish tugmasi bosilganda, foydalanuvchi o'z raqamini kiritganida korsatiladi
  localStorage.removeItem("customerPhone");
  localStorage.removeItem("userPhone");

  // VIP elementlarni yashiramiz
  const _hb0 = document.getElementById("headerBadge");
  if (_hb0) _hb0.style.display = "none";
  const _vb0 = document.getElementById("vip-banner");
  if (_vb0) _vb0.style.display = "none";
  const _vbadge = document.getElementById("vipBadge");
  if (_vbadge) _vbadge.style.display = "none";
  window.vipDiscountPercent = 0;

  // VIP faqat Tekshirish tugmasi bosilganda tekshiriladi — bu yerda chaqirilmaydi
});

function initStars() {
  document.querySelectorAll('.stars').forEach(group => {
    const stars = Array.from(group.querySelectorAll('span'));

    stars.forEach((star, index) => {
      star.onclick = function () {
        const value = index + 1;
        group.setAttribute('data-value', value);

        stars.forEach((s, i) => {
          s.style.color = i < value ? '#ffc107' : '#e4e5e9';
        });
      };
    });
  });
}

window.submitFeedback = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const foodQual = parseInt(document.getElementById('star-food').getAttribute('data-value') || 5);
  const servQual = parseInt(document.getElementById('star-service').getAttribute('data-value') || 5);
  const atmos = parseInt(document.getElementById('star-atmosphere').getAttribute('data-value') || 5);
  const recommend = document.getElementById('feedback-recommend').value === 'yes';

  const urlParams = new URLSearchParams(window.location.search);
  const tableNo = urlParams.get('table') || localStorage.getItem("tableNumber") || "Noma'lum";
  const orderId = localStorage.getItem("lastOrderId") || "";
  const feedbackData = {
    table: tableNo,
    orderId: orderId,
    foodQuality: foodQual,
    serviceQuality: servQual,
    atmosphere: atmos,
    wouldRecommend: recommend,
    createdAt: Date.now()
  };

  try {
    const newFeedbackRef = push(ref(db, `restaurants/${restId}/feedback`));
    await set(newFeedbackRef, feedbackData);

    showNotification(t("thanks_for_rating", "Bahoyingiz uchun rahmat! 🎉"));
    closeFeedback();
  } catch (error) {
    console.error(t("err_feedback", "Baholashda xato:"), error);
    alert(t("error_occurred_alert", "Xatolik yuz berdi!"));
  }
};

window.closeFeedback = function () {
  const modal = document.getElementById('feedback-modal');
  if (modal) modal.style.display = 'none';
};

/* =========================
   MIJOZ UCHUN PROMOKOD VA CHEGIRMA
========================= */
window.appliedPromoCode = null;
window.discountPercent = 0;

window.applyClientPromo = async function () {
  const promoInputEl = document.getElementById("cartPromoInput") || document.getElementById("promo-input");
  const promoInput = promoInputEl ? promoInputEl.value.trim().toUpperCase() : "";
  const msgEl = document.getElementById("promo-msg");

  let userPhone = document.getElementById("phoneNumber")?.value || localStorage.getItem("userPhone") || localStorage.getItem("customerPhone") || "";
  userPhone = userPhone.replace(/\D/g, "").slice(-9);

  const restId = localStorage.getItem("restaurantId");

  if (!promoInput) return;

  try {
    const promoSnap = await get(ref(db, `restaurants/${restId}/discounts/${promoInput}`));

    if (!promoSnap.exists()) {
      msgEl.style.color = "red";
      msgEl.innerText = "❌ " + t("promo_not_found", "Bunday promokod topilmadi!");
      msgEl.style.display = "block";
      return;
    }

    const promoData = promoSnap.val();

    const usesLeftOld = promoData.usesLeft !== undefined ? Number(promoData.usesLeft) : (promoData.used ? 0 : 1);

    if (promoData.used && usesLeftOld <= 0) {
      msgEl.style.color = "red";
      msgEl.innerText = "❌ " + t("promo_already_used", "Bu promokod ishlatib bo'lingan!");
      msgEl.style.display = "block";
      return;
    }
    if (usesLeftOld <= 0) {
      msgEl.style.color = "red";
      msgEl.innerText = "❌ " + t("promo_limit_reached", "Bu promokod limiti tugagan!");
      msgEl.style.display = "block";
      return;
    }

    if (promoData.ownerPhone) {
      const ownerClean = promoData.ownerPhone.replace(/\D/g, "").slice(-9);
      if (ownerClean !== userPhone) {
        msgEl.style.color = "red";
        msgEl.innerText = "❌ " + t("promo_not_yours", "Bu promokod sizning raqamingizga tegishli emas!");
        msgEl.style.display = "block";
        return;
      }
    }

    localStorage.setItem("discountPercent", promoData.percent);
    localStorage.setItem("discountCode", promoData.code);

    msgEl.style.color = "#28a745";
    msgEl.innerText = `🎉 ${t("congrats_discount_applied", "Tabriklaymiz!")} ${promoData.percent}% ${t("discount_applied", "chegirma qo'llanildi.")}`;
    msgEl.style.display = "block";

    if (typeof updatePaymentSummary === "function") updatePaymentSummary();

  } catch (error) {
    console.error("Promokod tekshirishda xato:", error);
  }
};

// ==========================================
// 🛡 MIJOZ VA BRONNI TEKSHIRISH TIZIMI
// ==========================================
window.verifyTableAccess = async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTable = urlParams.get("table");

  const tableInput = document.getElementById("stolRaqamiInput")?.value || urlTable;
  const phoneInput = document.getElementById("telefonRaqamInput")?.value.trim();

  if (!tableInput || !phoneInput) {
    alert(t("enter_table_and_phone", "Iltimos, stol va telefon raqamingizni kiriting!"));
    return;
  }

  const restId = urlParams.get("rest") || localStorage.getItem("restaurantId");
  if (!restId) return;

  const cleanInputPhone = phoneInput.replace(/\D/g, "");

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const reservationsRef = ref(db, `restaurants/${restId}/reservations`);
    const snap = await get(reservationsRef);

    let isReservedByOther = false;
    let matchedReservation = null;
    let matchedResKey = null;

    if (snap.exists()) {
      const reservations = snap.val();

      for (const key in reservations) {
        const res = reservations[key];

        if (res.date === todayStr &&
          String(res.tableNumber) === String(tableInput) &&
          ["pending", "confirmed", "seated"].includes(res.status)) {

          const cleanResPhone = (res.phone || "").replace(/\D/g, "");

          if (cleanResPhone === cleanInputPhone || cleanResPhone.endsWith(cleanInputPhone.slice(-9))) {
            matchedReservation = res;
            matchedResKey = key;
            isReservedByOther = false; // Bug 4 fix: o'z broni topilsa flagni tiklash
            break;
          } else {
            isReservedByOther = true;
          }
        }
      }
    }

    if (matchedReservation) {
      alert(`${t("welcome_guest", "Xush kelibsiz")}, ${matchedReservation.guestName}! ${t("menu_access_granted", "Menyuga ruxsat berildi.")}`);

      const resId = matchedReservation.id || matchedResKey;
      const now = Date.now();

      const updates = {};
      updates[`restaurants/${restId}/reservations/${resId}/status`] = "seated";
      updates[`restaurants/${restId}/reservations/${resId}/updatedAt`] = now;

      updates[`restaurants/${restId}/tables/${tableInput}/status`] = "busy";
      updates[`restaurants/${restId}/tables/${tableInput}/busy`] = true;
      updates[`restaurants/${restId}/tables/${tableInput}/updatedAt`] = now;

      await update(ref(db), updates);
      grantAccessToMenu(tableInput, phoneInput, matchedReservation.guestName);

    } else if (isReservedByOther) {
      const errorDiv = document.getElementById("reservationError") || createErrorDiv();
      errorDiv.innerHTML = `
          <i class="fa-solid fa-circle-exclamation" style="font-size:40px; color:#ef4444; margin-bottom:10px;"></i><br>
          <b>${t("table_already_reserved", "Afsuski, bu stol bron qilingan!")}</b><br>
          <span style="font-size:14px; color:#666;">${t("please_choose_another_table", "Boshqa bo'sh stol tanlashingizni so'raymiz.")}</span>
      `;
      errorDiv.style.display = "block";

    } else {
      // Bug 1 fix: walk-in mijozni ham DB ga yozish — stol busy bo'lmasa bron egasi ham o'tira olmaydi
      const now = Date.now();
      await update(ref(db), {
        [`restaurants/${restId}/tables/${tableInput}/status`]: "busy",
        [`restaurants/${restId}/tables/${tableInput}/busy`]: true,
        [`restaurants/${restId}/tables/${tableInput}/updatedAt`]: now,
      });
      grantAccessToMenu(tableInput, phoneInput, "Mijoz");
    }

  } catch (error) {
    console.error("Tekshirishda xato:", error);
  }
};

// ==========================================
// ⭐ MIJOZ FIKRINI OLISH (FEEDBACK) TIZIMI
// ==========================================
window.showFeedbackModal = function (orderId) {
  if (localStorage.getItem(`feedback_done_${orderId}`)) return;

  const existingModal = document.getElementById("clientFeedbackModal");
  if (existingModal) existingModal.remove();

  const modalHtml = `
        <div id="clientFeedbackModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;">
            <div style="background: #fff; width: 100%; max-width: 400px; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; animation: popIn 0.3s ease-out;">
                <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #111827;">${t("bon_appetit", "Yoqimli ishtaha! 😋")}</h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280;">${t("rate_service_quality", "Xizmatimiz sifatini baholang:")}</p>
                
                <div style="margin-bottom: 15px; text-align: left;">
                    <label style="font-size: 14px; font-weight: 600; color: #374151;">🍲 ${t("food_quality", "Taom sifati")}</label>
                    <div class="star-rating" data-category="food" style="font-size: 32px; color: #e5e7eb; cursor: pointer; display: flex; justify-content: space-between;">
                        <span data-value="1">★</span><span data-value="2">★</span><span data-value="3">★</span><span data-value="4">★</span><span data-value="5">★</span>
                    </div>
                </div>

                <div style="margin-bottom: 15px; text-align: left;">
                    <label style="font-size: 14px; font-weight: 600; color: #374151;">🧑‍🍳 ${t("service_quality", "Xizmat ko'rsatish")}</label>
                    <div class="star-rating" data-category="service" style="font-size: 32px; color: #e5e7eb; cursor: pointer; display: flex; justify-content: space-between;">
                        <span data-value="1">★</span><span data-value="2">★</span><span data-value="3">★</span><span data-value="4">★</span><span data-value="5">★</span>
                    </div>
                </div>

                <div style="margin-bottom: 20px; text-align: left;">
                    <label style="font-size: 14px; font-weight: 600; color: #374151;">🏠 ${t("restaurant_atmosphere", "Restoran muhiti")}</label>
                    <div class="star-rating" data-category="atmosphere" style="font-size: 32px; color: #e5e7eb; cursor: pointer; display: flex; justify-content: space-between;">
                        <span data-value="1">★</span><span data-value="2">★</span><span data-value="3">★</span><span data-value="4">★</span><span data-value="5">★</span>
                    </div>
                </div>

                <textarea id="feedbackComment" placeholder="${t("feedback_placeholder", "Qo'shimcha izoh yoki takliflaringiz bo'lsa yozing...")} style="width: 100%; height: 80px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; resize: none; margin-bottom: 20px; font-family: inherit; font-size: 14px; box-sizing: border-box;"></textarea>
                
                <button id="submitFeedbackBtn" style="width: 100%; background: #10b981; color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s;">${t("submit_btn", "Yuborish")}</button>
                <button id="closeFeedbackBtn" style="width: 100%; background: transparent; color: #6b7280; border: none; padding: 10px; margin-top: 5px; font-size: 14px; cursor: pointer;">${t("not_now_btn", "Hozir emas")}</button>
            </div>
            <style>
                @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .star-rating span { transition: color 0.2s; }
                .star-rating span.active { color: #f59e0b; }
            </style>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const ratings = { food: 0, service: 0, atmosphere: 0 };

  document.querySelectorAll(".star-rating").forEach(group => {
    const category = group.dataset.category;
    const stars = group.querySelectorAll("span");

    stars.forEach(star => {
      star.addEventListener("click", (e) => {
        const val = Number(e.target.dataset.value);
        ratings[category] = val;
        stars.forEach(s => {
          s.classList.toggle("active", Number(s.dataset.value) <= val);
        });
      });
    });
  });

  document.getElementById("closeFeedbackBtn").addEventListener("click", () => {
    localStorage.setItem(`feedback_done_${orderId}`, "true");
    document.getElementById("clientFeedbackModal").remove();
  });

  document.getElementById("submitFeedbackBtn").addEventListener("click", async () => {
    if (!ratings.food && !ratings.service && !ratings.atmosphere) {
      alert(t("leave_at_least_one_star", "Iltimos, hech bo'lmasa bitta yulduzcha qoldiring!"));
      return;
    }

    const btn = document.getElementById("submitFeedbackBtn");
    btn.innerText = t("sending_btn", "Yuborilmoqda...");
    btn.disabled = true;

    const restId = localStorage.getItem("restaurantId");
    const clientPhone = localStorage.getItem("clientPhone") || localStorage.getItem("phone") || "Mijoz";
    const tableNum = localStorage.getItem("tableNumber") || "Stol";
    const comment = document.getElementById("feedbackComment").value.trim();

    try {

      const newFeedbackRef = push(ref(db, `restaurants/${restId}/feedback`));
      await set(newFeedbackRef, {
        orderId: orderId,
        orderNumber: orderId.substring(orderId.length - 6),
        phone: clientPhone,
        table: tableNum,
        foodQuality: ratings.food,
        serviceQuality: ratings.service,
        atmosphere: ratings.atmosphere,
        comment: comment,
        createdAt: Date.now(),
        isRead: false
      });

      localStorage.setItem(`feedback_done_${orderId}`, "true");
      document.getElementById("clientFeedbackModal").remove();

      if (typeof showToast === "function") {
        showToast(t("thanks_for_feedback", "Fikringiz uchun rahmat!"));
      } else {
        alert(t("thanks_for_feedback_big", "Fikringiz uchun katta rahmat!"));
      }

    } catch (error) {
      console.error("Fikr yuborishda xato:", error);
      alert(t("error_try_again", "Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."));
      btn.innerText = t("submit_btn", "Yuborish");
      btn.disabled = false;
    }
  });
};

// ==========================================
// 📱 URL DAN STOL RAQAMINI OLISH 
// ==========================================
window.autoFillTableNumber = function () {
  const urlParams = new URLSearchParams(window.location.search);
  const tableNum = urlParams.get("table");


  if (!tableNum) return;


  const tableInput = document.getElementById("stolRaqamiInput") ||
    document.querySelector("input[placeholder*='Stol']") ||
    document.querySelector("input[placeholder*='stol']");

  if (tableInput) {

    tableInput.value = tableNum;
    tableInput.readOnly = true;
    tableInput.style.backgroundColor = "#f3f4f6";
    tableInput.style.cursor = "not-allowed";
    console.log("✅ Stol raqami avtomat kiritildi: " + tableNum);
  } else {

    setTimeout(window.autoFillTableNumber, 500);
  }
};


document.addEventListener("DOMContentLoaded", window.autoFillTableNumber);
setTimeout(window.autoFillTableNumber, 1000); // Zaxira chaqiruv

function grantAccessToMenu(table, phone, name) {
  localStorage.setItem("customerTable", table);
  localStorage.setItem("customerPhone", phone);
  localStorage.setItem("customerName", name);

  const loginSection = document.querySelector(".login-section");
  const menuSection = document.querySelector(".menu-section");

  if (loginSection) loginSection.style.display = "none";
  if (menuSection) menuSection.style.display = "block";
}

function createErrorDiv() {
  const div = document.createElement("div");
  div.id = "reservationError";
  div.style = "background: #fef2f2; color: #991b1b; padding: 20px; border: 2px solid #f87171; border-radius: 12px; text-align: center; margin-top: 15px; display: none;";

  const btn = document.querySelector("button[onclick='window.verifyTableAccess()']");
  if (btn) btn.parentNode.insertBefore(div, btn.nextSibling);
  else document.body.appendChild(div);

  return div;
}

window.closePayment = function () {
  const modal = document.getElementById("paymentModal");
  if (modal) modal.style.display = "none";

  if (currentOrderId && hasSubmittedOrder) {
    window.showFeedbackModal(currentOrderId);
  }
}

window.openPayment = async function (total, orderNumber, orderItems = null, baseCookTime = 30, phoneKey = "") {
  console.log("🔍 openPayment:", { total, orderNumber, baseCookTime });

  if (!total || total <= 0) {
    const menu = window.allMenu || {};
    const cart = window.cart || JSON.parse(localStorage.getItem("cart") || "{}");
    total = 0;
    Object.entries(cart).forEach(([id, c]) => {
      const m = menu[id];
      if (m) total += Number(m.price || 0) * Number(c.qty || 0);
    });
  }

  currentPaymentTotal = Number(total || 0);
  currentBaseCookTime = Number(baseCookTime || 30);
  window.currentPaymentPhoneKey = phoneKey;

  const modal = document.getElementById("paymentModal");
  if (!modal) return;

  // ── Mahsulotlar ro'yxatini tayyorlash ──
  const menu = window.allMenu || {};
  const cart = window.cart || JSON.parse(localStorage.getItem("cart") || "{}");
  const lang = typeof getLang === "function" ? getLang() : "uz";

  let itemsHtml = "";
  let itemsSource = orderItems
    ? (typeof orderItems === "object" && !Array.isArray(orderItems) ? Object.values(orderItems) : orderItems)
    : Object.entries(cart).map(([id, c]) => {
      const m = menu[id] || {};
      return {
        id, name: m.name || "Mahsulot", price: Number(m.price || 0), qty: Number(c.qty || 0),
        img: m.imgUrl || m.img || m.image || "", category: m.category || "", subcategory: m.subcategory || ""
      };
    });

  (itemsSource || []).forEach(item => {
    const itemName = typeof item.name === "object" ? (item.name[lang] || item.name.uz || "Mahsulot") : (item.name || "Mahsulot");
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const sum = qty * price;
    const imgSrc = item.img || item.imgUrl || item.image || "";
    const catLabel = item.category
      ? (typeof t === "function" ? t(item.category) || item.category : item.category)
      : "";
    const subLabel = item.subcategory
      ? (typeof t === "function" ? t(item.subcategory) || item.subcategory : item.subcategory)
      : "";
    const catBadge = catLabel
      ? `<span style="font-size:10px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;margin-right:4px;">${catLabel}</span>`
      : "";
    const subBadge = subLabel
      ? `<span style="font-size:10px;background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;border-radius:4px;padding:2px 6px;">${subLabel}</span>`
      : "";

    itemsHtml += `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
        ${imgSrc
        ? `<img src="${imgSrc}" onerror="this.style.display='none'" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0;">`
        : `<div style="width:56px;height:56px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🍽️</div>`
      }
        <div style="flex:1;min-width:0;">
          <p style="margin:0 0 3px;font-weight:600;font-size:14px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemName}</p>
          <div style="margin-bottom:4px;">${catBadge}${subBadge}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;color:#64748b;">${price.toLocaleString()} so'm × ${qty}</span>
            <span style="font-size:14px;font-weight:700;color:#0f172a;">${sum.toLocaleString()} so'm</span>
          </div>
        </div>
      </div>`;
  });

  const tNum = localStorage.getItem("tableNo") || "-";

  // ── Modal ichini yangilash ──
  let card = modal.querySelector(".payment-card");
  if (!card) {
    // HTML'da .payment-card yo'q bo'lsa — modal ichiga dinamik qo'shamiz
    card = document.createElement("div");
    card.className = "payment-card";
    card.style.cssText = "background:#fff;border-radius:20px;padding:24px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);position:relative;";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
    modal.innerHTML = "";
    modal.appendChild(card);
  }
  if (card) {
    card.innerHTML = `
      <style>
        .pm-method { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 6px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;background:#fff;transition:all 0.18s;flex:1;min-width:0;font-size:12px;font-weight:600;color:#334155; }
        .pm-method:hover { border-color:#22c55e;background:#f0fdf4; }
        .pm-method.active { border-color:#22c55e;background:#f0fdf4;color:#16a34a; }
        .pm-method img { width:32px;height:32px;object-fit:contain;border-radius:6px; }
        .pm-method .pm-icon { font-size:22px; }
        .card-fields { margin-top:14px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;animation:fadeInDown 0.2s ease; }
        @keyframes fadeInDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .cf-input { width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;margin-bottom:10px;background:#fff;color:#1e293b; }
        .cf-input:focus { border-color:#22c55e; }
        .cf-row { display:flex;gap:8px; }
        .pay-main-btn { width:100%;padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 14px rgba(34,197,94,0.35);transition:transform 0.15s,box-shadow 0.15s; }
        .pay-main-btn:hover { transform:translateY(-1px);box-shadow:0 6px 20px rgba(34,197,94,0.45); }
        .pay-main-btn:active { transform:scale(0.98); }
        .modal-close-x { position:absolute;top:12px;right:14px;background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;line-height:1; }
        .modal-close-x:hover { color:#475569; }
      </style>

      <div style="position:relative;">
        <button class="modal-close-x" onclick="document.getElementById('paymentModal').style.display='none'">✕</button>
        <h2 style="margin:0 0 4px;font-size:17px;font-weight:700;color:#0f172a;">To'lov</h2>
        <p style="margin:0 0 14px;font-size:12px;color:#94a3b8;">Buyurtma №${orderNumber || "-"} · Stol ${tNum}</p>
      </div>

      <div style="max-height:220px;overflow-y:auto;margin-bottom:14px;padding-right:2px;">
        ${itemsHtml || `<p style="text-align:center;color:#94a3b8;padding:20px 0;">Buyurtma yo'q</p>`}
      </div>

      <div id="pm-discount-row"></div>

      <div id="pm-promo-section" style="margin-bottom:12px;">
        <div id="pm-promo-cards" style="margin-bottom:8px;">
          <p style="font-size:12px;color:#94a3b8;margin:0 0 6px;">⏳ Promokodlar yuklanmoqda...</p>
        </div>
        <div style="position:relative;">
          <input id="pm-promo-input" type="text" placeholder="🎫 Promokod kiriting..."
            style="width:100%;box-sizing:border-box;padding:10px 46px 10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;background:#fff;color:#1e293b;letter-spacing:1px;"
            oninput="this.value=this.value.toUpperCase();"
            onfocus="this.style.borderColor='#22c55e'"
            onblur="this.style.borderColor=this.value?'#22c55e':'#e2e8f0'">
          <button id="pm-promo-apply-btn" onclick="window._applyPaymentPromo()" title="Qo'llash"
            style="position:absolute;right:7px;top:50%;transform:translateY(-50%);background:#22c55e;border:none;border-radius:7px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;line-height:1;"
            onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">›</button>
        </div>
        <div id="pm-promo-msg" style="font-size:12px;margin-top:5px;padding:0 2px;display:none;border-radius:6px;"></div>
      </div>

      <div style="background:#f0fdf4;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <span style="font-size:14px;color:#16a34a;font-weight:600;">${t("total_amount_label", "Jami summa")}</span>
        <span id="paymentTotal" style="font-size:20px;font-weight:800;color:#15803d;">${currentPaymentTotal.toLocaleString()} so'm</span>
      </div>

      <p style="font-size:13px;font-weight:600;color:#475569;margin:0 0 10px;">${t("select_pay_method", "To'lov usulini tanlang:")}</p>
      <div style="display:flex;gap:8px;margin-bottom:0;" id="pm-methods">
        <button class="pm-method" onclick="window._selectPayMethod('cash',this)">
          <span class="pm-icon">💵</span>${t("cash", "Naqd")}
        </button>
        <button class="pm-method" onclick="window._selectPayMethod('card',this)">
          <span class="pm-icon">💳</span>Karta
        </button>
        <button class="pm-method" onclick="window._selectPayMethod('click',this)">
          <img src="https://cdn.jsdelivr.net/gh/nicholasgasior/gsfmt@master/click-logo.png" onerror="this.outerHTML='<span style=font-size:20px>🔵</span>'" >Click
        </button>
        <button class="pm-method" onclick="window._selectPayMethod('payme',this)">
          <img src="https://cdn.jsdelivr.net/gh/nicholasgasior/gsfmt@master/payme-logo.png" onerror="this.outerHTML='<span style=font-size:20px>🟢</span>'">Payme
        </button>
      </div>

      <div id="pm-card-fields" style="display:none;">
        <div class="card-fields">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;" id="pm-card-title">💳 Karta ma'lumotlari</p>
          <input class="cf-input" id="pm-card-num" type="text" placeholder="0000 0000 0000 0000" maxlength="19"
            oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19)" >
          <div class="cf-row">
            <input class="cf-input" id="pm-card-exp" type="text" placeholder="MM/YY" maxlength="5"
              oninput="let v=this.value.replace(/\\D/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);this.value=v;" style="margin-bottom:0;">
            <input class="cf-input" id="pm-card-cvv" type="password" placeholder="CVV" maxlength="3"
              oninput="this.value=this.value.replace(/\\D/g,'')" style="margin-bottom:0;">
          </div>
        </div>
      </div>

      <button class="pay-main-btn" style="margin-top:18px;" onclick="window._doSimulatePayment()">
        💸 To'lash — <span id="pm-btn-total">${currentPaymentTotal.toLocaleString()}</span> so'm
      </button>
    `;
  }

  modal.style.display = "flex";

  // ── To'lov usulini tanlash logikasi ──
  window._selectedPayMethod = "cash";
  window._selectPayMethod = function (method, btn) {
    window._selectedPayMethod = method;
    document.querySelectorAll(".pm-method").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const cf = document.getElementById("pm-card-fields");
    const title = document.getElementById("pm-card-title");
    if (cf) {
      const showCard = ["card", "click", "payme"].includes(method);
      cf.style.display = showCard ? "block" : "none";
      if (title) {
        if (method === "click") title.textContent = "🔵 Click karta ma'lumotlari";
        else if (method === "payme") title.textContent = "🟢 Payme karta ma'lumotlari";
        else title.textContent = "💳 Karta ma'lumotlari";
      }
    }
  };

  // ── To'lash tugmasi logikasi ──
  window._doSimulatePayment = async function () {
    const method = window._selectedPayMethod || "cash";
    const showCard = ["card", "click", "payme"].includes(method);
    if (showCard) {
      const num = (document.getElementById("pm-card-num")?.value || "").replace(/\s/g, "");
      const exp = document.getElementById("pm-card-exp")?.value || "";
      const cvv = document.getElementById("pm-card-cvv")?.value || "";
      if (num.length < 16 || exp.length < 5 || cvv.length < 3) {
        const inp = document.getElementById(num.length < 16 ? "pm-card-num" : exp.length < 5 ? "pm-card-exp" : "pm-card-cvv");
        if (inp) { inp.style.borderColor = "#ef4444"; inp.focus(); setTimeout(() => inp.style.borderColor = "#e2e8f0", 1500); }
        return;
      }
    }
    if (typeof window.simulatePayment === "function") {
      // Promokod ishlatilgan bo'lsa — usesLeft ni kamaytiramiz
      if (window._appliedVipPromoCode) {
        const _rId = localStorage.getItem("restaurantId");
        try {
          if (window._appliedVipPromoCode === "VIP-DISCOUNT") {
            // Virtual VIP fallback — customers/ dagi vipOrdersUsed ni oshiramiz
            const _phone2 = localStorage.getItem("customerPhone") || localStorage.getItem("userPhone") || "";
            const _norm2  = (p) => String(p || "").replace(/\D/g, "").slice(-9);
            const _cAll2  = (await get(ref(db, `restaurants/${_rId}/customers`))).val() || {};
            const _cKey2  = Object.keys(_cAll2).find(k => _norm2(_cAll2[k]?.phone || k) === _norm2(_phone2));
            if (_cKey2) {
              const _vUsed2 = Number(_cAll2[_cKey2].vipOrdersUsed || 0) + 1;
              const _vTot2  = Number(_cAll2[_cKey2].vipOrdersTotal || 0);
              const _vDone2 = _vTot2 > 0 && _vUsed2 >= _vTot2;
              await update(ref(db, `restaurants/${_rId}/customers/${_cKey2}`), {
                vipOrdersUsed: _vUsed2,
                ...(_vDone2 ? { isVip: false, vipEndedAt: Date.now() } : {})
              });
              console.log(`👑 VIP xarid #${_vUsed2}/${_vTot2}${_vDone2 ? " — VIP tugadi!" : ""}`);
            }
          } else {
            // Oddiy discounts/ promokod
            const _pSnap = await get(ref(db, `restaurants/${_rId}/discounts/${window._appliedVipPromoCode}`));
            if (_pSnap.exists()) {
              const _pData   = _pSnap.val();
              const _usesLeft = Number(_pData.usesLeft !== undefined ? _pData.usesLeft : (_pData.used ? 0 : 1));
              const _newLeft  = Math.max(0, _usesLeft - 1);
              const _nowDone  = _newLeft === 0;
              await update(ref(db, `restaurants/${_rId}/discounts/${window._appliedVipPromoCode}`), {
                usesLeft: _newLeft,
                used:     _nowDone,
                ...(_nowDone ? { usedAt: Date.now() } : {})
              });
              console.log(`✅ Promokod ${window._appliedVipPromoCode}: ${_usesLeft} → ${_newLeft} qoldi.${_nowDone ? " Tugadi." : ""}`);
            }
          }
        } catch (_e) { console.warn("Promokod yangilashda xato:", _e); }
        window._appliedVipPromoCode = null;
      }
      window.simulatePayment(method);
    }
  };

  // ── VIP chegirma tekshiruvi ──
  // calculateDiscount natijasi keyingi promo kartochkalar blokiga uzatiladi.
  // VIP topilsa _vipFromCalc to'ldiriladi va _free massiviga qo'shiladi.
  let discountInfo = null;
  let _vipFromCalc = null; // {percent, normalizedKey}
  try {
    discountInfo = await calculateDiscount(currentPaymentTotal, phoneKey);
    console.log("💰 calculateDiscount natija:", discountInfo);
    if (discountInfo && discountInfo.isVipDiscount && discountInfo.discountPercent > 0) {
      _vipFromCalc = { percent: discountInfo.discountPercent };
      console.log("👑 VIP calculateDiscount orqali topildi, promo kartochkaga uzatilmoqda");
    }
  } catch (_e) { console.warn("calculateDiscount xato:", _e); }

  // ── Mijozning promokodlarini kartochka sifatida ko'rsatish ──
  // Qoida: 1 buyurtma = 1 promokod. Agar order'da allaqachon appliedPromo bor bo'lsa — bloklanadi.
  try {
    // Telefon raqamini barcha manbalardan qidiramiz
    const _rawPhone = phoneKey
      || window.currentPaymentPhoneKey
      || localStorage.getItem("customerPhone")
      || localStorage.getItem("userPhone")
      || (typeof getCurrentClientPhoneNumber === "function" ? getCurrentClientPhoneNumber() : "")
      || activeOrderData?.clientPhone
      || activeOrderData?.customerPhone
      || activeOrderData?.phoneNumber
      || document.getElementById("clientPhoneInput")?.value?.trim()
      || "";
    const _rId = localStorage.getItem("restaurantId");
    const cardsEl = document.getElementById("pm-promo-cards");
    if (!cardsEl) throw new Error("no cards el");

    console.log("💳 Promo search phone:", _rawPhone, "| restId:", _rId, "| orderId:", currentOrderId);

    if (!_rawPhone || !_rId) {
      cardsEl.innerHTML = "";
    } else {
      let _orderAppliedPromo = null;
      if (currentOrderId) {
        try {
          const _oSnap = await get(ref(db, `restaurants/${_rId}/orders/${currentOrderId}/appliedPromo`));
          if (_oSnap.exists()) _orderAppliedPromo = _oSnap.val();
        } catch (_oe) { console.warn("Order promo check xato:", _oe); }
      }

      if (_orderAppliedPromo) {
        const promoSnap = await get(ref(db, `restaurants/${_rId}/discounts/${_orderAppliedPromo}`));
        const promoData = promoSnap.exists() ? promoSnap.val() : { percent: 0 };
        cardsEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1.5px solid #86efac;
            border-radius:10px;padding:8px 12px;margin-bottom:8px;">
            <span style="font-size:18px;">✅</span>
            <div>
              <span style="font-size:13px;font-weight:700;color:#15803d;">${_orderAppliedPromo}</span>
              <span style="font-size:11px;color:#4ade80;margin-left:6px;">-${promoData.percent}%</span>
              <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Bu buyurtmaga promokod allaqachon qo'llanilgan</p>
            </div>
          </div>`;
        const inp = document.getElementById("pm-promo-input");
        const applyBtn = document.getElementById("pm-promo-apply-btn");
        if (inp) {
          inp.value = _orderAppliedPromo;
          inp.readOnly = true;
          inp.style.borderColor = "#22c55e";
          inp.style.background  = "#f0fdf4";
          inp.style.color       = "#15803d";
          inp.style.fontWeight  = "700";
        }
        if (applyBtn) {
          applyBtn.innerHTML = "✓";
          applyBtn.style.background = "#16a34a";
          applyBtn.disabled = true;
          applyBtn.onmouseover = null;
          applyBtn.onmouseout  = null;
        }
        // _applyPaymentPromo ni ham bloklash
        window._appliedVipPromoCode = _orderAppliedPromo;
        window._orderPromoLocked    = true;
      } else {
        // 2️⃣ Mijozga tegishli aktiv promokodlarni topish
        window._orderPromoLocked = false;
        const _norm  = (p) => String(p || "").replace(/\D/g, "").slice(-9);
        const _myKey = _norm(_rawPhone);
        const _dSnap = await get(ref(db, `restaurants/${_rId}/discounts`));
        const _allD  = _dSnap.val() || {};
        const _free  = Object.values(_allD).filter(d => {
          const isOwner  = d.ownerPhone && _norm(d.ownerPhone) === _myKey;
          const isGlobal = !d.ownerPhone; // ownerPhone yo'q — umumiy promokod
          const ul = d.usesLeft !== undefined ? Number(d.usesLeft) : (d.used ? 0 : 1);
          return (isOwner || isGlobal) && !d.used && ul > 0;
        });

        console.log("Found promos:", _free.length, _free.map(p=>p.code));

        // VIP kartochkani _free'ga qo'shish:
        // 1-ustuvorlik: calculateDiscount (tez, exact key) natijasi — _vipFromCalc
        // 2-ustuvorlik: customers/ scan (sekin, fallback)
        if (!_free.some(d => d.isVipPromo)) {
          if (_vipFromCalc) {
            // calculateDiscount VIP topdi — kartochkaga to'g'ridan-to'g'ri uzatamiz
            const _vTotal = Number(discountInfo && discountInfo.vipOrdersTotal || 0);
            const _vUsed  = Number(discountInfo && discountInfo.vipOrdersUsed  || 0);
            const _vLeft  = _vTotal > 0 ? (_vTotal - _vUsed) : 999;
            _free.push({
              code:       "VIP-DISCOUNT",
              percent:    _vipFromCalc.percent,
              used:       false,
              usesLeft:   _vLeft,
              maxUses:    _vTotal,
              ownerPhone: _myKey,
              isVipPromo: true,
              _isFallback: true
            });
            console.log("VIP calculateDiscount->promo kartochka:", _vipFromCalc.percent + "%");
          } else {
            // calculateDiscount VIP topa olmadi — customers/ scan bilan fallback
            try {
              const _cSnap = await get(ref(db, `restaurants/${_rId}/customers`));
              const _cAll  = _cSnap.val() || {};
              const _cData = Object.entries(_cAll).reduce((found, [key, c]) => {
                if (found) return found;
                const byPhone = String(c.phone || "").replace(/\D/g, "").slice(-9);
                const byKey   = String(key).replace(/\D/g, "").slice(-9);
                return (byPhone === _myKey || byKey === _myKey) ? c : null;
              }, null);
              console.log("VIP scan fallback:", _myKey, "->",
                _cData ? "isVip=" + _cData.isVip : "NOT FOUND");
              if (_cData && _cData.isVip === true && _cData.vipDiscountPercent > 0) {
                const _vTotal = Number(_cData.vipOrdersTotal || 0);
                const _vUsed  = Number(_cData.vipOrdersUsed  || 0);
                const _vLeft  = _vTotal > 0 ? (_vTotal - _vUsed) : 999;
                if (_vLeft > 0) {
                  _free.push({
                    code:       "VIP-DISCOUNT",
                    percent:    _cData.vipDiscountPercent,
                    used:       false,
                    usesLeft:   _vLeft,
                    maxUses:    _vTotal,
                    ownerPhone: _myKey,
                    isVipPromo: true,
                    _isFallback: true
                  });
                  console.log("VIP scan fallback qoshildi:", _cData.vipDiscountPercent + "%");
                }
              }
            } catch (_ve) { console.warn("VIP scan fallback xato:", _ve); }
          }
        }


        if (_free.length === 0) {
          cardsEl.innerHTML = "";
          // Promokod yo'q — butun seksiyani yashiramiz (bo'sh input ko'rinmasin)
          const _ps = document.getElementById("pm-promo-section");
          if (_ps) _ps.style.display = "none";
        } else if (_free.length === 1) {
          const _ps1 = document.getElementById("pm-promo-section");
          if (_ps1) _ps1.style.display = "";
          const _solo = _free[0];
          const _soloUl = _solo.usesLeft !== undefined ? Number(_solo.usesLeft) : 1;
          const _soloMulti = (_solo.maxUses || 1) > 1;
          const _soloBadge = _soloMulti
            ? `<span style="font-size:9px;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 4px;margin-left:3px;">${_soloUl}×</span>` : "";
          const _soloVip = _solo.isVipPromo
            ? `<span style="font-size:9px;background:#fef9c3;color:#b45309;border-radius:4px;padding:1px 4px;margin-left:3px;">VIP</span>` : "";

          cardsEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;background:#fafff4;border:1.5px solid #bbf7d0;
              border-radius:10px;padding:8px 12px;margin-bottom:8px;">
              <span style="font-size:18px;">🎫</span>
              <div>
                <span style="font-size:13px;font-weight:700;color:#15803d;">${_solo.code}${_soloBadge}${_soloVip}</span>
                <span style="font-size:11px;color:#4ade80;margin-left:6px;">-${_solo.percent}%</span>
                <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Promokod avtomatik qo'llanilmoqda...</p>
              </div>
            </div>`;

          const inp = document.getElementById("pm-promo-input");
          if (inp) {
            inp.value = _solo.code;
            inp.style.borderColor = "#22c55e";
            inp.style.background  = "#f0fdf4";
          }
          // _applyPaymentPromo quyida aniqlanadi — retry bilan chaqiramiz
          const _autoApply = () => {
            if (typeof window._applyPaymentPromo === "function") {
              window._applyPaymentPromo();
            } else {
              setTimeout(_autoApply, 100);
            }
          };
          setTimeout(_autoApply, 400);

        } else {
          // ── Ko'p promokod: select kartochkalar ──
          const _psM = document.getElementById("pm-promo-section");
          if (_psM) _psM.style.display = "";
          cardsEl.innerHTML = `
            <p style="font-size:11px;font-weight:600;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;">
              🎫 Promokodingizni tanlang
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
              ${_free.map(p => {
                const ul = p.usesLeft !== undefined ? Number(p.usesLeft) : 1;
                const isMulti = (p.maxUses || 1) > 1;
                const badge   = isMulti ? `<span style="font-size:9px;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 4px;margin-left:3px;">${ul}×</span>` : "";
                const vipBadge = p.isVipPromo ? `<span style="font-size:9px;background:#fef9c3;color:#b45309;border-radius:4px;padding:1px 4px;margin-left:3px;">VIP</span>` : "";
                return `
                  <button onclick="window._selectPromoCard('${p.code}',${p.percent},this)"
                    data-promo-code="${p.code}"
                    style="display:flex;flex-direction:column;align-items:flex-start;padding:8px 12px;
                      border:2px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;
                      transition:all .15s;min-width:90px;text-align:left;">
                    <span style="font-size:13px;font-weight:800;color:#15803d;letter-spacing:.5px;">${p.code}${badge}${vipBadge}</span>
                    <span style="font-size:11px;color:#64748b;margin-top:2px;">-${p.percent}%</span>
                  </button>`;
              }).join("")}
            </div>`;

          // VIP bo'lsa uni, yo'qsa birinchisini tanlangan qilib, avtomatik apply qilish
          const best = _free.find(d => d.isVipPromo) || _free[0];
          const inp  = document.getElementById("pm-promo-input");
          if (inp && best) {
            inp.value = best.code;
            inp.style.borderColor = "#22c55e";
            inp.style.background  = "#f0fdf4";
            setTimeout(() => {
              const firstCard = cardsEl.querySelector(`[data-promo-code="${best.code}"]`);
              if (firstCard) {
                firstCard.style.borderColor = "#22c55e";
                firstCard.style.background  = "#f0fdf4";
              }
            }, 50);
            // Ko'p promokod bo'lsa ham birinchisini avtomatik apply qilamiz
            const _autoApplyMulti = () => {
              if (typeof window._applyPaymentPromo === "function") {
                window._applyPaymentPromo();
              } else {
                setTimeout(_autoApplyMulti, 100);
              }
            };
            setTimeout(_autoApplyMulti, 450);
          }
        }
      }
    }
  } catch (_e) {
    const cardsEl = document.getElementById("pm-promo-cards");
    if (cardsEl) cardsEl.innerHTML = "";
    console.warn("Promo kartochkalar xatosi:", _e);
  }

  // Kartochka bosilganda: inputga yoziladi + avtomatik qo'llanadi
  window._selectPromoCard = function (code, percent, btn) {
    // Barcha kartochkalarni reset
    document.querySelectorAll("[data-promo-code]").forEach(b => {
      b.style.borderColor = "#e2e8f0";
      b.style.background  = "#fff";
    });
    // Tanlanganni belgilash
    if (btn) { btn.style.borderColor = "#22c55e"; btn.style.background = "#f0fdf4"; }
    // Inputga yozish
    const inp = document.getElementById("pm-promo-input");
    if (inp) {
      inp.value = code;
      inp.style.borderColor = "#22c55e";
      inp.style.background  = "#f0fdf4";
    }
    // Avtomatik qo'llash
    if (typeof window._applyPaymentPromo === "function") {
      window._applyPaymentPromo();
    }
  };

  // ── _applyPaymentPromo — strelka bosilganda ──
  window._applyPaymentPromo = async function () {
    const inp   = document.getElementById("pm-promo-input");
    const msgEl = document.getElementById("pm-promo-msg");
    const code  = inp ? inp.value.trim().toUpperCase() : "";

    function showMsg(txt, color, bg) {
      if (!msgEl) return;
      msgEl.innerText        = txt;
      msgEl.style.color      = color;
      msgEl.style.background = bg || "transparent";
      msgEl.style.padding    = bg ? "5px 8px" : "0";
      msgEl.style.display    = "block";
    }

    // 1 buyurtma = 1 promokod: order'da allaqachon qo'llanilgan bo'lsa bloklash
    if (window._orderPromoLocked) {
      showMsg("⚠️ Bu buyurtmaga promokod allaqachon qo'llanilgan!", "#92400e", "#fefce8");
      return;
    }

    if (!code) { showMsg("❗ Promokod kiriting", "#b45309"); return; }

    const _rId   = localStorage.getItem("restaurantId");
    const _phone = phoneKey
      || window.currentPaymentPhoneKey
      || localStorage.getItem("customerPhone")
      || localStorage.getItem("userPhone")
      || (typeof getCurrentClientPhoneNumber === "function" ? getCurrentClientPhoneNumber() : "")
      || activeOrderData?.clientPhone
      || activeOrderData?.customerPhone
      || document.getElementById("clientPhoneInput")?.value?.trim()
      || "";
    const _norm  = (p) => String(p || "").replace(/\D/g, "").slice(-9);

    try {
      // VIP-DISCOUNT — virtual fallback (discounts/ da yo'q, customers/ dan o'qilgan)
      let promo = null;
      if (code === "VIP-DISCOUNT") {
        const _cSnap2 = await get(ref(db, `restaurants/${_rId}/customers`));
        const _cAll2  = _cSnap2.val() || {};
        const _cData2 = Object.values(_cAll2).find(c => _norm(c.phone || "") === _norm(_phone));
        if (!_cData2 || !_cData2.isVip || !_cData2.vipDiscountPercent) {
          showMsg("❌ VIP status topilmadi!", "red"); return;
        }
        const _vT2 = Number(_cData2.vipOrdersTotal || 0);
        const _vU2 = Number(_cData2.vipOrdersUsed  || 0);
        const _vL2 = _vT2 > 0 ? (_vT2 - _vU2) : 999;
        if (_vL2 <= 0) { showMsg("❌ VIP limiti tugagan!", "red"); return; }
        promo = { code, percent: _cData2.vipDiscountPercent, isVipPromo: true, _isFallback: true, usesLeft: _vL2 };
      } else {
        const snap = await get(ref(db, `restaurants/${_rId}/discounts/${code}`));
        if (!snap.exists()) { showMsg("❌ Bunday promokod topilmadi!", "red"); return; }
        promo = snap.val();
      }

      // Ko'p martalik promokod uchun usesLeft ni tekshiramiz
      const usesLeft = promo.usesLeft !== undefined ? Number(promo.usesLeft) : (promo.used ? 0 : 1);
      if (promo.used && usesLeft <= 0) {
        showMsg("❌ Bu promokod allaqachon ishlatilgan!", "red"); return;
      }
      if (usesLeft <= 0) {
        showMsg("❌ Bu promokod limiti tugagan!", "red"); return;
      }

      if (!promo._isFallback && promo.ownerPhone && _norm(promo.ownerPhone) !== _norm(_phone)) {
        showMsg("❌ Bu promokod sizning raqamingizga tegishli emas!", "red"); return;
      }

      const base    = Number(discountInfo?.finalPrice ?? currentPaymentTotal);
      const discPct = Number(promo.percent || 0);
      const discAmt = Math.round(base * discPct / 100);
      const finalAmt= base - discAmt;

      const discRow = document.getElementById("pm-discount-row");
      if (discRow) discRow.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;">
          <span style="color:#92400e;">🎫 <b>${code}</b> (-${discPct}%)</span>
          <span style="font-weight:700;color:#b45309;">-${discAmt.toLocaleString()} so'm</span>
        </div>`;

      const totalEl    = document.getElementById("paymentTotal");
      const btnTotalEl = document.getElementById("pm-btn-total");
      if (totalEl)    totalEl.innerText    = finalAmt.toLocaleString() + " so'm";
      if (btnTotalEl) btnTotalEl.innerText = finalAmt.toLocaleString();
      currentPaymentTotal = finalAmt;

      if (inp) { inp.readOnly = true; inp.style.borderColor = "#22c55e"; inp.style.background = "#f0fdf4"; }
      const btn = document.getElementById("pm-promo-apply-btn");
      if (btn) { btn.innerHTML = "✓"; btn.style.background = "#16a34a"; btn.disabled = true; btn.onmouseover = null; btn.onmouseout = null; }
      showMsg(`✅ ${discPct}% chegirma qo'llanildi!`, "#16a34a", "#f0fdf4");
      window._appliedVipPromoCode = code;
      window._orderPromoLocked    = true;

      try {
        if (currentOrderId && _rId) {
          await update(ref(db, `restaurants/${_rId}/orders/${currentOrderId}`), {
            appliedPromo:    code,
            discountPercent: discPct,
            discountAmount:  discAmt
          });
        }
      } catch (_we) { console.warn("Order'ga promo yozishda xato:", _we); }

    } catch (_e) { showMsg("❌ Xatolik yuz berdi", "red"); console.error(_e); }
  };

  const firstBtn = document.querySelector(".pm-method");
  if (firstBtn) firstBtn.classList.add("active");
};

window.loadClientSettings = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const settingsRef = ref(db, `restaurants/${restId}/settings`);

    onValue(settingsRef, (snap) => {
      if (snap.exists()) {
        const settings = snap.val();

        const hoursEl = document.getElementById("uiWorkingHours") || document.querySelector('.support-footer p:first-child b');
        const phoneEl = document.getElementById("uiContactPhone") || document.querySelector('.support-footer p:last-child b');

        if (hoursEl && settings.workingHours) hoursEl.innerText = settings.workingHours;
        if (phoneEl && settings.contactPhone) phoneEl.innerText = settings.contactPhone;

        const logoEl = document.querySelector('.header .logo');
        if (logoEl && settings.restaurantName) {
          logoEl.innerText = settings.restaurantName;
          document.title = `${settings.restaurantName} — Elektron Menyu`;
        }

        // Admindan yuklangan restoran logotipini header img ga qo'llash
        if (settings.restaurantLogoUrl) {
          const logoImgs = document.querySelectorAll(
            'img[src*="logo-cropped"], img[src*="logo (2)"], img[src*="logo%20(2)"], .logo-img'
          );
          logoImgs.forEach(img => {
            img.src = settings.restaurantLogoUrl;
            img.style.objectFit = 'contain';
          });
        }
      }
    });
  } catch (error) {
    console.error("Sozlamalarni yuklashda xato:", error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.loadClientSettings();
  }, 1000);

});

function initHeaderTimer(restaurantId, orderId) {
  const orderRef = ref(db, `restaurants/${restaurantId}/orders/${orderId}`);

  onValue(orderRef, (snapshot) => {
    const order = snapshot.val();
    const timerContainer = document.getElementById('header-timer-container');
    const timerText = document.getElementById('header-countdown-text');

    if (order && order.readyAt && order.status !== "closed") {
      timerContainer.style.display = 'flex';

      if (window.headerInterval) clearInterval(window.headerInterval);

      window.headerInterval = setInterval(() => {
        const now = Date.now();
        const diff = order.readyAt - now;

        if (diff <= 0) {
          clearInterval(window.headerInterval);
          timerText.innerText = "Tayyor! ✅";
          return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerText.innerText = `${m}:${s.toString().padStart(2, '0')}`;
      }, 1000);
    } else {
      timerContainer.style.display = 'none';
    }
  });
}
function trackMyOrder(restaurantId, orderId) {
  const orderRef = dbRef(db, `restaurants/${restaurantId}/orders/${orderId}`);

  onValue(orderRef, (snapshot) => {
    const order = snapshot.val();
    const timerContainer = document.getElementById('header-timer-container');
    const timerText = document.getElementById('header-countdown-text');

    if (order && order.readyAt && order.status !== "closed") {
      timerContainer.style.display = 'flex';

      const updateTimer = () => {
        const now = Date.now();
        const diff = order.readyAt - now;

        if (diff <= 0) {
          timerText.innerText = "Tayyor! ✅";
          timerContainer.style.background = "rgba(34, 197, 94, 0.2)";
          return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerText.innerText = `${m}:${s < 10 ? '0' + s : s}`;
      };

      if (window.myCountdown) clearInterval(window.myCountdown);
      window.myCountdown = setInterval(updateTimer, 1000);
      updateTimer();
    } else {
      timerContainer.style.display = 'none';
    }
  });
}

function startCustomerCountdown(readyAtTimestamp) {
  const headerTimerElement = document.getElementById('header-countdown');

  const timer = setInterval(() => {
    const now = Date.now();
    const distance = readyAtTimestamp - now;

    if (distance <= 0) {
      clearInterval(timer);
      headerTimerElement.innerHTML = "🔔 Taomingiz tayyor!";
      headerTimerElement.style.color = "#10b981";
      return;
    }

    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    headerTimerElement.innerHTML = `⏳ Tayyor bo'ladi: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  }, 1000);
}

if (currentRestaurantId && currentOrderId) {
  const userOrderRef = ref(db, `restaurants/${currentRestaurantId}/orders/${currentOrderId}`);

  onValue(userOrderRef, (snapshot) => {
    const order = snapshot.val();
    const timerContainer = document.getElementById('header-timer-container');

    if (order && (order.status === 'cooking' || order.status === 'ready' || order.statusKey === 'ready') &&
      (order.expectedReadyAt || order.readyAtTimestamp || order.readyAt)) {
      startHeaderCountdown(order.expectedReadyAt || order.readyAtTimestamp || order.readyAt);
    } else if (order && order.status === 'ready') {
      if (typeof headerTimerInterval !== 'undefined' && headerTimerInterval) {
        clearInterval(headerTimerInterval);
      }
      if (timerContainer) timerContainer.style.display = 'none';
    } else {
      if (timerContainer) timerContainer.style.display = 'none';
    }
  });

} else {
  console.log("⏱ Taymer kutmoqda: Mijoz hali buyurtma bermagan yoki Buyurtma ID si yo'q.");
}

window.openCheckoutModal = async function () {
  const cart = window.cart || {};
  const menu = window.allMenu || {};
  const modal = document.getElementById('checkout-modal');

  if (!modal) return;

  if (!modal.querySelector('#co-title')) {
    modal.style.cssText = "position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;";
    modal.innerHTML = `
      <div id="checkout-inner" style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;padding:20px 16px 32px;position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <h2 id="co-title" style="margin:0;font-size:18px;font-weight:800;color:#0f172a;">${t("checkout_title", "Hisob-kitob")}</h2>
          <button onclick="window.closeCheckoutModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#94a3b8;line-height:1;padding:4px;">✕</button>
        </div>
        <p id="co-order-meta" style="margin:0 0 14px;font-size:12px;color:#94a3b8;"></p>

        <div id="checkout-items-list" style="margin-bottom:10px;"></div>

        <div id="co-discount-row"></div>

        <div id="co-promo-section" style="margin-bottom:12px;">
          
          <div id="co-promo-cards" style="margin-bottom:8px;"></div>
          <div style="position:relative;">
            <input id="co-promo-input" type="text"
              placeholder="🎫 ${t("enter_promo_placeholder", "Promokod kiriting...")}"
              style="width:100%;box-sizing:border-box;padding:10px 46px 10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;background:#fff;color:#1e293b;letter-spacing:1px;"
              oninput="this.value=this.value.toUpperCase();"
              onfocus="this.style.borderColor='#22c55e'"
              onblur="this.style.borderColor=this.value?'#22c55e':'#e2e8f0'">
            <button id="co-promo-apply-btn" onclick="window._coApplyPromo()" title="${t("apply_btn", "Qo\'llash")}"
              style="position:absolute;right:7px;top:50%;transform:translateY(-50%);background:#22c55e;border:none;border-radius:7px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;line-height:1;"
              onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">›</button>
          </div>
          <div id="co-promo-msg" style="font-size:12px;margin-top:5px;padding:0 2px;display:none;border-radius:6px;"></div>
        </div>

        <div style="background:#f0fdf4;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <span style="font-size:14px;color:#16a34a;font-weight:600;">${t("total_amount_label", "Jami summa")}</span>
          <span id="checkout-final-price" style="font-size:20px;font-weight:800;color:#15803d;">0 ${t("currency", "so\'m")}</span>
        </div>

        <p style="font-size:13px;font-weight:600;color:#475569;margin:0 0 10px;">${t("select_pay_method", "To\'lov usulini tanlang:")}</p>
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <style>
            .co-method-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;background:#fff;flex:1;font-size:12px;font-weight:600;color:#334155;transition:all .18s;}
            .co-method-btn:hover{border-color:#22c55e;background:#f0fdf4;}
            .co-active{border-color:#22c55e!important;background:#f0fdf4!important;color:#16a34a!important;}
          </style>
          <button class="co-method-btn co-active" onclick="window._coSelect('cash',this)">
            <span style="font-size:22px;">💵</span>${t("cash", "Naqd")}
          </button>
          <button class="co-method-btn" onclick="window._coSelect('card',this)">
            <span style="font-size:22px;">💳</span>${t("card", "Karta")}
          </button>
          <button class="co-method-btn" onclick="window._coSelect('click',this)">
            <img src="https://cdn.jsdelivr.net/gh/nicholasgasior/gsfmt@master/click-logo.png"
              onerror="this.outerHTML='<span style=font-size:22px>🔵</span>'"
              style="width:32px;height:32px;object-fit:contain;border-radius:6px;">${t("payment_click", "Click")}
          </button>
          <button class="co-method-btn" onclick="window._coSelect('payme',this)">
            <img src="https://cdn.jsdelivr.net/gh/nicholasgasior/gsfmt@master/payme-logo.png"
              onerror="this.outerHTML='<span style=font-size:22px>🟢</span>'"
              style="width:32px;height:32px;object-fit:contain;border-radius:6px;">${t("payment_payme", "Payme")}
          </button>
        </div>

        <div id="co-card-fields" style="display:none;margin-bottom:14px;">
          <div style="padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <p id="co-card-label" style="margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;">💳 ${t("card_details", "Karta ma\'lumotlari")}</p>
            <input id="co-card-num" type="text" placeholder="0000 0000 0000 0000" maxlength="19"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;margin-bottom:10px;background:#fff;"
              oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19)">
            <div style="display:flex;gap:8px;">
              <input id="co-card-exp" type="text" placeholder="MM/YY" maxlength="5"
                style="flex:1;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;background:#fff;"
                oninput="let v=this.value.replace(/\D/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);this.value=v;">
              <input id="co-card-cvv" type="password" placeholder="CVV" maxlength="3"
                style="flex:1;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;background:#fff;"
                oninput="this.value=this.value.replace(/\D/g,'')">
            </div>
          </div>
        </div>
        <button onclick="window._coPay()"
          style="width:100%;padding:15px;border:none;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 14px rgba(34,197,94,0.35);">
          💸 ${t("pay_now_btn", "To\'lash")} — <span id="co-btn-amount">0</span> ${t("currency", "so\'m")}
        </button>
</div>

      </div>`;
  }

  const listContainer = document.getElementById('checkout-items-list');
  const totalEl = document.getElementById('checkout-final-price');

  // ── Admin tasdiqlash tekshiruvi ──
  // Faqat admin tasdiqlagan buyurtmalarga ID beriladi va hisob modal ochiladi
  const APPROVED_STATUSES = [
    "tasdiqlandi", "approved",
    "tayyorlanmoqda", "cooking",
    "tayyor", "ready",
    "yetkazilmoqda", "delivering", "served",
    "yetkazildi", "delivered",
    "to'landi", "tolandi", "paid",
    "to'lov tasdiqlandi", "payment_confirmed"
  ];

  // ── Agar hasSubmittedOrder/currentOrderId yo'q bo'lsa, localStorage dan tiklash ──
  // Sababi: sahifa yangilanganda sessionStorage o'chib ketadi
  if (!hasSubmittedOrder || !currentOrderId) {
    const _savedId = localStorage.getItem("activeOrderId") || localStorage.getItem("currentOrderId");
    if (_savedId) {
      try {
        const _snap = await get(ref(db, BASE_PATH + "/orders/" + _savedId));
        if (_snap.exists()) {
          const _ord = _snap.val();
          const _st  = normalizeStatus(getOrderStatusKey(_ord));
          const _alive = !["yopildi", "bekor qilindi", "closed", "cancelled"].includes(_st);
          if (_alive && _ord.tableClosed !== true) {
            currentOrderId   = _savedId;
            activeOrderData  = { ..._ord, _id: _savedId };
            hasSubmittedOrder = true;
            sessionStorage.setItem("client_has_submitted_order", "1");
          } else {
            if (typeof Swal !== "undefined") Swal.fire({ icon: "info", title: t("no_active_order", "Faol buyurtma yo'q"), text: t("place_order_first", "Avval menyu orqali buyurtma bering."), confirmButtonColor: "#22c55e" });
            else alert(t("no_active_order", "Avval buyurtma bering!"));
            return;
          }
        } else {
          if (typeof Swal !== "undefined") Swal.fire({ icon: "info", title: t("no_active_order", "Faol buyurtma yo'q"), text: t("place_order_first", "Avval menyu orqali buyurtma bering."), confirmButtonColor: "#22c55e" });
          else alert(t("no_active_order", "Avval buyurtma bering!"));
          return;
        }
      } catch (_e) {
        console.warn("openCheckoutModal restore failed:", _e);
        if (typeof Swal !== "undefined") Swal.fire({ icon: "info", title: t("no_active_order", "Faol buyurtma yo'q"), text: t("place_order_first", "Avval menyu orqali buyurtma bering."), confirmButtonColor: "#22c55e" });
        else alert(t("no_active_order", "Avval buyurtma bering!"));
        return;
      }
    } else {
      if (typeof Swal !== "undefined") {
        Swal.fire({ icon: "info", title: t("no_active_order", "Faol buyurtma yo'q"), text: t("place_order_first", "Avval menyu orqali buyurtma bering."), confirmButtonColor: "#22c55e" });
      } else {
        alert(t("no_active_order", "Avval buyurtma bering!"));
      }
      return;
    }
  }

  // activeOrderData yangilangan bo'lishi mumkin — statusni qayta hisoblaymiz
  const _refreshedStatus = normalizeStatus(activeOrderData?.status || activeOrderData?.statusKey || "");
  const isApprovedByAdmin = APPROVED_STATUSES.includes(_refreshedStatus);

  if (!isApprovedByAdmin) {
    // Admin hali tasdiqlamagan
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "warning",
        title: t("order_not_approved_yet", "Buyurtma tasdiqlanmagan"),
        text: t("wait_admin_approval", "Hisob so'rash uchun admin buyurtmangizni tasdiqlashi kerak. Iltimos, kuting..."),
        confirmButtonColor: "#22c55e",
        confirmButtonText: t("ok_btn", "Tushunarli")
      });
    } else {
      alert(t("wait_admin_approval", "Admin buyurtmangizni hali tasdiqlamagan. Iltimos, kuting!"));
    }
    return;
  }

  const lang = typeof getLang === "function" ? getLang() : 'uz';
  const tNum = localStorage.getItem("tableNo") || document.getElementById("tableInput")?.value || "-";

  const realOrderNumber = activeOrderData?.orderNumber || null;
  const orderNo = realOrderNumber
    ? String(realOrderNumber)
    : (localStorage.getItem("currentOrderId")?.slice(-4) || "");

  const metaEl = document.getElementById("co-order-meta");
  if (metaEl) metaEl.textContent = (orderNo ? `${t("order_no_label", "Buyurtma №")}${orderNo} · ` : "") + `${t("table_label", "Stol")} ${tNum}`;

  let total = 0;
  if (listContainer) listContainer.innerHTML = '';

  if (Object.keys(cart).length === 0) {
    if (listContainer) listContainer.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:24px 0;">${t("cart_empty_text", "Savat bo'sh")}</p>`;
  } else {
    Object.entries(cart).forEach(([id, c]) => {
      const m = menu[id];
      if (!m) return;
      const qty = Number(c.qty || 0);
      const price = Number(m.price || 0);
      const sum = price * qty;
      total += sum;

      const name = typeof m.name === "object" ? (m.name[lang] || m.name.uz || "Mahsulot") : (m.name || "Mahsulot");
      const imgSrc = m.imgUrl || m.img || m.image || "";
      const cat = m.category
        ? (typeof t === "function" ? t(m.category) || m.category : m.category)
        : "";
      const sub = m.subcategory
        ? (typeof t === "function" ? t(m.subcategory) || m.subcategory : m.subcategory)
        : "";

      const imgEl = imgSrc
        ? `<img class="co-item-img" src="${imgSrc}" onerror="this.style.display='none'" alt="">`
        : `<div class="co-item-img-placeholder">🍽️</div>`;

      const catBadge = cat ? `<span class="co-badge co-badge-cat">${cat}</span> ` : "";
      const subBadge = sub ? `<span class="co-badge co-badge-sub">${sub}</span>` : "";

      if (listContainer) listContainer.innerHTML += `
        <div class="co-item-row">
          ${imgEl}
          <div style="flex:1;min-width:0;">
            <p style="margin:0 0 3px;font-weight:700;font-size:14px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</p>
            ${(cat || sub) ? `<div style="margin-bottom:4px;">${catBadge}${subBadge}</div>` : ""}
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:#64748b;">${price.toLocaleString()} so'm × ${qty}</span>
              <span style="font-size:14px;font-weight:800;color:#0f172a;">${sum.toLocaleString()} so'm</span>
            </div>
          </div>
        </div>`;
    });
  }

  // Chegirma hisoblash (VIP shaxsiy)
  let finalTotal = total;
  let _coBaseTotal = total;
  try {
    const discountInfo = await calculateDiscount(total);
    const discPct = Number(discountInfo?.discountPercent || 0);
    const discAmt = Number(discountInfo?.discountAmount || 0);
    finalTotal = Number(discountInfo?.finalPrice || total);
    _coBaseTotal = finalTotal;

    const discRow = document.getElementById("co-discount-row");
if (discRow) {
  discRow.innerHTML = discPct > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:9px 14px;margin-bottom:6px;font-size:13px;">
      <span style="color:#92400e;">🎟 ${t("vip_discount_label", "VIP Chegirma")} −${discPct}%</span>
      <span style="font-weight:800;color:#b45309;">−${discAmt.toLocaleString()} ${t("currency", "so'm")}</span>
    </div>` : "";
}
    sessionStorage.setItem("checkoutDiscountInfo", JSON.stringify({ discPct, discAmt, finalAmt: finalTotal }));
  } catch (e) { }

  if (totalEl) totalEl.innerText = finalTotal.toLocaleString();
  const btnAmountEl = document.getElementById("co-btn-amount");
  if (btnAmountEl) btnAmountEl.textContent = finalTotal.toLocaleString();

  window._coAppliedPromo = null;
  const _rId   = localStorage.getItem("restaurantId");
  const _norm  = (p) => String(p || "").replace(/\D/g, "").slice(-9);

  let _phone =
    localStorage.getItem("customerPhone") ||
    localStorage.getItem("userPhone") ||
    activeOrderData?.customerPhone ||
    activeOrderData?.clientPhone ||
    activeOrderData?.phoneNumber ||
    document.getElementById("clientPhoneInput")?.value ||
    "";

  // Agar hali ham telefon yo'q bo'lsa — Firebase'dan aktiv buyurtma orqali olamiz
  if (!_norm(_phone) && _rId) {
    try {
      const _activeOId =
        localStorage.getItem("activeOrderId") ||
        localStorage.getItem("currentOrderId");
      if (_activeOId) {
        const _oSnap = await get(ref(db, `restaurants/${_rId}/orders/${_activeOId}`));
        if (_oSnap.exists()) {
          const _oData = _oSnap.val();
          const _oPhone =
            _oData.customerPhone ||
            _oData.clientPhone ||
            _oData.phoneNumber ||
            "";
          if (_oPhone) {
            _phone = _oPhone;
            // Kelajakda ham ishlashi uchun saqlab qo'yamiz
            localStorage.setItem("customerPhone", _oPhone);
          }
        }
      }
    } catch (_fe) { console.warn("Buyurtmadan telefon olishda xato:", _fe); }
  }

  const _myKey = _norm(_phone);

  const cardsEl   = document.getElementById("co-promo-cards");
  const promoInp  = document.getElementById("co-promo-input");
  const promoMsg  = document.getElementById("co-promo-msg");
  const promoApplyBtn = document.getElementById("co-promo-apply-btn");

  if (cardsEl)   cardsEl.innerHTML   = "";
  if (promoInp)  { promoInp.value = ""; promoInp.readOnly = false; promoInp.style.borderColor = "#e2e8f0"; promoInp.style.background = "#fff"; }
  if (promoMsg)  promoMsg.style.display = "none";
  if (promoApplyBtn) { promoApplyBtn.innerHTML = "›"; promoApplyBtn.style.background = "#22c55e"; promoApplyBtn.disabled = false; promoApplyBtn.onmouseover = () => promoApplyBtn.style.background = "#16a34a"; promoApplyBtn.onmouseout = () => promoApplyBtn.style.background = "#22c55e"; }

  let _availablePromos = [];
  try {
    if (_rId) {
      const _dSnap = await get(ref(db, `restaurants/${_rId}/discounts`));
      const _allD  = _dSnap.val() || {};
      _availablePromos = Object.values(_allD).filter(d => {
        const usedCount = Number(d.usedCount || 0);
        const maxUses   = Number(d.maxUses || 1);
        if (d.used || usedCount >= maxUses) return false;
        const isOwner  = d.ownerPhone && _myKey && _norm(d.ownerPhone) === _myKey;
        const isGlobal = !d.ownerPhone;
        return isOwner || isGlobal;
      });
      // VIP promokodlarni birinchi qo'yish (ownerPhone ga tegishli va isVipPromo=true)
      _availablePromos.sort((a, b) => {
        const aVip = (a.isVipPromo === true || (a.ownerPhone && _myKey && _norm(a.ownerPhone) === _myKey)) ? 1 : 0;
        const bVip = (b.isVipPromo === true || (b.ownerPhone && _myKey && _norm(b.ownerPhone) === _myKey)) ? 1 : 0;
        return bVip - aVip;
      });
    }
  } catch (_e) { console.warn("Promo yuklashda xato:", _e); }

  // ── VIP promokodni AVTOMATIK qo'llash ──
  // Agar mijoz telefoni mavjud bo'lsa va unga tegishli VIP promo topilsa — hech narsa kiritmay avtomatik qo'llaniladi
  const _vipAutoPromo = _myKey
    ? _availablePromos.find(d =>
        d.ownerPhone &&
        _norm(d.ownerPhone) === _myKey &&
        !d.used &&
        Number(d.usedCount || 0) < Number(d.maxUses || 1) &&
        d.isVipPromo === true
      ) ||
      // isVipPromo belgisi bo'lmasa ham ownerPhone mos kelsa topamiz
      _availablePromos.find(d =>
        d.ownerPhone &&
        _norm(d.ownerPhone) === _myKey &&
        !d.used &&
        Number(d.usedCount || 0) < Number(d.maxUses || 1)
      )
    : null;

  if (_vipAutoPromo) {
    // VIP promokod topildi — avtomatik qo'llaymiz
    const _vCode   = _vipAutoPromo.code;
    const _vPct    = Number(_vipAutoPromo.percent || 0);
    const _vAmt    = Math.round(_coBaseTotal * _vPct / 100);
    const _vTotal  = _coBaseTotal - _vAmt;
    finalTotal = _vTotal;

    // Narxni yangilash
    if (totalEl)   totalEl.innerText   = _vTotal.toLocaleString();
    const _btnAmt  = document.getElementById("co-btn-amount");
    if (_btnAmt)   _btnAmt.textContent = _vTotal.toLocaleString();

    // Chegirma satrini ko'rsatish
    const _discRow = document.getElementById("co-discount-row");
    if (_discRow) _discRow.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:9px 14px;margin-bottom:6px;font-size:13px;">
        <span style="color:#92400e;">👑 VIP Promokod: <b>${_vCode}</b> (−${_vPct}%)</span>
        <span style="font-weight:800;color:#b45309;">−${_vAmt.toLocaleString()} so'm</span>
      </div>`;

    if (promoInp) {
      promoInp.value       = _vCode;
      promoInp.readOnly    = true;
      promoInp.style.borderColor = "#22c55e";
      promoInp.style.background  = "#f0fdf4";
    }
    if (promoApplyBtn) {
      promoApplyBtn.innerHTML   = "✓";
      promoApplyBtn.style.background = "#16a34a";
      promoApplyBtn.disabled    = true;
    }
    if (promoMsg) {
  promoMsg.innerText = `✅ ${t("vip_promo_applied", "VIP promokod avtomatik qo'llanildi")}: −${_vPct}%`;
  promoMsg.style.color = "#16a34a";
  promoMsg.style.background = "#f0fdf4";
  promoMsg.style.padding = "5px 8px";
  promoMsg.style.display = "block";
}

    window._coAppliedPromo = { code: _vCode, percent: _vPct, discAmt: _vAmt };

    if (cardsEl) {
      cardsEl.innerHTML = `
        <p style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:.4px;">🎫 Promokodlaringiz</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${_availablePromos.map(p => {
            const isSelected = p.code === _vCode;
            const usesLeft = Number(p.maxUses || 1) - Number(p.usedCount || 0);
            const badge = (p.maxUses || 1) > 1
              ? `<span style="font-size:9px;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 4px;margin-left:3px;">${usesLeft}×</span>`
              : "";
            const vipBadge = (p.ownerPhone && _norm(p.ownerPhone) === _myKey)
              ? `<span style="font-size:9px;background:#fef9c3;color:#92400e;border-radius:4px;padding:1px 4px;margin-left:3px;">👑VIP</span>`
              : "";
            return `<button onclick="window._coSelectPromoCard('${p.code}',${p.percent},this)"
              data-co-code="${p.code}"
              style="display:flex;flex-direction:column;align-items:flex-start;padding:7px 12px;border:2px solid ${isSelected ? '#22c55e' : '#e2e8f0'};border-radius:10px;background:${isSelected ? '#f0fdf4' : '#fff'};cursor:pointer;min-width:80px;text-align:left;transition:all .15s;">
              <span style="font-size:13px;font-weight:800;color:#15803d;letter-spacing:.5px;">${p.code}${badge}${vipBadge}</span>
              <span style="font-size:11px;color:#64748b;margin-top:2px;">−${p.percent}%</span>
            </button>`;
          }).join("")}
        </div>`;
    }

  } else {
    // VIP promo yo'q — oddiy ko'rsatish va birinchisini tanlash
    if (cardsEl && _availablePromos.length > 0) {
      if (_availablePromos.length <= 3) {
        // ≤3 ta: tugma kartochkalar
        cardsEl.innerHTML = `
          <p style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:.4px;">🎫 Promokodlaringiz</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;" id="co-promo-btns">
            ${_availablePromos.map(p => {
              const usesLeft = Number(p.maxUses || 1) - Number(p.usedCount || 0);
              const badge = (p.maxUses || 1) > 1
                ? `<span style="font-size:9px;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 4px;margin-left:3px;">${usesLeft}×</span>`
                : "";
              return `<button onclick="window._coSelectPromoCard('${p.code}',${p.percent},this)"
                data-co-code="${p.code}"
                style="display:flex;flex-direction:column;align-items:flex-start;padding:7px 12px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;min-width:80px;text-align:left;transition:all .15s;">
                <span style="font-size:13px;font-weight:800;color:#15803d;letter-spacing:.5px;">${p.code}${badge}</span>
                <span style="font-size:11px;color:#64748b;margin-top:2px;">−${p.percent}%</span>
              </button>`;
            }).join("")}
          </div>`;
      } else {
        // >3 ta: <select> dropdown
        cardsEl.innerHTML = `
          <p style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:.4px;">🎫 Promokodlaringiz</p>
          <select id="co-promo-select"
            style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;background:#fff;outline:none;margin-bottom:8px;cursor:pointer;"
            onchange="window._coSelectFromDropdown(this.value,this.options[this.selectedIndex].dataset.percent)">
            <option value="">— Tanlang —</option>
            ${_availablePromos.map(p => {
              const usesLeft = Number(p.maxUses || 1) - Number(p.usedCount || 0);
              const multi = (p.maxUses || 1) > 1 ? ` (${usesLeft}× qoldi)` : "";
              return `<option value="${p.code}" data-percent="${p.percent}">${p.code} — −${p.percent}%${multi}</option>`;
            }).join("")}
          </select>`;
      }

      // Birinchi promokodni avtomatik tanlash
      const first = _availablePromos[0];
      if (promoInp) {
        promoInp.value = first.code;
        promoInp.style.borderColor = "#22c55e";
        // Birinchi kartochkani highlight
        setTimeout(() => {
          const firstBtn = document.querySelector(`[data-co-code="${first.code}"]`);
          if (firstBtn) { firstBtn.style.borderColor = "#22c55e"; firstBtn.style.background = "#f0fdf4"; }
          const sel = document.getElementById("co-promo-select");
          if (sel) sel.value = first.code;
        }, 50);
      }
    }
  }

  // Kartochka bosilganda
  window._coSelectPromoCard = function (code, percent, btn) {
    document.querySelectorAll("[data-co-code]").forEach(b => { b.style.borderColor = "#e2e8f0"; b.style.background = "#fff"; });
    if (btn) { btn.style.borderColor = "#22c55e"; btn.style.background = "#f0fdf4"; }
    const inp = document.getElementById("co-promo-input");
    if (inp) { inp.value = code; inp.style.borderColor = "#22c55e"; inp.style.background = "#f0fdf4"; }
    window._coApplyPromo();
  };

  window._coSelectFromDropdown = function (code, percent) {
    if (!code) return;
    const inp = document.getElementById("co-promo-input");
    if (inp) { inp.value = code; inp.style.borderColor = "#22c55e"; }
    window._coApplyPromo();
  };

  window._coApplyPromo = async function () {
    const inp   = document.getElementById("co-promo-input");
    const msgEl = document.getElementById("co-promo-msg");
    const code  = inp ? inp.value.trim().toUpperCase() : "";

    function showMsg(txt, color, bg) {
      if (!msgEl) return;
      msgEl.innerText        = txt;
      msgEl.style.color      = color;
      msgEl.style.background = bg || "transparent";
      msgEl.style.padding    = bg ? "5px 8px" : "0";
      msgEl.style.display    = "block";
    }

    if (!code) { showMsg("❗ " + t("enter_promo_alert", "Promokod kiriting"), "#b45309"); return; }

    if (window._coAppliedPromo && window._coAppliedPromo.code === code) return;

    if (window._coAppliedPromo) {
      finalTotal = _coBaseTotal;
      const totalEl2 = document.getElementById("checkout-final-price");
      const btnAmt   = document.getElementById("co-btn-amount");
      if (totalEl2) totalEl2.innerText = finalTotal.toLocaleString();
      if (btnAmt)   btnAmt.textContent = finalTotal.toLocaleString();
      const discRow = document.getElementById("co-discount-row");
      if (discRow) discRow.innerHTML = "";
      window._coAppliedPromo = null;
      if (inp) { inp.readOnly = false; }
      const ab = document.getElementById("co-promo-apply-btn");
      if (ab) { ab.innerHTML = "›"; ab.style.background = "#22c55e"; ab.disabled = false; }
    }

    try {
      const snap = await get(ref(db, `restaurants/${_rId}/discounts/${code}`));
      if (!snap.exists()) { showMsg("❌ Bunday promokod topilmadi!", "red"); return; }

      const promo = snap.val();
      const usedCount = Number(promo.usedCount || 0);
      const maxUses   = Number(promo.maxUses || 1);

      if (promo.used || usedCount >= maxUses) {
        showMsg("❌ Bu promokod allaqachon tugagan!", "red"); return;
      }
      if (promo.ownerPhone && _norm(promo.ownerPhone) !== _myKey) {
        showMsg("❌ Bu promokod sizning raqamingizga tegishli emas!", "red"); return;
      }

      const discPct = Number(promo.percent || 0);
      const discAmt = Math.round(_coBaseTotal * discPct / 100);
      const newTotal = _coBaseTotal - discAmt;

      // Chegirma satri
      const discRow = document.getElementById("co-discount-row");
      if (discRow) discRow.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:9px 14px;margin-bottom:6px;font-size:13px;">
          <span style="color:#92400e;">🎫 <b>${code}</b> (−${discPct}%)</span>
          <span style="font-weight:800;color:#b45309;">−${discAmt.toLocaleString()} so'm</span>
        </div>`;

      finalTotal = newTotal;
      const totalEl2 = document.getElementById("checkout-final-price");
      const btnAmt   = document.getElementById("co-btn-amount");
      if (totalEl2) totalEl2.innerText = newTotal.toLocaleString();
      if (btnAmt)   btnAmt.textContent = newTotal.toLocaleString();

      if (inp) { inp.readOnly = true; inp.style.borderColor = "#22c55e"; inp.style.background = "#f0fdf4"; }
      const ab = document.getElementById("co-promo-apply-btn");
      if (ab) { ab.innerHTML = "✓"; ab.style.background = "#16a34a"; ab.disabled = true; ab.onmouseover = null; ab.onmouseout = null; }

      showMsg(`✅ −${discPct}% ${t("promo_applied_success", "qo'llanildi! Tejash:")} ${discAmt.toLocaleString()} ${t("currency", "so'm")}`, "#16a34a", "#f0fdf4");
      window._coAppliedPromo = { code, percent: discPct, discAmt };

    } catch (e) { showMsg("❌ Xatolik yuz berdi", "red"); console.error(e); }
  };

  window._coSelectedMethod = "cash";
  window._coSelect = function (method, btn) {
    window._coSelectedMethod = method;
    document.querySelectorAll(".co-method-btn").forEach(b => b.classList.remove("co-active"));
    if (btn) btn.classList.add("co-active");
    const cf = document.getElementById("co-card-fields");
    const lbl = document.getElementById("co-card-label");
    if (cf) {
      const show = ["card", "click", "payme"].includes(method);
      cf.style.display = show ? "block" : "none";
      if (lbl) {
        if (method === "click") lbl.textContent = "🔵 Click karta ma'lumotlari";
        else if (method === "payme") lbl.textContent = "🟢 Payme karta ma'lumotlari";
        else lbl.textContent = "💳 Karta ma'lumotlari";
      }
    }
  };

  // To'lash tugmasi
  window._coPay = async function () {
    const method = window._coSelectedMethod || "cash";
    const needsCard = ["card", "click", "payme"].includes(method);
    if (needsCard) {
      const num = (document.getElementById("co-card-num")?.value || "").replace(/\s/g, "");
      const exp = document.getElementById("co-card-exp")?.value || "";
      const cvv = document.getElementById("co-card-cvv")?.value || "";
      const errField = num.length < 16 ? "co-card-num" : exp.length < 5 ? "co-card-exp" : cvv.length < 3 ? "co-card-cvv" : null;
      if (errField) {
        const el = document.getElementById(errField);
        if (el) { el.classList.add("co-err"); el.focus(); setTimeout(() => el.classList.remove("co-err"), 800); }
        return;
      }
    }
    // To'lov imitatsiyasi
    const inner = document.getElementById("checkout-inner");
    if (!inner) return;
    const brandColor = method === "click" ? "#3b82f6" : method === "payme" ? "#22c55e" : method === "card" ? "#6366f1" : "#22c55e";
    const methodLabel = method === "cash" ? t("cash_label", "Naqd pul") : method === "card" ? t("card_label", "Bank kartasi") : method === "click" ? "Click" : "Payme";

    inner.innerHTML = `
      <style>@keyframes spinPay{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
      <div style="padding:60px 32px;text-align:center;">
        <div style="width:64px;height:64px;border:5px solid #f1f5f9;border-top:5px solid ${brandColor};border-radius:50%;animation:spinPay 0.9s linear infinite;margin:0 auto 24px;"></div>
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">${methodLabel} orqali to'lanmoqda</h3>
        <p style="margin:0;font-size:13px;color:#94a3b8;">Sahifani yopmang yoki yangilamang...</p>
        <div style="margin-top:20px;background:#f8fafc;border-radius:12px;padding:12px 18px;display:inline-block;">
          <span style="font-size:22px;font-weight:800;color:${brandColor};">${finalTotal.toLocaleString()} so'm</span>
        </div>
      </div>`;

    await new Promise(r => setTimeout(r, 2600));

    // Firebase ga yozish
    const restId = localStorage.getItem("restaurantId");
    const orderId = localStorage.getItem("currentOrderId") || (typeof currentOrderId !== 'undefined' ? currentOrderId : null);

    try {
      if (orderId && typeof db !== 'undefined') {
        await update(ref(db, `restaurants/${restId}/orders/${orderId}/payment`), {
          method, paid: true, approved: true, time: Date.now()
        });
        await update(ref(db, `restaurants/${restId}/orders/${orderId}`), {
          status: "to'landi", paidAt: Date.now()
        });
        const oSnap = await get(ref(db, `restaurants/${restId}/orders/${orderId}`));
        if (oSnap.exists()) {
          const tableNo = oSnap.val().table;
          if (tableNo) await update(ref(db, `restaurants/${restId}/tables/${tableNo}`), {
            status: "cleaning", cleaningNeededAt: Date.now(), busy: false
          });
        }
      }
    } catch (e) { console.warn("Firebase to'lov yozishda xato:", e); }

    // Promokod ishlatilgan bo'lsa — usedCount oshirish + orderni yangilash
    if (window._coAppliedPromo) {
      const _pCode = window._coAppliedPromo.code;
      try {
        const _pSnap = await get(ref(db, `restaurants/${restId}/discounts/${_pCode}`));
        if (_pSnap.exists()) {
          const _pd    = _pSnap.val();
          const _maxU  = Number(_pd.maxUses || 1);
          const _usedC = Number(_pd.usedCount || 0);
          const _newC  = _usedC + 1;
          const _done  = _newC >= _maxU;
          await update(ref(db, `restaurants/${restId}/discounts/${_pCode}`), {
            usedCount: _newC,
            used: _done,
            ...(_done ? { usedAt: Date.now() } : {})
          });
        }
      } catch (_e) { console.warn("Promo usedCount xato:", _e); }
      if (orderId) {
        try {
          await update(ref(db, `restaurants/${restId}/orders/${orderId}`), {
            appliedPromo:    window._coAppliedPromo.code,
            discountPercent: window._coAppliedPromo.percent,
            discountAmount:  window._coAppliedPromo.discAmt
          });
        } catch (_e) { }
      }
      window._coAppliedPromo = null;
    }

    // Muvaffaqiyat ekrani
    inner.innerHTML = `
      <style>@keyframes popSuccess{0%{transform:scale(0);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}</style>
      <div style="padding:52px 32px;text-align:center;">
        <div style="width:80px;height:80px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 20px;animation:popSuccess .5s ease-out forwards;color:#fff;">✓</div>
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">To'lov muvaffaqiyatli!</h2>
        <p style="margin:0 0 20px;font-size:14px;color:#64748b;">${methodLabel} orqali to'landi</p>
        <div style="background:#f0fdf4;border-radius:14px;padding:14px 20px;margin-bottom:20px;">
          <p style="margin:0 0 2px;font-size:13px;color:#64748b;">To'langan summa</p>
          <p style="margin:0;font-size:26px;font-weight:900;color:#15803d;">${finalTotal.toLocaleString()} so'm</p>
        </div>
        <p style="margin:0;font-size:11px;color:#cbd5e1;">NestaCRM • Tasdiqlandi ✓</p>
      </div>`;

    await new Promise(r => setTimeout(r, 2400));

    modal.style.display = "none";
    localStorage.removeItem("discountPercent");
    localStorage.removeItem("discountCode");

    if (orderId && typeof db !== 'undefined' && typeof showReceipt === "function") {
      try {
        const restId = localStorage.getItem("restaurantId");
        const snap = await get(ref(db, `restaurants/${restId}/orders/${orderId}`));
        if (snap.exists()) showReceipt(snap.val());
      } catch (e) { }
    }
    setTimeout(() => { if (typeof openFeedbackModal === "function") openFeedbackModal(); }, 5000);
  };

  modal.style.display = 'flex';
};

window.closeCheckoutModal = function () {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.style.display = 'none';
};

window.sendBillRequest = async function () {
  const methodInput = document.querySelector('input[name="pay-method"]:checked');
  const method = methodInput ? methodInput.value : 'cash';
  const restaurantId = localStorage.getItem("restaurantId") || "rest_default";
  const orderId = localStorage.getItem("currentOrderId") || "order_" + Date.now();

  Swal.fire({
    title: "To'lov hisoblanmoqda...",
    html: "Iltimos, kuting, tizim so'rovni qayta ishlamoqda.",
    allowOutsideClick: false,
    willOpen: () => {
      const swalContainer = Swal.getContainer();
      if (swalContainer) swalContainer.style.zIndex = '99999';
    },
    didOpen: () => {
      Swal.showLoading();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    if (typeof window.closeCheckoutModal === "function") {
      window.closeCheckoutModal();
    } else {
      const modal = document.getElementById("checkout-modal");
      if (modal) modal.style.display = "none";
    }

    const tableNo = localStorage.getItem("tableNo") || document.getElementById("tableInput")?.value || "-";

    const finalPriceElem = document.getElementById("checkout-final-price") || document.getElementById("paymentTotal");
    let totalNum = 0;
    if (finalPriceElem) {
      totalNum = parseInt(finalPriceElem.innerText.replace(/\D/g, '')) || 0;
    }

    let itemsArray = [];

    const checkoutListEl = document.getElementById("checkout-items-list");
    if (checkoutListEl && checkoutListEl.children.length > 0) {
      Array.from(checkoutListEl.children).forEach((child, idx) => {
        const text = child.innerText || child.textContent || "";
        if (!text.trim()) return;

        let qty = 1;
        let cleanName = "Taom";
        let totalItemPrice = 0;

        const qtyMatch = text.match(/[xX]\s*(\d+)/) || text.match(/(\d+)\s*ta/);

        if (qtyMatch) {
          qty = parseInt(qtyMatch[1]) || 1;

          const indexOfX = text.indexOf(qtyMatch[0]);
          const beforeX = text.substring(0, indexOfX).trim();
          const afterX = text.substring(indexOfX + qtyMatch[0].length).trim();

          cleanName = beforeX || "Taom";
          totalItemPrice = parseInt(afterX.replace(/\D/g, '')) || 0;
        } else {
          const digitsAtEnd = text.match(/(\d[\d\s]*)\s*so['`’‘]m/i) || text.match(/(\d[\d\s]*)$/);
          if (digitsAtEnd) {
            totalItemPrice = parseInt(digitsAtEnd[1].replace(/\D/g, '')) || 0;
            cleanName = text.replace(digitsAtEnd[0], "").trim();
          } else {
            cleanName = text.trim();
          }
        }

        const unitPrice = qty > 0 ? Math.round(totalItemPrice / qty) : totalItemPrice;

        itemsArray.push({
          id: "item_" + idx,
          name: cleanName,
          title: cleanName,
          quantity: qty,
          qty: qty,
          count: qty,
          price: unitPrice,
          unitPrice: unitPrice,
          total: totalItemPrice,
          totalPrice: totalItemPrice,
          summa: totalItemPrice
        });
      });
    }

    if (itemsArray.length === 0 && totalNum > 0) {
      itemsArray.push({
        id: "food_backup",
        name: "Buyurtma qilingan taomlar",
        title: "Buyurtma qilingan taomlar",
        quantity: 1,
        qty: 1,
        count: 1,
        price: totalNum,
        total: totalNum,
        totalPrice: totalNum,
        summa: totalNum
      });
    }

    const shortOrderNo = orderId.replace(/\D/g, '').slice(-4) || "1024";
    const mockOrderData = {
      id: orderId,
      orderId: orderId,
      orderNo: shortOrderNo,
      checkNo: shortOrderNo,
      orderNumber: shortOrderNo,
      restaurantId: restaurantId,

      tableNo: tableNo,
      table: tableNo,
      stol: tableNo,

      paymentMethod: method,
      paymentStatus: 'requested',
      billRequestedAt: Date.now(),

      items: itemsArray,

      totalPrice: totalNum,
      total: totalNum,
      finalPrice: totalNum,
      subTotal: totalNum,
      amount: totalNum,
      totalSum: totalNum,
      sum: totalNum,
      asosiy: totalNum
    };

    Swal.close();

    if (typeof showReceipt === "function") {
      showReceipt(mockOrderData);
    } else {
      Swal.fire({
        icon: 'success',
        title: 'Hisob soʻraldi!',
        text: `To'lov turi: ${method === 'cash' ? 'Naqd' : 'Karta'}. Ofitsiant hozir chekni olib keladi!`,
        confirmButtonColor: 'var(--primary)'
      });
    }

  } catch (error) {
    console.error("To'lov imitatsiyasida xato:", error);
    Swal.close();
  }
};

window.toggleCardInputs = function (show) {
  const cardForm = document.getElementById('card-details-form');
  if (cardForm) {
    cardForm.style.display = show ? 'block' : 'none';
  }
};

window.processFinalPayment = async function () {
  const methodInput = document.querySelector('input[name="pay-type"]:checked');
  if (!methodInput) {
    alert("Iltimos, to'lov turini tanlang!");
    return;
  }
  const method = methodInput.value;
  const rId = localStorage.getItem("restaurantId");
  const orderId = localStorage.getItem("currentOrderId");

  if (!orderId) {
    alert("Sizda hali faol buyurtma yo'q!");
    return;
  }

  try {
    const orderRef = ref(db, `restaurants/${rId}/orders/${orderId}`);
    await update(orderRef, {
      paymentStatus: 'requested',
      paymentMethod: method,
      billRequestedAt: Date.now()
    });

    if (typeof closeCheckoutModal === "function") {
      closeCheckoutModal();
    }

    if (typeof openPaymentModal === "function") {
      openPaymentModal();
    } else {
      const pModal = document.getElementById("paymentModal");
      if (pModal) pModal.style.display = "flex";
    }

  } catch (e) {
    console.error("Xatolik:", e);
    alert("Xatolik yuz berdi: " + e.message);
  }
};

/* =========================
EXPORT TO WINDOW
========================= */
window.openFeedbackModal = openFeedbackModal;
window.submitFeedback = submitFeedback;
window.closeFeedback = closeFeedback;
window.toggleCart = toggleCart;
window.sendOrder = sendOrder;
window.removeFromCart = removeFromCart;
window.confirmPayment = confirmPayment;
window.closePayment = closePayment;
window.closeReceipt = closeReceipt;
window.closeClientChat = closeClientChat;
window.checkTable = checkTable;
window.checkAndShowVipBadge = checkAndShowVipBadge;
window.cart = window.cart || {};