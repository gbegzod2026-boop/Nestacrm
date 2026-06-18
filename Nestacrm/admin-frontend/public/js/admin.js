import { CATEGORY_DATA } from "./shared.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";
import "./chat-system.js";

// ── Ingredient nomini tarjima qilish ──────────────────────
const ING_NAME_TO_KEY = {
  "qo'y go'shti": "ing_qoy_goshti",
  "mol go'shti": "ing_mol_goshti",
  "tovuq go'shti": "ing_tovuq_goshti",
  "jigar": "ing_jigar",
  "dumba yog'i": "ing_dumba_yogi",
  "qazi": "ing_qazi",
  "sabzi": "ing_sabzi",
  "piyoz": "ing_piyoz",
  "kartoshka": "ing_kartoshka",
  "pomidor": "ing_pomidor",
  "sarimsoqpiyoz": "ing_sarimsoqpiyoz",
  "bulg'or qalampiri": "ing_bulgor_qalampiri",
  "karam": "ing_karam",
  "turp": "ing_turp",
  "loba": "ing_loba",
  "yashil loviya": "ing_yashil_loviya",
  "bodring": "ing_bodring",
  "guruch (devzira)": "ing_guruch_devzira",
  "guruch (lazer)": "ing_guruch_lazer",
  "guruch (alang)": "ing_guruch_alang",
  "guruch": "ing_guruch",
  "un": "ing_un",
  "no'xat": "ing_noxat",
  "o'simlik yog'i": "ing_osimlik_yogi",
  "paxta yog'i": "ing_paxta_yogi",
  "sariyog'": "ing_sariyog",
  "margarin": "ing_margarin",
  "mol yog'i": "ing_mol_yogi",
  "tuz": "ing_tuz",
  "zira": "ing_zira",
  "qora murch": "ing_qora_murch",
  "qizil murch": "ing_qizil_murch",
  "zirk": "ing_zirk",
  "kashnich urug'i": "ing_kashnich_urugi",
  "dafna yaprog'i": "ing_dafna_yaprogi",
  "yulduzanis (badyon)": "ing_yulduzanis",
  "jandu": "ing_jandu",
  "kashnich": "ing_kashnich",
  "shivit (ukrop)": "ing_shivit",
  "ko'k piyoz": "ing_kok_piyoz",
  "selderey": "ing_selderey",
  "tuxum": "ing_tuxum",
  "suv": "ing_suv",
  "gazlangan suv": "ing_gazlangan_suv",
  "kvas": "ing_kvas",
  "kivi": "ing_kivi",
  "mayiz": "ing_mayiz",
  "bedana tuxumi": "ing_bedana_tuxumi",
  "gazak": "ing_gazak"
};

function translateIngName(name) {
  if (!name) return "";
  const key = ING_NAME_TO_KEY[String(name).trim().toLowerCase()];
  if (key && typeof t === "function") return t(key, name);
  return name;
}

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, update, get, set, remove, push, query, orderByChild, limitToLast, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const currentRestaurantId = urlParams.get('rest') || urlParams.get('id') || localStorage.getItem("restaurantId");
const restIdFromUrl = urlParams.get('rest') || urlParams.get('id');

if (currentRestaurantId) {
  localStorage.setItem("restaurantId", currentRestaurantId);
}
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
const storage = getStorage(app);
const BASE_PATH = `restaurants/${currentRestaurantId}`;

console.log(t("current_rest_id_log", "👉 Hozirgi restoran ID:"), currentRestaurantId);

const currentUserId = localStorage.getItem("userId");

if (!currentRestaurantId || !currentUserId) {
  alert(t("alerts_not_logged_in") || "Siz tizimga kirmagansiz!");
  window.location.href = "login.html";
} else {
  get(ref(db, `restaurants/${currentRestaurantId}/users/${currentUserId}`)).then((snap) => {
    if (!snap.exists() || snap.val().role !== "admin") {
      alert(t("alerts.not_admin_full") || "Siz admin emassiz!");
      window.location.href = "login.html";
    }
  }).catch(console.error);
}

// 🌐 LOKAL TARMOQ IP MANZILINI OLISH (QR kod uchun)
let _cachedNetworkOrigin = null;
async function getNetworkOrigin() {
  if (_cachedNetworkOrigin) return _cachedNetworkOrigin;
  try {
    const res = await fetch("/api/local-ip");
    if (res.ok) {
      const { ip, port } = await res.json();
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        _cachedNetworkOrigin = `http://${ip}:${port}`;
        return _cachedNetworkOrigin;
      }
    }
  } catch (e) {
    console.warn("local-ip API topilmadi, window.location.origin ishlatiladi");
  }
  _cachedNetworkOrigin = window.location.origin;
  return _cachedNetworkOrigin;
}

window.logSystemAction = async function (type, message) {
  if (typeof crmAdvAudit === "function") {
    await crmAdvAudit("system", type, t("system_actor_name", "Tizim"), message, {}, "info");
  }
};

window.logChefAction = async function (message) {
  if (typeof window.logSystemAction === "function") {
    await window.logSystemAction("update", message);
  }
};

const crmState = { customers: [], filtered: [] };
window.allUsers = {};
window.customerProfilesByPhone = window.customerProfilesByPhone || {};
const reservationState = { list: [] };
const feedbackState = { list: [] };
const notificationsState = { list: [] };
const tablesAdvancedState = { tables: {}, orders: {} };

window.db = db;
signInAnonymously(auth)
  .then(() => console.log(t("firebase_auth_ok_log")))
  .catch(console.error);

const socket = typeof io !== "undefined" ? io() : null;

const langSelect = document.getElementById("langSelect");
if (langSelect) {
  langSelect.value = getLang();
  langSelect.addEventListener("change", e => setLang(e.target.value));
}

/* =========================
   ADMIN HEADER RESTORAN NOMI
========================= */
window.loadRestaurantNameForHeader = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const [settingsSnap, infoSnap] = await Promise.all([
      get(ref(db, `restaurants/${restId}/settings`)),
      get(ref(db, `restaurants/${restId}/info`))
    ]);

    const settings = settingsSnap.val() || {};
    const info = infoSnap.val() || {};

    const restName = settings.restaurantName || info.name || t("unknown_restaurant", "Noma'lum Restoran");

    window.currentGlobalRestName = restName;

    const headerTitle = document.querySelector('.header h1') || document.querySelector('.brand h1') || document.querySelector('.logo');
    if (headerTitle) {
      headerTitle.innerText = `${t("admin_panel_title", "Administrator paneli")} | ${restName}`;
    }

    document.title = `${t("admin_panel_title", "Admin Panel")} | ${restName}`;

  } catch (error) {
    console.error(t("rest_name_load_error", "Restoran nomini yuklashda xatolik:"), error);
  }
};

function updateFullscreenButton() {
  const isFullscreen = !!document.fullscreenElement;
  const btn = document.getElementById("fullscreenBtn");
  const span = document.getElementById("fullscreenBtnText");
  if (span) span.textContent = isFullscreen ? t("exit_fullscreen") : t("fullscreen");
  if (btn) btn.innerHTML = isFullscreen
    ? `🡼 <span id="fullscreenBtnText">${t("exit_fullscreen")}</span>`
    : `⛶ <span id="fullscreenBtnText">${t("fullscreen")}</span>`;
}

window.toggleFullscreen = async function () {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (err) {
    console.error(t("fullscreen_error_log"), err);
    showAdminNotification(t("fullscreen_not_supported"), "error");
  }
};
document.addEventListener("fullscreenchange", updateFullscreenButton);

window.saveMaxTable = async function () {
  const input = document.getElementById("maxTablesInput") || document.getElementById("maxTablesSettings");
  if (!input) return;

  const val = parseInt(input.value);

  if (isNaN(val) || val < 1) {
    alert(t("a_valid_number", "Iltimos, to'g'ri son kiriting!"));
    return;
  }

  const restId = localStorage.getItem("restaurantId");
  const database = window.db || (typeof db !== 'undefined' ? db : null);

  try {
    await update(ref(database, `restaurants/${restId}/settings`), {
      maxTable: val
    });

    alert(t("a_tables_saved", "Stollar soni saqlandi!"));

    if (typeof window.renderTablesGrid === "function") {
      window.renderTablesGrid();
    }
  } catch (error) {
    console.error(t("error_log", "Xato:"), error);
    alert(t("notify.error", "Saqlashda xatolik yuz berdi."));
  }
};

const restId = localStorage.getItem("restaurantId");
get(ref(db, `restaurants/${restId}/settings/maxTable`)).then(snap => {
  if (snap.exists()) {
    const input = document.getElementById("maxTablesInput");
    if (input) input.value = snap.val();
  }
});

window.allMenu = {};
window.allOrders = {};

let editingItemId = null;
let oldImagePath = "";
let ordersChart = null;
let statusChart = null;
let topFoodsChart = null;
let searchQuery = "";
let undoStack = null;
let undoTimer = null;
let currentStaffId = null;
let currentStaffRole = null;

const ordersList = document.getElementById("ordersList");
const foodNameInput = document.getElementById("foodNameInput");
const addPrice = document.getElementById("addPrice");
const categorySelect = document.getElementById("category");
const subcategorySelect = document.getElementById("subcategory");
const addImgInput = document.getElementById("addImgInput");
const addFileName = document.getElementById("addFileName");
const addMenuBtn = document.getElementById("addMenuBtn");
const menuList = document.getElementById("menuList");
const editModal = document.getElementById("editModal");
const editPriceInput = document.getElementById("editPrice");
const editName = document.getElementById("editName");
const editCategory = document.getElementById("editCategory");
const editSubCategory = document.getElementById("editSubCategory");
const editImgInput = document.getElementById("editImgInput");
const editFileName = document.getElementById("editFileName");
const filterOrderCategory = document.getElementById("filterOrderCategory");
const filterOrderSubcategory = document.getElementById("filterOrderSubcategory");
const filterPaymentType = document.getElementById("filterPaymentType");
const filterPaymentStatus = document.getElementById("filterPaymentStatus");

[filterPaymentType, filterPaymentStatus, filterOrderCategory, filterOrderSubcategory]
  .forEach(el => el?.addEventListener("change", () => renderOrders(window.allOrders)));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizePhone(phone = "") {
  let cleaned = String(phone || "").replace(/\D/g, "");

  if (!cleaned) return "";

  if (cleaned.length === 12 && cleaned.startsWith("998")) {
    return "+" + cleaned;
  }
  else if (cleaned.length === 9) {
    return "+998" + cleaned;
  }
  else if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return "+998" + cleaned.slice(1);
  }
  else {
    return "+" + cleaned;
  }
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

function uniqueCustomerMemoryList(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const value = String(item || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCustomerProfilePhoneCache(customersObj = {}) {
  const cache = {};

  Object.entries(customersObj || {}).forEach(([id, profile]) => {
    const normalizedPhone = normalizePhone(profile?.phone || decodeURIComponent(id || ""));
    if (!normalizedPhone) return;

    cache[normalizedPhone] = {
      ...(profile || {}),
      phone: normalizedPhone,
      allergies: normalizeCustomerMemoryList(profile?.allergies),
      preferences: normalizeCustomerMemoryList(profile?.preferences)
    };
  });

  return cache;
}

function getCustomerProfileByPhone(phone = "") {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  return window.customerProfilesByPhone?.[normalizedPhone] || null;
}

function getCustomerMemoryState(customer = {}, customerProfile = null) {
  const profile = customerProfile || getCustomerProfileByPhone(customer?.phone || customer?.customerPhone || "");
  const allergies = uniqueCustomerMemoryList([
    ...normalizeCustomerMemoryList(customer?.allergies),
    ...normalizeCustomerMemoryList(profile?.allergies)
  ]);
  const preferences = uniqueCustomerMemoryList([
    ...normalizeCustomerMemoryList(customer?.preferences),
    ...normalizeCustomerMemoryList(profile?.preferences)
  ]);

  return {
    allergies,
    preferences,
    summary: [
      allergies.length ? `${t("allergy", "Allergiya")}: ${allergies.join(", ")}` : "",
      preferences.length ? `${t("special_note", "Maxsus izoh")}: ${preferences.join(", ")}` : ""
    ].filter(Boolean).join(" | ")
  };
}

function renderCustomerMemoryInline(customer = {}, customerProfile = null) {
  const memory = getCustomerMemoryState(customer, customerProfile);
  if (!memory.summary) return "";

  return `
    <p style="margin-top:8px;">
      <span style="display:inline-flex; align-items:center; gap:6px; background:#fff5f5; color:#b42318; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; line-height:1.4;">
        ⚠️ ${t("allergy", "Allergiya")}/${t("special_note", "Izoh")}: ${escapeHtml(memory.summary)}
      </span>
    </p>
  `;
}

function isCountableVisit(order = {}) {
  const status = normalizeText(order.status || order.statusKey || "");
  return (
    order.payment?.paid === true ||
    order.tableClosed === true ||
    [
      "new", "yangi",
      "approved", "cooking", "ready", "closed",
      "tasdiqlandi", "tayyorlanmoqda", "tayyor", "yopildi"
    ].includes(status)
  );
}

function countCustomerVisitsByPhone(phone, ordersObj = {}, excludeOrderId = "") {
  const target = normalizePhone(phone);
  if (!target) return 0;

  let count = 0;

  Object.entries(ordersObj || {}).forEach(([id, order]) => {
    if (excludeOrderId && id === excludeOrderId) return;

    const orderPhone = normalizePhone(
      order.customerPhone ||
      order.phone ||
      order.clientPhone ||
      ""
    );

    if (!orderPhone) return;
    if (orderPhone !== target) return;
    if (!isCountableVisit(order)) return;

    count++;
  });

  return count;
}

function sumCustomerPaidTotalByPhone(phone, ordersObj = {}, includeCurrentOrder = null) {
  const target = normalizePhone(phone);
  if (!target) return 0;

  let total = 0;

  Object.values(ordersObj || {}).forEach(order => {
    const orderPhone = normalizePhone(
      order.customerPhone ||
      order.phone ||
      order.clientPhone ||
      ""
    );

    if (orderPhone !== target) return;
    if (!isCountableVisit(order)) return;

    total += Number(order.finalTotal || order.total || 0);
  });

  if (includeCurrentOrder) {
    total += Number(includeCurrentOrder.finalTotal || includeCurrentOrder.total || 0);
  }

  return total;
}

function translateStatus(value = "") {
  const raw = normalizeText(value);

  const map = {
    yangi: "new",
    tasdiqlandi: "approved",
    tayyorlanmoqda: "cooking",
    tayyor: "ready",
    yopildi: "closed",

    new: "new",
    approved: "approved",
    cooking: "cooking",
    ready: "ready",
    closed: "closed",

    pending: "pending",
    confirmed: "confirmed",
    seated: "seated",
    completed: "completed",
    no_show: "no_show",
    canceled: "canceled",
    cancelled: "canceled",

    free: "free",
    reserved: "reserved",
    billing: "billing",
    cleaning: "cleaning",
    active: "active",
    open: "open"
  };

  const normalized = map[raw] || raw;
  const key = `status_${normalized}`;
  const translated = t(key);

  return translated === key ? (value || uiEmpty()) : translated;
}

function translateLoyalty(value = "") {
  const key = `loyalty_${normalizeText(value)}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}

function translateNotificationType(value = "") {
  const key = `notification_type_${normalizeText(value)}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}

function tr(key, fallback = "") {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function uiEmpty() {
  return tr("empty_value", "—");
}

function translateAuditSeverity(value = "") {
  const key = `audit_severity_${normalizeText(value)}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}


function translateAuditModule(value = "") {
  const raw = normalizeText(value).replace(/\s+/g, "_");

  const map = {
    "роли": "roles",
    "обновление": "update",
    "критично": "critical",
    "настройки_crm": "crm_settings",
    "crm_settings": "crm_settings",
    "система": "system"
  };

  const key = map[raw] || raw;
  const translated = t(`audit_module_value_${key}`);

  return translated.includes("audit_module_value_") ? (value || uiEmpty()) : translated;
}

function translateAuditAction(value = "") {
  const raw = normalizeText(value).replace(/\s+/g, "_");

  // Tizimiy action kodlarni tarjima qilish
  const systemActionMap = {
    "order_overdue_alert":  t("audit_action_order_overdue_alert", "Buyurtma kechikish ogohlantirishi"),
    "order_overdue":        t("audit_action_order_overdue_alert", "Buyurtma kechikish ogohlantirishi"),
    "update":               t("audit_action_value_update",         "Yangilash"),
    "create":               t("audit_action_value_create",         "Yaratish"),
    "delete":               t("audit_action_value_delete",         "O'chirish"),
    "close":                t("audit_action_value_close",          "Yopish"),
    "system":               t("audit_action_value_system",         "Tizim"),
    "payment_finish":       t("audit_action_value_payment_finish", "To'lov"),
    "manual_discount":      t("audit_action_value_manual_discount","Chegirma"),
    "обновление":           t("audit_action_value_update",         "Yangilash"),
    "создание":             t("audit_action_value_create",         "Yaratish"),
    "закрытие":             t("audit_action_value_close",          "Yopish")
  };

  if (systemActionMap[raw]) return systemActionMap[raw];

  const translated = t(`audit_action_value_${raw}`);
  return translated.includes("audit_action_value_") ? (value || uiEmpty()) : translated;
}

function translateAuditTarget(value = "") {
  const raw = String(value).toLowerCase().trim();
  const key = `audit_target_${raw}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}

function translateAuditUserName(name = "") {
  const raw = String(name).toLowerCase().trim();
  if (["admin", "админ", "администратор"].includes(raw)) {
    return t("admin");
  }
  return name;
}

function translateAuditDescription(desc = "") {
  if (!desc) return desc;
  // Replace Russian/hardcoded minute abbreviations with localized version
  const minLabel = t("minute_short", "min");
  // "мин" (Russian), "мин." — replace with localized minute_short
  return desc
    .replace(/\bмин\.?\b/g, minLabel)
    .replace(/\bмин\b/g, minLabel);
}

function translateZone(value = "") {
  const key = `table_zone_${normalizeText(value)}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}

function translatePulse(value = "") {
  const key = `table_pulse_${normalizeText(value)}`;
  const translated = t(key);
  return translated === key ? (value || uiEmpty()) : translated;
}

function formatMoney(value = 0) {
  return `${Number(value || 0).toLocaleString()} ${t("currency")}`;
}

function formatDateTime(value) {
  if (!value) return uiEmpty();
  try { return new Date(value).toLocaleString(); }
  catch { return uiEmpty(); }
}

function getOrderTimestamp(order) {
  return Number(
    order?.updatedAt ||
    order?.createdAt ||
    order?.payment?.approvedAt ||
    order?.payment?.requestedAt ||
    0
  );
}

function getCustomerDisplayName(order = {}, profile = {}) {
  let name = profile.name || order.customerName || order.clientName || order.name;
  if (!name || String(name).trim() === "" || name === "undefined") {
    const phone = getCustomerPhone(order, profile);
    if (phone) {
      name = `${t("client_label", "Mijoz")} (${phone.slice(-4)})`;
    } else {
      name = `${t("table", "Stol")} ${order.table || "—"}`;
    }
  }

  return String(name).trim();
}

function getCustomerPhone(order = {}, profile = {}) {
  return profile.phone || order.customerPhone || order.phone || "";
}

function getLoyaltyLevel(totalSpent = 0, visits = 0) {
  if (visits >= 5) return "gold";
  if (visits >= 3) return "silver";
  return "bronze";
}

function getLoyaltyDiscountPercent(visits = 0) {
  if (visits >= 5) return 10;
  if (visits >= 3) return 5;
  return 0;
}

function buildFavoriteItems(map = {}, limit = 4) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function getReservationStatusActions(status) {
  const s = String(status || "pending").toLowerCase();

  if (s === "pending") {
    return [
      { label: t("confirm_btn"), status: "confirmed" },
      { label: t("cancel_btn"), status: "canceled" }
    ];
  }

  if (s === "confirmed") {
    return [
      { label: t("seated_btn"), status: "seated" },
      { label: t("no_show_btn"), status: "no_show" }
    ];
  }

  if (s === "seated") {
    return [
      { label: t("complete_btn"), status: "completed" }
    ];
  }

  return [];
}

function buildCustomerMapFromOrders(ordersObj = {}, customerProfiles = {}, users = {}) {
  const map = {};

  Object.entries(ordersObj || {}).forEach(([orderId, order]) => {
    const phone = getCustomerPhone(order);
    const customerId = order.customerId || phone || `table_${order.table || "unknown"}`;

    // Customers profilidan boshlang'ich visits olish
    const existingProfile = phone ? (buildCustomerProfilePhoneCache(customerProfiles || {})[normalizePhone(phone)] || null) : null;
    if (!map[customerId]) {
      map[customerId] = {
        id: customerId,
        name: getCustomerDisplayName(order),
        phone: phone || "",
        visits: 0, totalSpent: 0, cashbackBalance: 0,
        promoCodesUsed: new Set(), favoriteItemsMap: {},
        recentOrders: [], lastVisit: 0, loyalty: "bronze",
        allergies: [],
        preferences: []
      };
    }

    const customer = map[customerId];
    if (isCountableVisit(order)) {
      customer.visits += 1;
    }
    customer.totalSpent += Number(order.finalTotal || order.total || 0);
    customer.lastVisit = Math.max(customer.lastVisit, getOrderTimestamp(order));
    customer.allergies = uniqueCustomerMemoryList([
      ...customer.allergies,
      ...normalizeCustomerMemoryList(order.allergyNote)
    ]);
    customer.preferences = uniqueCustomerMemoryList([
      ...customer.preferences,
      ...normalizeCustomerMemoryList(order.preferenceNote)
    ]);

    if (order.promoCode) customer.promoCodesUsed.add(order.promoCode);

    Object.values(order.items || {}).forEach(item => {
      const menuItem = window.allMenu?.[item.menuId || item.id || item.itemId];
      const itemName = getTranslatedItemName(item, menuItem, getLang());
      customer.favoriteItemsMap[itemName] =
        (customer.favoriteItemsMap[itemName] || 0) + Number(item.qty || 0);
    });

    customer.recentOrders.push({
      orderId,
      orderNumber: order.orderNumber || orderId,
      table: order.table || uiEmpty(),
      total: Number(order.finalTotal || order.total || 0),
      status: order.statusLabel || order.status || uiEmpty(),
      createdAt: getOrderTimestamp(order)
    });
  });

  Object.entries(customerProfiles || {}).forEach(([id, profile]) => {
    const key = profile.phone || id;
    if (!map[key]) {
      map[key] = {
        id: key, name: profile.name || uiEmpty(), phone: profile.phone || "",
        visits: Number(profile.visits || 0), totalSpent: Number(profile.totalSpent || 0),
        cashbackBalance: Number(profile.cashbackBalance || 0),
        promoCodesUsed: new Set(profile.promoCodesUsed || []),
        favoriteItemsMap: {}, recentOrders: [],
        lastVisit: Number(profile.lastVisit || 0), loyalty: profile.loyalty || "bronze",
        allergies: normalizeCustomerMemoryList(profile.allergies),
        preferences: normalizeCustomerMemoryList(profile.preferences)
      };
    } else {
      map[key].name = profile.name || map[key].name;
      map[key].cashbackBalance = Number(profile.cashbackBalance || map[key].cashbackBalance || 0);
      map[key].lastVisit = Math.max(Number(profile.lastVisit || 0), map[key].lastVisit || 0);
      // Customers profilidagi visits va totalSpent ni ham hisobga olish
      map[key].visits = Math.max(map[key].visits, Number(profile.visits || 0));
      map[key].totalSpent = Math.max(map[key].totalSpent, Number(profile.totalSpent || 0));
      (profile.promoCodesUsed || []).forEach(code => map[key].promoCodesUsed.add(code));
      map[key].allergies = uniqueCustomerMemoryList([
        ...normalizeCustomerMemoryList(map[key].allergies),
        ...normalizeCustomerMemoryList(profile.allergies)
      ]);
      map[key].preferences = uniqueCustomerMemoryList([
        ...normalizeCustomerMemoryList(map[key].preferences),
        ...normalizeCustomerMemoryList(profile.preferences)
      ]);
    }
  });

  Object.entries(users || {}).forEach(([id, user]) => {
    if (user.role !== "client") return;
    const key = user.phone || id;
    if (!map[key]) {
      map[key] = {
        id: key, name: user.name || uiEmpty(), phone: user.phone || "",
        visits: 0, totalSpent: 0,
        cashbackBalance: Number(user.cashbackBalance || 0),
        promoCodesUsed: new Set(), favoriteItemsMap: {},
        recentOrders: [], lastVisit: Number(user.lastVisit || 0), loyalty: "bronze",
        allergies: [],
        preferences: []
      };
    }
  });

  return Object.values(map).map(customer => ({
    ...customer,
    favoriteItems: buildFavoriteItems(customer.favoriteItemsMap, 4),
    promoCodesUsed: Array.from(customer.promoCodesUsed),
    loyalty: getLoyaltyLevel(customer.totalSpent, customer.visits),
    allergies: uniqueCustomerMemoryList(customer.allergies),
    preferences: uniqueCustomerMemoryList(customer.preferences),
    recentOrders: customer.recentOrders
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
  })).sort((a, b) => b.totalSpent - a.totalSpent);
}

async function autoTranslate(text, targetLang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=uz&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!res.ok) throw new Error(t("translate_service_busy", "Tarjima xizmati band"));
    const data = await res.json();
    return data[0][0][0];
  } catch (e) {
    console.warn(t("translate_error_log"), e);
    return text;
  }
}

function getTranslatedItemName(item, menuItem = null, lang = getLang()) {
  if (menuItem?.name) {
    if (typeof menuItem.name === "object") {
      return menuItem.name[lang] || menuItem.name.uz || menuItem.name.ru || menuItem.name.en || uiEmpty();
    }
    return menuItem.name || uiEmpty();
  }
  if (item?.name) {
    if (typeof item.name === "object") {
      return item.name[lang] || item.name.uz || item.name.ru || item.name.en || uiEmpty();
    }
    return item.name || uiEmpty();
  }
  return uiEmpty();
}

function showToast(text, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ==========================================
// 🔔 YANGI BUYURTMA OVOZLI BILDIRISHNOMA
// ==========================================
(function initOrderSoundSystem() {
  const _restId = localStorage.getItem("restaurantId");
  if (!_restId) return;

  onValue(ref(db, `restaurants/${_restId}/settings/notificationsEnabled`), snap => {
    window._adminNotifEnabled = snap.exists() ? snap.val() : true;
    console.log("🔔 Ovozli bildirishnoma:", window._adminNotifEnabled ? "YOQILGAN" : "O'CHIRILGAN");
  });
  if (window._adminNotifEnabled === undefined) {
    window._adminNotifEnabled = true;
  }
})();

function playNewOrderSound() {
  if (!window._adminNotifEnabled) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    const notes = [
      { freq: 880, start: 0.0,  dur: 0.18 },
      { freq: 660, start: 0.2,  dur: 0.18 },
      { freq: 880, start: 0.42, dur: 0.25 }
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });

    // Kontekstni ovozlar tugagandan keyin yopish
    setTimeout(() => ctx.close(), 1200);
  } catch (e) {
    console.warn("Ovoz chiqarishda xato:", e);
  }
}

/** Ovozli + vizual yangi buyurtma bildirishnomasi */
function notifyNewOrder(orderCount) {
  if (!window._adminNotifEnabled) return;

  playNewOrderSound();

  // Animatsiyali banner
  const banner = document.createElement("div");
  banner.id = "new-order-banner-" + Date.now();
  banner.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-80px);
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: white; padding: 14px 28px; border-radius: 14px;
    font-size: 15px; font-weight: 700; z-index: 99999;
    box-shadow: 0 8px 32px rgba(22,163,74,0.45);
    display: flex; align-items: center; gap: 10px;
    transition: transform 0.35s cubic-bezier(.175,.885,.32,1.275);
    white-space: nowrap;
  `;
  banner.innerHTML = `
    <span style="font-size:20px;animation:bell-shake 0.6s ease infinite alternate;">🔔</span>
    <span>${orderCount > 1 ? t("new_orders_count", "{count} ta yangi buyurtma!").replace("{count}", orderCount) : t("new_order_arrived", "Yangi buyurtma keldi!")}</span>
  `;

  if (!document.getElementById("bell-shake-style")) {
    const s = document.createElement("style");
    s.id = "bell-shake-style";
    s.textContent = `@keyframes bell-shake{0%{transform:rotate(-15deg)}100%{transform:rotate(15deg)}}`;
    document.head.appendChild(s);
  }

  document.body.appendChild(banner);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.style.transform = "translateX(-50%) translateY(0)";
    });
  });

  setTimeout(() => {
    banner.style.transform = "translateX(-50%) translateY(-80px)";
    setTimeout(() => banner.remove(), 400);
  }, 3500);
}

// ==========================================
// 🆕 YANGI BUYURTMALARNI KUZATISH
// ==========================================

/** Ilgari ko'rilgan buyurtma ID larini saqlash (sahifa yuklanishida to'ldiriladi) */
window._knownOrderIds = window._knownOrderIds || null; // null = hali ishga tushmagan

/**
 * Berilgan orders obyektidan yangi "yangi/queue/new" statusli buyurtmalarni aniqlash.
 * Birinchi yuklanishda faqat ro'yxatni to'ldiradi, ovoz chiqarmaydi.
 */
function detectAndSoundNewOrders(ordersObj) {
  const newStatusSet = new Set(["yangi", "new", "queue"]);

  const currentNewIds = new Set(
    Object.entries(ordersObj || {})
      .filter(([, o]) => {
        const s = String(o.statusKey || o.status || "yangi").trim().toLowerCase();
        return newStatusSet.has(s);
      })
      .map(([id]) => id)
  );

  if (window._knownOrderIds === null) {
    // Birinchi yuklash — faqat saqlash, ovoz yo'q
    window._knownOrderIds = new Set(currentNewIds);
    return;
  }

  // Yangi kelganlarni topish
  const arrivedIds = [...currentNewIds].filter(id => !window._knownOrderIds.has(id));

  if (arrivedIds.length > 0) {
    notifyNewOrder(arrivedIds.length);
  }

  // Ro'yxatni yangilash (tasdiqlangan yoki yo'q bo'lganlarni olib tashlash)
  window._knownOrderIds = new Set(currentNewIds);
}

function showAdminNotification(text, type = "success") {
  const n = document.createElement("div");
  n.className = `admin-toast ${type}`;
  n.innerText = text;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add("show"), 50);
  setTimeout(() => {
    n.classList.remove("show");
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

function showNotification(text) {
  const n = document.getElementById("notification");
  if (!n) return;
  n.innerText = text;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 3000);
}

addImgInput?.addEventListener("change", () => {
  if (addFileName) addFileName.textContent = addImgInput.files?.[0]?.name || t("file_not_selected");
});
editImgInput?.addEventListener("change", () => {
  if (editFileName) editFileName.textContent = editImgInput.files?.[0]?.name || t("file_not_selected");
});

function renderCategories(select, selected = "") {
  if (!select) return;
  select.innerHTML = `<option value="">${t("select_category")}</option>`;
  CATEGORY_DATA.categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.id}" ${cat.id === selected ? "selected" : ""}>${t(cat.nameKey)}</option>`;
  });
}

function renderSubcategories(select, categoryId, selected = "") {
  if (!select) return;
  select.innerHTML = `<option value="">${t("select_subcategory")}</option>`;
  const catObj = CATEGORY_DATA.categories.find(c => c.id === categoryId);
  if (!catObj) return;
  catObj.sub.forEach(subKey => {
    select.innerHTML += `<option value="${subKey}" ${subKey === selected ? "selected" : ""}>${t(subKey)}</option>`;
  });
}

function initOrderCategoryFilter() {
  if (!filterOrderCategory || !filterOrderSubcategory) return;
  filterOrderCategory.innerHTML = `<option value="all">${t("all_categories")}</option>`;
  CATEGORY_DATA.categories.forEach(cat => {
    filterOrderCategory.innerHTML += `<option value="${cat.id}">${t(cat.nameKey)}</option>`;
  });
  filterOrderSubcategory.innerHTML = `<option value="all">${t("all_subcategories")}</option>`;
}

filterOrderCategory?.addEventListener("change", () => {
  const catId = filterOrderCategory.value;
  filterOrderSubcategory.innerHTML = `<option value="all">${t("all_subcategories")}</option>`;
  if (catId !== "all") {
    const cat = CATEGORY_DATA.categories.find(c => c.id === catId);
    cat?.sub.forEach(subKey => {
      filterOrderSubcategory.innerHTML += `<option value="${subKey}">${t(subKey)}</option>`;
    });
  }
  renderOrders(window.allOrders);
});

filterOrderSubcategory?.addEventListener("change", () => renderOrders(window.allOrders));
categorySelect?.addEventListener("change", () => renderSubcategories(subcategorySelect, categorySelect.value));
editCategory?.addEventListener("change", () => renderSubcategories(editSubCategory, editCategory.value));

function renderOrders(ordersObj) {
  const list = document.getElementById("ordersList");
  if (!list) return;

  try {
    const priority = {
      yangi: 1, new: 1, queue: 1,
      tasdiqlandi: 2, approved: 2,
      tayyorlanmoqda: 3, cooking: 3,
      tayyor: 4, ready: 4,
      yopildi: 5, closed: 5
    };

    let filteredArr = applyOrderFilters(ordersObj);
    if (typeof applyChefFilter === 'function') {
      filteredArr = applyChefFilter(filteredArr);
    }

    let htmlContent = "";

    filteredArr
      .sort((a, b) => {
        const sa = String(a[1].statusKey || a[1].status || "").trim().toLowerCase();
        const sb = String(b[1].statusKey || b[1].status || "").trim().toLowerCase();

        if ((priority[sa] || 99) !== (priority[sb] || 99)) {
          return (priority[sa] || 99) - (priority[sb] || 99);
        }
        const ta = a[1].createdAt || 0;
        const tb = b[1].createdAt || 0;
        return tb - ta;
      })
      .forEach(([id, order]) => {
        if (typeof renderOrderCard === 'function') {
          htmlContent += renderOrderCard(id, order);
        }
      });

    list.innerHTML = htmlContent;
  } catch (e) {
    console.error(t("error_rendering_orders") || "renderOrders xatosi:", e);
    list.innerHTML = `<p style="color:red;">${t("error_rendering_orders") || "Xatolik yuz berdi"}</p>`;
  }
}

function applyOrderFilters(ordersObj) {
  const paymentStatus = filterPaymentStatus?.value || "all";
  const category = filterOrderCategory?.value || "all";
  const subcategory = filterOrderSubcategory?.value || "all";
  const paymentMethod = filterPaymentType?.value || "all";

  return Object.entries(ordersObj || {}).filter(([_, order]) => {
    if (paymentStatus !== "all") {
      const paid = order.payment?.paid === true;
      if (paymentStatus === "paid" && !paid) return false;
      if (paymentStatus === "unpaid" && paid) return false;
    }

    if (paymentMethod !== "all") {
      const method = normalizePaymentMethod(order.payment?.method);
      if (method !== paymentMethod) return false;
    }

    if (category !== "all" || subcategory !== "all") {
      const match = Object.entries(order.items || {}).some(([_, item]) => {
        const menuItem = window.allMenu?.[item.menuId || item.id || item.itemId];
        if (!menuItem) return false;
        if (category !== "all" && menuItem.category !== category) return false;
        if (subcategory !== "all" && menuItem.subcategory !== subcategory) return false;
        return true;
      });

      if (!match) return false;
    }

    return true;
  });
}

window.closeTable = async (orderId, tableNumber) => {
  try {
    const freeData = { status: "free", orderId: null, busy: false, closedByAdmin: true };
    // Ikki formatda ham yozamiz (table_1 va 1)
    const tableNum = String(tableNumber).replace("table_", "");
    await update(ref(db, BASE_PATH + "/tables/" + tableNumber), freeData);
    try { await update(ref(db, BASE_PATH + "/tables/table_" + tableNum), freeData); } catch(_) {}
    try { await update(ref(db, BASE_PATH + "/tables/" + tableNum), freeData); } catch(_) {}

    await update(ref(db, BASE_PATH + "/orders/" + orderId), {
      tableClosed: true,
      status: "closed",
      statusKey: "closed",
      statusLabel: "closed"
    });

    // Mijoz profilini yangilash (tashrif soni uchun)
    try {
      const closedOrderSnap = await get(ref(db, BASE_PATH + "/orders/" + orderId));
      if (closedOrderSnap.exists() && typeof syncCustomerProfileFromOrder === "function") {
        await syncCustomerProfileFromOrder(orderId, closedOrderSnap.val(), window.allOrders);
      }
    } catch (syncErr) { console.warn("syncCustomerProfile error:", syncErr); }

    await window.createOrderTimelineEvent(orderId, "table_closed", {
      tableNumber,
      closedByAdmin: true
    });

    await crmAdvAudit(
      "tables",
      "close",
      String(tableNumber),
      t("audit_table_closed_admin"),
      { orderId, tableNumber },
      "info"
    );

    showAdminNotification(t("alerts.table_closed"));
  } catch (err) {
    console.error(err);
    showAdminNotification(t("notify.error"), "error");
  }
};

addMenuBtn?.addEventListener("click", async () => {
  const nameUz = foodNameInput.value.trim();
  const price = Number(addPrice.value);
  const category = categorySelect.value;
  const subcategory = subcategorySelect.value;
  const prepTime = Number(document.getElementById("addPrepTime")?.value || 30);

  const imgUrlInput = document.getElementById("addImgUrlInput")?.value.trim();

  if (!nameUz || price <= 0 || !category || !subcategory) {
    alert(t("alerts.fill_all")); return;
  }

  const id = Date.now().toString();
  try {
    const finalImgUrl = imgUrlInput || "img/no-image.png";

    const nameRu = await autoTranslate(nameUz, "ru");
    const nameEn = await autoTranslate(nameUz, "en");

    await set(ref(db, BASE_PATH + "/menu/" + id), {
      name: { uz: nameUz, ru: nameRu, en: nameEn },
      price, category, subcategory, prepTime,
      imgUrl: finalImgUrl,
      imgPath: "",
      active: true, createdAt: Date.now()
    });

    showNotification(t("notify.food_added"));
    foodNameInput.value = "";
    addPrice.value = "";
    const prepTimeEl = document.getElementById("addPrepTime");
    if (prepTimeEl) prepTimeEl.value = "";

    if (document.getElementById("addImgUrlInput")) document.getElementById("addImgUrlInput").value = "";
  } catch (err) {
    console.error(err); alert(t("notify.error"));
  }
});

window.editMenu = async function (id) {
  editingItemId = id;
  const snap = await get(ref(db, BASE_PATH + "/menu/" + id));
  if (!snap.exists()) return alert(t("alerts.not_found"));
  const item = snap.val();

  if (editName) editName.value = item.name?.[getLang()] || item.name?.uz || item.name?.ru || item.name?.en || "";
  if (editPriceInput) editPriceInput.value = item.price || "";

  const editPrepTimeEl = document.getElementById("editPrepTime");
  if (editPrepTimeEl) editPrepTimeEl.value = item.prepTime || 30;

  renderCategories(editCategory, item.category);
  renderSubcategories(editSubCategory, item.category, item.subcategory);

  const editImgInputUrl = document.getElementById("editImgUrlInput");
  if (editImgInputUrl) editImgInputUrl.value = item.imgUrl || "";
  if (editFileName) editFileName.textContent = t("file_not_selected");
  if (editModal) editModal.classList.remove("hidden");
};

window.closeEditModal = function () {
  editModal?.classList.add("hidden");
  editingItemId = null;
  oldImagePath = "";
  if (editImgInput) editImgInput.value = "";
  if (editFileName) editFileName.textContent = t("file_not_selected");
};

window.saveMenuItem = async function () {
  if (!editingItemId) return;
  const updates = {};
  const name = editName?.value.trim();
  const price = Number(editPriceInput?.value);
  const prepTime = Number(document.getElementById("editPrepTime")?.value || 30); // VAQTNI OLISH
  const category = editCategory?.value;
  const subcategory = editSubCategory?.value;

  const currentSnap = await get(ref(db, BASE_PATH + "/menu/" + editingItemId));
  const currentItem = currentSnap.val() || {};

  if (name) {
    const translatedRu = await autoTranslate(name, "ru");
    const translatedEn = await autoTranslate(name, "en");
    updates.name = {
      uz: name,
      ru: translatedRu || currentItem.name?.ru || "",
      en: translatedEn || currentItem.name?.en || ""
    };
  }

  if (price > 0) updates.price = price;
  if (category) updates.category = category;
  if (subcategory) updates.subcategory = subcategory;
  if (prepTime > 0) updates.prepTime = prepTime;

  const editImgInputUrl = document.getElementById("editImgUrlInput")?.value.trim();
  if (editImgInputUrl) {
    updates.imgUrl = editImgInputUrl;
    updates.imgPath = "";
  }

  if (!Object.keys(updates).length) { alert(t("alerts.fill_all")); return; }

  await update(ref(db, BASE_PATH + "/menu/" + editingItemId), updates);
  window.closeEditModal();

  await crmAdvAudit("menu", "update", editingItemId, t("audit_menu_updated"), updates, "info");
};

window.deleteMenu = async function (id) {
  if (!confirm(t("alerts.confirm_delete"))) return;
  const snap = await get(ref(db, BASE_PATH + "/menu/" + id));
  if (!snap.exists()) return;
  const item = snap.val();
  undoStack = { id, item };
  await remove(ref(db, BASE_PATH + "/menu/" + id));
  showUndoToast();
  undoTimer = setTimeout(async () => {
    if (undoStack?.id === id) {
      if (item.imgPath) await deleteObject(storageRef(storage, item.imgPath)).catch(() => { });
      undoStack = null;
    }
  }, 5000);
};

function showUndoToast() {
  const toast = document.createElement("div");
  toast.className = "undo-toast";
  toast.innerHTML = `<span>${t("deleted")}</span><button id="undoBtn">♻️ ${t("undo")}</button>`;
  document.body.appendChild(toast);
  document.getElementById("undoBtn").onclick = async () => {
    if (!undoStack) return;
    clearTimeout(undoTimer);
    await set(ref(db, BASE_PATH + "/menu/" + undoStack.id), undoStack.item);
    undoStack = null;
    toast.remove();
    showAdminNotification(t("undo_success"));
  };
  setTimeout(() => toast.remove(), 5000);
}

window.clearAllOrders = async function () {
  if (!confirm(t("confirm_delete_orders_full"))) return;
  const tablesSnap = await get(ref(db, BASE_PATH + "/tables"));
  const updates = { orders: null };
  if (tablesSnap.exists()) {
    Object.keys(tablesSnap.val()).forEach(key => {
      updates["tables/" + key + "/status"] = "free";
      updates["tables/" + key + "/orderId"] = null;
    });
  }
  await update(ref(db, BASE_PATH), updates);
  showNotification(t("orders_deleted"));
};

// ─── Reports ─────────────────────────────────────────────
window.generateRangeReport = async function () {
  const snap = await get(ref(db, BASE_PATH + "/orders"));
  if (!snap.exists()) { alert(t("alerts.no_data")); return; }

  const orders = Object.values(snap.val() || {});
  const dateFiltered = filterByDate(orders);
  if (!dateFiltered.length) { alert(t("alerts.no_data")); return; }

  const reportOrders = filterByPayment(dateFiltered);
  if (!reportOrders.length) { alert(t("alerts.no_data")); return; }

  let totalSum = 0;
  reportOrders.forEach(o => { totalSum += Number(o.total || 0); });

  const reportResult = document.getElementById("reportResult");
  if (reportResult) reportResult.innerHTML = `💰 <b>${t("total_sum")}: ${totalSum.toLocaleString()} ${t("currency")}</b>`;

  renderStatusChart(reportOrders.reduce((acc, o) => {
    const key = String(o.status || o.statusKey || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}));

  const { cashSum, paymeSum, clickSum } = calculatePayments(reportOrders);
  const paymentSummary = document.getElementById("paymentSummary");
  if (paymentSummary) {
    paymentSummary.innerHTML = `
        💵 ${t("payment_cash")}: <b>${cashSum.toLocaleString()} ${t("currency")}</b><br>
        📲 ${t("payment_payme")}: <b>${paymeSum.toLocaleString()} ${t("currency")}</b><br>
        🔵 ${t("payment_click")}: <b>${clickSum.toLocaleString()} ${t("currency")}</b>
      `;
  }

  renderTopFoodsChart(reportOrders);
  renderTopFoodsTable(reportOrders);
  renderCategorySales(reportOrders);
  renderOrdersChart(reportOrders.length);
};

function calculateCategorySales(orders) {
  const stats = {};
  orders.forEach(order => {
    if (!order.items) return;
    Object.entries(order.items).forEach(([itemId, item]) => {
      const menuId = item.menuId || item.id || item.itemId || itemId;
      const menuItem = window.allMenu?.[menuId];
      const qty = Number(item.qty || 0);
      const sum = Number(item.price || 0) * qty;
      const cat = menuItem?.category || "unknown";
      if (!stats[cat]) stats[cat] = { qty: 0, sum: 0 };
      stats[cat].qty += qty;
      stats[cat].sum += sum;
    });
  });
  return stats;
}

function renderCategorySales(orders) {
  const tbody = document.getElementById("categorySalesTable");
  if (!tbody) return;
  const stats = calculateCategorySales(orders);

  let htmlContent = "";

  Object.entries(stats).forEach(([catId, v]) => {
    const catObj = CATEGORY_DATA.categories.find(c => c.id === catId);
    const name = catObj ? t(catObj.nameKey) : catId;
    htmlContent += `<tr><td>${name}</td><td>${v.qty}</td><td>${v.sum.toLocaleString()} ${t("currency")}</td></tr>`;
  });
  tbody.innerHTML = htmlContent;
}

window.downloadChartPNG = function (canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = canvasId + ".png";
  link.click();
};

window.downloadChartPDF = function (canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const imgData = canvas.toDataURL("image/png", 1.0);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape");
  const imgWidth = 280;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
  pdf.save(canvasId + ".pdf");
};

function renderOrdersChart(count) {
  const ctx = document.getElementById("ordersChart");
  if (!ctx) return;
  if (ordersChart) ordersChart.destroy();
  ordersChart = new Chart(ctx, {
    type: "bar",
    data: { labels: [t("orders_list")], datasets: [{ label: t("orders_list"), data: [count] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderStatusChart(statusCount) {
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(statusCount).map(k => t("status_" + k.toLowerCase())),
      datasets: [{ data: Object.values(statusCount) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

window.downloadCSV = async function () {
  const snap = await get(ref(db, BASE_PATH + "/orders"));
  if (!snap.exists()) { alert(t("alerts.no_data")); return; }
  const orders = Object.values(snap.val());
  const lang = getLang();
  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "uz-UZ";
  let csv = "\uFEFF" + `${t("report_date")};${t("table")};${t("total_sum")};${t("order_status")}\n`;
  orders.forEach(o => {
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString(locale) : "";
    const rawStatus = String(o.status || "").toLowerCase();
    const statusKey = "status_" + rawStatus;
    const statusText = t(statusKey) !== statusKey ? t(statusKey) : o.status;
    csv += `${date};${o.table || ""};${Number(o.total || 0).toLocaleString(locale)};${statusText}\n`;
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  link.download = t("report_title") + ".csv";
  link.click();
};

window.downloadExcel = async function () {
  const snap = await get(ref(db, BASE_PATH + "/orders"));
  if (!snap.exists()) { alert(t("alerts.no_data")); return; }
  const rawOrders = Object.values(snap.val());
  const lang = getLang();
  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "uz-UZ";
  const dateLabel = t("report_date"), tableLabel = t("table"),
    totalLabel = t("total_sum"), statusLabel = t("order_status");
  const orders = rawOrders.map(o => {
    const rawStatus = String(o.status || "").toLowerCase();
    const statusKey = "status_" + rawStatus;
    return {
      [dateLabel]: o.createdAt ? new Date(o.createdAt).toLocaleDateString(locale) : "",
      [tableLabel]: o.table || "",
      [totalLabel]: Number(o.total || 0),
      [statusLabel]: t(statusKey) !== statusKey ? t(statusKey) : o.status
    };
  });
  const ws = XLSX.utils.json_to_sheet(orders);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tr("report_title", tr("report_default_title", "Report")));
  XLSX.writeFile(wb, (tr("report_title", tr("report_default_title", "Report"))) + ".xlsx");
};

function calculateTopFoods(orders) {
  const stats = {};
  orders.forEach(order => {
    if (!order.items) return;
    Object.values(order.items).forEach(item => {
      const name = typeof item.name === "object"
        ? item.name?.[getLang()] || item.name?.uz || item.name?.ru || item.name?.en || uiEmpty()
        : item.name || uiEmpty();
      const qty = Number(item.qty || 0);
      const sum = Number(item.price || 0) * qty;
      if (!stats[name]) stats[name] = { name, qty: 0, sum: 0 };
      stats[name].qty += qty;
      stats[name].sum += sum;
    });
  });
  return Object.values(stats).sort((a, b) => b.qty - a.qty).slice(0, 10);
}

function renderTopFoodsChart(orders) {
  const ctx = document.getElementById("topFoodsChart");
  if (!ctx) return;
  if (topFoodsChart) topFoodsChart.destroy();
  const topFoods = calculateTopFoods(orders);
  if (!topFoods.length) return;
  topFoodsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topFoods.map(i => i.name),
      datasets: [{ label: t("top_foods"), data: topFoods.map(i => i.qty) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderTopFoodsTable(orders) {
  const tbody = document.getElementById("topFoodsTable");
  if (!tbody) return;
  let htmlContent = "";
  calculateTopFoods(orders).forEach((item, i) => {
    htmlContent += `<tr><td>${i + 1}</td><td>${item.name}</td><td>${item.qty}</td><td>${item.sum.toLocaleString()} ${t("currency")}</td></tr>`;
  });
  tbody.innerHTML = htmlContent;
}

// =====================================================
// 🔐 TARIF ASOSIDA FUNKSIYALARNI BOSHQARISH (PLAN GATE)
// =====================================================

/**
 * Tarifda qaysi feature larga ruxsat borligini Firebase dan
 * real-time tinglaydi va darhol UI ga qo'llaydi.
 *
 * Feature → bo'lim / element xaritalash:
 *   qr_menu  → #menu-qr, #qr-section, [data-feature="qr_menu"]
 *   kds      → #kds-link, [data-feature="kds"]
 *   promo    → #menu-promocodes, [data-feature="promo"]
 *   finance  → #menu-finance, a[href="#finance"], a[href="#report"], [data-feature="finance"]
 *   inventory→ a[href="#warehouse"], [data-feature="inventory"]
 *   reservations → a[href="#reservations"], [data-feature="reservations"]
 */

// Feature → sidebar/section selector xaritasi
const FEATURE_SECTION_MAP = {
  qr_menu:      ['#menu-qr', 'a[href="#qr"]', '[data-feature="qr_menu"]'],
  kds:          ['#kds-link', '[data-feature="kds"]'],
  promo:        ['#menu-promocodes', '[data-feature="promo"]'],
  finance:      ['#menu-finance', 'a[href="#finance"]', '[data-feature="finance"]'],
  inventory:    ['a[href="#warehouse"]', '#menu-warehouse', '[data-feature="inventory"]'],
  reservations: ['a[href="#reservations"]', '#menu-reservations', '[data-feature="reservations"]']
};

// Feature yo'q bo'lganda qaysi section ga o'tishni bloklaymiz
const FEATURE_SECTION_IDS = {
  qr_menu:      ['qr'],
  kds:          ['kds'],
  promo:        ['promocodes'],
  finance:      ['finance', 'report'],
  inventory:    ['warehouse', 'inventory'],
  reservations: ['reservations']
};

/** Joriy tarifning features massivini saqlash */
window._planFeatures = window._planFeatures || [];

/**
 * Features ro'yxatiga qarab barcha UI elementlarini yoq/o'chir.
 * Bu funksiya har safar tarif o'zgarganda qayta chaqiriladi.
 */
function applyPlanFeaturesToUI(features) {
  window._planFeatures = Array.isArray(features) ? features : [];

  Object.entries(FEATURE_SECTION_MAP).forEach(([featureId, selectors]) => {
    const allowed = window._planFeatures.includes(featureId);

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (allowed) {
          el.style.display = "";
          el.classList.remove("plan-locked");
          // Eski qulf ikonasini olib tashlaymiz
          el.querySelectorAll('.plan-lock-icon').forEach(ic => ic.remove());
          if (el.dataset._origOnclick) {
            el.onclick = null;
            delete el.dataset._origOnclick;
          }
        } else {
          // Sidebar linklarni yashirish o'rniga lock qilish (admin ko'rsin, bosib upgrade taklif qilsin)
          el.classList.add("plan-locked");
          if (!el.querySelector('.plan-lock-icon')) {
            const lockIcon = document.createElement('i');
            lockIcon.className = 'fa-solid fa-lock plan-lock-icon';
            lockIcon.style.cssText = 'margin-left:6px;color:#f59e0b;font-size:11px;';
            el.appendChild(lockIcon);
          }
          if (!el.dataset._origOnclick) {
            el.dataset._origOnclick = "1";
            el.addEventListener('click', function planLockedClick(e) {
              e.preventDefault();
              e.stopPropagation();
              showPlanUpgradeModal(featureId);
            });
          }
        }
      });
    });
  });

  const promoMenu = document.getElementById("menu-promocodes");
  if (promoMenu) promoMenu.style.display = window._planFeatures.includes("promo") ? "" : "none";

  const financeMenu = document.getElementById("menu-finance");
  if (financeMenu) financeMenu.style.display = window._planFeatures.includes("finance") ? "" : "none";
}

function showPlanUpgradeModal(featureId) {
  const featureNames = {
    qr_menu:      t("feature_qr_menu", "QR-Menyu va Self-service"),
    kds:          t("feature_kds", "Oshpaz ekrani (KDS)"),
    promo:        t("feature_promo", "Promokod / Keshbek"),
    finance:      t("feature_finance", "Moliya hisobotlari"),
    inventory:    t("feature_inventory", "Ombor (Inventarizatsiya)"),
    reservations: t("feature_reservations", "Bron tizimi")
  };
  const name = featureNames[featureId] || featureId;

  const old = document.getElementById('plan-upgrade-modal');
  if (old) old.remove();

  if (!document.getElementById('plan-pop-style')) {
    const s = document.createElement('style');
    s.id = 'plan-pop-style';
    s.textContent = `@keyframes plan-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
      .plan-locked{opacity:.55;pointer-events:auto!important;}`;
    document.head.appendChild(s);
  }

  const modal = document.createElement('div');
  modal.id = 'plan-upgrade-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;
    display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:36px 32px;max-width:420px;width:90%;text-align:center;
                box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:plan-pop .25s ease;">
      <div style="font-size:48px;margin-bottom:12px;">🔒</div>
      <h3 style="margin:0 0 10px;font-size:20px;color:#1e293b;">${t("plan_limit_title", "Tarif cheklovi")}</h3>
      <p style="color:#64748b;margin:0 0 20px;font-size:14px;line-height:1.6;">
        <b style="color:#f59e0b;">${name}</b> ${t("plan_feature_not_available", "funksiyasi joriy tarifingizda mavjud emas.")}<br>
        ${t("plan_upgrade_request", "Superadmin orqali tarifni yangilang.")}
      </p>
      <div style="background:#fef9ee;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#92400e;">
        💡 ${t("current_plan_label", "Joriy tarif:")} <b>${(window._currentPlanName || 'START').toUpperCase()}</b>
      </div>
      <div id="plan-upgrade-required-slot"></div>
      <button onclick="document.getElementById('plan-upgrade-modal').remove()"
        style="background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:12px 32px;
               font-size:15px;font-weight:700;cursor:pointer;width:100%;">${t("understood_btn", "Tushunarli")}</button>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const TARIFF_ORDER = ['start', 'pro', 'premium'];
  const currentKey = (window._currentPlanKey || 'start').toLowerCase();

  function _renderRequiredTariff(allTariffs) {
    const slot = document.getElementById('plan-upgrade-required-slot');
    if (!slot) return;

    let requiredTariffName = null;

    for (const tKey of TARIFF_ORDER) {
      if (TARIFF_ORDER.indexOf(tKey) <= TARIFF_ORDER.indexOf(currentKey)) continue;
      const tData = allTariffs[tKey] || {};
      const tFeatures = Array.isArray(tData.features) ? tData.features : [];
      if (tFeatures.includes(featureId)) {
        requiredTariffName = tData.name || tKey.toUpperCase();
        break;
      }
    }

    if (!requiredTariffName) {
      for (const tKey of TARIFF_ORDER) {
        const tData = allTariffs[tKey] || {};
        const tFeatures = Array.isArray(tData.features) ? tData.features : [];
        if (tFeatures.includes(featureId)) {
          requiredTariffName = tData.name || tKey.toUpperCase();
          break;
        }
      }
    }

    if (requiredTariffName) {
      slot.innerHTML = `
        <div style="background:#f0fdf4;border:1.5px solid #6ee7b7;border-radius:10px;padding:12px 14px;
                    margin-bottom:20px;font-size:13px;color:#065f46;display:flex;align-items:center;
                    justify-content:center;gap:8px;">
          <span style="font-size:18px;">⬆️</span>
          <span>${t("required_plan_label", "Kerakli tarif:")} <b style="color:#059669;font-size:15px;">${requiredTariffName}</b></span>
        </div>`;
    } else {
      slot.innerHTML = '';
    }
  }

  if (window.allTariffs && Object.keys(window.allTariffs).length > 0) {
    _renderRequiredTariff(window.allTariffs);
  } else {
    get(ref(db, 'systemData/settings/tariffs')).then(snap => {
      if (snap.exists()) {
        const fetched = snap.val();
        window.allTariffs = fetched; 
        _renderRequiredTariff(fetched);
      }
    }).catch(() => {  });
  }
}

function listenPlanFeatures() {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  onValue(ref(db, `restaurants/${restId}/info/tariff`), async tariffSnap => {
    const tariffKey = (tariffSnap.val() || "start").toLowerCase();
    window._currentPlanKey  = tariffKey;

    const featSnap = await get(ref(db, `systemData/settings/tariffs/${tariffKey}`));
    const tariffData = featSnap.val() || {};
    window._currentPlanName = tariffData.name || tariffKey.toUpperCase();

    const features = Array.isArray(tariffData.features) ? tariffData.features : [];
    console.log(`📋 Tarif: ${tariffKey.toUpperCase()} | Features:`, features);
    update(ref(db, `restaurants/${restId}/subscription`), { features });

    applyPlanFeaturesToUI(features);
  });
  onValue(ref(db, `systemData/settings/tariffs`), snap => {
    if (!snap.exists()) return;
    const allTariffs = snap.val();
    window.allTariffs = allTariffs; // showPlanUpgradeModal uchun global saqlash

    const tariffKey  = window._currentPlanKey || "start";
    const tariffData = allTariffs[tariffKey] || {};
    window._currentPlanName = tariffData.name || tariffKey.toUpperCase();

    const features = Array.isArray(tariffData.features) ? tariffData.features : [];
    update(ref(db, `restaurants/${restId}/subscription`), { features });

    applyPlanFeaturesToUI(features);
  });

  onValue(ref(db, `restaurants/${restId}/subscription/features`), snap => {
    const features = Array.isArray(snap.val()) ? snap.val() : [];
    if (JSON.stringify(features) !== JSON.stringify(window._planFeatures)) {
      applyPlanFeaturesToUI(features);
    }
  });
}

/**
 * showSection uchun feature guard — bloklangan sectionga
 * o'tishga urinilsa modal chiqaradi.
 */
function isPlanFeatureBlocked(sectionId) {
  for (const [featureId, sectionIds] of Object.entries(FEATURE_SECTION_IDS)) {
    if (sectionIds.includes(sectionId)) {
      if (!window._planFeatures.includes(featureId)) {
        showPlanUpgradeModal(featureId);
        return true;
      }
    }
  }
  return false;
}

async function checkAvailableFeatures() {
  // Eski funksiya — listenPlanFeatures() buni real-time bajaradi.
  // Moslik uchun saqlanadi.
}

window.refreshReports = async function () {
  if (ordersChart) ordersChart.destroy();
  if (statusChart) statusChart.destroy();
  if (topFoodsChart) topFoodsChart.destroy();
  ordersChart = statusChart = topFoodsChart = null;
  await window.generateRangeReport();
  showAdminNotification(t("updated"), "success");
};

function normalizePaymentMethod(method = "") {
  const m = String(method || "").trim().toLowerCase();
  if (m === "cash") return "cash";
  if (m === "payme") return "payme";
  if (m === "click" || m === "card") return "click";
  return "";
}

function filterByPayment(orders) {
  const cashChecked = document.getElementById("filterCash")?.checked ?? true;
  const paymeChecked = document.getElementById("filterPayme")?.checked ?? true;
  const clickChecked = document.getElementById("filterClick")?.checked ?? true;
  const paidOnly = document.getElementById("filterPaidOnly")?.checked ?? false;

  return orders.filter(order => {
    if (!order.payment) return false;
    const method = normalizePaymentMethod(order.payment.method);
    const isPaid = order.payment.paid === true;
    if (paidOnly && !isPaid) return false;
    if (!cashChecked && !paymeChecked && !clickChecked) return false;
    if (method === "cash") return cashChecked;
    if (method === "payme") return paymeChecked;
    if (method === "click") return clickChecked;
    return false;
  });
}

function calculatePayments(orders) {
  let cashSum = 0, paymeSum = 0, clickSum = 0;
  orders.forEach(o => {
    const sum = Number(o.total || 0);
    const method = normalizePaymentMethod(o.payment?.method);
    if (method === "cash") cashSum += sum;
    if (method === "payme") paymeSum += sum;
    if (method === "click") clickSum += sum;
  });
  return { cashSum, paymeSum, clickSum };
}

function filterByDate(orders) {
  const mode = document.getElementById("dateMode")?.value;
  const fromInput = document.getElementById("reportFrom")?.value;
  const toInput = document.getElementById("reportTo")?.value;
  const today = new Date();
  let fromDate, toDate;

  if (mode === "day") {
    fromDate = new Date(today.setHours(0, 0, 0, 0));
    toDate = new Date(today.setHours(23, 59, 59, 999));
  } else if (mode === "month") {
    fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  } else if (mode === "range") {
    if (!fromInput || !toInput) return [];
    fromDate = new Date(fromInput);
    toDate = new Date(toInput);
    toDate.setHours(23, 59, 59, 999);
  } else {
    return orders;
  }

  return orders.filter(o => {
    const time = o.createdAt || o.date;
    if (!time) return false;
    const d = new Date(time);
    return d >= fromDate && d <= toDate;
  });
}

["filterCash", "filterPayme", "filterClick", "filterPaidOnly"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", window.generateRangeReport);
});

function renderMenu() {
  if (!menuList) return;
  const lang = getLang();
  let items = Object.entries(window.allMenu || {})
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (searchQuery) {
    items = items.filter(item => {
      const name = item.name?.[lang] || item.name?.uz || item.name?.ru || item.name?.en || "";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  menuList.innerHTML = items.length
    ? items.map(item => {
      const name = item.name?.[lang] || item.name?.uz || item.name?.ru || item.name?.en || uiEmpty();
      const categoryObj = CATEGORY_DATA?.categories?.find(c => c.id === item.category);
      const catName = categoryObj ? t(categoryObj.nameKey) : item.category || uiEmpty();
      const subName = item.subcategory ? t(item.subcategory) : uiEmpty();
      const img = item.imgUrl?.trim() ? item.imgUrl : "img/no-image.png";

      return `
            <div class="menu-card">
              <label class="menu-select">
                <input type="checkbox" class="menu-check" value="${item.id}">
                <span></span>
              </label>
              <div class="menu-img"><img src="${img}" alt="${name}" onerror="this.src='img/no-image.png'"></div>
              <div class="menu-info">
                <h4>${name}</h4>
                <p class="menu-cat">📂 ${catName} / ${subName}</p>
                <p class="menu-price">💰 ${(item.price ?? 0).toLocaleString()} ${t("currency")}</p>
              </div>
              <div class="menu-actions">
                <button class="edit-btn"   data-id="${item.id}">✏️</button>
                <button class="delete-btn" data-id="${item.id}">🗑</button>
                <button class="recipe-btn" data-id="${item.id}" data-name="${name}" style="background:#6f42c1; color:white; border:none; border-radius:4px; cursor:pointer;">🧪</button>
              </div>
            </div>
          `;
    }).join("")
    : `<p>${t("search_not_found")}</p>`;
}

window.deleteSelectedMenus = async function () {
  const checks = document.querySelectorAll(".menu-check:checked");
  if (!checks.length) { alert(t("confirm_select_first")); return; }
  if (!confirm(t("confirm_delete_selected"))) return;
  for (const ch of checks) {
    const snap = await get(ref(db, BASE_PATH + "/menu/" + ch.value));
    if (snap.exists() && snap.val().imgPath) {
      await deleteObject(storageRef(storage, snap.val().imgPath)).catch(() => { });
    }
    await remove(ref(db, BASE_PATH + "/menu/" + ch.value));
  }
  showAdminNotification(t("notify_deleted_selected"));
};

window.deleteAllMenus = async function () {
  if (!confirm(t("confirm_delete_all_1"))) return;
  if (!confirm(t("confirm_delete_all_2"))) return;
  const snap = await get(ref(db, BASE_PATH + "/menu"));
  if (!snap.exists()) return;
  const data = snap.val();
  for (const id in data) {
    if (data[id].imgPath) await deleteObject(storageRef(storage, data[id].imgPath)).catch(() => { });
  }
  await remove(ref(db, BASE_PATH + "/menu"));
  showAdminNotification(t("notify_deleted_all"), "error");
};

function listenMenu() {
  onValue(ref(db, BASE_PATH + "/menu"), snap => {
    window.allMenu = snap.val() || {};
    renderMenu();
  });
}

window.toggleMenu = async function (id, active) {
  await update(ref(db, BASE_PATH + "/menu/" + id), { active });
};

document.getElementById("menuSearch")?.addEventListener("input", e => {
  searchQuery = e.target.value.toLowerCase();
  renderMenu();
});

document.addEventListener("click", e => {
  if (e.target.classList.contains("edit-btn")) editMenu(e.target.dataset.id);
  if (e.target.classList.contains("delete-btn")) deleteMenu(e.target.dataset.id);

  if (e.target.classList.contains("recipe-btn")) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    window.openRecipeModal(id, name);
  }
});

let cashierListenerBound = false;

function ensureCashierListener() {
  if (cashierListenerBound) return;
  cashierListenerBound = true;
  listenCashier();
}

function listenCashier() {
  onValue(ref(db, BASE_PATH + "/orders"), snap => {
    const orders = snap.val() || {};
    const list = document.getElementById("cashierList");
    if (!list) return;

    let htmlContent = "";

    Object.entries(orders)
      .filter(([_, o]) => o.payment?.requested && !o.payment?.paid)
      .sort((a, b) => {
        const ta = a[1].payment?.requestedAt || a[1].updatedAt || a[1].createdAt || 0;
        const tb = b[1].payment?.requestedAt || b[1].updatedAt || b[1].createdAt || 0;
        return tb - ta;
      })
      .forEach(([id, o]) => {
        htmlContent += `
            <div class="cash-card">
              <h4>🧾 ${o.orderNumber}</h4>
              <p>${t("table")}: <b>${o.table}</b></p>
              <div class="cash-items">
                ${Object.values(o.items || {}).map(i => {
          const menuItem = window.allMenu?.[i.id || i.menuId || i.itemId];
          const itemName = getTranslatedItemName(i, menuItem, getLang());
          return `<div class="cash-item">
                    <img src="${i.img || 'img/food.png'}" alt="${t("order_image_alt")}">
                    <span>${itemName} × ${i.qty}</span>
                    <b>${(i.price * i.qty).toLocaleString()} ${t("currency")}</b>
                  </div>`;
        }).join("")}
              </div>
              <p class="cash-total">${t("total_label")}: <b>${o.total.toLocaleString()} ${t("currency")}</b></p>
              <button class="btn primary" onclick="approvePayment('${id}')">✅ ${t("approve")}</button>
            </div>
          `;
      });

    list.innerHTML = htmlContent;
  });
}

async function checkAndShowPromo(orderId, phone) {
  if (!phone) return null;

  const normalizedInputPhone = normalizePhone(phone);

  const discountsSnap = await get(ref(db, `${BASE_PATH}/discounts`));
  const discounts = discountsSnap.val() || {};

  const activePromo = Object.values(discounts).find(d =>
    normalizePhone(d.ownerPhone || "") === normalizedInputPhone && d.used === false
  );

  if (activePromo) {
    const promoBtn = document.getElementById(`promo-btn-${orderId}`);
    if (promoBtn) {
      promoBtn.style.display = "block";
      promoBtn.innerHTML = `🎁 ${t("promo_available_msg", "Sizda {percent}% promokod bor! (Qo'llash)").replace("{percent}", activePromo.percent)}`;
      promoBtn.onclick = () => applyPromoCode(orderId, activePromo);
    }
  }
}

window.applyPromoCode = async function (orderId, promo) {
  const orderSnap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
  if (!orderSnap.exists()) return;

  const order = orderSnap.val();
  const currentTotal = Number(order.total || 0);
  const discountAmount = (currentTotal * promo.percent) / 100;
  const newTotal = currentTotal - discountAmount;

  // usedCount ni oshiramiz, maxUses ga yetsa used=true qilamiz
  const promoSnap = await get(ref(db, `${BASE_PATH}/discounts/${promo.code}`));
  const promoData = promoSnap.val() || {};
  const newUsedCount = (Number(promoData.usedCount) || 0) + 1;
  const maxUses = Number(promoData.maxUses) || 1;
  const nowUsed = newUsedCount >= maxUses;

  await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
    total: newTotal,
    originalTotal: currentTotal,
    appliedPromo: promo.code,
    discountAmount: discountAmount,
    discountPercent: promo.percent
  });

  await update(ref(db, `${BASE_PATH}/discounts/${promo.code}`), {
    usedCount: newUsedCount,
    used: nowUsed
  });

  showAdminNotification(`✅ ${t("promo_applied_success", "Promokod qo'llanildi:")} -${discountAmount.toLocaleString()} ${t("currency")}`);
};

window.approvePayment = async function (orderId) {
  const now = Date.now();
  try {
    const orderSnap = await get(ref(db, BASE_PATH + "/orders/" + orderId));
    if (!orderSnap.exists()) return;
    const order = orderSnap.val();

    const updates = {
      [`orders/${orderId}/payment/paid`]: true,
      [`orders/${orderId}/payment/approvedAt`]: now,
      [`orders/${orderId}/status`]: "closed",
      [`orders/${orderId}/statusKey`]: "closed",
      [`orders/${orderId}/statusLabel`]: t("status_closed", "Yopildi"),
      [`orders/${orderId}/updatedAt`]: now
    };

    if (!order.inventoryDeducted) {
      if (typeof window.deductOrderInventory === "function") {
        await window.deductOrderInventory(orderId);
      } else if (typeof deductStock === "function") {
        await deductStock(order.items);
        updates[`orders/${orderId}/inventoryDeducted`] = true;
      }
    }

    if (order.table) {
      updates[`tables/${order.table}/status`] = "cleaning";
      updates[`tables/${order.table}/busy`] = true;
      updates[`tables/${order.table}/updatedAt`] = now;
      updates[`tables/${order.table}/orderId`] = null;
    }

    await update(ref(db, BASE_PATH), updates);

    if (typeof syncCustomerProfileFromOrder === "function") {
      await syncCustomerProfileFromOrder(orderId, order, window.allOrders);
    }

    await crmAdvAudit("orders", "payment_finish", orderId, t("audit_payment_approved_admin"), { paidAt: now }, "info");
    showAdminNotification("✅ " + t("payment_approved_cleaning", "To'lov tasdiqlandi. Stol 'Tozalanmoqda' holatiga o'tkazildi!"));

    if (order.appliedPromo) {
      await update(ref(db, `${BASE_PATH}/discounts/${order.appliedPromo}`), {
        used: true,
        usedAt: now,
        usedByOrder: orderId
      });

      if (typeof trackCouponRedemption === "function") {
        await trackCouponRedemption({
          customerId: order.customerPhone || order.clientPhone,
          couponCode: order.appliedPromo,
          orderId: orderId,
          discountAmount: order.discountAmount
        });
      }
    }

  } catch (error) {
    console.error(t("payment_approve_error_log", "⛔ To'lovni tasdiqlashda xatolik:"), error);
    showAdminNotification(t("notify_error", "Xatolik yuz berdi"), "error");
  }
};

function loadSectionData(id) {
  if (id === "crm") loadCRM();
  if (id === "promocodes") loadPromocodesPanel();
  if (id === "reservations") loadReservations();
  if (id === "feedback") loadFeedbacks();
  if (id === "notifications") loadNotifications();
  if (id === "roles") loadRoles();
  if (id === "audit-log") loadAuditLog();
  if (id === "settings") loadSettings();
  if (id === "tables") {
    // Listener init() da allaqachon ishga tushirilgan, faqat grid stilini qo'yamiz
    const grid = document.getElementById("tablesGrid");
    if (grid) {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
      grid.style.gap = "16px";
      grid.style.padding = "16px";
    }
  }
  if (id === "cashier") ensureCashierListener();

  // Staff bolimi: oshpaz va ofitsiant reytinglarini yangilash
  if (id === "staff") {
    if (typeof window.updateChefKPIs === "function") window.updateChefKPIs();
    if (typeof window.updateWaiterKPIs === "function") window.updateWaiterKPIs();
  }

  // Dashboard: real vaqt statistikasini yangilash
  if (id === "dashboard") {
    if (typeof updateRealTimeStats === "function") updateRealTimeStats();
  }

  // Menu bolimi: menyuni qayta render qilish
  if (id === "menu") {
    if (typeof renderMenu === "function") renderMenu();
    // Statistikani ham yuklash
    setTimeout(() => {
      if (typeof window.renderMenuStats === "function") window.renderMenuStats();
    }, 300);
  }

  // Report bolimi: moliya hisobotlarini yangilash
  if (id === "report") {
    if (typeof window.renderStaffFinance === "function") window.renderStaffFinance();
    if (typeof window.renderSalaryReport === "function") window.renderSalaryReport();
  }

  // Finance bolimi: ish haqi hisoblash
  if (id === "finance") {
    if (typeof window.calculateSalaries === "function") window.calculateSalaries();
    if (typeof window.renderSalaryReport === "function") window.renderSalaryReport();
  }

  // Buyurtmalar bolimi: filtrlangan royxatni korsatish
  if (id === "orders") {
    if (typeof renderOrders === "function") renderOrders(window.allOrders || {});
  }

  // Ombor bolimi: inventarizatsiyani yuklash
  if (id === "warehouse") {
    if (!window._inventoryListenerStarted) {
      listenToInventory();
      window._inventoryListenerStarted = true;
    }
  }
}

// ==========================================
// 🔄 BO'LIMLARNI (SAHIFALARNI) ALMASHTIRISH
// ==========================================
window.showSection = function (id) {
  // Tarif feature guard — bloklangan sectionga o'tishni oldini olish
  if (isPlanFeatureBlocked(id)) return;

  const sections = document.querySelectorAll("main section, main .admin-section, .dashboard-section");
  const navLinks = document.querySelectorAll(".sidebar-nav a, .nav-link");

  let found = false;

  sections.forEach(sec => {
    const isActive = sec.id === id;
    if (isActive) {
      sec.style.display = "block";
      sec.classList.add("active-section");
      found = true;
    } else {
      sec.style.display = "none";
      sec.classList.remove("active-section");
    }
  });

  navLinks.forEach(a => {
    const href = a.getAttribute("href")?.replace("#", "");
    if (href === id) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });

  if (found) {
    if (typeof loadSectionData === "function") {
      loadSectionData(id);
    }
  }
};

document.querySelectorAll(".sidebar-nav a, .nav-link").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    showSection(link.getAttribute("href").replace("#", ""));
  });
});

function listenPaymentNotifications() {
  onValue(ref(db, BASE_PATH + "/orders"), snap => {
    const orders = snap.val() || {};

    Object.entries(orders).forEach(([orderId, o]) => {
      if (o.payment?.paid && !o.payment?.adminNotified) {
        showAdminNotification(
          `💰 ${t("table")} ${o.table} — ${Number(o.total || 0).toLocaleString()} ${t("currency")}`
        );

        update(ref(db, BASE_PATH + "/orders/" + orderId + "/payment"), {
          adminNotified: true
        });
      }
    });
  });
}

window.deleteAllOrdersAndFreeTables = async function () {
  if (!confirm(t("alerts.confirm_delete_all_orders_1"))) return;
  if (!confirm(t("alerts.confirm_delete_all_orders_2"))) return;
  try {
    await set(ref(db, BASE_PATH + "/orders"), null);
    const tablesSnap = await get(ref(db, BASE_PATH + "/tables"));
    if (tablesSnap.exists()) {
      const updates = {};
      Object.keys(tablesSnap.val()).forEach(n => {
        updates[`tables/${n}/busy`] = false;
        updates[`tables/${n}/orderId`] = null;
        updates[`tables/${n}/status`] = "free";
        updates[`tables/${n}/closedByAdmin`] = false;
      });
      await update(ref(db, BASE_PATH), updates);
    }
    window.allOrders = {};
    renderOrders({});
    showAdminNotification(t("alerts.orders_deleted_all"), "error");
  } catch (e) {
    console.error(e);
    showAdminNotification(t("notify.error"), "error");
  }
};

function renderOrderFilters() {
  const payment = document.getElementById("filterPaymentStatus");
  const category = document.getElementById("filterOrderCategory");
  const subcategory = document.getElementById("filterOrderSubcategory");

  if (payment) {
    payment.innerHTML = `
    <option value="all">${t("orders_payment_all")}</option>
    <option value="paid">${t("orders_payment_paid")}</option>
    <option value="unpaid">${t("orders_payment_unpaid")}</option>
  `;
  }
  if (category) {
    category.innerHTML = `<option value="all">${t("all_categories")}</option>`;
    CATEGORY_DATA.categories.forEach(cat => {
      category.innerHTML += `<option value="${cat.id}">${t(cat.nameKey)}</option>`;
    });
  }
  if (subcategory) {
    subcategory.innerHTML = `<option value="all">${t("all_subcategories")}</option>`;
  }
}

window.addChef = async function () {
  const name = document.getElementById("chefName")?.value?.trim();
  const passwordInput = document.getElementById("chefPassword")?.value?.trim();

  if (!name) {
    alert(t("enter_chef_name"));
    return;
  }

  const password = passwordInput || String(Math.floor(1000 + Math.random() * 9000));
  const id = "chef_" + Date.now();

  try {
    await set(ref(db, BASE_PATH + "/users/" + id), {
      name,
      role: "chef",
      active: true,
      password,
      createdAt: Date.now()
    });

    showAdminNotification(
      `👨‍🍳 ${t("chef_added")}\n${t("name_label")}: ${name}\n${t("password_label")}: ${password}\n(${t("save_password_note")})`,
      "success"
    );

    document.getElementById("chefName").value = "";
    document.getElementById("chefPassword").value = "";
  } catch (err) {
    console.error(err);
    showAdminNotification(t("error_occurred"), "error");
  }
};

window.addWaiter = async function () {
  const name = document.getElementById("waiterName")?.value?.trim();
  const passwordInput = document.getElementById("waiterPassword")?.value?.trim();

  if (!name) {
    alert(t("enter_waiter_name", "Iltimos, ofitsiant ismini kiriting!"));
    return;
  }

  const password = passwordInput || String(Math.floor(1000 + Math.random() * 9000));
  const id = "waiter_" + Date.now();

  try {
    await set(ref(db, BASE_PATH + "/users/" + id), {
      name: name,
      role: "waiter",
      active: true,
      password: password,
      createdAt: Date.now()
    });

    showAdminNotification(
      `🧑‍🍳 ${t("a_waiter_added", "Ofitsiant qo'shildi!")}\n${t("name_label", "Ismi")}: ${name}\n${t("password_label", "Paroli")}: ${password}`,
      "success"
    );

    if (document.getElementById("waiterName")) document.getElementById("waiterName").value = "";
    if (document.getElementById("waiterPassword")) document.getElementById("waiterPassword").value = "";

  } catch (err) {
    console.error(t("waiter_add_error_log", "❌ Ofitsiant qo'shishda xato:"), err);
    alert(t("notify.error", "Xatolik yuz berdi: ") + err.message);
  }
};

window.saveStaff = async function (roleType) {
  const nameInput = document.getElementById(roleType === 'chef' ? 'chefName' : 'waiterName');
  const passInput = document.getElementById(roleType === 'chef' ? 'chefPassword' : 'waiterPassword');

  const name = nameInput?.value.trim();
  const password = passInput?.value.trim();

  if (!name || !password) {
    alert(t("fill_all_fields") || "Iltimos, ism va parolni kiriting!");
    return;
  }

  const staffId = "staff_" + Date.now();
  const restId = localStorage.getItem("restaurantId");

  try {
    await set(ref(db, `restaurants/${restId}/users/${staffId}`), {
      id: staffId,
      name: name,
      password: password,
      role: roleType,
      active: true,
      fixedSalary: 0,
      commissionPercent: 0,
      createdAt: Date.now()
    });

    nameInput.value = "";
    passInput.value = "";

    alert(t("staff_added_success") || "Xodim muvaffaqiyatli qo'shildi!");
  } catch (error) {
    console.error(t("staff_add_error_log", "Xodim qo'shishda xato:"), error);
  }
};

window.saveTableSettings = async function () {
  const countInput = document.getElementById('tablesCountInput');
  if (!countInput) return;

  const count = parseInt(countInput.value);
  if (isNaN(count) || count <= 0) {
    alert(t("error_positive_number", "Iltimos, musbat son kiriting!"));
    return;
  }

  const restId = typeof currentRestaurantId !== 'undefined' ? currentRestaurantId : localStorage.getItem("restaurantId");
  if (!restId) {
    console.error("Restaurant ID topilmadi");
    return;
  }

  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) {
    console.error("Firebase database ulanmagan");
    return;
  }

  try {
    const tablesRef = ref(database, `restaurants/${restId}/tables`);
    const updates = {};

    for (let i = 1; i <= count; i++) {
      const tableId = `table_${i}`;
      updates[tableId] = {
        number: i,
        status: "free",
        createdAt: Date.now()
      };
    }

    await set(tablesRef, updates);
    alert(t("tables_updated_msg", "Stollar yangilandi!"));

    if (typeof renderTablesList === "function") {
      renderTablesList(updates);
    }
  } catch (error) {
    console.error(t("error_log","Xatolik:"), error);
  }
};

function renderTablesList(tables) {
  const container = document.getElementById('tablesContainer');
  if (!container) return;
  container.innerHTML = "";

  Object.values(tables).forEach(table => {
    const tableDisplayNum = table.number || table.id.replace('table_', '');

    const tableDiv = document.createElement('div');
    tableDiv.className = `table-card ${table.status}`;
    tableDiv.innerHTML = `
      <div class="table-number">${t("table", "Stol")} №${tableDisplayNum}</div>
      <div class="table-status">${translateStatus(table.status)}</div>
      <div class="table-actions">
        <button onclick="editTable('${table.id}')"><i class="fa fa-edit"></i></button>
      </div>
    `;
    container.appendChild(tableDiv);
  });
}

window.showStaffTab = function (type) {
  document.getElementById("chefTab").style.display = type === "chef" ? "block" : "none";
  document.getElementById("waiterTab").style.display = type === "waiter" ? "block" : "none";

  const buttons = document.querySelectorAll(".staff-tabs .tab-btn");
  buttons.forEach(btn => btn.classList.remove("active"));

  if (type === "chef") buttons[0]?.classList.add("active");
  if (type === "waiter") buttons[1]?.classList.add("active");
};

window.toggleStaff = async function (id, active) {
  await update(ref(db, BASE_PATH + "/users/" + id), { active });
  showAdminNotification(
    active ? t("staff_active_full") : t("staff_inactive_full")
  );
};

window.editStaff = async function (id, name) {
  const newName = prompt(t("enter_new_name"), name);
  if (!newName) return;
  await update(ref(db, BASE_PATH + "/users/" + id), { name: newName });
  showAdminNotification(t("name_updated_full"));
};

// =====================
// 🗑 XODIMNI O'CHIRISH 
// =====================
window.deleteStaff = async function (id) {
  const usersObj = window.allUsers || window.staffData || {};
  const staffMember = Object.values(usersObj).find(s => s.id === id);

  if (staffMember && staffMember.role === "admin" && staffMember.isSubAdmin !== true) {
    alert(t("super_admin_delete_error", "❌ Haqiqiy Super Admin (Asoschi) tizimdan o'chirilishi mumkin emas!"));
    return;
  }

  const confirmMsg = typeof t === "function" ? t("confirm_delete_staff") || "Haqiqatan ham o'chirmoqchimisiz?" : "Haqiqatan ham o'chirmoqchimisiz?";
  if (!confirm(confirmMsg)) return;

  try {
    await remove(ref(db, BASE_PATH + "/users/" + id));

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("delete", `🗑 ${t("staff_deleted_log", "Xodim o'chirildi:")} ${staffMember ? staffMember.name : id}`);
    }

    const successMsg = typeof t === "function" ? t("staff_deleted_full") || "Xodim o'chirildi" : "Xodim o'chirildi";
    if (typeof showAdminNotification === "function") {
      showAdminNotification(successMsg, "success");
    } else {
      alert(successMsg);
    }
  } catch (error) {
    console.error(t("staff_delete_error_log", "Xodimni o'chirishda xato:"), error);
    alert(t("error_occurred", "Xatolik yuz berdi!"));
  }
};

document.getElementById("chefFilter")?.addEventListener("change", () => renderOrders(window.allOrders));

function applyChefFilter(orders) {
  const chef = document.getElementById("chefFilter")?.value;
  if (!chef || chef === "all") return orders;
  return orders.filter(([_, o]) => o.chefId === chef);
}

function fillChefFilter(users) {
  const select = document.getElementById("chefFilter");
  if (!select) return;

  const prev = select.value || "all";

  select.innerHTML = `<option value="all">${t("all_items")}</option>`;

  Object.entries(users || {}).forEach(([id, u]) => {
    if (u.role !== "chef") return;
    select.innerHTML += `<option value="${id}">${u.name}</option>`;
  });

  const exists = [...select.options].some(opt => opt.value === prev);
  select.value = exists ? prev : "all";
}

function calculateChefStats(orders) {
  const stats = {};
  Object.values(orders || {}).forEach(o => {
    if (!o.chefId) return;
    if (!stats[o.chefId]) stats[o.chefId] = { count: 0, totalTime: 0 };

    const s = String(o.status || o.statusKey || "").toLowerCase();
    if (s === "tayyor" || s === "ready") {
      stats[o.chefId].count++;

      const startTime = o.acceptedAt || o.createdAt;
      if (o.updatedAt && startTime) {
        stats[o.chefId].totalTime += (o.updatedAt - startTime) / 60000;
      }
    }
  });
  return stats;
}

function renderStaff(users) {
  const chefList = document.getElementById("chefList");
  const waiterList = document.getElementById("waiterList");
  if (!chefList || !waiterList) return;

  const chefStats = calculateChefStats(window.allOrders);

  let chefHtml = "";
  let waiterHtml = "";

  Object.entries(users).forEach(([id, u]) => {
    const safeName = escapeHtml(u.name || t("unknown_label", "Noma'lum"));
    const safePassword = escapeHtml(u.password || '????');
    const safeId = escapeHtml(id);

    if (u.role === "chef") {
      const stat = chefStats[safeId] || { count: 0, totalTime: 0 };
      const avg = stat.count ? (stat.totalTime / stat.count).toFixed(1) : 0;

      chefHtml += `
        <div class="staff-card ${u.active ? "" : "staff-off"}" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <h3 style="margin-bottom: 10px; font-size: 18px;">👨‍🍳 ${safeName} <span onclick="openStaffStats('${safeId}','chef')" class="stats-icon" style="cursor:pointer;">📊</span></h3>
          <p style="margin-bottom: 5px; color: #4b5563; font-size: 14px;">🍽 ${t("orders_count", "Buyurtmalar")}: <b>${stat.count}</b></p>
          <p style="margin-bottom: 15px; color: #4b5563; font-size: 14px;">⏱ ${t("avg_time", "O'rtacha vaqt")}: <b>${avg} ${t("minute_short", "min")}</b></p>
          
          <div class="staff-actions" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
            <label class="switch" style="margin-right: 5px;">
              <input type="checkbox" ${u.active ? "checked" : ""} onchange="toggleStaff('${safeId}',this.checked)">
              <span class="slider"></span>
            </label>
            <button onclick="editStaff('${safeId}','${safeName}')" class="btn-icon" style="border: 1px solid #e5e7eb; background: white; width: 36px; height: 36px; border-radius: 8px;">✏️</button>
            <button onclick="deleteStaff('${safeId}')" class="btn-icon" style="border: 1px solid #e5e7eb; background: white; width: 36px; height: 36px; border-radius: 8px;">🗑</button>
          </div>
          <div style="margin-top: 10px; width: 100%;">
            <button onclick="window.open('chef.html?id=${escapeHtml(currentRestaurantId)}&viewAs=${safeId}', '_blank')" style="width: 100%; padding: 8px 0; background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📄 ${t("staff_page_btn", "Sahifa")}
            </button>
          </div>
        </div>
      `;
    }

    if (u.role === "waiter") {
      const count = Object.values(window.allOrders).filter(o => o.waiterId === safeId).length;

      waiterHtml += `
        <div class="staff-card ${u.active ? "" : "staff-off"}" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <h3 style="margin-bottom: 10px; font-size: 18px;">🧑‍🍳 ${safeName} <span onclick="openStaffStats('${safeId}','waiter')" class="stats-icon" style="cursor:pointer;">📊</span></h3>
          <p style="margin-bottom: 5px; color: #4b5563; font-size: 14px;">🪑 ${t("tables_served", "Xizmat qildi")}: <b>${count}</b></p>
          <p style="margin-bottom: 15px; color: #4b5563; font-size: 14px;">🔑 ${t("password_label", "Parol")}: <b>${safePassword}</b></p> 
          
          <div class="staff-actions" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
            <label class="switch" style="margin-right: 5px;">
              <input type="checkbox" ${u.active ? "checked" : ""} onchange="toggleStaff('${safeId}',this.checked)">
              <span class="slider"></span>
            </label>
            <button onclick="editStaff('${safeId}','${safeName}')" class="btn-icon" style="border: 1px solid #e5e7eb; background: white; width: 36px; height: 36px; border-radius: 8px;">✏️</button>
            <button onclick="deleteStaff('${safeId}')" class="btn-icon" style="border: 1px solid #e5e7eb; background: white; width: 36px; height: 36px; border-radius: 8px;">🗑</button>
          </div>
          <div style="margin-top: 10px; width: 100%;">
            <button onclick="window.open('waiter.html?id=${escapeHtml(currentRestaurantId)}&viewAs=${safeId}', '_blank')" style="width: 100%; padding: 8px 0; background: #eff6ff; color: #2563eb; border: 1px solid #93c5fd; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📄 ${t("staff_page_btn", "Sahifa")}
            </button>
          </div>
        </div>
      `;
    }
  });

  chefList.innerHTML = chefHtml;
  waiterList.innerHTML = waiterHtml;
}

function listenStaff() {
  onValue(ref(db, BASE_PATH + "/users"), snap => {
    const users = snap.val() || {};
    window.allUsers = users;

    renderStaff(users);
    fillChefFilter(users);
    if (typeof updateChefKPIs === "function") updateChefKPIs();
    if (typeof window.updateChefKPIs === "function") window.updateChefKPIs();
    if (typeof window.updateWaiterKPIs === "function") window.updateWaiterKPIs();

    const activeChefs = Object.values(users).filter(u => u.role === "chef" && u.active).length;
    const activeWaiters = Object.values(users).filter(u => u.role === "waiter" && u.active).length;

    const chefEl = document.getElementById("activeChefsCount");
    const waiterEl = document.getElementById("activeWaitersCount");

    if (chefEl) chefEl.innerText = activeChefs;
    if (waiterEl) waiterEl.innerText = activeWaiters;
  });
}

window.openStaffStats = function (id, role) {
  currentStaffId = id;
  currentStaffRole = role;
  document.getElementById("staffStatsModal").classList.remove("hidden");
  window.loadStaffStats();
};

window.closeStaffStats = function () {
  document.getElementById("staffStatsModal").classList.add("hidden");
};

let staffOrdersChart = null;
let timeChart = null;

window.loadStaffStats = async function () {
  const period = document.getElementById("statsPeriod").value;
  const snap = await get(ref(db, BASE_PATH + "/orders"));
  const orders = snap.val() || {};
  const now = new Date();
  let from = new Date();
  if (period === "today") from.setHours(0, 0, 0, 0);
  if (period === "week") from.setDate(now.getDate() - 7);
  if (period === "month") from.setMonth(now.getMonth() - 1);

  let count = 0, totalTime = 0;
  const labels = [], values = [];

  Object.values(orders).forEach(o => {
    const date = new Date(o.createdAt);
    if (date < from) return;
    if (currentStaffRole === "chef" && o.chefId === currentStaffId) {
      count++;
      const startTime = o.acceptedAt || o.createdAt;
      if (o.updatedAt && startTime) {
        const cookTime = (o.updatedAt - startTime) / 60000;
        totalTime += cookTime;
        labels.push(date.toLocaleDateString());
        values.push(cookTime);
      }
    }
    if (currentStaffRole === "waiter" && o.waiterId === currentStaffId) {
      count++;
      labels.push(date.toLocaleDateString());
      values.push(o.table);
    }
  });

  const avg = count ? (totalTime / count).toFixed(1) : 0;
  document.getElementById("staffStatsContent").innerHTML = currentStaffRole === "chef"
    ? `<p>🍽 ${t("orders_count")}: ${count}</p><p>⏱ ${t("avg_time")}: ${avg} ${t("minute_short")}</p>`
    : `<p>📦 ${t("orders_count")}: ${count}</p>`;

  const ordersCanvas = document.getElementById("staffOrdersChart");
  const timeCanvas = document.getElementById("staffTimeChart");
  if (!ordersCanvas || !timeCanvas) return;
  if (!labels.length) {
    if (staffOrdersChart) {
      staffOrdersChart.destroy();
      staffOrdersChart = null;
    }
    if (timeChart) {
      timeChart.destroy();
      timeChart = null;
    }

    const staffStatsContent = document.getElementById("staffStatsContent");
    if (staffStatsContent) {
      staffStatsContent.innerHTML += `<p style="text-align:center">${t("no_data")}</p>`;
    }
    return;
  }
  if (staffOrdersChart) staffOrdersChart.destroy();
  if (timeChart) timeChart.destroy();
  staffOrdersChart = new Chart(ordersCanvas, {
    type: "bar",
    data: { labels, datasets: [{ label: t("orders"), data: values, backgroundColor: "#f59e0b" }] }
  });
  timeChart = new Chart(timeCanvas, {
    type: "line",
    data: { labels, datasets: [{ label: t("time"), data: values, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.2)", tension: 0.3 }] }
  });
};

let chartUpdateTimeout;
function debouncedChartUpdate() {
  clearTimeout(chartUpdateTimeout);
  chartUpdateTimeout = setTimeout(() => {
    const reportSection = document.getElementById("report");
    if (reportSection?.style.display !== "none") {
      window.generateRangeReport();
    }
  }, 2000);
}

function listenOrders() {
  const ordersRef = query(ref(db, BASE_PATH + "/orders"), orderByChild("createdAt"), limitToLast(300));

  onValue(ordersRef, async snap => {
    const rawOrders = snap.val() || {};

    // Stollardan telefon raqamlarni orderlarga bog'laymiz
    const tables = window.allTables || {};
    window.allOrders = {};
    Object.entries(rawOrders).forEach(([oid, order]) => {
      const existingPhone = order.clientPhone || order.customerPhone || order.phone || "";
      if (!existingPhone && order.table) {
        const tableKey = `table_${order.table}`;
        const tableData = tables[tableKey] || tables[order.table] || {};
        const tablePhone = tableData.customerPhone || tableData.phone || tableData.clientPhone || "";
        if (tablePhone) {
          order = { ...order, customerPhone: tablePhone };
        }
      }
      window.allOrders[oid] = order;
    });

    renderOrders(window.allOrders);
    detectAndSoundNewOrders(window.allOrders);
    updateRealTimeStats();
    if (typeof updateChefKPIs === "function") updateChefKPIs();
    if (typeof window.updateChefKPIs === "function") window.updateChefKPIs();
    if (typeof window.updateWaiterKPIs === "function") window.updateWaiterKPIs();

    if (typeof ordersChart !== "undefined" || typeof statusChart !== "undefined" || typeof topFoodsChart !== "undefined") {
      if (typeof debouncedChartUpdate === "function") debouncedChartUpdate();
    }

    for (const [orderId, order] of Object.entries(window.allOrders)) {
      const phone = normalizePhone(
        order.customerPhone || order.phone || order.clientPhone || ""
      );

      if (!phone || order.payment?.paid || order.loyaltyAutoApplied === true) continue;

      if (loyaltySyncInFlight.has(orderId)) continue;

      loyaltySyncInFlight.add(orderId);

      applyAutoLoyaltyToOrder(orderId, order, window.allOrders)
        .catch(err => {
          console.error(t("auto_loyalty_error_log") || "Auto loyalty apply error:", err);
        })
        .finally(() => {
          loyaltySyncInFlight.delete(orderId);
        });
    }
  });
}

function listenCustomersRealtime() {
  onValue(ref(db, BASE_PATH + "/customers"), snap => {
    const customers = snap.val() || {};
    window.customerProfilesByPhone = buildCustomerProfilePhoneCache(customers);

    if (document.getElementById("crm")?.classList.contains("active-section")) {
      crmState.customers = buildCustomerMapFromOrders(
        window.allOrders || {},
        customers,
        window.allUsers || {}
      );

      const searchInput = document.getElementById("customerSearch");
      if (searchInput?.value) {
        filterCustomers();
      } else {
        crmState.filtered = [...crmState.customers];
        renderCRMStats();
        renderCustomerList();
      }
    }

    if (window.allOrders) {
      renderOrders(window.allOrders);
    }
  });
}

// ==========================================
// 🪑 STOLLAR XARITASI VA JONLI YANGILANISH
// ==========================================
// ==========================================
// ESKI STOL KALITLARINI MIGRATSIYA QILISH
// ==========================================
window.migrateTableKeys = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const snap = await get(ref(db, `restaurants/${restId}/tables`));
    if (!snap.exists()) return;

    const tablesObj = snap.val();
    const updates = {};
    const toDelete = [];

    Object.entries(tablesObj).forEach(([key, value]) => {
      if (/^\d+$/.test(key)) {
        const newKey = `table_${key}`;
        if (!tablesObj[newKey]) {
          updates[`restaurants/${restId}/tables/${newKey}`] = {
            ...value,
            id: newKey,
            number: Number(key)
          };
        }
        toDelete.push(`restaurants/${restId}/tables/${key}`);
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
    for (const path of toDelete) {
      await remove(ref(db, path));
    }
    if (Object.keys(updates).length > 0 || toDelete.length > 0) {
      console.log("Stol kalitlari migratsiya qilindi.");
    }
  } catch (err) {
    console.error("Migratsiya xatosi:", err);
  }
};

window.listenTablesRealtime = function () {
  const restId = localStorage.getItem("restaurantId");

  onValue(ref(db, `restaurants/${restId}/tables`), async (snap) => {
    // Stollar ma'lumotini global saqlaymiz (phone lookup uchun)
    window.allTables = snap.val() || {};

    // ── Dashboard: Band / Bo'sh stol statistikasini yangilash ──
    const tablesData = snap.val() || {};
    let busyCount = 0, freeCount = 0;
    Object.values(tablesData).forEach(table => {
      const st = String(table.status || "free").toLowerCase();
      if (st === "free") {
        freeCount++;
      } else {
        busyCount++;
      }
    });
    const busyEl = document.getElementById("busyTablesCount");
    const freeEl = document.getElementById("freeTablesCount");
    if (busyEl) busyEl.innerText = busyCount;
    if (freeEl) freeEl.innerText = freeCount;
    if (typeof updateRealTimeStats === "function") updateRealTimeStats();

    if (window.allOrders && Object.keys(window.allOrders).length > 0) {
      renderOrders(window.allOrders);
    }

    const grid = document.getElementById("tablesGrid");
    if (!grid) return;

    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
    grid.style.gap = "16px";
    grid.style.padding = "16px";

    if (!snap.exists()) {
      grid.innerHTML = `<p style="text-align:center; width:100%; padding:20px; grid-column:1/-1;">${t("no_tables_found", "Stollar topilmadi")}</p>`;
      return;
    }

    const tablesObj = snap.val();

    const sortedKeys = Object.keys(tablesObj).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    let html = "";
    const _netOrigin = await getNetworkOrigin();
    for (const key of sortedKeys) {
      const table = tablesObj[key];
      const tableNo = table.number || key.replace('table_', '');
      const _status = table.status || "free";
      const isFree = _status === "free";
      const isCleaning = _status === "cleaning" || _status === "needs_cleaning" || _status === "tozalanmoqda";
      const isBilling = _status === "billing";
      const clientUrl = `${_netOrigin}/client.html?rest=${restId}&tableId=${key}&tableNo=${tableNo}`;

      const badgeClass = isFree ? "status-free" : isCleaning ? "status-cleaning" : "status-busy";
      const badgeStyle = isCleaning
        ? "background:#0ea5e9;color:#fff;border-color:#0ea5e9;"
        : isBilling
          ? "background:#ef4444;color:#fff;border-color:#ef4444;"
          : "";
      const badgeIcon = isFree ? "🟢" : isCleaning ? "🧹" : isBilling ? "💳" : "🔴";
      const badgeLabel = isFree
        ? t("table_status_free", "Bo'sh")
        : isCleaning
          ? t("table_status_cleaning", "Tozalanmoqda")
          : isBilling
            ? t("table_status_billing", "To'lov")
            : t("table_status_busy", "Band");

      const cardStyle = isCleaning
        ? "border:2px solid #0ea5e9;background:#f0f9ff;"
        : isBilling
          ? "border:2px solid #ef4444;"
          : "";

      html += `
        <div class="table-card" style="${cardStyle}">
          <div class="table-card-header">
            <div class="table-title">
              <i class="fa-solid fa-couch"></i>
              <h3>${t("table", "Stol")} №${tableNo}</h3>
            </div>
            <span class="status-badge ${badgeClass}" style="${badgeStyle}">
              ${badgeIcon} ${badgeLabel}
            </span>
          </div>
          <div class="table-card-actions">
            <a href="${clientUrl}" target="_blank" class="action-btn btn-client" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>${t("go_to_client", "Mijoz sahifasi")}</span>
            </a>
            <button class="action-btn btn-qr" onclick="window.downloadSingleQR('${clientUrl}', ${tableNo})">
              <i class="fa-solid fa-qrcode"></i>
              <span>${t("download_qr", "QR Yuklash")}</span>
            </button>
            <button class="btn-qr-single" onclick="window.downloadSingleQR('${clientUrl}', ${tableNo})">
              <i class="fa-solid fa-qrcode"></i> ${t("qr_png_btn", "QR PNG")}
            </button>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
    if (typeof applyLang === "function") applyLang();
  });
};

// ==========================================
// 🖼 BITTA STOL UCHUN QR YUKLASH (PNG)
// ==========================================
window.downloadSingleQR = async function (url, tableNum) {
  try {
    const imageData = await generateQRBaseImage(tableNum, url);

    if (!imageData) {
      alert(t("qr_container_not_found", "QR kodni yaratishda xatolik yuz berdi (Konteyner topilmadi)."));
      return;
    }

    const link = document.createElement("a");
    link.download = `Stol_${tableNum}_QR.png`;
    link.href = imageData;
    link.click();

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("system", `📥 ${t("table_qr_downloaded", "{tableNum}-stol uchun QR kod yuklab olindi.").replace("{tableNum}", tableNum)}`);
    }

  } catch (err) {
    console.error(t("qr_download_error_log", "QR yuklashda xato:"), err);
    alert(t("qr_generate_error", "QR kod yaratishda xatolik yuz berdi."));
  }
};

function updateRealTimeStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let todayOrders = 0, activeOrders = 0, todayRevenue = 0;

  Object.values(window.allOrders || {}).forEach(order => {
    const orderDate = new Date(order.createdAt);
    if (orderDate >= today) {
      todayOrders++;
      if (order.payment?.paid) todayRevenue += Number(order.total || 0);
    }
    const s = String(order.status || "").toLowerCase();
    if (
      s === "tasdiqlandi" ||
      s === "approved" ||
      s === "tayyorlanmoqda" ||
      s === "cooking"
    ) activeOrders++;
  });

  const totalEl = document.getElementById("totalOrdersToday");
  const activeEl = document.getElementById("activeOrders");
  const revenueEl = document.getElementById("totalRevenue");

  if (totalEl) { totalEl.innerText = todayOrders; totalEl.classList.add("pulse"); setTimeout(() => totalEl.classList.remove("pulse"), 1000); }
  if (activeEl) activeEl.innerText = activeOrders;
  if (revenueEl) revenueEl.innerText = todayRevenue.toLocaleString() + " " + t("currency");

  // ── Band / Bo'sh stol statistikasi ──
  let busyCount = 0, freeCount = 0;
  Object.values(window.allTables || {}).forEach(table => {
    const st = String(table.status || "free").toLowerCase();
    if (st === "free") freeCount++;
    else busyCount++;
  });
  const busyEl = document.getElementById("busyTablesCount");
  const freeEl = document.getElementById("freeTablesCount");
  if (busyEl) busyEl.innerText = busyCount;
  if (freeEl) freeEl.innerText = freeCount;

  // ── Bugungi bronlar soni ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayResCount = (typeof reservationState !== "undefined" ? reservationState.list : []).filter(r =>
    r.date === todayStr &&
    ["pending", "confirmed", "seated"].includes(r.status)
  ).length;
  const resCountEl = document.getElementById("todayReservationsCount");
  if (resCountEl) resCountEl.innerText = todayResCount;
}

// ─── CRM: TELEFON RAQAMI ORQALI MIJOZNI TOPISH VA CHEGIRMA BERISH ───────────

window.lookupCustomerByPhone = async function () {
  const phoneInput = document.getElementById("crmPhoneLookupInput");
  const resultBox = document.getElementById("crmPhoneLookupResult");
  if (!phoneInput || !resultBox) return;

  const rawPhone = phoneInput.value.trim();
  if (!rawPhone) {
    resultBox.innerHTML = `<p style="color:#ef4444;">📵 ${t("enter_phone_number","Telefon raqamini kiriting!")}</p>`;
    return;
  }

  const normalizedPhone = normalizePhone(rawPhone);
  if (!normalizedPhone) {
    resultBox.innerHTML = `<p style="color:#ef4444;">❌ ${t("invalid_phone","Noto'g'ri format. Masalan: 901234567")}</p>`;
    return;
  }

  resultBox.innerHTML = `<p style="color:#6b7280; padding:12px;">🔍 ${t("searching","Qidirilmoqda")}...</p>`;

  try {
    const restId = localStorage.getItem("restaurantId");

    const [ordersSnap, customersSnap, discountsSnap] = await Promise.all([
      get(ref(db, `restaurants/${restId}/orders`)),
      get(ref(db, `restaurants/${restId}/customers`)),
      get(ref(db, `restaurants/${restId}/discounts`))
    ]);

    const ordersObj = ordersSnap.val() || {};
    const customersObj = customersSnap.val() || {};
    const discounts = discountsSnap.val() || {};

    // Mijoz profili
    const profileCache = buildCustomerProfilePhoneCache(customersObj);
    const profile = profileCache[normalizedPhone] || null;

    // Ushbu telefonga tegishli barcha orderlarni to'plash
    const myOrders = Object.entries(ordersObj)
      .filter(([, o]) => normalizePhone(o.customerPhone || o.phone || o.clientPhone || "") === normalizedPhone)
      .map(([id, o]) => ({ id, ...o }))
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));

    // Tashrif va summa hisoblash
    const visitsFromOrders = myOrders.filter(o => isCountableVisit(o)).length;
    const visitsFromProfile = Number(profile?.visits || 0);
    const visitCount = Math.max(visitsFromOrders, visitsFromProfile);

    const totalSpentFromOrders = myOrders
      .filter(o => isCountableVisit(o))
      .reduce((s, o) => s + Number(o.finalTotal || o.total || 0), 0);
    const totalSpent = Math.max(totalSpentFromOrders, Number(profile?.totalSpent || 0));

    const loyaltyLevel = getLoyaltyLevel(totalSpent, visitCount);
    const autoDiscount = getLoyaltyDiscountPercent(visitCount);

    const levelMeta = {
      vip:    { emoji: "👑", color: "#7c3aed", bg: "#f5f3ff", badge: "#7c3aed" },
      gold:   { emoji: "🥇", color: "#d97706", bg: "#fffbeb", badge: "#d97706" },
      silver: { emoji: "🥈", color: "#475569", bg: "#f1f5f9", badge: "#475569" },
      bronze: { emoji: "🥉", color: "#92400e", bg: "#fef3c7", badge: "#92400e" }
    };
    const meta = levelMeta[loyaltyLevel] || levelMeta.bronze;

    const activePromos = Object.values(discounts).filter(
      d => d.ownerPhone === normalizedPhone && d.used === false
    );
    const promoHtml = activePromos.length
      ? activePromos.map(p =>
          `<span style="background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;margin-right:4px;">🎁 ${escapeHtml(p.code)} — ${p.percent}%</span>`
        ).join("")
      : `<span style="color:#9ca3af;font-size:12px;">${t("no_active_discount","Faol chegirma yo'q")}</span>`;

    // Tashrif tarixi — har bir order qatori
    const visitRows = myOrders.filter(o => isCountableVisit(o)).map((o, i) => {
      const date = getOrderTimestamp(o)
        ? new Date(getOrderTimestamp(o)).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })
        : "—";
      const sum = Number(o.finalTotal || o.total || 0);
      const statusLabel = translateStatus(o.status || o.statusKey || "");
      const isPaid = o.payment?.paid;
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 10px;font-weight:700;color:${meta.color};text-align:center;">${i + 1}</td>
          <td style="padding:8px 10px;color:#374151;font-size:13px;">${date}</td>
          <td style="padding:8px 10px;color:#374151;font-size:13px;text-align:center;">${t("table","Stol")} ${escapeHtml(String(o.table || "—"))}</td>
          <td style="padding:8px 10px;font-weight:700;color:#059669;text-align:right;">${sum.toLocaleString()} ${t("currency","UZS")}</td>
          <td style="padding:8px 10px;text-align:center;">
            <span style="background:${isPaid ? "#dcfce7" : "#fef9c3"};color:${isPaid ? "#16a34a" : "#92400e"};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">
              ${isPaid ? `✅ ${t("paid_label","To'langan")}` : escapeHtml(statusLabel)}
            </span>
          </td>
        </tr>`;
    }).join("");

    const visitHistoryHtml = visitRows
      ? `<div style="margin-top:16px;">
          <div style="font-size:13px;font-weight:800;color:#1e293b;margin-bottom:8px;">📋 ${t("visit_history_title","Tashrif tarixi")}</div>
          <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 10px;color:#64748b;font-weight:700;text-align:center;">#</th>
                  <th style="padding:8px 10px;color:#64748b;font-weight:700;text-align:left;">${t("date_label","Sana")}</th>
                  <th style="padding:8px 10px;color:#64748b;font-weight:700;text-align:center;">${t("table","Stol")}</th>
                  <th style="padding:8px 10px;color:#64748b;font-weight:700;text-align:right;">${t("total_label","Summa")}</th>
                  <th style="padding:8px 10px;color:#64748b;font-weight:700;text-align:center;">${t("status_label","Holat")}</th>
                </tr>
              </thead>
              <tbody>${visitRows}</tbody>
              <tfoot>
                <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                  <td colspan="3" style="padding:10px;font-weight:800;color:#1e293b;">💰 ${t("total_sum","Umumiy jami")}</td>
                  <td style="padding:10px;font-weight:800;color:#059669;text-align:right;">${totalSpent.toLocaleString()} ${t("currency","UZS")}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`
      : `<p style="margin:12px 0 0;color:#9ca3af;font-size:13px;">⚠️ ${t("customer_never_visited","Bu mijoz hali hech qachon kelmagan.")}</p>`;

    resultBox.innerHTML = `
      <div style="background:${meta.bg};border:1.5px solid ${meta.color}33;border-radius:14px;padding:18px 20px;margin-top:10px;">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
          <div>
            <div style="font-size:20px;font-weight:800;color:${meta.color};">${meta.emoji} ${escapeHtml(profile?.name || t("customer_default_name","Noma'lum mijoz"))}</div>
            <div style="font-size:13px;color:#64748b;margin-top:3px;">📞 ${normalizedPhone}</div>
          </div>
          <span style="background:${meta.badge};color:#fff;padding:5px 14px;border-radius:20px;font-weight:800;font-size:12px;text-transform:uppercase;">${loyaltyLevel.toUpperCase()}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:28px;font-weight:800;color:${meta.color};">${visitCount}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">🚶 ${t("visits_label","Jami tashrif")}</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:14px;font-weight:800;color:#059669;">${totalSpent.toLocaleString()}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">💰 ${t("total_spent_label","Umumiy chek")}</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:22px;font-weight:800;color:#3b82f6;">${autoDiscount > 0 ? autoDiscount + "%" : "—"}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">🎯 ${t("auto_discount_label","Auto chegirma")}</div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">🎁 ${t("active_promos_label","Faol promokodlar")}:</div>
          <div>${promoHtml}</div>
        </div>

        ${visitHistoryHtml}

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid ${meta.color}22;">
          <input type="number" id="crmManualDiscountPercent" placeholder="Chegirma %" min="1" max="100"
            style="flex:1;min-width:120px;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;">
          <button onclick="window.giveManualDiscountToPhone('${normalizedPhone}', '${escapeHtml(profile?.name || "")}')"
            style="background:#3b82f6;color:#fff;border:none;padding:9px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;">
            🎁 ${t("give_discount_btn","Chegirma ber")}
          </button>
        </div>

      </div>
    `;
  } catch (err) {
    console.error("lookupCustomerByPhone error:", err);
    resultBox.innerHTML = `<p style="color:#ef4444;">❌ ${t("error_occurred","Xatolik")}: ${err.message}</p>`;
  }
};


// ─── Telefon raqamini stol orderlariga bog'lash ───────────────────────────────
window.linkPhoneToTableOrders = async function (phone, tableNo) {
  if (!phone || !tableNo) {
    showAdminNotification(t("enter_phone_and_table","Telefon va stol raqamini kiriting!"), "error");
    return;
  }
  const restId = localStorage.getItem("restaurantId");
  const normalizedPhone = normalizePhone(phone);

  try {
    const ordersSnap = await get(ref(db, `restaurants/${restId}/orders`));
    const ordersObj = ordersSnap.val() || {};

    const batch = {};
    let linked = 0;

    Object.entries(ordersObj).forEach(([oid, o]) => {
      const hasPhone = normalizePhone(o.customerPhone || o.phone || o.clientPhone || "");
      const sameTable = String(o.table || "") === String(tableNo);
      if (sameTable && !hasPhone) {
        batch[`orders/${oid}/customerPhone`] = normalizedPhone;
        batch[`orders/${oid}/customerId`] = normalizedPhone;
        linked++;
      }
    });

    if (linked === 0) {
      showAdminNotification(t("table_no_phone_order","Stol da telefonsiz order topilmadi").replace("{table}", tableNo), "warning");
      return;
    }

    await update(ref(db, `restaurants/${restId}`), batch);

    // Customers profilini yaratish / yangilash
    const freshSnap = await get(ref(db, `restaurants/${restId}/orders`));
    const freshOrders = freshSnap.val() || {};
    const paidVisits = countCustomerVisitsByPhone(normalizedPhone, freshOrders);
    const totalSpent = sumCustomerPaidTotalByPhone(normalizedPhone, freshOrders);
    const loyalty = getLoyaltyLevel(totalSpent, paidVisits);

    await update(ref(db, `restaurants/${restId}/customers/${crmAdvSafeKey(normalizedPhone)}`), {
      id: normalizedPhone,
      phone: normalizedPhone,
      visits: paidVisits,
      totalSpent,
      loyalty,
      lastVisit: Date.now(),
      updatedAt: Date.now()
    });

    showAdminNotification(`✅ ${t("table","Stol")} ${tableNo} ${t("orders_linked_msg","dagi")} ${linked} ${t("orders_linked_count","ta order")} ${normalizedPhone} ${t("orders_linked_success","ga bog'landi")}!`, "success");

    // CRM ni yangilash
    if (typeof window.lookupCustomerByPhone === "function") {
      window.lookupCustomerByPhone();
    }
  } catch (err) {
    console.error("linkPhoneToTableOrders error:", err);
    showAdminNotification(t("error_occurred","Xatolik") + ": " + err.message, "error");
  }
};


// ─── Chegirmani xavfsiz birlashtirish: kattasi ishlaydi, kichikisi keyinga qoladi ───
async function safeSetPersonalDiscount(restId, phone, newPercent, source) {
  const custRef = ref(db, `restaurants/${restId}/customers/${crmAdvSafeKey(phone)}`);
  const snap = await get(custRef);
  const existing = snap.exists() ? snap.val() : {};

  const current  = Number(existing.personalDiscount  || 0);
  const pending  = Number(existing.pendingDiscount    || 0);

  let active;
  let queued;

  if (current === 0) {
    // Hech qanday chegirma yo'q — to'g'ridan-to'g'ri qo'yiladi
    active = newPercent;
    queued = 0;
  } else if (newPercent > current) {
    // Yangi chegirma kattaroq — u ishlaydi, eskisi queue ga
    queued = current;
    active = newPercent;
  } else {
    // Yangi chegirma kichikroq — u keyingi buyurtmaga qoladi
    // Agar allaqachon pending bo'lsa, kattarog'ini queue ga qo'yamiz
    queued = Math.max(pending, newPercent);
    active = current;
  }

  await update(custRef, {
    personalDiscount:        active,
    pendingDiscount:         queued,
    personalDiscountSource:  source,
    personalDiscountSetAt:   Date.now()
  });

  return { active, queued };
}

window.giveManualDiscountToPhone = async function (phone, customerName) {
  const percentInput = document.getElementById("crmManualDiscountPercent");
  const percent = Number(percentInput?.value || 0);

  if (!percent || percent < 1 || percent > 100) {
    alert(t("alert_invalid_promo_percent","Iltimos, 1 dan 100 gacha chegirma foizini kiriting!"));
    return;
  }
  if (!phone) {
    alert(t("phone_not_found","Telefon raqami aniqlanmadi!"));
    return;
  }

  const restId = localStorage.getItem("restaurantId");

  try {
    // Chegirmani xavfsiz birlashtirish (kattasi ishlaydi, kichikisi keyinga qoladi)
    const { active, queued } = await safeSetPersonalDiscount(restId, phone, percent, "admin_crm");

    const code = `MANUAL${percent}-${phone.slice(-4)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    await set(ref(db, `restaurants/${restId}/discounts/${code}`), {
      code, percent, used: false, ownerPhone: phone, isManual: true,
      createdAt: Date.now(), createdBy: "admin",
      reason: `Admin CRM${customerName ? " — " + customerName : ""}`
    });

    await crmAdvAudit("crm", "manual_discount", phone,
      `📦 ${phone} ga ${percent}% chegirma (faol: ${active}%, keyingi: ${queued}%)`,
      { code, percent, active, queued, phone }, "info");

    const msg = queued > 0
      ? `✅ ${phone} ${t("discount_given_with_queue","ga")} ${active}% ${t("discount_applied","chegirma berildi")}! (${queued}% ${t("next_order_queue","keyingi buyurtmaga qoldi")})`
      : `✅ ${phone} ${t("discount_given_with_queue","ga")} ${active}% ${t("discount_applied","chegirma berildi")}!`;
    showAdminNotification(msg, "success");

    if (percentInput) percentInput.value = "";
    if (typeof window.lookupCustomerByPhone === "function") window.lookupCustomerByPhone();
  } catch (err) {
    console.error("giveManualDiscountToPhone error:", err);
    alert(t("discount_error","Chegirma berishda xatolik") + ": " + err.message);
  }
};

// CRM bo'limiga telefon qidiruv panelini inject qilish
function injectCRMPhoneLookupPanel() {
  const statsEl = document.getElementById("crmStats");
  if (!statsEl) return;

  const existingPanel = document.getElementById("crmPhoneLookupPanel");
  if (existingPanel) return; // Ikki marta qo'shilmasin

  const panel = document.createElement("div");
  panel.id = "crmPhoneLookupPanel";
  panel.style.cssText = "background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px 20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.06);";
  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
      <span style="font-size:20px;">📱</span>
      <h3 style="margin:0; font-size:16px; font-weight:800; color:#1e293b;">${t("crm_phone_lookup_title", "Telefon raqami orqali mijozni topish")}</h3>
    </div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <input
        id="crmPhoneLookupInput"
        type="tel"
        placeholder="${t("crm_phone_lookup_placeholder", "Masalan: 901234567 yoki +998901234567")}"
        style="flex:1; min-width:220px; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 14px; font-size:14px; outline:none; transition:border 0.2s;"
        onfocus="this.style.borderColor='#3b82f6'"
        onblur="this.style.borderColor='#e2e8f0'"
        onkeydown="if(event.key==='Enter') window.lookupCustomerByPhone()"
      >
      <button
        onclick="window.lookupCustomerByPhone()"
        style="background:#1e293b; color:#fff; border:none; padding:10px 22px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap;"
      >
        🔍 ${t("search_btn", "Qidirish")}
      </button>
    </div>
    <div id="crmPhoneLookupResult" style="margin-top:10px;"></div>

    
  `;

  statsEl.parentNode.insertBefore(panel, statsEl);
}

// ─── CRM ─────────────────────────────────────────────────
async function loadCRM() {
  const statsEl = document.getElementById("crmStats");
  const listEl = document.getElementById("customerList");
  if (!statsEl || !listEl) return;
  try {
    const [ordersSnap, customersSnap, usersSnap] = await Promise.all([
      get(ref(db, BASE_PATH + "/orders")), get(ref(db, BASE_PATH + "/customers")), get(ref(db, BASE_PATH + "/users"))
    ]);
    window.customerProfilesByPhone = buildCustomerProfilePhoneCache(customersSnap.val() || {});
    crmState.customers = buildCustomerMapFromOrders(
      ordersSnap.val() || {}, customersSnap.val() || {}, usersSnap.val() || {}
    );
    crmState.filtered = [...crmState.customers];
    injectCRMPhoneLookupPanel();
    renderCRMStats();
    renderCustomerList();
    const searchInput = document.getElementById("customerSearch");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "1";
      searchInput.addEventListener("input", filterCustomers);
    }
  } catch (err) {
    console.error(t("crm_load_error_log"), err);
    showAdminNotification(t("crm_load_error"), "error");
  }
}

const loyaltySyncInFlight = new Set();

/* =========================
   MIJOZ TASHRIFLARINI SANASH 
========================= */
async function applyAutoLoyaltyToOrder(orderId, order, ordersObj = {}) {
  const phone = normalizePhone(order.customerPhone || order.phone || order.clientPhone || "");
  if (!phone) return;
  if (order.payment?.paid) return;

  const previousVisits = countCustomerVisitsByPhone(phone, ordersObj, orderId);
  const currentVisitNumber = previousVisits + 1;
  const loyaltyLevel = getLoyaltyLevel(0, currentVisitNumber);

  const discountPercent = getLoyaltyDiscountPercent(previousVisits);

  const customerName = order.customerName || order.clientName || order.name || `${t("table")} ${order.table || uiEmpty()}`;

  const updates = {
    customerId: phone,
    customerPhone: phone,
    customerName,
    loyaltyLevel,
    loyaltyVisits: currentVisitNumber,
    loyaltyAutoApplied: true,
    updatedAt: Date.now()
  };

  if (discountPercent > 0 && !order.discountApplied) {
    const currentTotal = Number(order.total || 0);
    const discountAmount = (currentTotal * discountPercent) / 100;
    const newTotal = currentTotal - discountAmount;

    updates.originalTotal = currentTotal;
    updates.total = newTotal;
    updates.discountPercent = discountPercent;
    updates.discountApplied = true;

    showAdminNotification(`🎉 ${t("client_label", "Mijoz")} (${phone}) ${discountPercent}% ${t("discount_received", "chegirma oldi! Yangi narx:")} ${newTotal}`);
  }

  await update(ref(db, `${BASE_PATH}/orders/${orderId}`), updates);
}

window.cancelOrder = async function (orderId) {
  if (!orderId) return;

  const confirmCancel = confirm(
    t("confirm_cancel_order", "Buyurtmani bekor qilmoqchimisiz?")
  );

  if (!confirmCancel) return;

  try {
    const orderRef = ref(db, `${BASE_PATH}/orders/${orderId}`);

    const orderSnap = await get(orderRef);

    if (!orderSnap.exists()) {
      showAdminNotification(
        t("order_not_found", "Buyurtma topilmadi"),
        "error"
      );
      return;
    }

    const order = orderSnap.val();

    if (order.table) {
      await update(
        ref(db, `${BASE_PATH}/tables/${order.table}`),
        {
          status: "free",
          busy: false,
          orderId: null
        }
      );
    }

    await update(orderRef, {
      status: "canceled",
      statusKey: "canceled",
      statusLabel: "canceled",
      canceledAt: Date.now(),
      canceledBy: currentUserId || "admin"
    });

    if (typeof window.createOrderTimelineEvent === "function") {
      await window.createOrderTimelineEvent(
        orderId,
        "order_canceled",
        {
          canceledBy: currentUserId || "admin"
        }
      );
    }

    if (typeof crmAdvAudit === "function") {
      await crmAdvAudit(
        "orders",
        "cancel",
        orderId,
        t("audit_order_canceled", "Buyurtma bekor qilindi"),
        {},
        "warning"
      );
    }

    showAdminNotification(
      t("order_canceled_success", "Buyurtma bekor qilindi"),
      "success"
    );

  } catch (error) {
    console.error("Cancel order error:", error);

    showAdminNotification(
      t("notify.error", "Xatolik yuz berdi"),
      "error"
    );
  }
};

async function syncCustomerProfileFromOrder(orderId, order, ordersObj = {}) {
  const phone = normalizePhone(
    order.customerPhone ||
    order.phone ||
    order.clientPhone ||
    ""
  );

  if (!phone) return;

  // Har doim fresh ma'lumot olish — allOrders eskirgan bo'lishi mumkin
  const restId = localStorage.getItem("restaurantId");
  let freshOrders = ordersObj;
  try {
    const freshSnap = await get(ref(db, `restaurants/${restId}/orders`));
    if (freshSnap.exists()) freshOrders = freshSnap.val();
  } catch (e) { /* fallback to passed ordersObj */ }

  const paidVisits = countCustomerVisitsByPhone(phone, freshOrders);
  const totalSpentFresh = sumCustomerPaidTotalByPhone(phone, freshOrders);
  const loyaltyLevel = getLoyaltyLevel(totalSpentFresh, paidVisits);
  const discountPercent = getLoyaltyDiscountPercent(paidVisits);
  const totalSpent = totalSpentFresh;

  await update(ref(db, `${BASE_PATH}/customers/${crmAdvSafeKey(phone)}`), {
    id: phone,
    phone,
    name: order.customerName || order.clientName || order.name || "",
    visits: paidVisits,
    loyalty: loyaltyLevel,
    loyaltyDiscountPercent: discountPercent,
    cashbackBalance: Number(order.cashbackBalance || 0),
    totalSpent,
    lastVisit: Date.now(),
    updatedAt: Date.now()
  });
}

function renderCRMStats() {
  const el = document.getElementById("crmStats");
  if (!el) return;
  const customers = Array.isArray(crmState.filtered) ? crmState.filtered : crmState.customers;
  const totalCustomers = customers.length;
  const vipMembers = customers.filter(c => c.loyalty === "vip").length;
  const returning = customers.filter(c => c.visits > 1).length;
  const avgSpend = totalCustomers
    ? customers.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0) / totalCustomers : 0;
  const topVip = [...crmState.customers]
    .filter(c => c.loyalty === "vip").slice(0, 3)
    .map(c => `${escapeHtml(c.name)} (${formatMoney(c.totalSpent)})`).join("<br>") || uiEmpty();
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><h4>${t("crm_total_customers")}</h4><b>${totalCustomers}</b></div>
      <div class="stat-card"><h4>${t("crm_vip_customers")}</h4><b>${vipMembers}</b></div>
      <div class="stat-card"><h4>${t("crm_returning_customers")}</h4><b>${returning}</b></div>
      <div class="stat-card"><h4>${t("crm_avg_spend")}</h4><b>${formatMoney(avgSpend)}</b></div>
    </div>
  `;
}

function filterCustomers() {
  const q = normalizeText(document.getElementById("customerSearch")?.value || "");
  crmState.filtered = crmState.customers.filter(c =>
    normalizeText(c.name).includes(q) || normalizeText(c.phone).includes(q)
  );
  renderCRMStats();
  renderCustomerList();
}

/* =========================
   1. FAOL MIJOZLAR RO'YXATI
========================= */
function renderCustomerList() {
  const el = document.getElementById("customerList");
  if (!el) return;

  let customers = Array.isArray(crmState.filtered) ? crmState.filtered : crmState.customers;

  let topCustomers = customers
    .filter(c => c.phone && c.visits > 0)
    .sort((a, b) => b.visits - a.visits);

  if (!topCustomers.length) {
    el.innerHTML = `<p>${t("customers_not_found", "Mijozlar topilmadi")}</p>`;
    return;
  }

  el.innerHTML = topCustomers.map((c, index) => {
    let rankIcon;
    if (index === 0) rankIcon = "🥇";
    else if (index === 1) rankIcon = "🥈";
    else if (index === 2) rankIcon = "🥉";
    else if (index === 3 || index === 4) rankIcon = "🎖️";
    else rankIcon = `<span style="display:inline-block; width:24px; height:24px; text-align:center; background:#e2e8f0; border-radius:50%; font-size:12px; line-height:24px; color:#475569;">${index + 1}</span>`;

    const safeName = escapeHtml(c.name ? c.name : t("customer_default_name", "Noma'lum mijoz"));
    const safePhone = escapeHtml(c.phone ? c.phone : t("no_phone", "Raqam yo'q"));
    const memoryInline = renderCustomerMemoryInline(c);

    return `
    <div class="staff-card customer-card" onclick="openCustomerDetail('${escapeHtml(c.id)}')">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="margin:0; font-size:18px; display:flex; align-items:center; gap:8px;">
              ${rankIcon} ${safeName}
          </h3>
          <span style="background:#eef8ee; color:#28a745; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:14px;">
              ${c.visits} ${t("visit_times", "marta")}
          </span>
      </div>
      <p>📞 ${t("phone_label", "Tel")}: <b>${safePhone}</b></p>
      <p>💰 ${t("total_spent_label", "Jami sarfladi")}: <b>${formatMoney(c.totalSpent)}</b></p>
      <p>🕒 ${t("last_visit_label", "Oxirgi tashrif")}: <b>${escapeHtml(formatDateTime(c.lastVisit))}</b></p>
      ${memoryInline}
    </div>
  `}).join("");
}

// ─── UNIT KONVERTATSIYA YORDAMCHISI ───────────────────────────────────────
// Masalan: 200 gr → 0.2 kg (agar ombor kg da saqlangan bo'lsa)
function convertToBaseUnit(amount, fromUnit, toUnit) {
  const toBase = {
    gr: 1,       kg: 1000,
    ml: 1,       l: 1000,
    dona: 1,
    osh_q: 15,   choy_q: 5,   piyola: 240,
    bunch: 1,    dash: 1
  };
  if (!fromUnit || !toUnit || fromUnit === toUnit) return amount;
  const baseFrom = toBase[fromUnit];
  const baseTo   = toBase[toUnit];
  if (baseFrom && baseTo) return (amount * baseFrom) / baseTo;
  console.warn(`⚠️ Unit konvertatsiya mumkin emas: ${fromUnit} → ${toUnit}`);
  return amount;
}

async function deductStock(orderItems) {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  for (const [, item] of Object.entries(orderItems)) {
    const menuId = item.menuId || item.id || item.itemId;
    if (!menuId) continue;

    const qty = Number(item.qty || 1);

    let recipe = [];
    if (window.allMenu && window.allMenu[menuId] && window.allMenu[menuId].recipe) {
      const r = window.allMenu[menuId].recipe;
      recipe = Array.isArray(r) ? r : Object.values(r);
    } else {
      try {
        const menuSnap = await get(ref(db, `${BASE_PATH}/menu/${menuId}`));
        if (menuSnap.exists()) {
          const r = menuSnap.val().recipe || [];
          recipe = Array.isArray(r) ? r : Object.values(r);
        }
      } catch (e) {
        console.warn("Recipe o'qishda xato:", e);
        continue;
      }
    }

    // recipes/ yo'lidan ham tekshirish (eski format)
    if (!recipe.length) {
      try {
        const recipeSnap = await get(ref(db, `${BASE_PATH}/recipes/${menuId}`));
        if (recipeSnap.exists()) {
          const r = recipeSnap.val();
          recipe = Object.entries(r).map(([id, v]) => ({ id, ...v }));
        }
      } catch (e) { }
    }

    for (const ing of recipe) {
      const ingId = ing.id;
      const recipeUnit    = ing.unit || "gr";
      const inventoryUnit = window.allInventory?.[ingId]?.unit || "gr";
      const rawNeeded     = Number(ing.amount || 0) * qty;
      const needed        = convertToBaseUnit(rawNeeded, recipeUnit, inventoryUnit);
      if (!ingId || needed <= 0) continue;

      // inventory yo'lini yangilash
      const ingRef = ref(db, `${BASE_PATH}/inventory/${ingId}/stock`);
      try {
        await runTransaction(ingRef, (currentStock) => {
          if (currentStock === null) return undefined; // abort — Firebase qayta urinadi
          return Math.max(0, currentStock - needed);
        });

        // ingredients yo'lini ham sinxronlash
        const afterSnap = await get(ingRef);
        const afterVal = afterSnap.val() ?? 0;
        await update(ref(db, `${BASE_PATH}/ingredients/${ingId}`), { stock: afterVal });

        const ingName = translateIngName(window.allInventory?.[ingId]?.name || ing.name) || ingId;
        const ingUnit = window.allInventory?.[ingId]?.unit || ing.unit || "gr";
        const ingMinStock = parseFloat(window.allInventory?.[ingId]?.minStock || 0);
        const defaultThresholds = { kg: 1, l: 1, gr: 200, ml: 200, dona: 5 };
        const warnThreshold = ingMinStock > 0 ? ingMinStock : (defaultThresholds[ingUnit] ?? 10);
        if (afterVal <= 0) {
          console.warn(`⛔ "${ingName}" omborda tugadi!`);
          if (typeof showAdminNotification === 'function') {
            showAdminNotification(`⛔ "${ingName}" ${t("stock_empty", "Tugagan")}!`, "error");
          }
        } else if (afterVal <= warnThreshold) {
          console.warn(`⚠️ "${ingName}" kam qoldi: ${afterVal}`);
          if (typeof showAdminNotification === 'function') {
            showAdminNotification(`⚠️ "${ingName}" ${t("stock_low", "Kam qoldi")}: ${afterVal} ${ingUnit}`, "warning");
          }
        }
      } catch (e) {
        console.error(`Inventory ayirishda xato (${ingId}):`, e);
      }
    }
  }
}

window.markAsReady = async function (orderId) {
  const now = Date.now();
  try {
    const updates = {
      status: "ready",
      statusKey: "ready",
      statusLabel: typeof t === 'function' ? t("status_ready", "Tayyor") : "Tayyor",
      updatedAt: now
    };

    await update(ref(db, `${BASE_PATH}/orders/${orderId}`), updates);

    if (typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    if (typeof showAdminNotification === 'function') {
      showAdminNotification("✅ " + (typeof t === 'function' ? t("order_ready_stock_deducted", "Buyurtma tayyor!") : "Buyurtma tayyor!"));
    }
  } catch (error) {
    console.error("Xatolik:", error);
    alert((typeof t === 'function' ? t("error_occurred", "Xatolik yuz berdi: ") : "Xatolik yuz berdi: ") + error.message);
  }
};

window.addIngredient = async function () {
  const nameInput = document.getElementById('ing-name');
  const stockInput = document.getElementById('ing-stock');
  const unitInput = document.getElementById('ing-unit');
  const minStockInput = document.getElementById('ing-min-stock');

  const name = nameInput.value.trim();
  const stock = parseFloat(stockInput.value);
  const unit = unitInput ? unitInput.value : "kg";
  const minStock = minStockInput ? parseFloat(minStockInput.value) || 0 : 0;

  if (!name || isNaN(stock)) {
    alert(t("enter_valid_ingredient", "Iltimos, nomi va miqdorini to'g'ri kiriting!"));
    return;
  }

  try {
    const restId = localStorage.getItem("restaurantId");
    const newIngRef = push(ref(db, `restaurants/${restId}/inventory`));
    const ingData = {
      name: name,
      unit: unit,
      stock: stock,
      minStock: minStock,
      createdAt: Date.now(),
      addedFrom: "manual"
    };
    await set(newIngRef, ingData);

    // Masalliqlar bo'limiga ham saqlash
    await set(ref(db, `restaurants/${restId}/ingredients/${newIngRef.key}`), ingData);

    nameInput.value = "";
    stockInput.value = "";
    if (unitInput) unitInput.value = "gr";
    if (minStockInput) minStockInput.value = "";
    console.log(t("ingredient_added_log", "✅ Masalliq qo'shildi"));
    if (typeof showAdminNotification === "function") {
      showAdminNotification(`✅ ${t("ingredient_added_log", "Masalliq qo'shildi")}`, "success");
    }

    // Agar listener hali ishlamagan bo'lsa, ishga tushiramiz
    if (!window._inventoryListenerStarted) {
      listenToInventory();
      window._inventoryListenerStarted = true;
    }
  } catch (e) {
    console.error(t("error_log", "Xatolik:"), e.message);
    alert(t("error_log","Xatolik") + ": " + e.message);
  }
};

function listenToInventory() {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  let inventoryData = {};
  let ingredientsData = {};

  function mergeAndRender() {
    // ID bo'yicha birlashtirish: inventory ustunlik qiladi
    const byId = {};
    Object.entries(inventoryData || {}).forEach(([id, ing]) => { byId[id] = { ...ing, _id: id, _source: "inventory" }; });
    Object.entries(ingredientsData || {}).forEach(([id, ing]) => { if (!byId[id]) byId[id] = { ...ing, _id: id, _source: "ingredients" }; });

    // Nom bo'yicha dedup: bir xil nomli (kichik harfda) masalliqlarni birlashtirish
    // inventory manbali yozuv doimo ustunlik qiladi; aks holda eng katta stock qiymatli yozuv olinadi
    const byName = {};
    Object.entries(byId).forEach(([id, ing]) => {
      const nameKey = String(ing.name || "").trim().toLowerCase();
      if (!nameKey) { byName[id] = ing; return; } // nomsiz yozuvlarni shunchaki qo'shib qo'yamiz
      if (!byName[nameKey]) {
        byName[nameKey] = ing;
      } else {
        const existing = byName[nameKey];
        // inventory manbali yozuv afzal
        if (ing._source === "inventory" && existing._source !== "inventory") {
          byName[nameKey] = ing;
        } else if (ing._source === existing._source) {
          // ikkalasi ham bir xil manbadan — eng katta stockni saqlaymiz
          if (parseFloat(ing.stock || 0) > parseFloat(existing.stock || 0)) {
            byName[nameKey] = ing;
          }
        }
        // boshqa holda existing qoladi
      }
    });

    const merged = {};
    Object.values(byName).forEach(ing => { merged[ing._id] = ing; });

    window.allInventory = merged;

    const tbody = document.getElementById('ingredients-list');
    if (!tbody) return;

    if (Object.keys(merged).length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888; padding:20px;">${typeof t === "function" ? t("no_ingredients", "Masalliqlar yo'q") : "Masalliqlar yo'q"}</td></tr>`;
      return;
    }

    let htmlContent = "";
    const UNITS = window.RECIPE_UNITS || [
      { value: "gr", label: () => "gr (gramm)" },
      { value: "kg", label: () => "kg (kilogram)" },
      { value: "l",  label: () => "l (litr)" },
      { value: "ml", label: () => "ml (millilitr)" },
      { value: "dona", label: () => "dona" },
    ];

    Object.entries(merged).forEach(([id, ing]) => {
      const stockVal = parseFloat(ing.stock || 0);
      const minStockVal = parseFloat(ing.minStock || 0);
      const unit = ing.unit || "gr";
      const defaultThresholds = { kg: 1, l: 1, gr: 200, ml: 200, dona: 5 };
      const lowThreshold = minStockVal > 0 ? minStockVal : (defaultThresholds[unit] ?? 10);
      const unitEntry = UNITS.find(u => u.value === unit);
      const unitLabel = unitEntry ? (typeof unitEntry.label === "function" ? unitEntry.label() : unitEntry.label) : (unit || "gr");
      const color = stockVal <= 0 ? "red" : (stockVal <= lowThreshold ? "orange" : "#28a745");
      const statusKey = stockVal <= 0 ? "stock_empty" : (stockVal <= lowThreshold ? "stock_low" : "stock_enough");
      const statusFallback = stockVal <= 0 ? "Tugagan" : (stockVal <= lowThreshold ? "Kam qoldi" : "Yetarli");
      const statusText = typeof t === "function" ? t(statusKey, statusFallback) : statusFallback;

      const safeName = translateIngName(ing.name).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const safeUnit = String(unitLabel || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

      const badgeBg = stockVal <= 0 ? '#fee2e2' : (stockVal <= lowThreshold ? '#fef9c3' : '#dcfce7');
      const badgeBorder = stockVal <= 0 ? '#fca5a5' : (stockVal <= lowThreshold ? '#fde047' : '#86efac');

      // Birlik tanlash opsiyalari
      const unitsOptions = UNITS.map(u =>
        `<option value="${u.value}"${u.value === unit ? " selected" : ""}>${typeof u.label === "function" ? u.label() : u.label}</option>`
      ).join("");

      htmlContent += `
        <tr id="ing-row-${id}">
          <td><b>${safeName}</b></td>
          <td>
            <span id="ing-unit-display-${id}"
              onclick="window.showUnitSelect('${id}')"
              title="O'zgartirish uchun bosing"
              style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; background:#f1f5f9; border:1px dashed #cbd5e1; font-size:13px; font-weight:600;">
              ${safeUnit} <i class="fa-solid fa-pen" style="font-size:10px; opacity:0.5; color:#64748b;"></i>
            </span>
            <span id="ing-unit-select-wrap-${id}" style="display:none; align-items:center; gap:5px;">
              <select id="ing-unit-select-${id}"
                style="padding:4px 8px; border:1px solid #10b981; border-radius:6px; font-size:13px; outline:none; background:#fff; cursor:pointer;">
                ${unitsOptions}
              </select>
              <button onclick="window.updateUnit('${id}')"
                style="padding:4px 10px; background:#16a34a; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px;">&#x2714;</button>
              <button onclick="window.hideUnitSelect('${id}')"
                style="padding:4px 8px; background:#e5e7eb; color:#333; border:none; border-radius:6px; cursor:pointer; font-size:13px;">&#x2716;</button>
            </span>
          </td>
          <td>
            <span id="ing-stock-display-${id}" style="font-weight:bold; cursor:pointer;"
              onclick="window.showStockInput('${id}', ${stockVal})" title="Miqdorni yangilash uchun bosing">
              <span style="color:${color}">${stockVal} ${ing.unit || 'gr'}</span>
              <i class="fa-solid fa-pen" style="font-size:11px; margin-left:4px; opacity:0.5; color:#888;"></i>
            </span>
            <span id="ing-stock-input-${id}" style="display:none; align-items:center; gap:6px;">
              <input type="number" step="0.01" id="ing-stock-val-${id}" value="${stockVal}"
                style="width:80px; padding:4px 6px; border:1px solid #ccc; border-radius:6px; font-size:14px;">
              <button onclick="window.updateStock('${id}')"
                style="padding:4px 10px; background:#16a34a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
                ✔
              </button>
              <button onclick="window.hideStockInput('${id}')"
                style="padding:4px 8px; background:#e5e7eb; color:#333; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
                ✖
              </button>
            </span>
          </td>
          <td style="display:flex; align-items:center; gap:8px;">
            <span data-i18n="${statusKey}" style="display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600;
              background:${badgeBg}; border:1px solid ${badgeBorder}; color:${color};">
              ${statusText}
            </span>
            <button class="btn-sm btn-danger" onclick="deleteIngredient('${id}')" style="padding:4px 10px;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = htmlContent;
    if (typeof applyLang === "function") applyLang();
  }

  // Til o'zgarganda ombor ro'yxatini qayta render qilish uchun global qilish
  window.mergeAndRender = mergeAndRender;

  // inventory yo'lini tinglash
  onValue(ref(db, `restaurants/${restId}/inventory`), (snap) => {
    inventoryData = snap.val() || {};
    mergeAndRender();
  });

  // ingredients yo'lini ham tinglash
  onValue(ref(db, `restaurants/${restId}/ingredients`), (snap) => {
    ingredientsData = snap.val() || {};
    mergeAndRender();
  });
}

// Sahifa yuklanganda ham bir marta ishga tushiramiz
if (!window._inventoryListenerStarted) {
  listenToInventory();
  window._inventoryListenerStarted = true;
}

function renderMenuItem(id, item) {
  const foodName = item.name.uz || item.name;

  return `
    <div class="menu-card">
      <div class="menu-card-image">
        <img src="${item.imgUrl || 'img/no-food.png'}" alt="${foodName}">
      </div>
      <div class="menu-card-info">
        <h3>${foodName}</h3>
        <p><i class="fa-solid fa-folder"></i> ${item.category} / ${item.subcategory}</p>
        <div class="price">💰 ${(item.price ?? 0).toLocaleString()} ${typeof t === 'function' ? t('currency') : 'UZS'}</div>
      </div>

      <div class="menu-card-actions" style="display: flex; gap: 8px; padding: 10px;">
        <button class="action-btn edit" onclick="window.editMenu('${id}')" title="${t("edit_btn", "Tahrirlash")}">
  <i class="fa-solid fa-pencil"></i>
</button>
        <button class="action-btn delete" onclick="window.deleteMenu('${id}')" title="${t("delete_btn", "O'chirish")}">
  <i class="fa-solid fa-trash"></i>
</button>
        
        <button class="action-btn recipe" onclick="openRecipeModal('${id}', '${foodName}')" 
                title="${t("calculation", "Kalkulyatsiya")}" style="background-color: #6f42c1; color: white;">
          <i class="fa-solid fa-flask-vial"></i>
        </button>
      </div>
    </div>
  `;
}

let currentRecipeFoodId = null;
let inventoryData = {};

window.addIngredientRowToRecipe = function (selectedIngId = "", amount = "") {
  const container = document.getElementById('recipe-items-container');
  if (!container) return;
  const row = document.createElement('div');
  row.className = "recipe-row";
  row.style = "display:flex; gap:10px; margin-bottom:10px; align-items:center;";

  // Agar mavjud ingId bolsa, inventorydan nomini olish
  const inv = window.allInventory || inventoryData || {};
  let existingName = "";
  if (selectedIngId && inv[selectedIngId]) {
    existingName = inv[selectedIngId].name || "";
  }

  row.innerHTML = `
        <input type="text" class="recipe-ing-name-input"
               value="${existingName}"
               data-ing-id="${selectedIngId}"
               placeholder="${typeof t === 'function' ? t('ingredient_name', 'Masalliq nomi') : 'Masalliq nomi'}"
               style="flex:2; padding:8px; border-radius:5px; border:1px solid #ddd;"
               autocomplete="off">
        <input type="number" step="0.001" class="recipe-amount-input" 
               placeholder="${t("quantity", "Miqdor")}" value="${amount}" 
               style="flex:1; padding:8px; border-radius:5px; border:1px solid #ddd;">
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:red; cursor:pointer;">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
  container.appendChild(row);
};

// save-recipe-btn onclick window.saveRecipe() orqali HTML da bog'langan — bu blok olib tashlandi

window.closeRecipeModal = function () {
  window.currentRecipeMenuId = null;
  window.currentRecipeFoodId = null;
  const modal = document.getElementById("recipeModal")
    || document.getElementById("recipe-modal")
    || document.querySelector('[data-modal="recipe"]');
  if (modal) modal.style.display = "none";
};

// ---- Ombor: stock inline yangilash ----
window.showStockInput = function (id, currentVal) {
  const display = document.getElementById(`ing-stock-display-${id}`);
  const input = document.getElementById(`ing-stock-input-${id}`);
  const valInput = document.getElementById(`ing-stock-val-${id}`);
  if (display) display.style.display = "none";
  if (input) { input.style.display = "inline-flex"; }
  if (valInput) { valInput.focus(); valInput.select(); }
};

window.hideStockInput = function (id) {
  const display = document.getElementById(`ing-stock-display-${id}`);
  const input = document.getElementById(`ing-stock-input-${id}`);
  if (display) display.style.display = "inline";
  if (input) input.style.display = "none";
};

window.updateStock = async function (id) {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const valInput = document.getElementById(`ing-stock-val-${id}`);
  const newStock = parseFloat(valInput ? valInput.value : 0);
  if (isNaN(newStock)) { alert(t("invalid_amount", "Noto'g'ri miqdor!")); return; }

  try {
    // inventory va ingredients ikkalasini yangilash
    await update(ref(db, `restaurants/${restId}/inventory/${id}`), { stock: newStock });
    await update(ref(db, `restaurants/${restId}/ingredients/${id}`), { stock: newStock });
    window.hideStockInput(id);
    if (typeof showAdminNotification === "function") {
      showAdminNotification(`✅ ${t("stock_label", "Zaxira")} ${t("updated", "yangilandi")}: ${newStock}`, "success");
    }
  } catch (err) {
    alert(t("notify.error", "Xatolik yuz berdi") + ": " + err.message);
  }
};

// ── Birlik o'zgartirish funksiyalari ──────────────────────

window.showUnitSelect = function (id) {
  const display = document.getElementById(`ing-unit-display-${id}`);
  const wrap    = document.getElementById(`ing-unit-select-wrap-${id}`);
  if (display) display.style.display = "none";
  if (wrap)    { wrap.style.display = "inline-flex"; }
};

window.hideUnitSelect = function (id) {
  const display = document.getElementById(`ing-unit-display-${id}`);
  const wrap    = document.getElementById(`ing-unit-select-wrap-${id}`);
  if (display) display.style.display = "inline-flex";
  if (wrap)    wrap.style.display = "none";
};

window.updateUnit = async function (id) {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const sel = document.getElementById(`ing-unit-select-${id}`);
  if (!sel) return;
  const newUnit = sel.value;

  try {
    await update(ref(db, `restaurants/${restId}/inventory/${id}`),    { unit: newUnit });
    await update(ref(db, `restaurants/${restId}/ingredients/${id}`),  { unit: newUnit });
    window.hideUnitSelect(id);
    if (typeof showAdminNotification === "function") {
      const UNITS = window.RECIPE_UNITS || [
        { value: "gr",   label: () => "gr (gramm)"    },
        { value: "kg",   label: () => "kg (kilogram)" },
        { value: "l",    label: () => "l (litr)"       },
        { value: "ml",   label: () => "ml (millilitr)" },
        { value: "dona", label: () => "dona"            },
      ];
      const unitEntry = UNITS.find(u => u.value === newUnit);
      const label = unitEntry ? (typeof unitEntry.label === "function" ? unitEntry.label() : unitEntry.label) : newUnit;
      showAdminNotification(
        `✅ ${t("unit_label", "Birlik")} ${t("updated", "yangilandi")}: ${label}`,
        "success"
      );
    }
  } catch (err) {
    alert(t("notify.error", "Xatolik yuz berdi") + ": " + err.message);
  }
};

/* =========================
   2. MIJOZ KARTASINI OCHISH VA PROMOKOD YARATISH
========================= */
window.openCustomerDetail = function openCustomerDetail(id) {
  const customer = crmState.customers.find(c => c.id === id);
  if (!customer) return;
  const memory = getCustomerMemoryState(customer);

  let modal = document.getElementById("crmDetailModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "crmDetailModal";
    modal.className = "modal hidden";
    document.body.appendChild(modal);
  }

  modal.classList.remove("hidden");
  modal.style.display = "flex";

  modal.innerHTML = `
    <div class="modal-content">
      <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>${escapeHtml(customer.name || t("customer_default_name"))}</h3>
          <span style="background:#eef8ee; color:#28a745; padding:4px 8px; border-radius:12px; font-weight:bold;">${customer.visits} ${t("visits_count_label")}</span>
      </div>
      <p>📞 ${t("phone_label")}: <b>${escapeHtml(customer.phone)}</b></p>
      <p>💰 ${t("total_spent_label")}: <b>${formatMoney(customer.totalSpent)}</b></p>

      ${memory.summary ? `
      <div style="margin: 12px 0 15px; padding: 12px 14px; border-radius: 10px; background: #fff5f5; border: 1px solid #fecaca; color: #b42318;">
        <div style="font-weight: 800; margin-bottom: 6px;">${t("allergies_preferences_warning", "⚠️ Allergiyalar/Afzalliklar")}</div>
        <div style="font-size: 14px; line-height: 1.5;">${escapeHtml(memory.summary)}</div>
      </div>
      ` : ""}
      <div style="margin: 15px 0; padding: 15px; background: #eef8ee; border-radius: 8px; border: 1px solid #c3e6cb;">
         <h4 style="margin-top:0; color:#155724;">🎫 ${t("create_promo_title")}</h4>
         <p style="font-size:13px; color:#666; margin-bottom:10px;">${t("create_promo_desc")}</p>
         <div style="display:flex; gap:10px; align-items:center;">
             <input id="promoPercentValue" type="number" placeholder="${t("promo_percent_placeholder")}" style="padding: 6px; flex:1; border-radius:4px; border:1px solid #ccc;" min="1" max="100">
             <span style="font-weight:bold; font-size:16px;">%</span>
         </div>
         <button class="btn primary" style="margin-top:10px; width:100%; background:#28a745;" onclick="generatePromoForCustomer('${customer.phone || id}')">${t("create_promo_btn")}</button>
      </div>

      <h4>${t("recent_orders_title")}</h4>
      <div>
        ${customer.recentOrders.length
      ? customer.recentOrders.map(o => `
            <div class="cash-card">
              <p>#${escapeHtml(String(o.orderNumber))} | ${t("table")} ${escapeHtml(String(o.table))}</p>
              <p>${escapeHtml(translateStatus(o.status))} — ${formatMoney(o.total)}</p>
            </div>
          `).join("")
      : `<p>${t("no_orders_found")}</p>`
    }
      </div>

      <div class="modal-actions" style="margin-top:15px;">
        <button class="btn" onclick="closeCustomerDetail()">${t("close_btn")}</button>
      </div>
    </div>
  `;
};

/* =========================
   3. PROMOKODNI BAZAGA SAQLASH
========================= */
window.generatePromoForCustomer = async function (phoneKey) {
  const val = document.getElementById("promoPercentValue").value.trim();
  const percent = Number(val);

  if (!percent || percent <= 0 || percent > 100) {
    alert(t("alerts_invalid_promo_percent"));
    return;
  }

  const code = `DINE${percent}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  await set(ref(db, `${BASE_PATH}/discounts/${code}`), {
    code: code,
    percent: percent,
    used: false,
    usedCount: 0,
    maxUses: 1,
    ownerPhone: phoneKey,
    createdAt: Date.now(),
    createdBy: "admin"
  });

  showAdminNotification(t("promo_created_success").replace("{code}", code).replace("{percent}", percent));
  closeCustomerDetail();
};

window.closeCustomerDetail = function () {
  const modal = document.getElementById("crmDetailModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.classList.add("hidden");
};

/* =========================
   PROMOKODLAR BOSHQARUVI PANELI
========================= */
window.loadPromocodesPanel = async function () {
  const container = document.getElementById("promocodes");
  if (!container) return;

  container.innerHTML = `<div style="padding:24px;text-align:center;color:#6b7280;">${t("loading","Yuklanmoqda...")} ⏳</div>`;

  const snap = await get(ref(db, `${BASE_PATH}/discounts`));
  const discounts = snap.val() || {};

  const allRows = Object.values(discounts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Aktiv va Ishlatilgan ajratish
  const activeRows = allRows.filter(d => {
    const usedCount = Number(d.usedCount) || (d.used ? 1 : 0);
    const maxUses   = Number(d.maxUses) || 1;
    return !d.used && usedCount < maxUses;
  });
  const usedRows = allRows.filter(d => {
    const usedCount = Number(d.usedCount) || (d.used ? 1 : 0);
    const maxUses   = Number(d.maxUses) || 1;
    return d.used || usedCount >= maxUses;
  });

  function buildTableRows(rows, isUsedTab) {
    if (!rows.length) {
      return `<tr><td colspan="7" style="padding:24px;text-align:center;color:#9ca3af;">
        ${isUsedTab ? t("no_used_promos","Hozircha ishlatilgan promokod yo'q") : t("no_active_promos","Hozircha aktiv promokod yo'q")}
      </td></tr>`;
    }
    return rows.map(d => {
      const usedCount   = Number(d.usedCount) || (d.used ? 1 : 0);
      const maxUses     = Number(d.maxUses) || 1;
      const createdStr  = d.createdAt ? new Date(d.createdAt).toLocaleDateString("uz-UZ") : "—";
      const usedAtStr   = d.usedAt    ? new Date(d.usedAt).toLocaleDateString("uz-UZ")    : "—";
      const chegirma    = d.percent   ? `${d.percent}%` : (d.amount ? `${formatMoney(d.amount)}` : "—");

      // Kim ishlatgan (ownerPhone yoki usedByOrder)
      let ownerCell;
      if (isUsedTab) {
        const ownerPhone  = d.ownerPhone  ? `📱 ${d.ownerPhone}`  : "";
        const usedByOrder = d.usedByOrder ? `🧾 #${d.usedByOrder.slice(-6)}` : "";
        ownerCell = ownerPhone || usedByOrder
          ? `<div style="font-size:12px;color:#374151;font-weight:600;">${ownerPhone}</div>
             ${usedByOrder ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">${usedByOrder}</div>` : ""}`
          : `<span style="color:#d1d5db;">—</span>`;
      } else {
        ownerCell = d.ownerPhone
          ? `<span style="font-size:12px;color:#374151;font-weight:600;">📱 ${d.ownerPhone}</span>`
          : `<span style="font-size:12px;color:#9ca3af;">${t("promo_public","Umumiy")}</span>`;
      }

      // VIP badge
      const vipBadge = d.isVipPromo
        ? `<span style="background:#ede9fe;color:#5b21b6;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700;">VIP</span>`
        : "";

      if (isUsedTab) {
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px;font-weight:600;font-family:monospace;font-size:13px;">${escapeHtml(d.code)}${vipBadge}</td>
          <td style="padding:10px 12px;text-align:center;">${chegirma}</td>
          <td style="padding:10px 12px;">${ownerCell}</td>
          <td style="padding:10px 12px;text-align:center;color:#6b7280;font-size:12px;">${createdStr}</td>
          <td style="padding:10px 12px;text-align:center;color:#dc2626;font-size:12px;font-weight:600;">${usedAtStr}</td>
          <td style="padding:10px 12px;text-align:center;font-weight:600;color:#f59e0b;">${usedCount} / ${maxUses}</td>
        </tr>`;
      } else {
        const deactivateBtn = `<button onclick="window.deactivatePromo('${escapeHtml(d.code)}')"
           style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;font-weight:700;line-height:1;" title="${t('deactivate_btn',"O'chirish")}">−</button>`;
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 12px;font-weight:600;font-family:monospace;font-size:13px;">${escapeHtml(d.code)}${vipBadge}</td>
          <td style="padding:10px 12px;text-align:center;">${chegirma}</td>
          <td style="padding:10px 12px;">${ownerCell}</td>
          <td style="padding:10px 12px;text-align:center;color:#6b7280;font-size:12px;">${createdStr}</td>
          <td style="padding:10px 12px;text-align:center;font-weight:600;color:#6b7280;">${usedCount} / ${maxUses}</td>
          <td style="padding:10px 12px;text-align:center;">${deactivateBtn}</td>
        </tr>`;
      }
    }).join("");
  }

  const activeTableRows = buildTableRows(activeRows, false);
  const usedTableRows   = buildTableRows(usedRows, true);

  container.innerHTML = `
    <div style="padding:24px;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;">🎫 ${t("promocodes_title","Promokodlar boshqaruvi")}</h2>
        <button onclick="window.openCreatePromoModal()"
          style="background:#4f46e5;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          ＋ ${t("new_promo_btn","Yangi Promokod")}
        </button>
      </div>

      <!-- Stats row -->
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">✅</span>
          <div>
            <div style="font-size:22px;font-weight:700;color:#16a34a;">${activeRows.length}</div>
            <div style="font-size:12px;color:#15803d;">${t("stat_active_promos","Aktiv promokodlar")}</div>
          </div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">🔒</span>
          <div>
            <div style="font-size:22px;font-weight:700;color:#ea580c;">${usedRows.length}</div>
            <div style="font-size:12px;color:#c2410c;">${t("stat_used_promos","Ishlatilgan promokodlar")}</div>
          </div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">📊</span>
          <div>
            <div style="font-size:22px;font-weight:700;color:#374151;">${allRows.length}</div>
            <div style="font-size:12px;color:#6b7280;">${t("stat_total_promos","Jami promokodlar")}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid #e5e7eb;">
        <button id="promo-tab-active" onclick="window._switchPromoTab('active')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;color:#4f46e5;border-bottom:2px solid #4f46e5;margin-bottom:-2px;cursor:pointer;">
          ✅ ${t("tab_active_promos","Aktiv")} <span style="background:#dcfce7;color:#16a34a;border-radius:12px;padding:1px 8px;font-size:12px;margin-left:4px;">${activeRows.length}</span>
        </button>
        <button id="promo-tab-used" onclick="window._switchPromoTab('used')"
          style="padding:10px 20px;border:none;background:none;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;">
          🔒 ${t("tab_used_promos","Ishlatilgan")} <span style="background:#fee2e2;color:#dc2626;border-radius:12px;padding:1px 8px;font-size:12px;margin-left:4px;">${usedRows.length}</span>
        </button>
      </div>

      <!-- Active tab panel -->
      <div id="promo-panel-active" style="background:#fff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_code","Promokod")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_discount","Chegirma")}</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_owner","Egasi")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_date","Yaratilgan")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_uses","Ishlatish")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;"></th>
              </tr>
            </thead>
            <tbody>${activeTableRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Used tab panel (hidden by default) -->
      <div id="promo-panel-used" style="display:none;background:#fff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#fef9f9;border-bottom:1px solid #fecaca;">
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_code","Promokod")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_discount","Chegirma")}</th>
                <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_used_by","Kim ishlatdi")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_created_at","Yaratilgan")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_used_at","Ishlatilgan sana")}</th>
                <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">${t("promo_col_uses","Ishlatish")}</th>
              </tr>
            </thead>
            <tbody>${usedTableRows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Yangi Promo Modal -->
    <div id="createPromoModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <h3 style="margin:0 0 20px;font-size:18px;font-weight:700;">🎫 ${t("new_promo_title","Yangi Promokod yaratish")}</h3>

        <label style="display:block;margin-bottom:14px;">
          <span style="font-size:13px;font-weight:600;color:#374151;">${t("promo_field_code","Promokod (ixtiyoriy, bo'sh qoldirsangiz avtomatik)")}</span>
          <input id="newPromoCode" type="text" placeholder="SALE20"
            style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;text-transform:uppercase;">
        </label>

        <label style="display:block;margin-bottom:14px;">
          <span style="font-size:13px;font-weight:600;color:#374151;">${t("promo_field_percent","Chegirma (%)")}</span>
          <input id="newPromoPercent" type="number" min="1" max="100" placeholder="20"
            style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </label>

        <label style="display:block;margin-bottom:20px;">
          <span style="font-size:13px;font-weight:600;color:#374151;">${t("promo_field_maxuses","Maksimal ishlatish soni")}</span>
          <input id="newPromoMaxUses" type="number" min="1" value="1"
            style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </label>

        <div style="display:flex;gap:10px;">
          <button onclick="window.closeCreatePromoModal()"
            style="flex:1;padding:10px;border:1px solid #d1d5db;background:#fff;border-radius:8px;font-size:14px;cursor:pointer;color:#374151;">
            ${t("cancel","Bekor qilish")}
          </button>
          <button onclick="window.saveNewPromo()"
            style="flex:1;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
            ${t("create_btn","Yaratish")}
          </button>
        </div>
      </div>
    </div>
  `;
};

window._switchPromoTab = function (tab) {
  const activePanel = document.getElementById("promo-panel-active");
  const usedPanel   = document.getElementById("promo-panel-used");
  const activeBtn   = document.getElementById("promo-tab-active");
  const usedBtn     = document.getElementById("promo-tab-used");
  if (!activePanel || !usedPanel || !activeBtn || !usedBtn) return;

  if (tab === "active") {
    activePanel.style.display = "";
    usedPanel.style.display   = "none";
    activeBtn.style.color     = "#4f46e5";
    activeBtn.style.borderBottom = "2px solid #4f46e5";
    activeBtn.style.marginBottom = "-2px";
    usedBtn.style.color       = "#6b7280";
    usedBtn.style.borderBottom = "none";
    usedBtn.style.marginBottom = "0";
  } else {
    activePanel.style.display = "none";
    usedPanel.style.display   = "";
    usedBtn.style.color       = "#4f46e5";
    usedBtn.style.borderBottom = "2px solid #4f46e5";
    usedBtn.style.marginBottom = "-2px";
    activeBtn.style.color     = "#6b7280";
    activeBtn.style.borderBottom = "none";
    activeBtn.style.marginBottom = "0";
  }
};

window.openCreatePromoModal = function () {
  const modal = document.getElementById("createPromoModal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("newPromoCode").value = "";
    document.getElementById("newPromoPercent").value = "";
    document.getElementById("newPromoMaxUses").value = "1";
  }
};

window.closeCreatePromoModal = function () {
  const modal = document.getElementById("createPromoModal");
  if (modal) modal.style.display = "none";
};

window.saveNewPromo = async function () {
  const codeInput   = document.getElementById("newPromoCode")?.value.trim().toUpperCase();
  const percentVal  = Number(document.getElementById("newPromoPercent")?.value || 0);
  const maxUsesVal  = Number(document.getElementById("newPromoMaxUses")?.value || 1);

  if (!percentVal || percentVal <= 0 || percentVal > 100) {
    alert(t("alerts_invalid_promo_percent","Chegirma foizini 1–100 oralig'ida kiriting!"));
    return;
  }

  const code = codeInput || `PROMO${percentVal}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Duplicate tekshirish
  const existing = await get(ref(db, `${BASE_PATH}/discounts/${code}`));
  if (existing.exists()) {
    alert(t("promo_duplicate_error","Bu kod allaqachon mavjud! Boshqa kod kiriting."));
    return;
  }

  await set(ref(db, `${BASE_PATH}/discounts/${code}`), {
    code,
    percent: percentVal,
    used: false,
    usedCount: 0,
    maxUses: maxUsesVal,
    createdAt: Date.now(),
    createdBy: "admin"
  });

  showAdminNotification(`✅ ${t("promo_created_success","Promokod yaratildi:").replace("{code}", code).replace("{percent}", percentVal)} ${code} — ${percentVal}%`);
  window.closeCreatePromoModal();
  window.loadPromocodesPanel();
};

window.deactivatePromo = async function (code) {
  if (!confirm(t("promo_deactivate_confirm",`"${code}" promokodini o'chirishni tasdiqlaysizmi?`).replace("{code}", code))) return;

  await update(ref(db, `${BASE_PATH}/discounts/${code}`), {
    used: true,
    deactivatedAt: Date.now(),
    deactivatedBy: "admin"
  });

  showAdminNotification(`✅ ${t("promo_deactivated","Promokod o'chirildi:")}: ${code}`, "warning");
  window.loadPromocodesPanel();
};

async function loadReservations() {
  const listEl = document.getElementById("reservationList");
  const statsEl = document.getElementById("reservationStats");
  const formEl = document.getElementById("reservationForm");
  const filtersEl = document.getElementById("reservationFilters");
  if (!listEl || !statsEl || !formEl || !filtersEl) return;
  try {
    const snap = await get(ref(db, BASE_PATH + "/reservations"));
    reservationState.list = Object.entries(snap.val() || {})
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    formEl.innerHTML = `
    <div class="form-grid">
      <input id="resGuestName" type="text" placeholder="${t("reservation_guest_name")}">
      <input id="resPhone" type="text" placeholder="${t("customer_phone")}">
      <input id="resDate" type="date">
      <input id="resTime" type="time">
      <input id="resGuests" type="number" min="1" placeholder="${t("guest_count")}">
      <input id="resTable" type="number" min="1" placeholder="${t("table_number")}">
      <input id="resSpecial" type="text" placeholder="${t("special_request_label")}">
      <button class="btn primary" onclick="createReservation()">${t("create_reservation_btn")}</button>
    </div>
  `;
    filtersEl.innerHTML = `
    <div class="form-grid">
      <select id="reservationStatusFilter" onchange="renderReservationList()">
        <option value="all">${t("all_items")}</option>
        <option value="pending">${t("reservation_status_pending")}</option>
        <option value="confirmed">${t("reservation_status_confirmed")}</option>
        <option value="seated">${t("reservation_status_seated")}</option>
        <option value="completed">${t("reservation_status_completed")}</option>
        <option value="no_show">${t("reservation_status_no_show")}</option>
        <option value="canceled">${t("reservation_status_canceled")}</option>
      </select>
    </div>
  `;
    renderReservationStats();
    renderReservationList();
    if (typeof updateRealTimeStats === "function") updateRealTimeStats();
  } catch (err) {
    console.error(t("reservations_load_error_log"), err);
    showAdminNotification(t("reservations_load_error"), "error");
  }
}

// ==========================================
// 🎨 BRON STATUSLARI UCHUN DIZAYN
// ==========================================
window.getReservationStatusBadge = function (status) {
  let statusText = status;
  let badgeBg = "#eee";
  let badgeColor = "#333";

  switch (status) {
    case "pending":
      statusText = t("res_badge_pending", "KUTILMOQDA");
      badgeBg = "#fef3c7";
      badgeColor = "#d97706";
      break;
    case "confirmed":
      statusText = t("res_badge_confirmed", "TASDIQLANGAN");
      badgeBg = "#e0e7ff";
      badgeColor = "#4f46e5";
      break;
    case "seated":
      statusText = t("res_badge_seated", "MIJOZ KELDI");
      badgeBg = "#dcfce7";
      badgeColor = "#16a34a";
      break;
    case "completed":
      statusText = t("res_badge_completed", "YAKUNLANDI");
      badgeBg = "#f1f5f9";
      badgeColor = "#475569";
      break;
    case "canceled":
      statusText = t("res_badge_canceled", "BEKOR QILINDI");
      badgeBg = "#fee2e2";
      badgeColor = "#dc2626";
      break;
    case "no_show":
      statusText = t("res_badge_no_show", "KELMAGAN");
      badgeBg = "#f3f4f6";
      badgeColor = "#374151";
      break;
  }

  return `<span style="background:${badgeBg}; color:${badgeColor}; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 11px; display: inline-block; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-transform: uppercase;">${statusText}</span>`;
};

function renderReservationStats() {
  const el = document.getElementById("reservationStats");
  if (!el) return;
  const list = reservationState.list;
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><h4>${t("total_label")}</h4><b>${list.length}</b></div>
      <div class="stat-card"><h4>${t("today_label")}</h4><b>${list.filter(r => r.date === today).length}</b></div>
      <div class="stat-card"><h4>${t("pending_label")}</h4><b>${list.filter(r => r.status === "pending").length}</b></div>
      <div class="stat-card"><h4>${t("confirmed_label")}</h4><b>${list.filter(r => r.status === "confirmed").length}</b></div>
      <div class="stat-card"><h4>${t("no_show_label")}</h4><b>${list.filter(r => r.status === "no_show").length}</b></div>
    </div>
  `;
}

window.renderReservationList = function renderReservationList() {
  const el = document.getElementById("reservationList");
  if (!el) return;

  const filter = document.getElementById("reservationStatusFilter")?.value || "all";
  const today = new Date().toISOString().slice(0, 10);

  const items = reservationState.list.filter(
    item => filter === "all" || String(item.status || "pending") === filter
  );

  if (!items.length) {
    el.innerHTML = `<p>${t("reservations_empty") || "Bronlar topilmadi"}</p>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const status = String(item.status || "pending");
    const urgent = item.date === today && status === "pending";

    return `
        <div class="order-card">
          <div class="order-info">
            <h3>${escapeHtml(item.guestName || "Mijoz")}</h3>
            <p>📞 ${escapeHtml(item.phone || "")}</p>
            <p>📅 ${escapeHtml(item.date || "")} <b style="color: #3b82f6; font-size: 16px;">${escapeHtml(item.time || "")}</b></p>
            <p>👥 ${t("guests_label", "Mehmonlar:")} <b>${Number(item.guests || 0)}</b></p>
            <p>🍽 ${t("table_label", "Stol:")} <b>${escapeHtml(String(item.tableNumber || ""))}</b></p>
            <p>📝 ${t("special_label", "Maxsus:")} ${escapeHtml(item.specialRequests || "")}</p>
            
            <p style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
              ${t("status_label", "Holati:")} 
              ${window.getReservationStatusBadge(status)}
              ${urgent ? `<span class="approved" style="background:#ef4444; color:white; padding:4px 8px; border-radius:10px; font-size:10px;">❗️ ${t("urgent_label", "Tezkor")}</span>` : ""}
            </p>
          </div>  

         <div class="order-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${getReservationStatusActions(status).map(action => `
              <button class="btn" onclick="updateReservationStatus('${item.id}','${action.status}')">
                ${escapeHtml(action.label)}
              </button>
            `).join("")}
            
            <button class="btn" style="background: #e0e7ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 8px 12px; border-radius: 6px; cursor: pointer; flex: 1; font-weight:bold;" 
                    onclick="window.editReservationTime('${item.id}', '${item.time || ''}')">
              🕒 ${t("change_time_btn", "Vaqtni o'zgartirish")}
            </button>
            <button class="btn" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; flex: 1; font-weight:bold;" 
                    onclick="window.deleteReservation('${item.id}', '${item.tableNumber || ''}')">
              🗑 ${t("delete_btn", "O'chirish")}
            </button>
          </div>
        </div>
      `;
  }).join("");
};

window.createReservation = async function () {
  const guestName = document.getElementById("resGuestName")?.value?.trim();
  const phone = document.getElementById("resPhone")?.value?.trim();
  const date = document.getElementById("resDate")?.value;
  const time = document.getElementById("resTime")?.value;
  const guests = Number(document.getElementById("resGuests")?.value || 0);
  const tableNumber = Number(document.getElementById("resTable")?.value || 0);
  const specialRequests = document.getElementById("resSpecial")?.value?.trim();

  if (!guestName || !phone || !date || !time || guests < 1) {
    alert(t("fill_reservation_fields") || "Iltimos, barcha maydonlarni to'ldiring!");
    return;
  }

  const resDateTime = new Date(`${date}T${time}`);
  if (resDateTime < new Date()) {
    alert(t("past_time_error", "O'tib ketgan vaqtga bron qilish mumkin emas!"));
    return;
  }

  if (tableNumber > 0) {
    const existingRes = reservationState.list.find(r =>
      r.date === date &&
      Number(r.tableNumber) === tableNumber &&
      (r.status === "pending" || r.status === "confirmed")
    );

    if (existingRes) {
      const existingTime = new Date(`${existingRes.date}T${existingRes.time}`);
      const diffHours = Math.abs(resDateTime - existingTime) / 36e5;
      if (diffHours < 2) {
        alert(t("table_already_reserved", "⚠️ Diqqat! {tableNumber}-stol soat {time} da band qilingan. Boshqa vaqt yoki stol tanlang.").replace("{tableNumber}", tableNumber).replace("{time}", existingRes.time));
        return;
      }
    }
  }

  const restId = localStorage.getItem("restaurantId");
  try {
    await set(push(ref(db, `restaurants/${restId}/reservations`)), {
      guestName,
      phone,
      date,
      time,
      guests,
      tableNumber: tableNumber || null,
      specialRequests: specialRequests || "",
      status: "pending",
      createdAt: Date.now()
    });

    showAdminNotification(t("reservation_created_success") || "Bron muvaffaqiyatli yaratildi!");

    document.getElementById("resGuestName").value = "";
    document.getElementById("resPhone").value = "";
    document.getElementById("resGuests").value = "";
    document.getElementById("resSpecial").value = "";

    loadReservations();
  } catch (error) {
    console.error("Bron qilishda xato:", error);
  }
};

window.updateReservationStatus = async function (id, status) {
  window.logSystemAction("update", t("log_res_status_changed", "🔄 Bron holati o'zgardi: {status}. ID: {id}").replace("{status}", status).replace("{id}", id));
  const restId = localStorage.getItem("restaurantId");

  try {
    await update(ref(db, `restaurants/${restId}/reservations/${id}`), {
      status,
      updatedAt: Date.now()
    });

    const resData = reservationState.list.find(r => r.id === id);
    if (resData && resData.tableNumber) {
      const tableRef = ref(db, `restaurants/${restId}/tables/${resData.tableNumber}`);

      if (status === "seated") {
        await update(tableRef, { status: "busy", busy: true });
      } else if (status === "canceled" || status === "no_show") {
        await update(tableRef, { status: "free", busy: false });
      }
    }

    showAdminNotification(`${t("reservations_title", "Bron")} → ${t("reservation_status_" + status, status)}`);
    loadReservations();
  } catch (error) {
    console.error(t("status_update_error_log", "Status yangilashda xato:"), error);
  }
};

// ==========================================
// ⏳ BRONLAR: AVTOMATIK VAQT NAZORATCHISI
// ==========================================
window.autoCheckReservations = async function () {
  if (!reservationState || !reservationState.list) return;

  const now = new Date();
  const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  for (const res of reservationState.list) {
    if (res.date === todayStr && res.time <= currentTimeStr) {
      if (res.status === "pending" || res.status === "confirmed") {

        await update(ref(db, `restaurants/${restId}/reservations/${res.id}`), {
          status: "seated",
          updatedAt: Date.now()
        });

        if (res.tableNumber) {
          await update(ref(db, `restaurants/${restId}/tables/${res.tableNumber}`), {
            status: "busy",
            busy: true,
            updatedAt: Date.now()
          });

          showAdminNotification(t("auto_reserved_notification", "⏳ Soat {time} bo'ldi! {table}-stol avtomat band qilindi.").replace("{time}", res.time).replace("{table}", res.tableNumber), "warning");
        }
      }
    }
  }
};

async function loadFeedbacks() {
  const listEl = document.getElementById("feedbackList");
  const statsEl = document.getElementById("feedbackStats");
  const filtersEl = document.getElementById("feedbackFilters");
  if (!listEl || !statsEl || !filtersEl) return;
  try {
    const [feedbackSnap, ordersSnap] = await Promise.all([
      get(ref(db, BASE_PATH + "/feedback")),
      get(ref(db, BASE_PATH + "/orders"))
    ]);
    const ordersObj = ordersSnap.val() || {};

    feedbackState.list = Object.entries(feedbackSnap.val() || {})
      .map(([id, item]) => {
        const order = item.orderId ? (ordersObj[item.orderId] || null) : null;

        const realOrderNumber = order?.orderNumber
          || item.orderNumber
          || (item.orderId ? item.orderId.slice(-6) : "—");

        const realTable = order?.table
          || order?.tableNumber
          || item.table
          || item.tableNumber
          || "—";

        const phone = order?.customerPhone || order?.phone || order?.clientPhone || item.phone || "";
        const visitCount = phone
          ? countCustomerVisitsByPhone(phone, ordersObj)
          : null;

        return {
          id,
          ...item,
          orderNumber: realOrderNumber,
          table:       realTable,
          visitCount
        };
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    filtersEl.innerHTML = `
    <div class="form-grid">
      <input id="feedbackDateFrom" type="date" onchange="filterFeedbacks()">
      <input id="feedbackDateTo" type="date" onchange="filterFeedbacks()">
      <input id="feedbackTableFilter" type="text" placeholder="${t("table")}" oninput="filterFeedbacks()">
      <select id="feedbackScoreFilter" onchange="filterFeedbacks()">
        <option value="all">${t("all_scores")}</option>
        <option value="5">5</option>
        <option value="4">4+</option>
        <option value="3">3+</option>
        <option value="2">${t("two_or_lower")}</option>
      </select>
    </div>
  `;
    renderFeedbackStats();
    renderFeedbackList();
  } catch (err) {
    console.error(t("feedback_load_error_log"), err);
    showAdminNotification(t("feedback_load_error"), "error");
  }
}

function renderFeedbackStats() {
  const el = document.getElementById("feedbackStats");
  if (!el) return;
  const list = feedbackState.list;
  const getScore = item => (Number(item.foodQuality || 0) + Number(item.serviceQuality || 0) + Number(item.atmosphere || 0)) / 3;
  const avg = list.length ? list.reduce((sum, item) => sum + getScore(item), 0) / list.length : 0;
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><h4>${t("feedback_total")}</h4><b>${list.length}</b></div>
      <div class="stat-card"><h4>${t("feedback_avg_rating")}</h4><b>${avg.toFixed(1)}</b></div>
      <div class="stat-card"><h4>${t("feedback_low_rating_alerts")}</h4><b>${list.filter(item => getScore(item) <= 2.5).length}</b></div>
    </div>
  `;
}

function renderFeedbackList(customList = null) {
  const el = document.getElementById("feedbackList");
  if (!el) return;
  const list = customList || feedbackState.list;

  if (!list.length) {
    el.innerHTML = `<p style="text-align:center; padding:20px; color:#6b7280;">${t("no_feedbacks_yet", "Hozircha fikrlar mavjud emas.")}</p>`;
    return;
  }

  el.innerHTML = list.map(item => {
    const score = (Number(item.foodQuality || 0) + Number(item.serviceQuality || 0) + Number(item.atmosphere || 0)) / 3;
    const stars = "⭐".repeat(Math.round(score));

    const borderColor = score >= 4 ? "#10b981" : (score >= 3 ? "#f59e0b" : "#ef4444");
    const safeOrderId  = escapeHtml(String(item.orderId  || ''));
    const safeFeedbackId = escapeHtml(String(item.id || ''));

    return `
      <div class="feedback-card" style="background:#fff; border:1px solid #e5e7eb; border-left: 5px solid ${borderColor}; padding:15px; border-radius:12px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <h4 style="margin:0; font-size:16px;">
            ${item.visitCount !== null
              ? `${t("visit_count_label", "Mijoz")} <b>${item.visitCount}</b>-${t("visit_suffix", "chi tashrifi")}`
              : `${t("order_label", "Buyurtma")} #${escapeHtml(String(item.orderNumber || '—'))}`}
          </h4>
          <span style="font-size:14px;">${stars} (${score.toFixed(1)})</span>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:13px; color:#4b5563;">
          <p>🍽 ${t("table_label", "Stol")}: <b>${escapeHtml(String(item.table || item.tableNumber || '—'))}</b></p>
          <p>🧾 ${t("order_label", "Buyurtma")}: <b>#${escapeHtml(String(item.orderNumber || '—'))}</b></p>
          <p>🍲 ${t("food_quality", "Taom")}: <b>${Number(item.foodQuality || 0)}/5</b></p>
          <p>🧑‍🍳 ${t("service_quality", "Xizmat")}: <b>${Number(item.serviceQuality || 0)}/5</b></p>
          <p>🏠 ${t("atmosphere_quality", "Muhit")}: <b>${Number(item.atmosphere || 0)}/5</b></p>
        </div>

        ${item.comment ? `<p style="margin-top:10px; padding:8px; background:#f9fafb; border-radius:6px; font-style:italic;">"${escapeHtml(item.comment)}"</p>` : ''}
        
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <small style="color:#9ca3af;">🕒 ${escapeHtml(formatDateTime(item.createdAt))}</small>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${safeOrderId ? `
            <button onclick="rewardFromFeedback('${safeOrderId}', ${score}, '${safeFeedbackId}')" 
                    style="background:${score >= 4 ? '#10b981' : '#3b82f6'}; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px;">
              ${score >= 4 ? t("say_thank_you", "🎁 Poблагодарить") : t("apologize_discount", "🙏 Uzr so'rash (Chegirma)")}
            </button>` : `
            <span style="font-size:11px; color:#9ca3af; padding:6px 8px; background:#f3f4f6; border-radius:8px;">
              ${t("no_order_linked", "Buyurtma bog'lanmagan")}
            </span>`}
            ${safeFeedbackId ? `
            <button onclick="deleteFeedback('${safeFeedbackId}')"
                    style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px;">
              🗑 ${t("delete_label", "O'chirish")}
            </button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.filterFeedbacks = function filterFeedbacks() {
  const from = document.getElementById("feedbackDateFrom")?.value;
  const to = document.getElementById("feedbackDateTo")?.value;
  const table = normalizeText(document.getElementById("feedbackTableFilter")?.value || "");
  const scoreFilter = document.getElementById("feedbackScoreFilter")?.value || "all";

  const getScore = item =>
    (Number(item.foodQuality || 0) +
      Number(item.serviceQuality || 0) +
      Number(item.atmosphere || 0)) / 3;

  renderFeedbackList(
    feedbackState.list.filter(item => {
      const itemDate = item.createdAt ? new Date(item.createdAt) : null;

      if (from && itemDate && itemDate < new Date(from)) return false;

      if (to && itemDate) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }

      if (table && !normalizeText(item.table || item.tableNumber || "").includes(table)) {
        return false;
      }

      const score = getScore(item);

      if (scoreFilter === "5" && score < 5) return false;
      if (scoreFilter === "4" && score < 4) return false;
      if (scoreFilter === "3" && score < 3) return false;
      if (scoreFilter === "2" && score > 2.5) return false;

      return true;
    })
  );
};

window.deleteFeedback = async function (id) {
  if (!confirm(t("confirm_delete_feedback", "Haqiqatan ham ushbu fikrni o'chirmoqchimisiz?"))) return;

  try {
    await remove(ref(db, `${BASE_PATH}/feedback/${id}`));

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("delete", `🗑 ${t("feedback_deleted_log", "Fikr o'chirildi. ID:")} ${id}`);
    }

    showAdminNotification(t("feedback_deleted", "Fikr o'chirildi"));
    if (typeof loadFeedbacks === "function") loadFeedbacks();
  } catch (error) {
    console.error(t("error_log", "Xato:"), error);
  }
};

function getReadNotifications() {
  try { return JSON.parse(localStorage.getItem("foodify_admin_notifications_read") || "[]"); }
  catch { return []; }
}

function setReadNotifications(ids) {
  localStorage.setItem("foodify_admin_notifications_read", JSON.stringify(ids));
}

async function loadNotifications() {
  const el = document.getElementById("notificationsList");
  if (!el) return;
  const [ordersSnap, reservationsSnap, feedbackSnap] = await Promise.all([
    get(ref(db, BASE_PATH + "/orders")), get(ref(db, BASE_PATH + "/reservations")), get(ref(db, BASE_PATH + "/feedback"))
  ]);
  const orders = Object.entries(ordersSnap.val() || {});
  const reservations = Object.entries(reservationsSnap.val() || {});
  const feedback = Object.entries(feedbackSnap.val() || {});
  const now = Date.now();
  const list = [];

  orders.forEach(([id, order]) => {
    if (order.payment?.requested && !order.payment?.paid) {
      list.push({
        id: `payment_${id}`, type: "payment",
        text: `${t("notification_payment_request")} — ${t("table")} ${order.table}, ${formatMoney(order.total)}`,
        createdAt: getOrderTimestamp(order)
      });
    }
    const status = normalizeText(order.status || order.statusKey || "");
    const diffMin = (now - getOrderTimestamp(order)) / 60000;
    if ((status === "tayyorlanmoqda" || status === "cooking") && diffMin >= 20) {
      list.push({
        id: `delayed_${id}`, type: "delay",
        text: `${t("notification_delayed_order")} — #${order.orderNumber || id}, ${t("table")} ${order.table}`,
        createdAt: getOrderTimestamp(order)
      });
    }
    if (status === "tayyor" || status === "ready") {
      list.push({
        id: `ready_${id}`, type: "ready",
        text: `${t("notification_ready_order")} — #${order.orderNumber || id}, ${t("table")} ${order.table}`,
        createdAt: getOrderTimestamp(order)
      });
    }
  });

  reservations.forEach(([id, item]) => {
    if (item.status === "pending") {
      list.push({
        id: `reservation_${id}`, type: "reservation",
        text: `${t("notification_pending_reservation")} — ${item.guestName || t("guest_label")} (${item.date} ${item.time})`,
        createdAt: Number(item.createdAt || 0)
      });
    }
  });

  feedback.forEach(([id, item]) => {
    const score = (Number(item.foodQuality || 0) + Number(item.serviceQuality || 0) + Number(item.atmosphere || 0)) / 3;
    if (score <= 2.5) {
      list.push({
        id: `feedback_${id}`, type: "feedback",
        text: `${t("feedback_low_rating_alerts")} — ${t("table")} ${item.table || item.tableNumber || uiEmpty()} (${score.toFixed(1)})`,
        createdAt: Number(item.createdAt || 0)
      });
    }
  });

  notificationsState.list = list.sort((a, b) => b.createdAt - a.createdAt);
  renderNotifications();
}

function renderNotifications() {
  const el = document.getElementById("notificationsList");
  if (!el) return;
  const read = getReadNotifications();
  if (!notificationsState.list.length) {
    el.innerHTML = `<p>${t("notifications_empty")}</p>`;
    return;
  }
  el.innerHTML = notificationsState.list.map(item => `
      <div class="cash-card ${read.includes(item.id) ? "read-item" : ""}">
        <p><b>${escapeHtml(translateNotificationType(item.type))}</b></p>
        <p>${escapeHtml(item.text)}</p>
        <p>${escapeHtml(formatDateTime(item.createdAt))}</p>
        <button class="btn" onclick="markNotificationRead('${item.id}')">
          ${read.includes(item.id) ? t("notification_status_read") : t("mark_as_read_btn")}
        </button>
      </div>
    `).join("");
}

window.markNotificationRead = function (id) {
  const read = getReadNotifications();
  if (!read.includes(id)) { read.push(id); setReadNotifications(read); }
  renderNotifications();
};

const ROLE_TEMPLATES = {
  admin: ["dashboard", "orders", "menu", "tables", "staff", "customers", "report", "notifications", "roles", "audit_log", "settings"],
  manager: ["dashboard", "orders", "tables", "staff", "customers", "report", "notifications"],
  cashier: ["dashboard", "orders", "customers", "notifications"],
  waiter: ["dashboard", "orders", "tables", "customers", "reservations"],
  chef: ["dashboard", "orders", "notifications"],
  client: ["dashboard"]
};

const ALL_PERMISSIONS = [
  "dashboard",
  "orders",
  "menu",
  "tables",
  "staff",
  "customers",
  "report",
  "notifications",
  "roles",
  "audit_log",
  "settings",
  "reservations"
];

let currentRoleUserId = null;

async function loadRoles() {
  const statsEl = document.getElementById("rolesStats");
  const tableEl = document.getElementById("rolesUsersTable");
  const templatesEl = document.getElementById("rolesTemplates");
  const searchEl = document.getElementById("rolesSearch");

  if (!statsEl || !tableEl || !templatesEl) return;

  const snap = await get(ref(db, BASE_PATH + "/users"));
  const users = Object.entries(snap.val() || {}).map(([id, u]) => ({
    id,
    name: u.name || uiEmpty(),
    role: u.role || "waiter",
    active: u.active !== false,
    permissions: Array.isArray(u.permissions) ? u.permissions : (ROLE_TEMPLATES[u.role] || [])
  }));

  window.rolesLoadedUsers = users;

  renderRolesStats(users);
  renderRolesTemplates();
  renderRolesTable(users);

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", () => {
      const q = normalizeText(searchEl.value);
      const filtered = (window.rolesLoadedUsers || []).filter(u =>
        normalizeText(u.name).includes(q) ||
        normalizeText(u.role).includes(q)
      );
      renderRolesTable(filtered);
    });
  }
}

function startNotificationsAutoRefresh() {
  if (window.__notificationsInterval) clearInterval(window.__notificationsInterval);

  window.__notificationsInterval = setInterval(() => {
    const section = document.getElementById("notifications");
    if (section && section.style.display !== "none") {
      loadNotifications();
    }
  }, 5000);
}

function renderRolesStats(users) {
  const statsEl = document.getElementById("rolesStats");
  if (!statsEl) return;

  const total = users.length;
  const admins = users.filter(u => u.role === "admin").length;
  const active = users.filter(u => u.active).length;
  const custom = users.filter(u => Array.isArray(u.permissions) && u.permissions.length).length;

  statsEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><h4>${t("roles_total_users")}</h4><b>${total}</b></div>
        <div class="stat-card"><h4>${t("roles_admin_count")}</h4><b>${admins}</b></div>
        <div class="stat-card"><h4>${t("status_active")}</h4><b>${active}</b></div>
        <div class="stat-card"><h4>${t("roles_custom_permissions")}</h4><b>${custom}</b></div>
      </div>
    `;
}

function renderRolesTemplates() {
  const el = document.getElementById("rolesTemplates");
  if (!el) return;

  el.innerHTML = Object.entries(ROLE_TEMPLATES).map(([role, permissions]) => `
      <div class="cash-card">
        <h4>${t("role_" + role)}</h4>
        <p>${permissions.map(p => t("permission_" + p) || p).join(", ")}</p>
      </div>
    `).join("");
}

function renderRolesTable(users) {
  const tableEl = document.getElementById("rolesUsersTable");
  if (!tableEl) return;

  if (!users.length) {
    tableEl.innerHTML = `<tr><td colspan="5">${t("roles_empty")}</td></tr>`;
    return;
  }

  tableEl.innerHTML = users.map(user => `
      <tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${t("role_" + user.role)}</td>
        <td>${user.active ? t("status_active") : t("status_inactive")}</td>
        <td>${(user.permissions || []).map(p => t("permission_" + p) || p).join(", ")}</td>
        <td>
          <button class="btn" onclick="openRoleModal('${user.id}')">${t("view_btn")}</button>
        </td>
      </tr>
    `).join("");
}

// ==========================================
// 🔒 ROLLAR VA RUXSATLAR OYNASINI OCHISH
// ==========================================
window.openRoleModal = function (userId) {
  const modal = document.getElementById("roleModal");
  const body = document.getElementById("rolePermissionsGrid");
  const user = (window.rolesLoadedUsers || []).find(u => u.id === userId);

  if (!modal || !body || !user) return;

  if (user.role === "admin" && user.isSubAdmin !== true) {
    alert(t("super_admin_edit_error", "👑 Bu foydalanuvchi restoran asoschisi (Super Admin)!\nUning huquqlarini cheklash yoki o'zgartirish mumkin emas."));
    return;
  }

  currentRoleUserId = userId;
  const titleEl = document.getElementById("roleModalTitle");
  if (titleEl) titleEl.textContent = `${typeof t === 'function' ? t("role_detail_title") || "Rol" : "Rol"}: ${user.name}`;

  const nameInput = document.getElementById("roleUserName");
  if (nameInput) nameInput.value = user.name;

  const roleSelect = document.getElementById("roleUserRole");
  if (roleSelect) roleSelect.value = user.role;

  const permissions = user.permissions?.length ? user.permissions : (ROLE_TEMPLATES[user.role] || []);

  body.innerHTML = ALL_PERMISSIONS.map(permission => `
      <label class="permission-item">
        <input type="checkbox" class="role-permission-checkbox" value="${permission}" ${permissions.includes(permission) ? "checked" : ""}>
        <span>${typeof t === 'function' ? t("permission_" + permission) || permission : permission}</span>
      </label>
    `).join("");

  modal.classList.remove("hidden");
  modal.style.display = "flex";
};

window.closeRoleModal = function () {
  document.getElementById("roleModal")?.classList.add("hidden");
  currentRoleUserId = null;
};

window.saveRolePermissions = async function () {
  if (!currentRoleUserId) return;
  const myUserId = localStorage.getItem("userId") || localStorage.getItem("adminId") || "admin_1";

  try {
    const mySnap = await get(ref(db, `${BASE_PATH}/users/${myUserId}`));
    const myData = mySnap.val() || {};

    if (myData.isSubAdmin === true) {
      alert(t("insufficient_permissions", "❌ Huquq yetarli emas! Faqat Asosiy Restoran Admini ruxsatlarni o'zgartira oladi."));
      return;
    }

    const role = document.getElementById("roleUserRole")?.value;
    const checkboxes = document.querySelectorAll("#rolePermissionsGrid input[type='checkbox']:checked");
    const selectedPermissions = Array.from(checkboxes).map(el => el.value);
    const finalPermissions = selectedPermissions.length > 0 ? selectedPermissions : ["none"];

    const updates = {
      role: role,
      permissions: finalPermissions,
      isSubAdmin: role === "admin" ? true : null,
      updatedAt: Date.now()
    };

    if (currentRoleUserId === myUserId) {
      updates.permissions = [];
      updates.isSubAdmin = null;
    }

    await update(ref(db, `${BASE_PATH}/users/${currentRoleUserId}`), updates);

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("update", `🔐 ${t("log_permissions_updated", "{userId} uchun yangi ruxsatlar belgilandi.").replace("{userId}", currentRoleUserId)}`);
    }

    showAdminNotification(t("permissions_saved", "Ruxsatlar muvaffaqiyatli saqlandi!"));
    closeRoleModal();
    if (typeof loadRoles === "function") loadRoles();
  } catch (error) {
    console.error("Saqlashda xato:", error);
    alert(t("save_error", "Saqlashda xatolik yuz berdi!"));
  }
};

async function loadSettings() {
  const formEl = document.getElementById("settingsForm");
  if (!formEl) return;

  const [settingsSnap, infoSnap] = await Promise.all([
    get(ref(db, BASE_PATH + "/settings")),
    get(ref(db, BASE_PATH + "/info"))
  ]);

  const settings = settingsSnap.val() || {};
  const info = infoSnap.val() || {};
  const finalRestName = settings.restaurantName || info.name || "";

  formEl.innerHTML = `
    <div class="form-grid">
    <input id="restaurantName" type="text" placeholder="${t("settings_restaurant_name") || 'Restoran nomi'}" value="${escapeHtml(finalRestName)}">
    <input id="workingHours" type="text" placeholder="${t("placeholder_working_hours", "Ish vaqti (masalan: 09:00 - 20:00)")}" value="${escapeHtml(settings.workingHours || "")}">      
    <input id="contactPhone" type="text" placeholder="${t("contact_phone_placeholder") || 'Aloqa raqami (+998...)'}" value="${escapeHtml(settings.contactPhone || "")}">      
      
      <div class="settings-group" style="grid-column: 1 / -1; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
        <h4 style="margin-top:0; margin-bottom: 15px; color: #333;">⚡ ${t("fast_and_normal_order_title") || 'Tezkor va Oddiy buyurtma sozlamalari'}</h4>
        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <label style="font-size: 14px;">${t("fast_fee_percent") || 'Tezkor ustama (%)'}: <br><input id="fastFee" type="number" style="width:100px; margin-top:5px;" value="${Number(settings.fastFee || 5)}"></label>
            <label style="font-size: 14px;">${t("fast_minus_mins") || 'Tezkor vaqt (min)'}: <br><input id="fastMinusMins" type="number" style="width:100px; margin-top:5px;" value="${Number(settings.fastOrderMinusMinutes || 10)}"></label>
            <label style="font-size: 14px;">${t("normal_time_mins") || 'Oddiy vaqt (min)'}: <br><input id="normalTime" type="number" style="width:100px; margin-top:5px;" value="${Number(settings.normalOrderBaseTime || 30)}"></label>
            <label style="font-size: 14px;">${t("fast_min_amount") || 'Tezkor min. summa'}: <br><input id="fastMinAmount" type="number" style="width:100px; margin-top:5px;" value="${Number(settings.fastOrderMinAmount || 80000)}"></label>
        </div>
      </div>
      
      <label style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px;">
        <input id="notificationsEnabled" type="checkbox" ${settings.notificationsEnabled !== false ? "checked" : ""}>
        ${t("settings_notifications_enabled") || 'Ovozli xabarnomalarni yoqish'}
      </label>

      <div style="grid-column: 1 / -1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; color: #15803d; display:flex; align-items:center; gap:8px;">
          🖼️ ${t("restaurant_logo_title", "Restoran Logotipi")}
        </h4>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">
          ${t("logo_description", "Yuklangan logotip Chef va Ofitsiant sahifalarida ham header qismida ko'rinadi.")}
        </p>
        <div id="logoPreviewContainer" style="display:${settings.restaurantLogoUrl ? 'flex' : 'none'}; align-items:center; gap:12px; margin-bottom:12px; padding:10px; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">
          <img id="logoPreview" src="${settings.restaurantLogoUrl || ''}" alt="Logo" style="height:60px; width:60px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0;">
          <div>
            <div style="font-weight:600; font-size:13px; color:#15803d;">✅ ${t("logo_loaded", "Logotip yuklangan")}</div>
            <div style="font-size:12px; color:#64748b; margin-top:4px;">${t("logo_will_show", "Chef va Waiter sahifalarida ko'rinadi")}</div>
          </div>
        </div>

        <!-- File input -->
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <label style="display:inline-flex; align-items:center; gap:8px; background:#fff; border:2px dashed #86efac; border-radius:8px; padding:10px 16px; cursor:pointer; font-size:13px; color:#16a34a; font-weight:600; transition:0.2s;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
            📁 ${t("choose_logo_file", "Fayl tanlash")}
            <input type="file" id="logoFileInput" accept="image/*" style="display:none;">
          </label>
          <span id="logoFileName" style="font-size:13px; color:#64748b;">${t("file_not_selected", "Fayl tanlanmagan")}</span>
          <button id="uploadLogoBtn" onclick="window.uploadRestaurantLogo()" 
            style="background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; border:none; border-radius:8px; padding:10px 20px; font-weight:700; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            ⬆️ ${t("upload_logo_btn", "Logotipni yuklash")}
          </button>
        </div>
        <div id="logoUploadStatus" style="margin-top:8px; font-size:13px; min-height:20px;"></div>
      </div>
      
      <button class="btn primary" style="grid-column: 1 / -1; padding: 12px;" onclick="saveSettings()">${t("save_settings_btn") || 'Saqlash'}</button>
    </div>
  `;

  const logoFileInput = document.getElementById("logoFileInput");
  if (logoFileInput) {
    logoFileInput.addEventListener("change", () => {
      const fileNameEl = document.getElementById("logoFileName");
      if (fileNameEl) {
        fileNameEl.innerText = logoFileInput.files?.[0]?.name || t("file_not_selected", "Fayl tanlanmagan");
      }
    });
  }
  updateAdminFooter(settings.workingHours, settings.contactPhone);
}

/* =========================
   ADMIN SIDEBAR FOOTERNI YANGILASH
========================= */
function updateAdminFooter(hours, phone) {
  const wHours = hours || "09:00 – 22:00";
  const wPhone = phone || "+998 90 123 45 67";

  // Eski .support-footer tuzilmasi
  const adminFooter = document.querySelector('.support-footer');
  if (adminFooter) {
    adminFooter.innerHTML = `
      <div class="support-footer-item">
        <span>${t("support_working_hours", "Ish vaqti")}</span>
        <b>${wHours}</b>
      </div>
      <div class="support-footer-item">
        <span>${t("support_contact", "Aloqa")}</span>
        <b>${wPhone}</b>
      </div>
    `;
  }

  // Yangi .chef-footer tuzilmasi uchun maxsus elementlar
  const chefFooterWorkHours = document.getElementById("clientFooterWorkHours");
  const chefFooterPhone     = document.getElementById("clientFooterPhone");
  if (chefFooterWorkHours) chefFooterWorkHours.textContent = wHours;
  if (chefFooterPhone)     chefFooterPhone.textContent     = wPhone;
}

window.saveSettings = async function () {
  const restId = localStorage.getItem("restaurantId");

  // Mavjud logotip URL ni saqlab qolish
  let existingLogoUrl = "";
  try {
    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (database) {
      const existingSnap = await get(ref(database, `restaurants/${restId}/settings/restaurantLogoUrl`));
      if (existingSnap.exists()) {
        existingLogoUrl = existingSnap.val() || "";
      }
    }
  } catch (_) {}

  const data = {
    restaurantName: document.getElementById("restaurantName")?.value?.trim() || "",
    workingHours: document.getElementById("workingHours")?.value?.trim() || "",
    contactPhone: document.getElementById("contactPhone")?.value?.trim() || "",
    serviceFee: Number(document.getElementById("serviceFee")?.value || 0),
    fastFee: Number(document.getElementById("fastFee")?.value || 5),
    fastOrderMinusMinutes: Number(document.getElementById("fastMinusMins")?.value || 10),
    normalOrderBaseTime: Number(document.getElementById("normalTime")?.value || 30),
    fastOrderMinAmount: Number(document.getElementById("fastMinAmount")?.value || 80000),
    fastOrderActive: !!document.getElementById("fastOrderActive")?.checked,
    paymeLink: document.getElementById("paymeLink")?.value?.trim() || "",
    clickLink: document.getElementById("clickLink")?.value?.trim() || "",
    maxTable: Number(document.getElementById("maxTablesSettings")?.value || 0),
    defaultLanguage: document.getElementById("defaultLanguage")?.value || "uz",
    notificationsEnabled: !!document.getElementById("notificationsEnabled")?.checked,
    vipDefaults: {
      discountPct: Number(document.getElementById("vipDefaultPercent")?.value || 10),
      orderCount:  Number(document.getElementById("vipDefaultOrders")?.value  || 3)
    },
    updatedAt: Date.now()
  };

  // Logotip URL ni saqlab qolish (agar mavjud bo'lsa)
  if (existingLogoUrl) {
    data.restaurantLogoUrl = existingLogoUrl;
  }

  await update(ref(db, BASE_PATH + "/settings"), data);
  showAdminNotification(t("settings_saved_success") || "Sozlamalar saqlandi!");

  if (typeof updateAdminFooter === "function") {
    updateAdminFooter(data.workingHours, data.contactPhone);
  }

  // Admin header logotipini ham yangilash
  const finalLogoUrl = data.restaurantLogoUrl || existingLogoUrl;
  if (finalLogoUrl && typeof window.applyRestaurantLogo === "function") {
    window.applyRestaurantLogo(finalLogoUrl);
  }

  if (typeof loadRestaurantNameForHeader === "function") {
    loadRestaurantNameForHeader();
  }

  if (typeof window.logSystemAction === "function") {
    await window.logSystemAction("update", t("settings_updated_log", "⚙️ Restoran asosiy sozlamalari yangilandi."));
  }
};

async function loadTablesAdvanced() {
  try {
    const tablesRef = ref(db, `restaurants/${currentRestaurantId}/tables`);
    const snapshot = await get(tablesRef);

    const tablesData = snapshot.exists() ? snapshot.val() : null;
    renderTablesGrid(tablesData);
  } catch (error) {
    console.error(t("tables_load_error_log", "Stollarni yuklashda xato:"), error);
  }
}

let auditLoadedRows = [];

async function loadAuditLog() {
  const statsEl = document.getElementById("auditStats");
  const tableEl = document.getElementById("auditLogTableBody");
  const searchEl = document.getElementById("auditSearch");
  const moduleFilterEl = document.getElementById("auditModuleFilter");
  const severityFilterEl = document.getElementById("auditSeverityFilter");

  if (!statsEl || !tableEl) return;

  const recentLogsQuery = query(ref(db, BASE_PATH + "/activityLogs"), orderByChild("createdAt"), limitToLast(150));
  const snap = await get(recentLogsQuery);
  auditLoadedRows = Object.entries(snap.val() || {})
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  renderAuditStats(auditLoadedRows);
  renderAuditTable(auditLoadedRows);

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", filterAuditRows);
  }
  if (moduleFilterEl && !moduleFilterEl.dataset.bound) {
    moduleFilterEl.dataset.bound = "1";
    moduleFilterEl.addEventListener("change", filterAuditRows);
  }
  if (severityFilterEl && !severityFilterEl.dataset.bound) {
    severityFilterEl.dataset.bound = "1";
    severityFilterEl.addEventListener("change", filterAuditRows);
  }
}

function renderAuditStats(rows) {
  const statsEl = document.getElementById("auditStats");
  if (!statsEl) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const total = rows.length;
  const today = rows.filter(r => Number(r.createdAt || 0) >= todayStart.getTime()).length;
  const critical = rows.filter(r => r.severity === "critical").length;
  const users = new Set(rows.map(r => r.userId || r.userName)).size;

  statsEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><h4>${t("audit_total_logs")}</h4><b>${total}</b></div>
        <div class="stat-card"><h4>${t("audit_today_logs")}</h4><b>${today}</b></div>
        <div class="stat-card"><h4>${t("audit_critical_logs")}</h4><b>${critical}</b></div>
        <div class="stat-card"><h4>${t("audit_unique_users")}</h4><b>${users}</b></div>
      </div>
    `;
}

function renderAuditTable(rows) {
  const tableEl = document.getElementById("auditLogTableBody");
  if (!tableEl) return;

  if (!rows.length) {
    tableEl.innerHTML = `<tr><td colspan="7">${t("audit_empty")}</td></tr>`;
    return;
  }

  // action bo'yicha module va target ni aniqlash yordamchisi
  function resolveModule(row) {
    if (row.module) return translateAuditModule(row.module);
    const act = normalizeText(row.action || "").replace(/\s+/g, "_");
    if (act.includes("order")) return t("audit_module_orders", "Buyurtmalar");
    if (act.includes("table")) return t("audit_module_tables", "Stollar");
    if (act.includes("menu"))  return t("audit_module_menu",   "Menyu");
    if (act.includes("staff")) return t("audit_module_staff",  "Xodimlar");
    return t("audit_module_system", "Tizim");
  }

  function resolveTarget(row) {
    if (row.target) return translateAuditTarget(row.target);
    const act = normalizeText(row.action || "").replace(/\s+/g, "_");
    if (act === "order_overdue_alert") return t("audit_target_order", "Buyurtma");
    return uiEmpty();
  }

  function resolveUser(row) {
    if (row.userName) return translateAuditUserName(row.userName);
    const act = normalizeText(row.action || "").replace(/\s+/g, "_");
    if (act === "order_overdue_alert") return t("audit_system_label", "Tizim (avto)");
    return uiEmpty();
  }

  tableEl.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
      <td>${escapeHtml(resolveUser(row))}</td>
      <td>${escapeHtml(resolveModule(row))}</td>
      <td>${escapeHtml(translateAuditAction(row.action || uiEmpty()))}</td>
      <td>${escapeHtml(resolveTarget(row))}</td>
      <td>${escapeHtml(translateAuditSeverity(row.severity || "info"))}</td>
      <td>
        <button class="btn" onclick="openAuditModal('${row.id}')">${t("view_btn")}</button>
      </td>
    </tr>
  `).join("");
}

window.filterAuditRows = function () {
  const q = normalizeText(document.getElementById("auditSearch")?.value || "");
  const moduleValue = document.getElementById("auditModuleFilter")?.value || "all";
  const severityValue = document.getElementById("auditSeverityFilter")?.value || "all";

  const filtered = auditLoadedRows.filter(row => {
    const matchesSearch =
      normalizeText(row.userName).includes(q) ||
      normalizeText(row.module).includes(q) ||
      normalizeText(row.action).includes(q) ||
      normalizeText(row.target).includes(q);

    const matchesModule = moduleValue === "all" || row.module === moduleValue;
    const matchesSeverity = severityValue === "all" || row.severity === severityValue;

    return matchesSearch && matchesModule && matchesSeverity;
  });

  renderAuditTable(filtered);
};

window.openAuditModal = function (id) {
  const row = auditLoadedRows.find(r => r.id === id);
  const modal = document.getElementById("auditModal");
  const body = document.getElementById("auditModalBody");
  if (!modal || !body || !row) return;

  // action bo'yicha module/target/user ni aniqlash
  const act = normalizeText(row.action || "").replace(/\s+/g, "_");
  const isOverdue = act === "order_overdue_alert";

  const displayModule = row.module
    ? translateAuditModule(row.module)
    : (isOverdue ? t("audit_module_orders", "Buyurtmalar") : t("audit_module_system", "Tizim"));

  const displayTarget = row.target
    ? row.target
    : (isOverdue ? t("audit_target_order", "Buyurtma") : uiEmpty());

  const displayUser = row.userName
    ? row.userName
    : (isOverdue ? t("audit_system_label", "Tizim (avto)") : uiEmpty());

  document.getElementById("auditModalTitle").textContent =
    `${t("audit_detail_title")}: ${displayTarget || id}`;

  body.innerHTML = `
      <p><b>${t("date_label")}:</b> ${escapeHtml(formatDateTime(row.createdAt))}</p>
      <p><b>${t("user_name_label")}:</b> ${escapeHtml(displayUser)}</p>
      <p><b>${t("audit_module")}:</b> ${escapeHtml(displayModule)}</p>
      <p><b>${t("audit_action")}:</b> ${escapeHtml(translateAuditAction(row.action || uiEmpty()))}</p>
      <p><b>${t("audit_target")}:</b> ${escapeHtml(displayTarget)}</p>
      <p><b>${t("audit_severity")}:</b> ${escapeHtml(translateAuditSeverity(row.severity || uiEmpty()))}</p>
      <p><b>${t("audit_description")}:</b> ${escapeHtml(translateAuditDescription(row.description || uiEmpty()))}</p>
      <pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(row.payload || {}, null, 2))}</pre>
    `;

  modal.classList.remove("hidden");
};

window.closeAuditModal = function () {
  document.getElementById("auditModal")?.classList.add("hidden");
};

const currentRestaurantDomain = "nestcafe.nestacrm.uz";

function listenTables() {
  const tablesRef = ref(db, `restaurants/${currentRestaurantId}/tables`);
  onValue(tablesRef, (snapshot) => {
    const tables = snapshot.val() || {};
    window.allTables = tables;
    renderTablesGrid(tables);

    // Dashboard stol statistikasini yangilash
    let busyCount = 0, freeCount = 0;
    Object.values(tables).forEach(table => {
      const st = String(table.status || "free").toLowerCase();
      if (st === "free") freeCount++;
      else busyCount++;
    });
    const busyEl = document.getElementById("busyTablesCount");
    const freeEl = document.getElementById("freeTablesCount");
    if (busyEl) busyEl.innerText = busyCount;
    if (freeEl) freeEl.innerText = freeCount;
  });
}

async function renderTablesGrid(tables) {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;

  if (!tables || Object.keys(tables).length === 0) {
    grid.innerHTML = `<div style="text-align:center; padding:40px; color:#94a3b8; grid-column: 1/-1;">${t("no_tables_created", "Hozircha stollar yaratilmagan...")}</div>`;
    return;
  }

  grid.innerHTML = "";

  const _netOrigin = await getNetworkOrigin();

  const entries = Object.entries(tables).sort((a, b) => a[1].number - b[1].number);
  for (const [key, table] of entries) {

    const rawId = table.id || key || "";
    const tableDisplayNum = table.number || String(rawId).replace('table_', '');

    const _status    = table.status || "free";
    const _isFree     = _status === "free";
    const _isCleaning = _status === "cleaning" || _status === "tozalanmoqda" || _status === "needs_cleaning";

    const _statusClass = _isFree ? "status-free" : _isCleaning ? "status-cleaning" : "status-busy";
    const _statusLabel = _isFree
      ? (typeof t === "function" ? t("table_status_free", "Bo'sh") : "Bo'sh")
      : _isCleaning
        ? (typeof t === "function" ? t("table_status_cleaning", "Tozalanmoqda") : "Tozalanmoqda")
        : (typeof t === "function" ? t("table_status_busy", "Band") : "Band");
    const _statusIcon  = _isFree ? "🟢" : _isCleaning ? "🧹" : "🔴";

    const clientUrl =
      `${_netOrigin}/client.html` +
      `?rest=${currentRestaurantId}` +
      `&tableId=${key}` +
      `&tableNo=${tableDisplayNum}`;

    const card = document.createElement('div');
    card.className = "table-card";
    if (_isCleaning) card.style.cssText = "border:2px solid #0ea5e9;background:#f0f9ff;";
    card.innerHTML = `
            <div class="table-card-header">
                <div class="table-title">
                    <i class="fa-solid fa-couch"></i>
                    <h3>${t("table", "Stol")} №${tableDisplayNum}</h3>
                </div>
                <span class="status-badge ${_statusClass}" style="${_isCleaning ? 'background:#0ea5e9;color:#fff;' : ''}">
                    ${_statusIcon} ${_statusLabel}
                </span>
            </div>
            
            <div class="table-card-actions">
                <a href="${clientUrl}" target="_blank" class="action-btn btn-client">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span data-i18n="go_to_client">Mijoz sahifasi</span>
                </a>

                <button class="action-btn btn-qr" onclick="window.downloadSingleQR('${clientUrl}', ${tableDisplayNum})">
                    <i class="fa-solid fa-qrcode"></i>
                    <span data-i18n="download_qr">QR Yuklash</span>
                </button>
            </div>
            <button class="btn-qr-single" onclick="window.downloadSingleQR('${clientUrl}', ${tableDisplayNum})">
        <i class="fa-solid fa-qrcode"></i> QR PNG
    </button>
        `;
    grid.appendChild(card);
  }

  if (typeof applyLang === "function") applyLang();
}

async function generateQRImage(tableNum, url) {
  const restName = window.currentGlobalRestName || "NestaCRM";
  const container = document.getElementById("qrPrintContainer"); // HTMLdagi yashirin div

  container.innerHTML = `
        <div class="qr-card-template" id="temp-qr-card">
            <h2>${t("table", "Stol")} ${tableNum}</h2>
            <p>${t("sa_default_rest_name", "Restoran")} | ${restName}</p>
            <div id="qr-code-space" style="display: flex; justify-content: center;"></div>
            <div class="qr-footer-text">${t("qr_scan_to_order", "Buyurtma berish uchun skanerlang")}</div>
        </div>
    `;

  new QRCode(document.getElementById("qr-code-space"), {
    text: url,
    width: 250,
    height: 250,
    correctLevel: QRCode.CorrectLevel.H
  });

  await new Promise(r => setTimeout(r, 200));
  const canvas = await html2canvas(document.getElementById("temp-qr-card"), { scale: 2 });
  return canvas.toDataURL("image/png");
}

async function generateQRBaseImage(tableNum, url) {
  const printContainer = document.getElementById("qrPrintContainer");
  if (!printContainer) return null;

  printContainer.innerHTML = "";
  printContainer.style.display = "block";
  printContainer.style.position = "fixed";
  printContainer.style.left = "-9999px";

  printContainer.innerHTML = `
        <div id="qr-capture-area" style="width: 450px; padding: 60px; background: white; text-align: center; border: 5px dashed #d1d5db; border-radius: 40px; font-family: 'Inter', sans-serif;">
            <h2 style="margin: 0 0 35px 0; font-size: 48px; color: #111827; font-weight: 900;">
              Nesta | ${tableNum}
            </h2>
            <div id="qr-target-${tableNum}" style="display: flex; justify-content: center; margin-bottom: 30px;"></div>
            <div style="font-size: 18px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">
              ${t("scan_and_order", "Skanerlang va buyurtma bering")}
            </div>
        </div>
    `;

  new QRCode(document.getElementById(`qr-target-${tableNum}`), {
    text: url,
    width: 320,
    height: 320,
    correctLevel: QRCode.CorrectLevel.H
  });

  await new Promise(r => setTimeout(r, 500));

  const canvas = await html2canvas(document.getElementById("qr-capture-area"), {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false
  });

  printContainer.style.display = "none";
  return canvas.toDataURL("image/png");
}

// ==========================================
// 📄 BARCHA STOLLAR UCHUN PDF QR YARATISH
// ==========================================
window.downloadAllTablesQR = async function () {
  const maxInput = document.getElementById("maxTablesInput") || document.getElementById("tablesCountInput");
  const maxTables = parseInt(maxInput?.value);
  const restId = localStorage.getItem("restaurantId");
  let restName = window.currentGlobalRestName || "Nesta";

  if (!maxTables || maxTables <= 0) {
    alert(typeof t === "function" ? t("a_qr_enter_max", "Avval stollar sonini kiriting!") : "Avval stollar sonini kiriting!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  alert(typeof t === "function" ? t("a_qr_generating", "PDF shakllanmoqda, iltimos kuting...") : "PDF shakllanmoqda, iltimos kuting...");

  for (let i = 1; i <= maxTables; i++) {
    if (i > 1) pdf.addPage();

    const _netOrigin = await getNetworkOrigin();
    const tableUrl = `${_netOrigin}/client.html?rest=${restId}&table=${i}`;

    try {
      const imageData = await generateQRBaseImage(i, tableUrl);

      if (imageData) {
        pdf.addImage(imageData, 'PNG', 15, 40, pdfWidth - 30, 0);

        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`Nesta | ${restName} | ${t("table", "Stol")} ${i}`, pdfWidth / 2, pdfHeight - 10, { align: "center" });
      }
    } catch (err) {
      console.error(`${i}-stol QR yaratishda xato:`, err);
    }
  }

  pdf.save(`NestaCRM_QR_Stollar_${restName.replace(/\s+/g, '_')}.pdf`);

  if (typeof window.logSystemAction === "function") {
    await window.logSystemAction("system", t("all_tables_qr_downloaded_log", "📄 Barcha ({maxTables} ta) stollar uchun PDF QR yuklab olindi.").replace("{maxTables}", maxTables));
  }
};

async function fetchCurrentRestaurantData() {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return null;

  const snap = await get(ref(db, `restaurants/${restId}/settings`));
  return snap.exists() ? snap.val() : {};
}

function getBusyTablesIds(orders) {
  if (!orders) return [];
  const busyIds = [];
  Object.values(orders).forEach(order => {
    if (order.status !== "paid" && order.table) {
      const tableNum = String(order.table).replace(/\D/g, '');
      if (tableNum && !busyIds.includes(tableNum)) {
        busyIds.push(tableNum);
      }
    }
  });
  return busyIds;
}

window.openTableDetail = function (tableNo) {
  const modal = document.getElementById("tableDetailModal");
  if (!modal) return;
  const table = tablesAdvancedState.tables?.[tableNo] || {};
  const activeOrder = Object.values(tablesAdvancedState.orders || {}).find(
    o => String(o.table) === String(tableNo) && !o.tableClosed
  );
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${t("table")} ${escapeHtml(String(tableNo))}</h3>
      <p>${t("status_label")}: <b>${escapeHtml(translateStatus(table.status || "free"))}</b></p>
      <p>${t("zone_label")}: <b>${escapeHtml(translateZone(String(table.zone || "main")))}</b></p>
      <p>${t("capacity_label")}: <b>${escapeHtml(String(table.capacity || uiEmpty()))}</b></p>
      <p>${t("service_status_label")}: <b>${escapeHtml(translatePulse(String(table.servicePulse || table.mood || "green")))}</b></p>
      <p>${t("busy_label")}: <b>${table.busy ? t("yes_label") : t("no_label")}</b></p>
      <h4>${t("lifecycle_title")}</h4>
      <div class="modal-actions">
        <button class="btn" onclick="updateTableLifecycle('${tableNo}','reserved')">${t("reserve_btn")}</button>
        <button class="btn" onclick="updateTableLifecycle('${tableNo}','seated')">${t("seated_btn")}</button>
        <button class="btn" onclick="updateTableLifecycle('${tableNo}','billing')">${t("request_bill_btn")}</button>
        <button class="btn" onclick="updateTableLifecycle('${tableNo}','cleaning')">${t("start_cleaning_btn")}</button>
        <button class="btn danger" onclick="updateTableLifecycle('${tableNo}','free')">${t("mark_free_btn")}</button>
      </div>
      <h4>${t("active_order_label")}</h4>
      ${activeOrder
      ? `<div class="cash-card">
          <p>${t("order_label")}: <b>#${escapeHtml(String(activeOrder.orderNumber || uiEmpty()))}</b></p>
          <p>${t("total_label")}: <b>${formatMoney(activeOrder.total || 0)}</b></p>
          <p>${t("status_label")}: <b>${escapeHtml(translateStatus(activeOrder.statusLabel || activeOrder.status || uiEmpty()))}</b></p>
        </div>`
      : `<p>${t("no_active_order")}</p>`}
      <div class="modal-actions">
        <button class="btn" onclick="
  document.getElementById('tableDetailModal').classList.add('hidden');
  document.getElementById('tableDetailModal').style.display='none';
  ">${t("close_btn")}</button>
      </div>
    </div>
  `;
};

window.updateTableLifecycle = async function (tableNo, status) {
  window.logSystemAction("update", `${tableNo}-${t("table_freed_manually", "stol qo'lda bo'shatildi.")}`);
  const restId = localStorage.getItem("restaurantId");
  const isBusy = !["free", "cleaning"].includes(status);

  const updates = {
    status: status,
    busy: isBusy,
    updatedAt: Date.now()
  };

  if (status === "free") {
    updates.orderId = null;
    updates.closedByAdmin = true;

    if (reservationState && reservationState.list) {
      const activeRes = reservationState.list.find(r =>
        String(r.tableNumber) === String(tableNo) && r.status === "seated"
      );
      if (activeRes) {
        await update(ref(db, `restaurants/${restId}/reservations/${activeRes.id}`), {
          status: "completed",
          updatedAt: Date.now()
        });
      }
    }
  }

  await update(ref(db, `restaurants/${restId}/tables/${tableNo}`), updates);
  showAdminNotification(t("table_status_updated", "Stol {tableNo} holati: {status}").replace("{tableNo}", tableNo).replace("{status}", status));

  if (typeof loadTablesAdvanced === "function") loadTablesAdvanced();
  if (typeof loadReservations === "function") loadReservations();
};

window.crmAdvancedState = {
  segments: null,
  campaigns: [],
  complaints: [],
  notes: {}
};

function crmAdvSafeKey(value = "") {
  return encodeURIComponent(String(value || "unknown"));
}

function crmAdvNow() {
  return Date.now();
}

function crmAdvNotify(text, type = "success") {
  if (typeof showAdminNotification === "function") {
    showAdminNotification(text, type);
  } else {
    console.log(text);
  }
}

function crmAdvActor() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    return {
      id: currentUser.id || "admin_local",
      name: currentUser.name || t("admin"),
      role: currentUser.role || localStorage.getItem("role") || "admin"
    };
  } catch {
    return {
      id: "admin_local",
      name: t("admin"),
      role: localStorage.getItem("role") || "admin"
    };
  }
}

async function crmAdvAudit(
  module,
  action,
  target,
  description,
  payload = {},
  severity = "info"
) {
  await push(ref(db, BASE_PATH + "/activityLogs"), {
    userId: crmAdvActor().id,
    userName: crmAdvActor().name,
    userRole: crmAdvActor().role,
    module,
    action,
    target,
    severity,
    description,
    payload,
    createdAt: crmAdvNow()
  });
}

function crmAdvFindCustomer(customerId) {
  const list = crmState?.customers || [];
  return list.find(c => String(c.id) === String(customerId)) || null;
}

function crmAdvOrderCustomerId(order = {}) {
  return order.customerId || order.customerPhone || order.phone || `table_${order.table || "unknown"}`;
}

function crmAdvOrderCustomerName(order = {}) {
  return order.customerName || order.clientName || order.name || `${t("table")} ${order.table || uiEmpty()}`;
}

function crmAdvOrderCustomerPhone(order = {}) {
  return order.customerPhone || order.phone || "";
}

async function crmAdvEnsureOrder(orderId) {
  const snap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
  return snap.exists() ? snap.val() : null;
}

/* ==============================
  CUSTOMER NOTES
============================== */
window.saveCustomerNote = async function saveCustomerNote(customerId, note, meta = {}) {
  const cleanNote = String(note || "").trim();

  if (!customerId || !cleanNote) {
    alert(t("customer_note_required"));
    return null;
  }

  const customer = crmAdvFindCustomer(customerId);
  const customerKey = crmAdvSafeKey(customerId);
  const noteRef = push(ref(db, `${BASE_PATH}/customerNotes/${customerKey}`));

  const payload = {
    customerId,
    customerName: customer?.name || meta.customerName || t("unknown_label"),
    customerPhone: customer?.phone || meta.customerPhone || "",
    note: cleanNote,
    tags: meta.tags || [],
    pinned: !!meta.pinned,
    source: meta.source || "admin",
    createdAt: crmAdvNow(),
    createdBy: crmAdvActor().id,
    createdByName: crmAdvActor().name
  };

  await set(noteRef, payload);

  if (meta.orderId) {
    await window.createOrderTimelineEvent(meta.orderId, "customer_note_added", {
      customerId,
      note: cleanNote,
      noteId: noteRef.key
    });
  }

  await crmAdvAudit(
    "customers",
    "note_add",
    customerId,
    t("audit_customer_note_saved"),
    { noteId: noteRef.key, ...payload },
    "info"
  );

  crmAdvNotify(t("customer_note_saved"));
  return noteRef.key;
};

/* ==============================
  CUSTOMER SEGMENTS
============================== */
window.buildCustomerSegments = async function buildCustomerSegments(options = {}) {
  const defaults = {
    vipSpent: 1500000,
    goldSpent: 800000,
    silverSpent: 300000,
    loyalVisits: 5,
    atRiskDays: 30,
    newCustomerDays: 7,
    couponUsersMin: 1,
    cashbackMin: 50000
  };

  const cfg = { ...defaults, ...options };
  let customers = crmState?.customers || [];

  if (!customers.length) {
    const [ordersSnap, customersSnap, usersSnap] = await Promise.all([
      get(ref(db, BASE_PATH + "/orders")),
      get(ref(db, BASE_PATH + "/customers")),
      get(ref(db, BASE_PATH + "/users"))
    ]);

    const orders = ordersSnap.val() || {};
    const customerProfiles = customersSnap.val() || {};
    const users = usersSnap.val() || {};

    if (typeof buildCustomerMapFromOrders === "function") {
      customers = buildCustomerMapFromOrders(orders, customerProfiles, users);
    } else {
      customers = [];
    }
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const segments = {
    vip: [],
    gold: [],
    silver: [],
    loyal: [],
    atRisk: [],
    newCustomers: [],
    couponUsers: [],
    cashbackHeavy: [],
    highValueLowVisit: []
  };

  customers.forEach(customer => {
    const spent = Number(customer.totalSpent || customer.spent || 0);
    const visits = Number(customer.visits || 0);
    const cashback = Number(customer.cashbackBalance || customer.cashback || 0);
    const promoCount = Array.isArray(customer.promoCodesUsed)
      ? customer.promoCodesUsed.length
      : 0;

    const lastVisit = Number(customer.lastVisit || 0);
    const daysSinceLastVisit = lastVisit
      ? Math.floor((now - lastVisit) / dayMs)
      : 9999;

    if (spent >= cfg.vipSpent || customer.loyalty === "vip") {
      segments.vip.push(customer);
    } else if (spent >= cfg.goldSpent || customer.loyalty === "gold") {
      segments.gold.push(customer);
    } else if (spent >= cfg.silverSpent || customer.loyalty === "silver") {
      segments.silver.push(customer);
    }

    if (visits >= cfg.loyalVisits) segments.loyal.push(customer);
    if (visits > 0 && daysSinceLastVisit >= cfg.atRiskDays) segments.atRisk.push(customer);
    if (visits <= 2 && daysSinceLastVisit <= cfg.newCustomerDays) segments.newCustomers.push(customer);
    if (promoCount >= cfg.couponUsersMin) segments.couponUsers.push(customer);
    if (cashback >= cfg.cashbackMin) segments.cashbackHeavy.push(customer);
    if (spent >= cfg.goldSpent && visits <= 2) segments.highValueLowVisit.push(customer);
  });

  const summary = Object.fromEntries(
    Object.entries(segments).map(([key, list]) => [key, list.length])
  );

  const result = {
    builtAt: crmAdvNow(),
    config: cfg,
    summary,
    segments: Object.fromEntries(
      Object.entries(segments).map(([key, list]) => [
        key,
        list.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          visits: Number(c.visits || 0),
          totalSpent: Number(c.totalSpent || c.spent || 0),
          cashbackBalance: Number(c.cashbackBalance || c.cashback || 0),
          loyalty: c.loyalty || c.level || "bronze",
          lastVisit: Number(c.lastVisit || 0)
        }))
      ])
    )
  };

  await set(ref(db, BASE_PATH + "/customerSegments/generated"), result);
  window.crmAdvancedState.segments = result;

  await crmAdvAudit(
    "customers",
    "segment_build",
    "customerSegments/generated",
    t("audit_customer_segments_rebuilt"),
    { summary, config: cfg },
    "info"
  );

  crmAdvNotify(t("customer_segments_built"));
  return result;
};

/* ==============================
  CAMPAIGNS
============================== */
window.createCampaign = async function createCampaign(payload = {}) {
  const name = String(payload.name || "").trim();

  if (!name) {
    alert(t("campaign_name_required"));
    return null;
  }

  const segmentKey = payload.segmentKey || "all";
  let segmentSnapshot = window.crmAdvancedState.segments;

  if (!segmentSnapshot && segmentKey !== "all") {
    segmentSnapshot = await window.buildCustomerSegments();
  }

  const recipientsCount = segmentKey === "all"
    ? (crmState?.customers || []).length
    : (segmentSnapshot?.segments?.[segmentKey]?.length || 0);

  const campaignRef = push(ref(db, BASE_PATH + "/campaigns"));

  const campaignData = {
    name,
    type: payload.type || "coupon",
    segmentKey,
    message: payload.message || "",
    couponCode: payload.couponCode || "",
    discountType: payload.discountType || "fixed",
    discountValue: Number(payload.discountValue || 0),
    startsAt: payload.startsAt || "",
    endsAt: payload.endsAt || "",
    status: payload.status || "draft",
    recipientsCount,
    redeemedCount: 0,
    createdAt: crmAdvNow(),
    createdBy: crmAdvActor().id,
    createdByName: crmAdvActor().name
  };

  await set(campaignRef, campaignData);

  if (campaignData.couponCode) {
    await set(ref(db, `${BASE_PATH}/coupons/${crmAdvSafeKey(campaignData.couponCode)}`), {
      campaignId: campaignRef.key,
      code: campaignData.couponCode,
      discountType: campaignData.discountType,
      discountValue: campaignData.discountValue,
      status: campaignData.status,
      startsAt: campaignData.startsAt,
      endsAt: campaignData.endsAt,
      createdAt: crmAdvNow()
    });
  }

  await crmAdvAudit(
    "marketing",
    "campaign_create",
    campaignRef.key,
    t("audit_campaign_created"),
    campaignData,
    "info"
  );

  crmAdvNotify(t("campaign_created_success"));
  return campaignRef.key;
};

/* ==============================
  COUPON REDEMPTION
============================== */
window.trackCouponRedemption = async function ({
  customerId = "",
  couponCode = "",
  campaignId = "",
  orderId = "",
  amount = 0,
  discountAmount = 0,
  tableNumber = ""
} = {}) {
  const cleanCoupon = String(couponCode || "").trim();

  if (!cleanCoupon) {
    alert(t("coupon_code_required"));
    return null;
  }

  const actor = crmAdvActor();
  const redemptionRef = push(ref(db, BASE_PATH + "/couponRedemptions"));

  const payload = {
    customerId: customerId || "",
    couponCode: cleanCoupon,
    campaignId: campaignId || "",
    orderId: orderId || "",
    amount: Number(amount || 0),
    discountAmount: Number(discountAmount || 0),
    tableNumber: tableNumber || "",
    redeemedAt: crmAdvNow(),
    redeemedBy: actor.id,
    redeemedByName: actor.name
  };

  await set(redemptionRef, payload);

  if (campaignId) {
    const campaignSnap = await get(ref(db, `${BASE_PATH}/campaigns/${campaignId}`));
    if (campaignSnap.exists()) {
      const current = campaignSnap.val() || {};
      await update(ref(db, `${BASE_PATH}/campaigns/${campaignId}`), {
        redeemedCount: Number(current.redeemedCount || 0) + 1,
        updatedAt: crmAdvNow()
      });
    }
  }

  if (customerId) {
    const customerKey = crmAdvSafeKey(customerId);
    const customerPromoRef = push(ref(db, `${BASE_PATH}/customerCouponHistory/${customerKey}`));
    await set(customerPromoRef, payload);
  }

  if (orderId) {
    await window.createOrderTimelineEvent(orderId, "coupon_redeemed", {
      couponCode: cleanCoupon,
      campaignId,
      discountAmount: Number(discountAmount || 0)
    });
  }

  await crmAdvAudit(
    "marketing",
    "coupon_redeem",
    cleanCoupon,
    t("audit_coupon_redeemed"),
    payload,
    "info"
  );

  crmAdvNotify(t("coupon_redemption_tracked"));
  return redemptionRef.key;
};

/* ==============================
  COMPLAINTS
============================== */
window.createComplaintTicket = async function ({
  feedbackId = "",
  orderId = "",
  tableNumber = "",
  customerId = "",
  title = "",
  description = "",
  priority = "medium",
  source = "feedback"
} = {}) {
  const finalTitle = String(title || "").trim() || t("default_complaint_title");
  const finalDescription = String(description || "").trim() || t("no_description_label");
  const actor = crmAdvActor();
  const complaintRef = push(ref(db, BASE_PATH + "/complaints"));

  const payload = {
    feedbackId: feedbackId || "",
    orderId: orderId || "",
    tableNumber: tableNumber || "",
    customerId: customerId || "",
    title: finalTitle,
    description: finalDescription,
    priority,
    source,
    status: "new",
    ownerId: "",
    ownerName: "",
    resolutionNote: "",
    createdAt: crmAdvNow(),
    createdBy: actor.id,
    createdByName: actor.name
  };

  await set(complaintRef, payload);

  if (feedbackId) {
    await update(ref(db, `${BASE_PATH}/feedback/${feedbackId}`), {
      complaintId: complaintRef.key,
      complaintStatus: "new"
    });
  }

  if (orderId) {
    await window.createOrderTimelineEvent(orderId, "complaint_created", {
      complaintId: complaintRef.key,
      priority,
      title: finalTitle
    });
  }

  await crmAdvAudit(
    "complaints",
    "create",
    complaintRef.key,
    t("audit_complaint_created"),
    payload,
    "warning"
  );

  crmAdvNotify(t("complaint_created_success"), "warning");
  return complaintRef.key;
};

/* ==============================
  COMPLAINT OWNER ASSIGN
============================== */
window.assignComplaintOwner = async function (complaintId, staffId) {
  if (!complaintId || !staffId) {
    alert(t("complaint_id_staff_id_required"));
    return;
  }

  const userSnap = await get(ref(db, `${BASE_PATH}/users/${staffId}`));

  if (!userSnap.exists()) {
    alert(t("staff_not_found"));
    return;
  }

  const user = userSnap.val() || {};

  const updates = {
    ownerId: staffId,
    ownerName: user.name || "",
    status: "in_progress",
    assignedAt: crmAdvNow(),
    updatedAt: crmAdvNow()
  };

  await update(ref(db, `${BASE_PATH}/complaints/${complaintId}`), updates);

  const complaintSnap = await get(ref(db, `${BASE_PATH}/complaints/${complaintId}`));
  const complaint = complaintSnap.exists() ? complaintSnap.val() : null;

  if (complaint?.orderId) {
    await window.createOrderTimelineEvent(complaint.orderId, "complaint_owner_assigned", {
      complaintId,
      ownerId: staffId,
      ownerName: user.name || ""
    });
  }

  await crmAdvAudit(
    "complaints",
    "assign_owner",
    complaintId,
    t("audit_complaint_owner_assigned"),
    { ownerId: staffId, ownerName: user.name || "" },
    "info"
  );

  crmAdvNotify(t("complaint_owner_assigned"));
};

/* ==============================
  ORDER TIMELINE
============================== */
window.createOrderTimelineEvent = async function createOrderTimelineEvent(
  orderId,
  eventType,
  payload = {}
) {
  if (!orderId || !eventType) return null;

  const eventRef = push(ref(db, `${BASE_PATH}/orderTimeline/${orderId}`));

  const data = {
    orderId,
    eventType,
    payload,
    actorId: crmAdvActor().id,
    actorName: crmAdvActor().name,
    actorRole: crmAdvActor().role,
    createdAt: crmAdvNow()
  };

  await set(eventRef, data);

  try {
    await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
      lastTimelineEventAt: crmAdvNow(),
      lastTimelineEventType: eventType
    });
  } catch (e) {
    console.warn(t("timeline_order_update_skipped_log"), e);
  }

  return eventRef.key;
};

window.addToStopList = async function (productId, productName) {
  await update(ref(db, `${BASE_PATH}/stopList/${productId}`), {
    name: productName,
    active: true,
    addedAt: Date.now(),
    addedBy: "chef"
  });

  if (typeof window.logChefAction === "function") {
    await window.logChefAction(`"${productName}" taomi tugadi deb belgilandi (Stop-listga qo'shildi).`);
  }

  showToast(t("stop_list_added").replace("{name}", productName), "warning");
};

window.removeFromStopList = async function (productId, productName) {
  await remove(ref(db, `${BASE_PATH}/stopList/${productId}`));

  if (typeof window.logChefAction === "function") {
    const name = productName || productId;
    await window.logChefAction(`"${name}" taomi stop-listdan olindi (Sotuvga qaytarildi).`);
  }

  showToast(t("product_reactivated"), "success");
};

function applyAdminPageTranslations() {
  document.title = t("admin_document_title");
}

window.openSupportBot = function () {
  const user = crmAdvActor();
  const restName = document.getElementById("restaurantName")?.value || t("default_restaurant_name");
  const phone = localStorage.getItem("userPhone") || t("unknown_label");

  const botUsername = "NestaSupportBot";
  const startParam = btoa(`user:${user.name}_rest:${restName}`).replace(/=/g, '');

  window.open(`https://t.me/${botUsername}?start=${startParam}`, "_blank");
};

window.openUserManual = function () {
  window.open("https://help.nestacrm.uz", "_blank");

};

/* =========================
   OBUNA HOLATINI TEKSHIRISH 
========================= */
window.checkSubscriptionStatus = async function (restId) {
  return true;
};

document.addEventListener("DOMContentLoaded", async () => {
  const currentRestId = localStorage.getItem("restaurantId");

  if (!currentRestId) {
    window.location.href = "login.html";
    return;
  }

  const isSubActive = await window.checkSubscriptionStatus(currentRestId);

  if (isSubActive) {
    init();

    if (typeof loadRestaurantNameForHeader === "function") {
      loadRestaurantNameForHeader();
    }
  }
});

window.approveOrder = async function (orderId) {
  try {
    const orderRef = ref(db, `${BASE_PATH}/orders/${orderId}`);
    const orderSnap = await get(orderRef);
    if (!orderSnap.exists()) return;

    const now = Date.now();

    // ✅ "approved" + "tayyorlanmoqda" — ikkala status ham yoziladi
    // Chef sahifasi "approved" yoki "tayyorlanmoqda" statusdagi buyurtmalarni ko'rsatadi
    const updates = {
      status: "tayyorlanmoqda",
      statusKey: "cooking",
      statusLabel: typeof t === "function"
        ? t("status_approved_chef", "Oshpazga yuborildi")
        : "Oshpazga yuborildi",
      confirmedAt: now,
      approvedAt: now,
      approvedByAdmin: true
    };

    const order = orderSnap.val();
    await update(orderRef, updates);

    // ✅ Stol statusini "busy" qilamiz — admin yopmaguncha hech kim o'tira olmaydi
    if (order.table) {
      const tableKey = `table_${order.table}`;
      const tableRef2 = ref(db, `${BASE_PATH}/tables/${tableKey}`);
      const tableRef3 = ref(db, `${BASE_PATH}/tables/${order.table}`);
      try {
        await update(tableRef2, {
          status: "busy",
          busy: true,
          orderId: orderId,
          occupiedAt: now
        });
      } catch (_) {}
      try {
        await update(tableRef3, {
          status: "busy",
          busy: true,
          orderId: orderId,
          occupiedAt: now
        });
      } catch (_) {}
    }

    if (typeof window.deductOrderInventory === "function") {
      await window.deductOrderInventory(orderId);
    }

    // Kitchen notification — oshpaz ko'rishi uchun
    try {
      await push(ref(db, `${BASE_PATH}/kitchenNotifications`), {
        orderId,
        type: "new_order",
        message: typeof t === "function"
          ? t("kitchen_new_order_notify", "Yangi buyurtma keldi!")
          : "Yangi buyurtma keldi!",
        status: "unread",
        createdAt: now
      });
    } catch (notifyErr) {
      console.warn("Kitchen notification xatosi:", notifyErr);
    }

    showAdminNotification(
      `✅ ${typeof t === "function"
        ? t("a_order_approved_notify", "Buyurtma tasdiqlandi va oshpazga yuborildi!")
        : "Buyurtma tasdiqlandi va oshpazga yuborildi!"
      }`
    );

  } catch (error) {
    console.error(t("error_log", "Xato:"), error);
    alert(typeof t === "function" ? t("notify.error", "Xatolik yuz berdi") : "Xatolik yuz berdi");
  }
};

// =================================
// 🥗 TAOM RETSEPTI VA MASALLIQLAR 
// =================================
window.allInventory = {};

// window.allInventory listenToInventory() orqali avtomatik yangilanadi
window.listenInventory = function () { /* listenToInventory() orqali boshqariladi */ };

window.currentRecipeMenuId = null;

window.openRecipeModal = function (menuId, foodName) {
  window.currentRecipeMenuId = menuId;
  window.currentRecipeFoodId = menuId; // eski kod uchun ham
  const menu = window.allMenu[menuId];
  if (!menu) return;

  const lang = typeof getLang === 'function' ? getLang() : 'uz';
  const modalTitle = document.getElementById('recipe-food-name');
  const finalName = foodName
    || (menu.name && (menu.name[lang] || menu.name.uz || menu.name.ru || menu.name.en))
    || menu.name
    || "Taom";
  if (modalTitle) {
    modalTitle.innerText = finalName + " — " + (typeof t === 'function' ? t("ingredients", "tarkibi") : "tarkibi");
  }

  const container = document.getElementById("recipe-items-container");
  if (!container) return;
  container.innerHTML = "";

  const recipe = Array.isArray(menu.recipe) ? menu.recipe : [];
  if (recipe.length === 0) {
    window.addIngredientRowToRecipe();
  } else {
    recipe.forEach(ing => window.addIngredientRowToRecipe(ing.id, ing.amount, ing.unit || "gr"));
  }

  const modal = document.getElementById("recipeModal")
    || document.getElementById("recipe-modal")
    || document.querySelector('[data-modal="recipe"]');
  if (modal) modal.style.display = "flex";
};

// O'zbek milliy taomlari uchun mashhur masalliqlar ro'yxati
window.UZBEK_INGREDIENTS_LIST = [
  // Go'sht turlari
  "Qo'y go'shti", "Mol go'shti", "Tovuq go'shti", "Jigar", "Dumba yog'i", "Qazi",
  // Sabzavotlar
  "Sabzi", "Piyoz", "Kartoshka", "Pomidor", "Sarimsoqpiyoz", "Bulg'or qalampiri",
  "Karam", "Turp", "Loba", "Yashil loviya", "Bodring",
  // Guruch va donlar
  "Guruch (Devzira)", "Guruch (Lazer)", "Guruch (Alang)", "Guruch", "Un", "No'xat",
  // Yog'lar
  "O'simlik yog'i", "Paxta yog'i", "Sariyog'", "Margarin", "Mol yog'i",
  // Ziravorlar
  "Tuz", "Zira", "Qora murch", "Qizil murch", "Zirk", "Kashnich urug'i",
  "Dafna yaprog'i", "Yulduzanis (Badyon)", "Jandu",
  // Ko'katlar
  "Kashnich", "Shivit (Ukrop)", "Ko'k piyoz", "Selderey",
  // Xamir uchun
  "Tuxum", "Suv", "Gazlangan suv", "Kvas", "Kivi",
  // Qo'shimchalar
  "Mayiz", "Bedana tuxumi", "Gazak"
];

window.RECIPE_UNITS = [
  { value: "gr",     label: () => t("unit_gr",     "gr (gramm)") },
  { value: "kg",     label: () => t("unit_kg",     "kg (kilogram)") },
  { value: "ml",     label: () => t("unit_ml",     "ml (millilitr)") },
  { value: "l",      label: () => t("unit_l",      "l (litr)") },
  { value: "dona",   label: () => t("unit_dona",   "dona (soni)") },
  { value: "osh_q",  label: () => t("unit_osh_q",  "osh qoshiq") },
  { value: "choy_q", label: () => t("unit_choy_q", "choy qoshiq") },
  { value: "piyola", label: () => t("unit_piyola", "piyola") },
  { value: "bunch",  label: () => t("unit_bunch",  "bog'lam") },
  { value: "dash",   label: () => t("unit_dash",   "chimdim") }
];

window.addIngredientRowToRecipe = function (selectedIngId = "", amount = "", unit = "") {
  const container = document.getElementById("recipe-items-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "recipe-row";
  row.style.cssText = "display:flex; gap:8px; margin-bottom:10px; align-items:center; flex-wrap:wrap;";

  // Agar mavjud ingId bo'lsa, inventorydan nomini va unitini olish
  const inv = window.allInventory || {};
  let existingName = "";
  let existingUnit = unit || "gr";
  if (selectedIngId && inv[selectedIngId]) {
    existingName = inv[selectedIngId].name || "";
    existingUnit = unit || inv[selectedIngId].unit || "gr";
  }

  // Inventory + standart ro'yxatdan barcha masalliq nomlarini yig'ish
  const allIngNames = new Set(window.UZBEK_INGREDIENTS_LIST || []);
  Object.values(inv).forEach(ing => { if (ing.name) allIngNames.add(ing.name); });

  // datalist id (unique)
  const listId = "ing-list-" + Math.random().toString(36).slice(2, 8);

  // Units options HTML
  const unitsHtml = (window.RECIPE_UNITS || []).map(u =>
    `<option value="${u.value}"${existingUnit === u.value ? " selected" : ""}>${typeof u.label === "function" ? u.label() : u.label}</option>`
  ).join("");

  // Datalist options
  const datalistHtml = Array.from(allIngNames).map(name =>
    `<option value="${escapeHtml(name)}">`
  ).join("");

  row.innerHTML = `
    <div style="position:relative; flex:2; min-width:160px;">
      <input type="text"
             class="recipe-ing-name-input"
             value="${escapeHtml(existingName)}"
             data-ing-id="${selectedIngId}"
             list="${listId}"
             placeholder="${typeof t === 'function' ? t('ingredient_name', 'Masalliq nomi') : 'Masalliq nomi'}"
             style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:14px; box-sizing:border-box;"
             autocomplete="off">
      <datalist id="${listId}">${datalistHtml}</datalist>
    </div>
    <input type="number"
           class="recipe-amount-input"
           value="${amount}"
           min="0.001"
           step="0.001"
           placeholder="${typeof t === 'function' ? t('quantity', 'Miqdori') : 'Miqdori'}"
           style="flex:1; min-width:80px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:14px;">
    <select class="recipe-unit-select"
            style="flex:1; min-width:110px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:13px; background:#fff; cursor:pointer;">
      ${unitsHtml}
    </select>
    <button type="button" onclick="this.closest('.recipe-row').remove()"
            style="padding:8px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;"
            title="${typeof t === 'function' ? t('delete_btn', "O'chirish") : "O'chirish"}">✖</button>
  `;

  container.appendChild(row);
};

window.saveRecipe = async function () {
  // currentRecipeMenuId yoki currentRecipeFoodId dan birini ishlatamiz
  if (!window.currentRecipeMenuId) {
    window.currentRecipeMenuId = window.currentRecipeFoodId || null;
  }
  if (!window.currentRecipeMenuId) {
    alert(t("food_id_not_found", "Xatolik: Taom ID topilmadi!"));
    return;
  }

  const container = document.getElementById("recipe-items-container");
  if (!container) return;

  const rows = container.querySelectorAll(".recipe-row");
  const newRecipe = [];

  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    // Avval inventoryni yangilab olamiz
    const invSnap = await get(ref(db, `restaurants/${restId}/inventory`));
    const currentInv = invSnap.val() || {};

    // name -> id mapping (kichik harf bilan)
    const nameToId = {};
    Object.entries(currentInv).forEach(([id, ing]) => {
      if (ing.name) nameToId[ing.name.trim().toLowerCase()] = id;
    });

    for (const row of rows) {
      const nameInput = row.querySelector(".recipe-ing-name-input");
      const amountInput = row.querySelector(".recipe-amount-input");
      const unitSelect = row.querySelector(".recipe-unit-select");
      const ingName = nameInput ? nameInput.value.trim() : "";
      const amount = Number(amountInput ? amountInput.value : 0);
      const ingUnit = unitSelect ? unitSelect.value : "gr";

      if (!ingName || amount <= 0) continue;

      // Inventoryda shu nomli masalliq bor-yo'qligini tekshirish
      let ingId = nameToId[ingName.toLowerCase()];

      if (!ingId) {
        // Yo'q bo'lsa yangi masalliq yaratish — tarkibdagi miqdor bilan stock ni ham to'ldirish
        const newIngRef = push(ref(db, `restaurants/${restId}/inventory`));
        ingId = newIngRef.key;
        const newIngData = {
          name: ingName,
          unit: ingUnit,
          stock: amount,   // tarkibdagi miqdorni boshlang'ich zaxira sifatida saqlash
          minStock: 0,
          createdAt: Date.now(),
          addedFrom: "recipe"
        };
        await set(newIngRef, newIngData);
        nameToId[ingName.toLowerCase()] = ingId;
        if (window.allInventory) window.allInventory[ingId] = newIngData;

        // Masalliqlar bo'limiga ham saqlash
        await set(ref(db, `restaurants/${restId}/ingredients/${ingId}`), newIngData);
        console.log("✅ Yangi masalliq saqlandi:", ingName, amount, ingUnit);
      } else {
        // Mavjud masalliq — faqat ingredients bilan sinxronlash (stock ni o'zgartirmaymiz)
        const existingData = currentInv[ingId] || {};
        await update(ref(db, `restaurants/${restId}/ingredients/${ingId}`), {
          name: ingName,
          unit: ingUnit,
          stock: existingData.stock || 0,
          syncedToIngredients: true
        });
      }

      newRecipe.push({ id: ingId, amount: amount, unit: ingUnit, name: ingName });
    }

    // menu/${menuId}/recipe ga saqlash
    await update(ref(db, `restaurants/${restId}/menu/${window.currentRecipeMenuId}`), {
      recipe: newRecipe
    });

    // Local cache yangilash
    if (window.allMenu && window.allMenu[window.currentRecipeMenuId]) {
      window.allMenu[window.currentRecipeMenuId].recipe = newRecipe;
    }

    const successMsg = typeof t === "function"
      ? t("recipe_saved", "Retsept muvaffaqiyatli saqlandi! Yangi masalliqlar Ombor va Masalliqlar bo'limiga ham qo'shildi.")
      : "Retsept muvaffaqiyatli saqlandi! Yangi masalliqlar Ombor va Masalliqlar bo'limiga ham qo'shildi.";

    if (typeof showAdminNotification === "function") {
      showAdminNotification("✅ " + successMsg, "success");
    }

    window.closeRecipeModal();
  } catch (error) {
    const errMsg = typeof t === "function" ? t("notify.error", "Xatolik yuz berdi: ") : "Xatolik yuz berdi: ";
    alert(errMsg + error.message);
  }
};

window.deleteIngredient = async function (ingredientId) {
  if (!confirm(typeof t === 'function' ? t("confirm_delete_ingredient", "Rostdan ham ushbu masalliqni o'chirmoqchimisiz? (Bunga ulangan retseptlar ishlamay qolishi mumkin!)") : "Rostdan ham ushbu masalliqni o'chirmoqchimisiz?")) {
    return;
  }

  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    await Promise.all([
      remove(ref(db, `restaurants/${restId}/inventory/${ingredientId}`)),
      remove(ref(db, `restaurants/${restId}/ingredients/${ingredientId}`))
    ]);

    console.log(t("ingredient_deleted_log", "✅ Masalliq o'chirildi: ") + ingredientId);
    alert(typeof t === 'function' ? t("ingredient_deleted", "Masalliq muvaffaqiyatli o'chirildi!") : "Masalliq muvaffaqiyatli o'chirildi!");

  } catch (error) {
    console.error(t("error_deleting_ingredient", "Masalliqni o'chirishda xato:"), error);
    alert(t("error_occurred", "Xatolik yuz berdi: ") + error.message);
  }
};

// ==========================================
// 💰 MOLIYA VA KPI: MAOSH HISOBLASH
// salaryMode: "fixed" | "percent" | "ball"
//   fixed   — belgilangan oylik
//   percent — har bir buyurtma summasidan %
//   ball    — 1 buyurtma = 1 ball; 1 ball = ballRate so'm
// ==========================================

// ── Bitta buyurtma uchun KPI (yangi buyurtma yopilganda) ──────────────
window.calculateStaffKPI = async function (orderId) {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;
  const monthKey = new Date().toISOString().slice(0, 7);
  try {
    const orderSnap = await get(ref(db, `restaurants/${restId}/orders/${orderId}`));
    if (!orderSnap.exists() || orderSnap.val().kpiCalculated) return;
    const order = orderSnap.val();
    const total  = Number(order.finalTotal || order.total || order.totalPrice || 0);
    const staffIds = [order.waiterId, order.chefId].filter(Boolean);

    for (const sId of staffIds) {
      const userSnap = await get(ref(db, `restaurants/${restId}/users/${sId}`));
      if (!userSnap.exists()) continue;
      const user   = userSnap.val();
      const mode   = user.salaryMode || "percent";
      // % rejimda pul hisoblanadi; ball/fixed rejimda faqat orderCount oshadi
      const earned = mode === "percent"
        ? (total * (Number(user.commissionPercent || 0))) / 100
        : 0;

      const statsRef = ref(db, `restaurants/${restId}/finance/staff_stats/${sId}/${monthKey}`);
      const cur = (await get(statsRef)).val() || { totalEarned: 0, orderCount: 0 };
      await update(statsRef, {
        totalEarned: (cur.totalEarned || 0) + earned,
        orderCount:  (cur.orderCount  || 0) + 1,
        lastUpdate:  Date.now()
      });
    }
    await update(ref(db, `restaurants/${restId}/orders/${orderId}`), { kpiCalculated: true });
  } catch (e) { console.error("KPI error:", e); }
};

// ── Oylik statistikasini noldan qayta hisoblash (Qayta hisoblash tugmasi) ──
window.recalculateMonthlyKPI = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;
  const monthKey = new Date().toISOString().slice(0, 7);

  // Oyning boshi va oxiri
  const monthStart = new Date(monthKey + "-01T00:00:00").getTime();
  const monthEnd   = new Date(
    new Date(monthStart).getFullYear(),
    new Date(monthStart).getMonth() + 1,
    0, 23, 59, 59, 999
  ).getTime();

  const btn = document.getElementById("recalcKpiBtn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Hisoblanmoqda..."; }

  try {
    const [ordersSnap, usersSnap] = await Promise.all([
      get(ref(db, `restaurants/${restId}/orders`)),
      get(ref(db, `restaurants/${restId}/users`))
    ]);
    const orders = ordersSnap.val() || {};
    const users  = usersSnap.val()  || {};

    // Bu oyning barcha staff statslarini nolga tushiramiz
    const staffIds = Object.keys(users).filter(id =>
      users[id].role === "chef" || users[id].role === "waiter"
    );
    const resetUpdates = {};
    staffIds.forEach(sId => {
      resetUpdates[`finance/staff_stats/${sId}/${monthKey}`] = {
        totalEarned: 0, orderCount: 0, lastUpdate: Date.now()
      };
    });
    await update(ref(db, `restaurants/${restId}`), resetUpdates);

    // Oy ichidagi yopilgan / to'langan buyurtmalarni qayta sanaymiz
    const closedStatuses = ["yopildi","closed","to'landi","paid","bekor qilindi","cancelled","canceled"];
    const validOrders = Object.entries(orders).filter(([, o]) => {
      const st  = String(o.status || o.statusKey || "").trim().toLowerCase();
      const ts  = Number(o.createdAt || o.timestamp || 0);
      const ok  = closedStatuses.includes(st) || o.payment?.paid === true;
      return ok && ts >= monthStart && ts <= monthEnd;
    });

    // Har bir buyurtma uchun counter va earned hisob
    const accumulator = {}; // { staffId: { orderCount, totalEarned } }
    for (const [, order] of validOrders) {
      const total    = Number(order.finalTotal || order.total || order.totalPrice || 0);
      const staffPair = [order.waiterId, order.chefId].filter(Boolean);
      for (const sId of staffPair) {
        const user = users[sId];
        if (!user) continue;
        const mode   = user.salaryMode || "percent";
        const earned = mode === "percent"
          ? (total * (Number(user.commissionPercent || 0))) / 100
          : 0;
        if (!accumulator[sId]) accumulator[sId] = { orderCount: 0, totalEarned: 0 };
        accumulator[sId].orderCount  += 1;
        accumulator[sId].totalEarned += earned;
      }
    }

    // Firebase ga yozamiz
    const writeUpdates = {};
    Object.entries(accumulator).forEach(([sId, data]) => {
      writeUpdates[`finance/staff_stats/${sId}/${monthKey}`] = {
        totalEarned: data.totalEarned,
        orderCount:  data.orderCount,
        lastUpdate:  Date.now()
      };
    });
    if (Object.keys(writeUpdates).length > 0) {
      await update(ref(db, `restaurants/${restId}`), writeUpdates);
    }

    // kpiCalculated flag larini olib tashlaymiz — keyingi yangi buyurtmalar uchun ham ishlaydi
    const flagUpdates = {};
    validOrders.forEach(([oId]) => { flagUpdates[`orders/${oId}/kpiCalculated`] = true; });
    if (Object.keys(flagUpdates).length > 0) {
      await update(ref(db, `restaurants/${restId}`), flagUpdates);
    }

    const total = validOrders.length;
    const staff = Object.keys(accumulator).length;
    if (typeof showToast === "function") {
      showToast(t("recalculate_success", "✅ Qayta hisoblandi: {total} ta buyurtma, {staff} ta xodim").replace("{total}", total).replace("{staff}", staff), "success");
    } else {
      alert(t("recalculate_success", "✅ Qayta hisoblandi: {total} ta buyurtma, {staff} ta xodim").replace("{total}", total).replace("{staff}", staff));
    }
    window.renderSalaryReport();
  } catch (e) {
    console.error("Recalc error:", e);
    if (typeof showToast === "function") showToast("❌ Xatolik yuz berdi", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔄 Qayta hisoblash"; }
  }
};

window.renderStaffFinance = function () {
  const restId    = localStorage.getItem("restaurantId");
  const monthKey  = new Date().toISOString().slice(0, 7);
  const container = document.getElementById("staff-finance-list");
  if (!container) return;

  onValue(ref(db, `restaurants/${restId}/finance/staff_stats`), (snap) => {
    const allStats = snap.val() || {};
    container.innerHTML = "";

    Object.entries(window.allUsers || {}).forEach(([uId, user]) => {
      if (!user.active) return;
      const stats      = allStats[uId]?.[monthKey] || { totalEarned: 0, orderCount: 0 };
      const mode       = user.salaryMode || "percent";
      const fixed      = Number(user.fixedSalary || 0);
      const ballRate   = Number(user.ballRate    || 0);
      const orderCount = Number(stats.orderCount || 0);
      const earned     = Number(stats.totalEarned|| 0);

      let totalDebt = 0;
      if (mode === "fixed")   totalDebt = fixed;
      else if (mode === "percent") totalDebt = earned;
      else if (mode === "ball")    totalDebt = orderCount * ballRate;

      container.innerHTML += `
        <div class="finance-card" style="background:#fff; padding:15px; border-radius:12px; margin-bottom:10px;
             display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
          <div>
            <div style="font-weight:bold; font-size:16px;">${user.name} (${user.role})</div>
            <div style="font-size:13px; color:#64748b;">
              Buyurtmalar: <b>${orderCount} ta</b>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#64748b;">Jami to'lanishi kerak:</div>
            <div style="font-weight:bold; color:#10b981; font-size:18px;">${totalDebt.toLocaleString()} so'm</div>
          </div>
        </div>`;
    });
  });
};

function renderOrderCard(id, order) {
  const rawStatus = String(order.statusKey || order.status || "yangi").trim().toLowerCase();
  const isNew = rawStatus === "yangi" || rawStatus === "new" || rawStatus === "queue";
  const isApproved = rawStatus === "approved" || rawStatus === "tasdiqlandi";
  const isCooking = rawStatus === "cooking" || rawStatus === "tayyorlanmoqda";
  const isReady = rawStatus === "ready" || rawStatus === "tayyor";
  const isClosed = rawStatus === "closed" || rawStatus === "yopildi";
  const isCanceled = rawStatus === "bekor qilindi" || rawStatus === "cancelled" || rawStatus === "canceled";
  const isPaid = order.payment?.paid === true;

  // Telefon raqamni barcha mumkin bo'lgan fieldlardan qidiramiz
  const tableKey = `table_${order.table}`;
  const tableData = window.allTables?.[tableKey] || window.allTables?.[order.table] || {};
  const rawPhone =
    order.clientPhone ||
    order.customerPhone ||
    order.phone ||
    tableData.customerPhone ||
    tableData.phone ||
    tableData.clientPhone ||
    "";
  const clientPhone = normalizePhone(rawPhone);
  const customerProfile = getCustomerProfileByPhone(clientPhone);
  const customerName = customerProfile?.name || order.customerName || order.clientName || order.name || "";
  const phoneDisplay = clientPhone
    ? (customerName && customerName !== clientPhone ? `${customerName} (${clientPhone})` : clientPhone)
    : (customerName || t("anonymous_client", "Anonim mijoz"));
  const memoryInline = renderCustomerMemoryInline({
    allergies: normalizeCustomerMemoryList(order.allergyNote),
    preferences: normalizeCustomerMemoryList(order.preferenceNote),
    phone: clientPhone
  }, customerProfile);

  // ---- Holat konfiguratsiyasi ----
  let statusBg, statusColor, statusBorder, statusIcon, statusText, cardBorderLeft;
  if (isNew) {
    statusBg = "#fffbeb"; statusColor = "#b45309"; statusBorder = "#fde68a";
    statusIcon = "🆕"; statusText = t("status_new", "Yangi buyurtma");
    cardBorderLeft = "#f59e0b";
  } else if (isApproved) {
    statusBg = "#eff6ff"; statusColor = "#1d4ed8"; statusBorder = "#bfdbfe";
    statusIcon = "👨‍🍳"; statusText = t("status_approved", "Oshpazga yuborildi");
    cardBorderLeft = "#3b82f6";
  } else if (isCooking) {
    statusBg = "#fff7ed"; statusColor = "#c2410c"; statusBorder = "#fed7aa";
    statusIcon = "🔥"; statusText = t("status_cooking", "Tayyorlanmoqda");
    cardBorderLeft = "#f97316";
  } else if (isReady) {
    statusBg = "#f0fdf4"; statusColor = "#15803d"; statusBorder = "#bbf7d0";
    statusIcon = "✅"; statusText = t("status_ready", "Tayyor!");
    cardBorderLeft = "#22c55e";
  } else if (isClosed) {
    statusBg = "#f8fafc"; statusColor = "#64748b"; statusBorder = "#e2e8f0";
    statusIcon = "🏁"; statusText = t("status_closed", "Yopildi");
    cardBorderLeft = "#94a3b8";
  } else if (isCanceled) {
    statusBg = "#fef2f2"; statusColor = "#dc2626"; statusBorder = "#fecaca";
    statusIcon = "❌"; statusText = t("status_cancelled", "Bekor qilindi");
    cardBorderLeft = "#ef4444";
  } else {
    statusBg = "#f1f5f9"; statusColor = "#475569"; statusBorder = "#e2e8f0";
    statusIcon = "⚡"; statusText = order.statusLabel || rawStatus;
    cardBorderLeft = "#94a3b8";
  }

  const itemsHtml = Object.values(order.items || {}).map(item => {
    const itemName = (typeof item.name === "object") ? (item.name.uz || item.name.ru || item.name.en || "Taom") : (item.name || "Taom");
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:8px; background:#f8f9fa; border-radius:8px; margin-bottom:8px;">
        <img src="${item.img || 'img/no-image.png'}"
             style="width:52px; height:52px; border-radius:6px; object-fit:cover; border:1px solid #e5e7eb; flex-shrink:0;"
             onerror="this.src='img/no-image.png'">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <b style="font-size:13px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${itemName}</b>
            <span style="background:#3b82f6; color:#fff; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:700; flex-shrink:0;">x${item.qty}</span>
          </div>
          <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">
            <span style="font-size:11px; background:#e9ecef; color:#495057; padding:2px 6px; border-radius:4px;">📂 ${item.category || t("no_category", "Kategoriyasiz")}</span>
            ${item.subcategory ? `<span style="font-size:11px; background:#fff4e6; color:#d9480f; padding:2px 6px; border-radius:4px;">🏷️ ${item.subcategory}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // ---- Footer tugmalar ----
  let footerHtml;

  if (isNew) {
    // 🆕 YANGI — faqat "Tasdiqlash" va "Bekor" ko'rinsin
    footerHtml = `
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button onclick="window.approveOrder('${id}')"
          style="flex:2; background:#16a34a; color:#fff; border:none; padding:11px; border-radius:9px;
                 cursor:pointer; font-weight:700; font-size:13px; display:flex; align-items:center;
                 justify-content:center; gap:6px; transition:opacity 0.2s;"
          onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          ✅ ${t("approve_btn", "Tasdiqlash")}
        </button>
        <button onclick="cancelOrder('${id}')"
          style="flex:1; background:#fff; color:#dc2626; border:1.5px solid #dc2626; padding:11px;
                 border-radius:9px; cursor:pointer; font-weight:700; font-size:13px;">
          ✕ ${t("cancel_btn", "Bekor")}
        </button>
      </div>
    `;
  } else if (isApproved || isCooking) {
    // 👨‍🍳 OSHPAZDA — admin bekor qila oladi
    footerHtml = `
      <div style="display:flex; gap:8px; margin-top:14px;">
        <div style="flex:2; display:flex; align-items:center; justify-content:center; gap:6px;
                    background:${statusBg}; color:${statusColor}; border:1.5px solid ${statusBorder};
                    border-radius:9px; padding:10px; font-weight:700; font-size:13px;">
          ${statusIcon} ${statusText}
        </div>
        <button onclick="cancelOrder('${id}')"
          style="flex:1; background:#fff; color:#dc2626; border:1.5px solid #dc2626; padding:11px;
                 border-radius:9px; cursor:pointer; font-weight:700; font-size:13px;">
          ✕ ${t("cancel_btn", "Bekor")}
        </button>
      </div>
    `;
  } else if (isReady) {
    // ✅ TAYYOR — admin to'lovni tasdiqlaydi
    footerHtml = `
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button onclick="window.approvePayment('${id}')"
          style="flex:2; background:#16a34a; color:#fff; border:none; padding:11px; border-radius:9px;
                 cursor:pointer; font-weight:700; font-size:13px; display:flex; align-items:center;
                 justify-content:center; gap:6px;">
          💳 ${t("approve_payment_btn", "To'lovni tasdiqlash")}
        </button>
        <button onclick="cancelOrder('${id}')"
          style="flex:1; background:#fff; color:#dc2626; border:1.5px solid #dc2626; padding:11px;
                 border-radius:9px; cursor:pointer; font-weight:700; font-size:13px;">
          ✕ ${t("cancel_btn", "Bekor")}
        </button>
      </div>
    `;
  } else {
    // YOPILDI / BOSHQA
    footerHtml = `
      <div style="margin-top:14px; display:flex; align-items:center; justify-content:center; gap:6px;
                  background:${statusBg}; color:${statusColor}; border:1.5px solid ${statusBorder};
                  border-radius:9px; padding:10px; font-weight:600; font-size:13px;">
        ${statusIcon} ${statusText} ${isPaid ? "· 💳 " + t("paid_label", "To'landi") : ""}
      </div>
    `;
  }

  const cardHtml = `
    <div class="order-card" id="order-${id}"
         style="background:#fff; border-radius:14px; padding:18px;
                box-shadow:0 4px 16px rgba(0,0,0,0.07);
                border:1px solid #f1f5f9;
                border-left:4px solid ${cardBorderLeft};
                margin-bottom:18px; transition:box-shadow 0.2s;">

      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <h3 style="margin:0 0 3px 0; font-size:15px; color:#1e293b;">
            🪑 ${t("table", "Stol")} ${order.table}
            <span style="color:#94a3b8; font-weight:500; font-size:13px;"> | #${order.orderNumber || id.slice(-4)}</span>
          </h3>
          <span style="display:inline-flex; align-items:center; gap:4px;
                       background:${statusBg}; color:${statusColor};
                       border:1px solid ${statusBorder};
                       padding:3px 9px; border-radius:20px; font-size:11px; font-weight:700;">
            ${statusIcon} ${statusText}
          </span>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="color:#16a34a; font-weight:800; font-size:15px;">
            ${Number(order.total || 0).toLocaleString()} ${t("currency", "so'm")}
          </div>
          <small style="color:#94a3b8; font-size:11px;">
            ${new Date(order.createdAt || Date.now()).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
          </small>
        </div>
      </div>

      <!-- MIJOZ -->
      <div style="margin-bottom:12px; font-size:13px; color:#475569; display:flex; align-items:center; gap:5px;">
        📞 <b>${t("client_label", "Mijoz")}:</b>
        <a href="tel:${clientPhone}" style="color:#3b82f6; text-decoration:none;">${phoneDisplay}</a>
      </div>

      ${memoryInline}

      <!-- TAOMLAR -->
      <div style="max-height:220px; overflow-y:auto; margin-bottom:4px;">
        ${itemsHtml}
      </div>

      <!-- PROMO TUGMA (hidden by default) -->
      <button id="promo-btn-${id}" class="btn"
              style="display:none; background:#fbbf24; color:#000; margin-top:10px; width:100%;
                     font-weight:700; border:none; padding:10px; border-radius:8px; cursor:pointer;">
      </button>

      <!-- FOOTER TUGMALAR -->
      ${footerHtml}
    </div>
  `;

  setTimeout(() => {
    if (typeof checkAndShowPromo === "function") {
      checkAndShowPromo(id, clientPhone);
    }
  }, 100);

  return cardHtml;
}

window.currentKpiPeriod = 'today';

window.updateOrderStatus = async function (orderId, newStatus) {
  const restId = localStorage.getItem("restaurantId");
  const orderRef = ref(db, `restaurants/${restId}/orders/${orderId}`);

  try {
    await update(orderRef, {
      status: newStatus,
      updatedAt: Date.now()
    });

    if (newStatus === "approved" || newStatus === "cooking") {
      await window.deductOrderInventory(orderId);
    }

    if (newStatus === "closed") {
      await window.calculateStaffKPI(orderId);
    }

    showToast(t("status_updated_success"));
  } catch (error) {
    console.error("Status update error:", error);
    showToast(t("error_updating_status"), "error");
  }
};

window.updateChefKPIs = async function (period = null) {
  if (period) window.currentKpiPeriod = period;
  const activePeriod = window.currentKpiPeriod;

  const kpiGrid = document.getElementById("chefKpiGrid");
  if (!kpiGrid) return;

  ['today', 'week', 'month'].forEach(p => {
    const btn = document.getElementById(`kpiBtn-${p}`);
    if (btn) {
      if (p === activePeriod) {
        btn.style.background = "white";
        btn.style.color = "#111827";
        btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
      } else {
        btn.style.background = "transparent";
        btn.style.color = "#6b7280";
        btn.style.boxShadow = "none";
      }
    }
  });

  const users = window.allUsers || {};
  const orders = window.allOrders || {};

  const restId = localStorage.getItem("restaurantId");
  let normalTime = 25;
  try {
    const snap = await get(ref(db, `restaurants/${restId}/settings/normalOrderBaseTime`));
    if (snap.exists()) normalTime = Number(snap.val());
  } catch (e) { }

  const chefStats = {};
  Object.entries(users).forEach(([id, u]) => {
    if (u.role === "chef" && u.active !== false) {
      chefStats[id] = { id, name: u.name, count: 0, totalTime: 0, delayed: 0, score: 0 };
    }
  });

  const now = new Date();
  let startTime = new Date();

  if (activePeriod === 'today') {
    startTime.setHours(0, 0, 0, 0);
  } else if (activePeriod === 'week') {
    const day = startTime.getDay();
    const diff = startTime.getDate() - day + (day === 0 ? -6 : 1);
    startTime.setDate(diff);
    startTime.setHours(0, 0, 0, 0);
  } else if (activePeriod === 'month') {
    startTime.setDate(1);
    startTime.setHours(0, 0, 0, 0);
  }
  const startTimestamp = startTime.getTime();

  Object.values(orders).forEach(o => {
    if (!o.chefId || !chefStats[o.chefId]) return;

    const s = String(o.status || o.statusKey || "").toLowerCase();
    const orderTime = o.updatedAt || o.createdAt || 0;

    if (orderTime >= startTimestamp && ["tayyor", "ready", "yopildi", "closed"].includes(s)) {
      chefStats[o.chefId].count++;

      const startTime = o.acceptedAt || o.createdAt;

      if (o.updatedAt && startTime) {
        const cookTime = (o.updatedAt - startTime) / 60000;
        chefStats[o.chefId].totalTime += cookTime;

        if (cookTime > normalTime) {
          chefStats[o.chefId].delayed++;
        }
      }
    }
  });

  const leaderboard = Object.values(chefStats)
    .filter(chef => chef.count > 0)
    .map(chef => {
      const avgTime = chef.count > 0 ? (chef.totalTime / chef.count) : 0;

      let points = (chef.count * 10) - (chef.delayed * 15);
      if (avgTime > 0 && avgTime < normalTime && chef.count >= 5) points += 50;

      return { ...chef, avgTime: avgTime.toFixed(1), score: Math.max(0, points) };
    }).sort((a, b) => b.score - a.score);

  if (leaderboard.length === 0) {
    let periodText = activePeriod === 'today' ? t("today_label", "Bugun") : (activePeriod === 'week' ? t("this_week", "Shu hafta") : t("this_month", "Shu oy"));
    kpiGrid.innerHTML = `<p style="color: #9ca3af; font-size: 14px; grid-column: 1/-1; text-align: center; padding: 20px;">${periodText} ${t("no_chef_orders_yet", "oshpazlar tomonidan hali buyurtma tayyorlanmadi.")}</p>`;
    return;
  }

  kpiGrid.innerHTML = leaderboard.map((chef, index) => {
    let rankBadge = "";
    let borderGlow = "border: 1px solid #e5e7eb;";
    if (index === 0) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #fbbf24; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.4); border: 2px solid #fff;">1</div>`;
      borderGlow = "border: 2px solid #fbbf24; background: #fffbeb;";
    } else if (index === 1) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #94a3b8; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(148, 163, 184, 0.4); border: 2px solid #fff;">2</div>`;
    } else if (index === 2) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #b45309; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(180, 83, 9, 0.4); border: 2px solid #fff;">3</div>`;
    }

    return `
        <div style="position: relative; background: #f9fafb; padding: 20px; border-radius: 12px; ${borderGlow} display: flex; flex-direction: column; gap: 15px; transition: 0.3s;">
            ${rankBadge}
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 45px; height: 45px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;">
                    ${chef.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 style="margin: 0; color: #111827; font-size: 18px;">${chef.name}</h4>
                    <span style="font-size: 13px; color: #f59e0b; font-weight: 800; background: #fef3c7; padding: 2px 8px; border-radius: 12px; display: inline-block; margin-top: 4px;">🏆 ${chef.score} ball</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6; text-align: center;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600;">${t("prepared_label", "Tayyorladi")}</div>
                    <div style="font-size: 20px; font-weight: 800; color: #111827;">${chef.count} <span style="font-size: 12px; font-weight: 500; color: #9ca3af;">${t("sa_badge_count", "ta")}</span></div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6; text-align: center;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600;">${t("avg_time", "O'rtacha vaqt")}</div>
                    <div style="font-size: 20px; font-weight: 800; color: #3b82f6;">${chef.avgTime} <span style="font-size: 12px; font-weight: 500; color: #9ca3af;">${t("minute_short", "min")}</span></div>
                </div>
                <div style="grid-column: span 2; background: ${chef.delayed > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 12px; border-radius: 8px; border: 1px solid ${chef.delayed > 0 ? '#fecaca' : '#bbf7d0'}; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: ${chef.delayed > 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">${t("delayed_orders_count", "Kechikkan buyurtmalar:")}</span>
                    <span style="font-size: 16px; font-weight: 800; color: ${chef.delayed > 0 ? '#ef4444' : '#10b981'}; background: white; padding: 2px 10px; border-radius: 12px;">${chef.delayed} ${t("sa_badge_count", "ta")}</span>
                </div>
            </div>
        </div>
        `;
  }).join("");
};

window.currentWaiterKpiPeriod = 'today';

window.updateWaiterKPIs = function (period = null) {
  if (period) window.currentWaiterKpiPeriod = period;
  const activePeriod = window.currentWaiterKpiPeriod;

  const kpiGrid = document.getElementById("waiterKpiGrid");
  if (!kpiGrid) return;

  ['today', 'week', 'month'].forEach(p => {
    const btn = document.getElementById(`waiterKpiBtn-${p}`);
    if (btn) {
      if (p === activePeriod) {
        btn.style.background = "white";
        btn.style.color = "#111827";
        btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
      } else {
        btn.style.background = "transparent";
        btn.style.color = "#6b7280";
        btn.style.boxShadow = "none";
      }
    }
  });

  const users = window.allUsers || {};
  const orders = window.allOrders || {};

  const waiterStats = {};

  Object.entries(users).forEach(([id, u]) => {
    if (u.role === "waiter" && u.active !== false) {
      waiterStats[id] = { id, name: u.name, count: 0, revenue: 0, score: 0 };
    }
  });
  const now = new Date();
  let startTime = new Date();

  if (activePeriod === 'today') {
    startTime.setHours(0, 0, 0, 0);
  } else if (activePeriod === 'week') {
    const day = startTime.getDay();
    const diff = startTime.getDate() - day + (day === 0 ? -6 : 1);
    startTime.setDate(diff);
    startTime.setHours(0, 0, 0, 0);
  } else if (activePeriod === 'month') {
    startTime.setDate(1);
    startTime.setHours(0, 0, 0, 0);
  }
  const startTimestamp = startTime.getTime();

  Object.values(orders).forEach(o => {
    if (!o.waiterId || !waiterStats[o.waiterId]) return;

    const orderTime = o.createdAt || 0;
    const status = String(o.status || "").toLowerCase();

    if (orderTime >= startTimestamp && status !== "canceled" && status !== "cancelled") {
      waiterStats[o.waiterId].count++;
      waiterStats[o.waiterId].revenue += Number(o.finalTotal || o.total || 0);
    }
  });

  const leaderboard = Object.values(waiterStats)
    .filter(waiter => waiter.count > 0)
    .map(waiter => {
      const avgCheck = waiter.count > 0 ? (waiter.revenue / waiter.count) : 0;

      let points = (waiter.count * 10) + Math.floor(waiter.revenue / 100000) * 5;

      return {
        ...waiter,
        avgCheck: avgCheck,
        score: Math.max(0, points)
      };
    }).sort((a, b) => b.score - a.score);

  if (leaderboard.length === 0) {
    let periodText = activePeriod === 'today' ? t("today_btn", "Bugun") : (activePeriod === 'week' ? t("this_week_btn", "Shu hafta") : t("this_month_btn", "Shu oy"));
    kpiGrid.innerHTML = `<p style="color: #9ca3af; font-size: 14px; grid-column: 1/-1; text-align: center; padding: 20px;">${periodText} ${t("no_waiter_service_today", "ofitsiantlar tomonidan hali xizmat ko'rsatilmadi.")}.</p>`;
    return;
  }

  kpiGrid.innerHTML = leaderboard.map((waiter, index) => {
    let rankBadge = "";
    let borderGlow = "border: 1px solid #e5e7eb;";
    if (index === 0) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #fbbf24; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.4); border: 2px solid #fff;">1</div>`;
      borderGlow = "border: 2px solid #fbbf24; background: #fffbeb;";
    } else if (index === 1) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #94a3b8; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(148, 163, 184, 0.4); border: 2px solid #fff;">2</div>`;
    } else if (index === 2) {
      rankBadge = `<div style="position: absolute; top: -12px; right: -12px; background: #b45309; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; font-size: 14px; box-shadow: 0 4px 6px rgba(180, 83, 9, 0.4); border: 2px solid #fff;">3</div>`;
    }

    return `
        <div style="position: relative; background: #f9fafb; padding: 20px; border-radius: 12px; ${borderGlow} display: flex; flex-direction: column; gap: 15px; transition: 0.3s;">
            ${rankBadge}
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 45px; height: 45px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;">
                    ${waiter.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 style="margin: 0; color: #111827; font-size: 18px;">${waiter.name}</h4>
                    <span style="font-size: 13px; color: #3b82f6; font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 12px; display: inline-block; margin-top: 4px;">🏆 ${waiter.score} ball</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6; text-align: center;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600;">${t("served_label", "Xizmat qildi")}</div>
                    <div style="font-size: 20px; font-weight: 800; color: #111827;">${waiter.count} <span style="font-size: 12px; font-weight: 500; color: #9ca3af;">${t("table_short", "stol")}</span></div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6; text-align: center;">
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600;">${t("crm_avg_spend", "O'rtacha chek")}</div>
                    <div style="font-size: 16px; font-weight: 800; color: #10b981;">${waiter.avgCheck.toLocaleString()} <span style="font-size: 10px; font-weight: 500; color: #9ca3af;">${t("currency", "UZS")}</span></div>
                </div>
                <div style="grid-column: span 2; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: #475569; font-weight: 700;">${t("total_revenue", "Umumiy Tushum:")}</span>
                    <span style="font-size: 16px; font-weight: 800; color: #3b82f6; background: white; padding: 2px 10px; border-radius: 12px;">${waiter.revenue.toLocaleString()} ${t("currency", "UZS")}</span>
                </div>
            </div>
        </div>
        `;
  }).join("");
};

window.saveSalarySettings = async function () {
  const restId   = localStorage.getItem("restaurantId");
  const ballRate = document.getElementById("chefPointRate")?.value  || 1000;
  const wRate    = document.getElementById("waiterPercentRate")?.value || 3;
  try {
    await update(ref(db, `restaurants/${restId}/settings/finance`), {
      chefPointRate: Number(ballRate), waiterPercentRate: Number(wRate), updatedAt: Date.now()
    });
    if (typeof showToast === "function") showToast("Sozlamalar saqlandi!", "success");
  } catch (e) { console.error("Settings error:", e); }
};

window.addStaffAdjustment = async function (staffId) {
  const amount = prompt(t("enter_bonus_amount", "Qo'shimcha miqdorni kiriting (masalan: 50000 yoki -20000):"));
  if (!amount || isNaN(amount)) return;
  const reason  = prompt(t("enter_reason", "Sababini yozing:"));
  const restId  = localStorage.getItem("restaurantId");
  const monthKey = new Date().toISOString().slice(0, 7);
  const adjRef  = push(ref(db, `restaurants/${restId}/finance/adjustments/${staffId}/${monthKey}`));
  await set(adjRef, { amount: Number(amount), reason: reason || "Qo'shimcha haq", date: Date.now() });
  window.renderSalaryReport();
};

window.paySalary = async function (staffId, totalAmount) {
  if (!confirm(t("confirm_payment", "{amount} so'm to'lov qilindimi?").replace("{amount}", Number(totalAmount).toLocaleString()))) return;
  const restId   = localStorage.getItem("restaurantId");
  const monthKey = new Date().toISOString().slice(0, 7);
  const payRef   = push(ref(db, `restaurants/${restId}/finance/payments`));
  await set(payRef, { staffId, amount: totalAmount, month: monthKey, date: Date.now() });
  if (typeof showToast === "function") showToast(t("payment_success", "✅ To'lov muvaffaqiyatli qayd etildi!"), "success");
  else alert(t("payment_success", "To'lov muvaffaqiyatli qayd etildi!"));
};

window.renderSalaryReport = function () {
  const restId   = localStorage.getItem("restaurantId");
  const monthKey = new Date().toISOString().slice(0, 7);
  const grid     = document.getElementById("salaryReportGrid");
  if (!grid) return;

  onValue(ref(db, `restaurants/${restId}`), (snap) => {
    const data    = snap.val() || {};
    const users   = data.users || {};
    const allStats= data.finance?.staff_stats  || {};
    const allAdjs = data.finance?.adjustments  || {};

    grid.innerHTML = `
      <!-- Qayta hisoblash tugmasi -->
      <div style="grid-column:1/-1; background:#fffbeb; border:1px solid #fde68a; border-radius:12px;
           padding:14px 18px; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div>
          <div style="font-weight:700; font-size:14px; color:#92400e;">📊 Bu oyning statistikasini qayta hisoblash</div>
          <div style="font-size:12px; color:#b45309; margin-top:2px;">
            Agar buyurtmalar sanasi noto'g'ri ko'rsatilsa, shu tugmani bosing
          </div>
        </div>
        <button id="recalcKpiBtn" onclick="window.recalculateMonthlyKPI()"
          style="background:#f59e0b; color:#fff; border:none; padding:10px 20px;
                 border-radius:9px; cursor:pointer; font-weight:700; font-size:13px; white-space:nowrap;">
          🔄 Qayta hisoblash
        </button>
      </div>
    `;

    let hasStaff = false;

    Object.entries(users).forEach(([uId, user]) => {
      if (!user.active) return;
      if (user.role !== "chef" && user.role !== "waiter") return;
      hasStaff = true;

      const stats      = allStats[uId]?.[monthKey] || { totalEarned: 0, orderCount: 0 };
      const adjs       = Object.values(allAdjs[uId]?.[monthKey] || {});
      const totalBonus = adjs.reduce((s, a) => s + (Number(a.amount) || 0), 0);

      const mode       = user.salaryMode     || "percent";
      const fixed      = Number(user.fixedSalary       || 0);
      const commPct    = Number(user.commissionPercent || 0);
      const ballRate   = Number(user.ballRate          || 0);
      const orderCount = Number(stats.orderCount       || 0);
      const earned     = Number(stats.totalEarned      || 0);

      // Rejimga qarab asosiy maosh
      let baseSalary = 0, detailHtml = "", modeLabel = "";
      const cur = "so'm";

      if (mode === "fixed") {
        baseSalary = fixed;
        modeLabel  = "💼 Oylik";
        detailHtml = `<div style="color:#6366f1; font-weight:600;">Oylik: ${fixed.toLocaleString()} ${cur}</div>`;
      } else if (mode === "percent") {
        baseSalary = earned;
        modeLabel  = "📊 % Foiz";
        detailHtml = `
          <div style="color:#d97706; font-weight:600;">
            Sotuvdan % (KPI): ${earned.toLocaleString()} ${cur}
          </div>
          <div style="color:#6b7280; font-size:11px; margin-top:2px;">
            ${orderCount} ta buyurtma · ${commPct}% stavka
          </div>`;
      } else if (mode === "ball") {
        baseSalary = orderCount * ballRate;
        modeLabel  = "🏆 Ball";
        detailHtml = `
          <div style="color:#10b981; font-weight:600;">
            ${orderCount} ball × ${ballRate.toLocaleString()} = ${baseSalary.toLocaleString()} ${cur}
          </div>
          <div style="color:#6b7280; font-size:11px; margin-top:2px;">1 buyurtma = 1 ball</div>`;
      }

      const finalSalary = baseSalary + totalBonus;
      const roleIcon    = user.role === "chef" ? "👨‍🍳" : "🧑‍🍳";
      const roleLabel   = user.role === "chef" ? "Oshpaz" : "Ofitsiant";
      const borderClr   = user.role === "chef" ? "#10b981" : "#3b82f6";

      // Adjustment ro'yxati
      const adjRows = adjs.length ? adjs.map(a =>
        `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;
              color:${Number(a.amount)>=0?'#16a34a':'#dc2626'};">
           <span>${a.reason||"Qo'shimcha"}</span>
           <b>${Number(a.amount)>=0?"+":""}${Number(a.amount).toLocaleString()} ${cur}</b>
         </div>`).join("") : "";

      grid.innerHTML += `
        <div class="salary-card" style="background:#fff; border:1px solid #e5e7eb;
             border-left:4px solid ${borderClr}; padding:20px; border-radius:15px;
             box-shadow:0 4px 12px rgba(0,0,0,0.07);">

          <!-- HEADER -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <div style="font-size:17px; font-weight:700;">${roleIcon} ${user.name}</div>
              <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                <span style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">${roleLabel}</span>
                <span style="font-size:11px; background:#f1f5f9; color:#475569; padding:2px 8px;
                      border-radius:20px; font-weight:600;">${modeLabel}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px; color:#6b7280;">Jami to'lanadigan:</div>
              <b style="font-size:24px; color:#10b981;">${finalSalary.toLocaleString()}</b>
              <span style="font-size:13px; color:#6b7280;"> ${cur}</span>
            </div>
          </div>

          <!-- DETAL QUTISI -->
          <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px;
               padding:12px 14px; margin-bottom:14px;">
            ${detailHtml}
            <div style="display:flex; justify-content:space-between; font-size:12px;
                 color:#94a3b8; margin-top:8px; padding-top:8px; border-top:1px solid #e5e7eb;">
              <span>Bajarilgan buyurtmalar:</span>
              <b style="color:#1e293b;">${orderCount} ta</b>
            </div>
            ${adjs.length ? `
              <div style="border-top:1px solid #e5e7eb; margin-top:8px; padding-top:8px;">
                <div style="font-size:11px; color:#6b7280; margin-bottom:4px; font-weight:600;">Bonuslar / Jarimalar:</div>
                ${adjRows}
              </div>` : ""}
            ${totalBonus !== 0 ? `
              <div style="display:flex; justify-content:space-between; font-size:13px;
                   font-weight:700; padding-top:6px; margin-top:4px; border-top:1px solid #e5e7eb;
                   color:${totalBonus>=0?'#16a34a':'#dc2626'};">
                <span>Bonus/Jarima jami:</span>
                <span>${totalBonus>=0?"+":""}${totalBonus.toLocaleString()} ${cur}</span>
              </div>` : ""}
          </div>

          <!-- REJIM O'ZGARTIRISH -->
          <details style="margin-bottom:12px;">
            <summary style="cursor:pointer; font-size:12px; font-weight:700; color:#6366f1;
                            list-style:none; display:flex; align-items:center; gap:5px;">
              ⚙️ Maosh rejimini o'zgartirish
            </summary>
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px;
                 padding:14px; margin-top:10px;">

              <!-- 3 ta radio tugma -->
              <label style="font-size:11px; color:#6b7280; font-weight:600; display:block; margin-bottom:8px;">
                Hisoblash usuli:
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:14px;">
                ${[
                  {val:"fixed",   icon:"💼", label:"Oylik",   clr:"#6366f1", bg:"#eff0ff"},
                  {val:"percent", icon:"📊", label:"% Foiz",  clr:"#d97706", bg:"#fffbeb"},
                  {val:"ball",    icon:"🏆", label:"Ball",    clr:"#16a34a", bg:"#f0fdf4"}
                ].map(opt => `
                  <label onclick="
                    document.getElementById('mode-${uId}').value='${opt.val}';
                    window.onSalaryModeChange('${uId}');
                    this.closest('.mode-btns-${uId}') && Array.from(this.closest('.mode-btns-${uId}').children)
                      .forEach(l=>{ l.style.borderColor='#e5e7eb'; l.style.background='#fff'; l.style.color='#64748b'; });
                    this.style.borderColor='${opt.clr}'; this.style.background='${opt.bg}'; this.style.color='${opt.clr}';
                  " style="display:flex; flex-direction:column; align-items:center; gap:4px;
                           padding:8px 4px; border:2px solid ${mode===opt.val?opt.clr:'#e5e7eb'};
                           border-radius:8px; cursor:pointer; font-size:11px; font-weight:600;
                           color:${mode===opt.val?opt.clr:'#64748b'};
                           background:${mode===opt.val?opt.bg:'#fff'}; transition:.15s;">
                    ${opt.icon} ${opt.label}
                  </label>`).join("")}
              </div>
              <select id="mode-${uId}" style="display:none;">
                <option value="fixed"   ${mode==="fixed"  ?"selected":""}>fixed</option>
                <option value="percent" ${mode==="percent"?"selected":""}>percent</option>
                <option value="ball"    ${mode==="ball"   ?"selected":""}>ball</option>
              </select>

              <!-- Oylik input -->
              <div id="row-fixed-${uId}" style="${mode!=="fixed"?"display:none;":""}margin-bottom:10px;">
                <label style="font-size:11px;color:#6b7280;">Oylik maosh (so'm):</label>
                <input type="number" id="fixed-${uId}" value="${fixed}" min="0"
                  style="width:100%;border:1.5px solid #e5e7eb;padding:8px 10px;border-radius:8px;
                         outline:none;font-size:14px;margin-top:4px;box-sizing:border-box;">
              </div>

              <!-- Foiz input -->
              <div id="row-comm-${uId}" style="${mode!=="percent"?"display:none;":""}margin-bottom:10px;">
                <label style="font-size:11px;color:#6b7280;">Har bir buyurtmadan foiz (%):</label>
                <input type="number" id="comm-${uId}" value="${commPct}" min="0" max="100" step="0.5"
                  style="width:100%;border:1.5px solid #e5e7eb;padding:8px 10px;border-radius:8px;
                         outline:none;font-size:14px;margin-top:4px;box-sizing:border-box;">
              </div>

              <!-- Ball input -->
              <div id="row-ball-${uId}" style="${mode!=="ball"?"display:none;":""}margin-bottom:10px;">
                <label style="font-size:11px;color:#6b7280;">
                  1 ball = necha so'm:
                  <span style="color:#10b981;"> (1 buyurtma = 1 ball)</span>
                </label>
                <input type="number" id="ball-${uId}" value="${ballRate}" min="0"
                  style="width:100%;border:1.5px solid #e5e7eb;padding:8px 10px;border-radius:8px;
                         outline:none;font-size:14px;margin-top:4px;box-sizing:border-box;">
              </div>

              <button onclick="window.updateStaffSalarySettings('${uId}')"
                style="width:100%; background:#6366f1; color:#fff; border:none; padding:10px;
                       border-radius:8px; cursor:pointer; font-weight:700; font-size:13px;">
                ✅ Saqlash
              </button>
            </div>
          </details>

          <!-- AMALLAR -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button onclick="window.addStaffAdjustment('${uId}')"
              style="background:#f3f4f6; border:1px solid #e5e7eb; padding:10px;
                     border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;">
              ➕ Bonus / Jarima
            </button>
            <button onclick="window.paySalary('${uId}', ${finalSalary})"
              style="background:#10b981; color:#fff; border:none; padding:10px;
                     border-radius:8px; cursor:pointer; font-size:13px; font-weight:700;">
              💸 To'lov qilish
            </button>
          </div>
        </div>
      `;
    });

    if (!hasStaff) {
      grid.innerHTML += `<p style="color:#9ca3af; text-align:center; padding:20px;">
        Hozircha faol xodimlar yo'q</p>`;
    }
  });
};

window.onSalaryModeChange = function (staffId) {
  const mode = document.getElementById(`mode-${staffId}`)?.value || "percent";
  const show = id => { const el=document.getElementById(id); if(el) el.style.display=""; };
  const hide = id => { const el=document.getElementById(id); if(el) el.style.display="none"; };
  hide(`row-fixed-${staffId}`); hide(`row-comm-${staffId}`); hide(`row-ball-${staffId}`);
  if (mode==="fixed")   show(`row-fixed-${staffId}`);
  if (mode==="percent") show(`row-comm-${staffId}`);
  if (mode==="ball")    show(`row-ball-${staffId}`);
};

window.updateStaffSalarySettings = async function (staffId) {
  const restId  = localStorage.getItem("restaurantId");
  const mode    = document.getElementById(`mode-${staffId}`)?.value     || "percent";
  const fixed   = Number(document.getElementById(`fixed-${staffId}`)?.value) || 0;
  const comm    = Number(document.getElementById(`comm-${staffId}`)?.value)  || 0;
  const ball    = Number(document.getElementById(`ball-${staffId}`)?.value)  || 0;
  try {
    await update(ref(db, `restaurants/${restId}/users/${staffId}`), {
      salaryMode: mode, fixedSalary: fixed, commissionPercent: comm, ballRate: ball
    });
    if (typeof showToast === "function") showToast(t("salary_rates_saved", "✅ Maosh sozlamalari saqlandi!"), "success");
    else alert(t("salary_rates_saved", "Maosh sozlamalari saqlandi!"));
    window.renderSalaryReport();
  } catch (e) { console.error("Update error:", e); }
};

window.calculateSalaries = async function () {
  window.renderSalaryReport();
};

function normalizeKitchenStatus(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    approved: "approved",
    cooking: "cooking",
    cooked: "cooked",
    accepted: "accepted",
    delivered: "delivered",
    closed: "closed"
  };
  return map[s] || "approved";
}

function listenKitchenNotifications() {
  const callsRef = ref(db, BASE_PATH + "/waiterCalls");

  onValue(callsRef, (snap) => {
    const calls = snap.val() || {};

    Object.entries(calls).forEach(([callId, call]) => {
      if (call.status === "waiting" && !call.adminNotified) {

        if (typeof playSound === "function") {
          playSound();
        }

        showAdminNotification(
          `🍽 ${t("a_kitchen_ready_notify", "TAYYOR: Stol {table} uchun buyurtma tayyor bo'ldi!").replace("{table}", call.table)}`,
          "success"
        );

        update(ref(db, BASE_PATH + "/waiterCalls/" + callId), {
          adminNotified: true,
          deliveredToAdminAt: Date.now()
        });
      }
    });
  });
}

/* =========================
   FEEDBACK ORQALI CHEGIRMA BERISH
========================= */
window.rewardFromFeedback = async function (orderId, score, feedbackId) {
  if (!orderId || orderId === "undefined" || orderId === "null") {
    alert(t("a_fb_no_order", "Bu fikrga bog'langan buyurtma topilmadi. Mijozni aniqlab bo'lmaydi."));
    return;
  }

  try {
    const orderSnap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));

    if (!orderSnap.exists()) {
      alert(t("a_fb_archived", "Ushbu buyurtma arxivga o'tgan yoki topilmadi."));
      return;
    }

    const order = orderSnap.val();
    const phone = order.customerPhone || order.clientPhone || order.phone;

    if (!phone) {
      alert(t("a_fb_no_phone", "Bu buyurtmada mijozning telefon raqami kiritilmagan."));
      return;
    }

    let defaultPercent = score >= 4 ? 10 : 15;
    const percent = prompt(t("a_fb_prompt_percent", "Mijoz ({phone}) uchun necha foiz chegirma bermoqchisiz?").replace("{phone}", phone), defaultPercent);

    if (!percent || isNaN(percent) || percent <= 0 || percent > 100) return;
    const pct = Number(percent);

    const restId = localStorage.getItem("restaurantId");

    // Chegirmani xavfsiz birlashtirish (kattasi ishlaydi, kichikisi keyinga qoladi)
    const { active, queued } = await safeSetPersonalDiscount(restId, phone, pct, "feedback_reward");

    const code = `FEEDBACK${pct}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await set(ref(db, `${BASE_PATH}/discounts/${code}`), {
      code, percent: pct, used: false, ownerPhone: phone,
      createdAt: Date.now(), createdBy: "admin_feedback",
      reason: `Feedback score: ${score.toFixed(1)}`
    });

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("create",
        `🎁 ${phone} ga fikr uchun ${pct}% chegirma. Faol: ${active}%, Keyingi: ${queued}%`);
    }

    // Feedbackni "javob berildi" deb belgilash
    if (feedbackId) {
      await update(ref(db, `${BASE_PATH}/feedback/${feedbackId}`), {
        adminReplied: true,
        adminReplyAt: Date.now(),
        adminReplyType: score >= 4 ? "thank_you" : "apology_discount",
        discountCode: code,
        discountActive: active,
        discountQueued: queued
      });
    }

    const msg = queued > 0
      ? `✅ ${phone} ga ${active}% chegirma (fikr uchun)! ${queued}% keyingi buyurtmaga qoldi.`
      : `✅ ${phone} ga ${active}% chegirma (fikr uchun) berildi!`;
    showAdminNotification(msg, "success");

    if (typeof loadFeedbacks === "function") loadFeedbacks();

  } catch (error) {
    console.error(t("discount_give_error_log", "Chegirma berishda xato:"), error);
    alert(t("notify.error", "Xatolik yuz berdi!"));
  }
};

window.grantVipStatus = async function (prefillPhone) {
  // ── Modal yaratish ──
  const existing = document.getElementById("vipGrantModal");
  if (existing) existing.remove();

  const restId = localStorage.getItem("restaurantId");

  // VIP sozlamalarini Firebaseden o'qiymiz
  let defaultOrders = 3;
  let defaultPercent = 10;
  try {
    const settSnap = await get(ref(db, `restaurants/${restId}/settings/vipDefaults`));
    if (settSnap.exists()) {
      defaultOrders  = settSnap.val().orderCount  || defaultOrders;
      defaultPercent = settSnap.val().discountPct  || defaultPercent;
    }
  } catch (_) {}

  const modal = document.createElement("div");
  modal.id = "vipGrantModal";
  modal.style = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;
    align-items:center;justify-content:center;z-index:99999;padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <span style="font-size:28px;">👑</span>
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">VIP Status Berish</div>
          <div style="font-size:13px;color:#64748b;">Mijozga VIP imtiyoz bering</div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">📞 Telefon raqam</label>
        <input id="vipGrantPhone" type="text" value="${prefillPhone || ''}"
          placeholder="+998901234567"
          style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box;outline:none;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">🎯 Chegirma foizi (%)</label>
        <input id="vipGrantPercent" type="number" min="1" max="100" value="${defaultPercent}"
          style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box;outline:none;">
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Har bir VIP xaridda qo'llaniladigan chegirma</div>
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">🛒 Nechta xarid uchun?</label>
        <input id="vipGrantOrders" type="number" min="1" max="999" value="${defaultOrders}"
          style="width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box;outline:none;">
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Shu marta xarid qilgandan keyin VIP bekor bo'ladi</div>
      </div>

      <div id="vipGrantPreview" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px;margin-bottom:18px;font-size:13px;color:#5b21b6;text-align:center;">
        Mijoz <b id="vipGrantOrders2">${defaultOrders}</b> marta xarid qilganda har biriga <b id="vipGrantPercent2">${defaultPercent}%</b> chegirma oladi
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('vipGrantModal').remove()"
          style="flex:1;padding:11px;border:1.5px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#374151;font-weight:700;cursor:pointer;font-size:14px;">
          Bekor
        </button>
        <button id="vipGrantConfirmBtn"
          style="flex:2;padding:11px;border:none;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-weight:800;cursor:pointer;font-size:14px;">
          👑 VIP Berish
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Preview yangilanishi
  const pctInput = modal.querySelector("#vipGrantPercent");
  const ordInput = modal.querySelector("#vipGrantOrders");
  const pct2El   = modal.querySelector("#vipGrantPercent2");
  const ord2El   = modal.querySelector("#vipGrantOrders2");

  const updatePreview = () => {
    if (pct2El) pct2El.textContent = pctInput.value + "%";
    if (ord2El) ord2El.textContent = ordInput.value;
  };
  pctInput.addEventListener("input", updatePreview);
  ordInput.addEventListener("input", updatePreview);

  modal.querySelector("#vipGrantConfirmBtn").onclick = async function () {
    const phoneRaw   = modal.querySelector("#vipGrantPhone").value.trim();
    const percentNum = Number(pctInput.value);
    const ordersNum  = Number(ordInput.value);

    if (!phoneRaw || phoneRaw.length < 9) {
      alert(t("invalid_phone", "Telefon raqamni to'liq kiriting!")); return;
    }
    if (!percentNum || percentNum < 1 || percentNum > 100) {
      alert(t("alerts_invalid_promo_percent", "Chegirma foizini 1–100 oralig'ida kiriting!")); return;
    }
    if (!ordersNum || ordersNum < 1) {
      alert(t("vip_min_orders", "Kamida 1 ta xarid kiriting!")); return;
    }

    const cleanPhone      = phoneRaw.replace(/\D/g, "");
    const normalizedPhone = cleanPhone.startsWith("998") ? `+${cleanPhone}` : `+998${cleanPhone.slice(-9)}`;

    this.disabled = true;
    this.textContent = `⏳ ${t("loading", "Saqlanmoqda...")}`;

    try {
      // Mijoz mavjud emasligini tekshirib, kerak bo'lsa yaratamiz
      const custRef  = ref(db, `restaurants/${restId}/customers/${normalizedPhone}`);
      const custSnap = await get(custRef);
      const custData = custSnap.exists() ? custSnap.val() : {};

      await update(custRef, {
        ...(custSnap.exists() ? {} : { phone: normalizedPhone, visits: 0, totalSpent: 0, createdAt: Date.now() }),
        isVip:              true,
        vipDiscountPercent: percentNum,
        vipOrdersTotal:     ordersNum,
        vipOrdersUsed:      0,           // sanagich noldan boshlanadi
        vipGrantedAt:       Date.now(),
        vipGrantedBy:       localStorage.getItem("userId") || "admin"
      });

      // VIP promokodini discounts/ ga ham yozamiz — mijoz to'lov oynasida ko'rsin
      const vipCode = `VIP${percentNum}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const phoneKey9 = normalizedPhone.replace(/\D/g, "").slice(-9);
      await set(ref(db, `restaurants/${restId}/discounts/${vipCode}`), {
        code:        vipCode,
        percent:     percentNum,
        used:        false,
        usedCount:   0,
        maxUses:     ordersNum,
        usesLeft:    ordersNum,
        ownerPhone:  phoneKey9,
        isVipPromo:  true,
        createdAt:   Date.now(),
        createdBy:   "admin_vip",
        vipOrdersTotal: ordersNum
      });

      modal.remove();
      showAdminNotification(
        t("a_vip_success", "{phone} ga {percent}% VIP status berildi!")
          .replace("{phone}", normalizedPhone)
          .replace("{percent}", percentNum)
          + ` (${ordersNum} ${t("orders_count", "buyurtma")})`,
        "success"
      );

    } catch (error) {
      console.error(t("vip_grant_error_log", "VIP berishda xato:"), error);
      this.disabled = false;
      this.textContent = `👑 ${t("grant_vip_btn", "VIP Berish")}`;
      alert(t("notify.error", "Xatolik yuz berdi") + ": " + error.message);
    }
  };

  // Modal tashqarisiga bosganda yopiladi
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });
};

/* =========================
   BOSHQA SAHIFALARGA O'TISH 
========================= */
window.openStaffPage = function (pageType, staffId) {
  const restId = localStorage.getItem("restaurantId");

  if (!restId) {
    alert(typeof t === 'function' ? t("rest_id_not_found", "Restoran ID topilmadi! Iltimos, sahifani yangilang.") : "Restoran ID topilmadi!");
    return;
  }

  let url = `${pageType}.html?rest=${restId}`;

  if (staffId) {
    url += `&viewAs=${staffId}`;
  }

  window.open(url, '_blank');
};

// ==========================================
// 🚀 ADMIN: TIZIM EGASI BILAN JONLI CHAT
// ==========================================
window.initAdminSupportChat = function () {
  const chatHtml = `
  <style>
    .admin-chat-btn { position: fixed; bottom: 30px; right: 30px; background: #3b82f6; color: #fff; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; cursor: pointer; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); z-index: 99999; transition: 0.3s; }
    .admin-chat-btn:hover { transform: scale(1.1); }
    .admin-chat-modal { position: fixed; bottom: 100px; right: 30px; width: 350px; height: 480px; background: #fff; border-radius: 15px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); display: flex; flex-direction: column; z-index: 99999; overflow: hidden; font-family: sans-serif; transition: 0.3s; }
    .admin-chat-modal.hidden { opacity: 0; pointer-events: none; transform: translateY(20px); }
    .admin-chat-header { background: #1e293b; color: #fff; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
    .admin-chat-header button { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
    .admin-chat-messages { flex: 1; overflow-y: auto; padding: 15px; background: #f0f2f5; display: flex; flex-direction: column; gap: 10px; }
    .sa-msg-row { display: flex; flex-direction: column; max-width: 85%; }
    .sa-msg-row.me { align-self: flex-end; align-items: flex-end; }
    .sa-msg-row.them { align-self: flex-start; align-items: flex-start; }
    .sa-msg-bubble { padding: 10px 14px; border-radius: 15px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); line-height: 1.4; color: #111;}
    .sa-msg-row.me .sa-msg-bubble { background: #dcf8c6; border-bottom-right-radius: 2px; }
    .sa-msg-row.them .sa-msg-bubble { background: #fff; border-bottom-left-radius: 2px; }
    .sa-msg-time { font-size: 11px; color: #64748b; margin-top: 4px; }
    .admin-chat-input { padding: 10px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }
    .admin-chat-input input { flex: 1; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 14px;}
    .admin-chat-input button { background: #3b82f6; color: #fff; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;}
  </style>
  <div class="admin-chat-btn" onclick="window.toggleAdminChat()"><i class="fa-solid fa-headset"></i></div>
  <div id="adminChatModal" class="admin-chat-modal hidden">
    <div class="admin-chat-header">
      <span>🎧 ${t("chat_support_title", "Tizim Egasi (Yordam)")}</span>
      <button onclick="window.toggleAdminChat()"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="adminChatMessages" class="admin-chat-messages"></div>
    <div class="admin-chat-input">
      <input type="text" id="adminChatInput" autocomplete="off" placeholder="${t("type_message_placeholder", "Xabar yozing...")}" onkeypress="if(event.key==='Enter') window.sendAdminMessage()">
      <button onclick="window.sendAdminMessage()"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', chatHtml);
  window.listenAdminChat();
};

window.toggleAdminChat = function () {
  const modal = document.getElementById('adminChatModal');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) {
    const msgsDiv = document.getElementById('adminChatMessages');
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }
};

window.listenAdminChat = function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const chatRef = ref(db, `restaurants/${restId}/superadmin_chat`);

  onValue(chatRef, (snap) => {
    const msgsDiv = document.getElementById('adminChatMessages');
    msgsDiv.innerHTML = '';
    if (!snap.exists()) {
      msgsDiv.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px; font-size:13px;">${t("chat_with_owner_placeholder", "Tizim egasi bilan chat. Savollaringizni shu yerda yozishingiz mumkin.")}</div>`;
      return;
    }
    const msgs = snap.val();
    Object.values(msgs).forEach(m => {
      const isMe = m.sender === 'admin';
      msgsDiv.innerHTML += `
        <div class="sa-msg-row ${isMe ? 'me' : 'them'}">
          <div class="sa-msg-bubble">${m.text}</div>
          <div class="sa-msg-time">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>`;
    });
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  });
};

window.sendAdminMessage = function () {
  const input = document.getElementById('adminChatInput');
  const text = input.value.trim();
  const restId = localStorage.getItem("restaurantId");
  if (!text || !restId) return;

  input.value = '';
  const now = Date.now();

  push(ref(db, `restaurants/${restId}/superadmin_chat`), {
    sender: "admin",
    text: text,
    timestamp: now
  });
};

setTimeout(window.initAdminSupportChat, 1500);

// ==========================================
// 🚀 ADMIN: XODIMLAR BILAN JONLI CHAT (ICHKI CHAT)
// ==========================================
window.initStaffChatSystem = function () {
  // Eski elementlarni tozalash (til o'zgarganda qayta chaqirilganda)
  const oldBtn = document.querySelector('.stf-chat-btn');
  const oldModal = document.getElementById('stfChatModal');
  if (oldBtn) oldBtn.remove();
  if (oldModal) oldModal.remove();

  const chatHtml = `
  <style>
    .stf-chat-btn { position: fixed; bottom: 100px; right: 30px; background: #8b5cf6; color: #fff; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; cursor: pointer; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); z-index: 99999; transition: 0.3s; }
    .stf-chat-btn:hover { transform: scale(1.1); }
    .stf-chat-modal { position: fixed; bottom: 170px; right: 30px; width: 350px; height: 500px; background: #fff; border-radius: 15px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); display: flex; flex-direction: column; z-index: 99999; overflow: hidden; font-family: sans-serif; transition: 0.3s; }
    .stf-chat-modal.hidden { opacity: 0; pointer-events: none; transform: translateY(20px); }
    .stf-chat-header { background: #1e293b; color: #fff; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
    .stf-chat-header button { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }

    .stf-view { flex: 1; display: none; flex-direction: column; background: #f8f9fa; overflow-y: auto;}
    .stf-view.active { display: flex; }

    .stf-role-btn { background: #fff; border: 1px solid #e2e8f0; padding: 15px; margin: 10px; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 10px; transition: 0.2s; color: #333; }
    .stf-role-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }

    .stf-user-item { background: #fff; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; color: #333; transition: 0.2s;}
    .stf-user-item:hover { background: #f1f5f9; }
    .stf-user-item.all-btn { background: #eff6ff; color: #2563eb; border-bottom: 2px solid #bfdbfe; }

    .stf-chat-messages { flex: 1; overflow-y: auto; padding: 15px; background: #f0f2f5; display: flex; flex-direction: column; gap: 10px; }
    .sa-msg-row { display: flex; flex-direction: column; max-width: 85%; }
    .sa-msg-row.me { align-self: flex-end; align-items: flex-end; }
    .sa-msg-row.them { align-self: flex-start; align-items: flex-start; }
    .sa-msg-bubble { padding: 10px 14px; border-radius: 15px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); line-height: 1.4; color: #111;}
    .sa-msg-row.me .sa-msg-bubble { background: #dcf8c6; border-bottom-right-radius: 2px; }
    .sa-msg-row.them .sa-msg-bubble { background: #fff; border-bottom-left-radius: 2px; }
    .sa-msg-time { font-size: 11px; color: #64748b; margin-top: 4px; }

    .stf-chat-input { padding: 10px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }
    .stf-chat-input input { flex: 1; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 14px;}
    .stf-chat-input button { background: #8b5cf6; color: #fff; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;}
  </style>
  
  <div class="stf-chat-btn" onclick="window.toggleStaffChat()"><i class="fa-solid fa-comment-dots"></i></div>
  
  <div id="stfChatModal" class="stf-chat-modal hidden">
    <div class="stf-chat-header">
      <span id="stfChatTitle">${t("chat_with_staff", "Xodimlar bilan Chat")}</span>
      <button onclick="window.toggleStaffChat()"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div id="stfRoleView" class="stf-view active">
      <button class="stf-role-btn" onclick="window.openStfList('chef')">👨‍🍳 ${t("chat_with_chefs_short", "Oshpazlar bilan")}</button>
      <button class="stf-role-btn" onclick="window.openStfList('waiter')">🧑‍🍳 ${t("chat_with_waiters_short", "Ofitsiantlar bilan")}</button>
    </div>

    <div id="stfListView" class="stf-view">
      <div style="padding: 10px; background: #fff; border-bottom: 1px solid #ddd;">
        <button onclick="window.showStfView('stfRoleView', t('chat_with_staff', 'Xodimlar bilan Chat'))" style="background:none; border:none; color:#8b5cf6; cursor:pointer; font-weight:bold; font-size:14px;"><i class="fa-solid fa-arrow-left"></i> ${t("back_btn", "Orqaga")}</button>
      </div>
      <div id="stfListContainer"></div>
    </div>

    <div id="stfRoomView" class="stf-view">
      <div style="padding: 10px; background: #fff; border-bottom: 1px solid #ddd;">
        <button onclick="window.showStfView('stfListView')" style="background:none; border:none; color:#8b5cf6; cursor:pointer; font-weight:bold; font-size:14px;"><i class="fa-solid fa-arrow-left"></i> ${t("back_btn", "Orqaga")}</button>
      </div>
      <div id="stfChatMessages" class="stf-chat-messages"></div>
      <div class="stf-chat-input">
        <input type="text" id="stfChatInput" autocomplete="off" placeholder="${t("type_message_placeholder", "Xabar yozing...")}" onkeypress="if(event.key==='Enter') window.sendStfMessage()">
        <button onclick="window.sendStfMessage()"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', chatHtml);
};

window.stfCurrentRole = null;
window.stfCurrentTarget = null;
window.stfUnsubscribe = null;

window.toggleStaffChat = function () {
  const modal = document.getElementById('stfChatModal');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) {
    window.showStfView('stfRoleView', t('chat_with_staff', 'Xodimlar bilan Chat'));
  }
};

window.showStfView = function (viewId, title) {
  document.querySelectorAll('.stf-view').forEach(el => el.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (title) document.getElementById('stfChatTitle').innerText = title;
  if (window.stfUnsubscribe) { window.stfUnsubscribe(); window.stfUnsubscribe = null; }
};

window.openStfList = function (role) {
  window.stfCurrentRole = role;
  const title = role === 'chef' ? '👨‍🍳 ' + t("chefs", "Oshpazlar") : '🧑‍🍳 ' + t("waiters", "Ofitsiantlar");
  window.showStfView('stfListView', title);

  const container = document.getElementById('stfListContainer');

  container.innerHTML = `
    <div class="stf-user-item all-btn" onclick="window.openStfRoom('all', '📢 ${t("chat_write_all", "Barchasiga yozish")}')">
      📢 ${t("chat_write_all_group", "Barchasiga yozish (Guruh)")}
    </div>
  `;

  const users = window.allUsers || {};
  Object.entries(users).forEach(([id, u]) => {
    if (u.role === role && u.active) {
      const icon = role === 'chef' ? '👨‍🍳' : '🧑‍🍳';
      container.innerHTML += `
        <div class="stf-user-item" onclick="window.openStfRoom('${id}', '${icon} ${u.name}')">
          <span>${icon} ${u.name}</span>
        </div>
      `;
    }
  });
};

window.openStfRoom = function (targetId, targetName) {
  window.stfCurrentTarget = targetId;
  window.showStfView('stfRoomView', targetName);

  const msgsDiv = document.getElementById('stfChatMessages');
  msgsDiv.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px;">${t("loading", "Yuklanmoqda...")}</div>`;

  const restId = localStorage.getItem("restaurantId");

  let chatPath;
  if (targetId === "all") {
    chatPath = `restaurants/${restId}/internal_chat/group_${window.stfCurrentRole}`;
  } else {
    // ✅ TO'G'RI PATH: chef.js bilan bir xil
    if (window.stfCurrentRole === 'chef') {
      chatPath = `restaurants/${restId}/chats/admin_chef_${targetId}/messages`;
    } else {
      chatPath = `restaurants/${restId}/chats/admin_waiter_${targetId}/messages`;
    }
  }

  window.stfUnsubscribe = onValue(ref(db, chatPath), (snap) => {
    msgsDiv.innerHTML = '';
    if (!snap.exists()) {
      msgsDiv.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px; font-size:13px;">${t("no_messages_yet", "Hali xabarlar yo'q. Birinchi bo'lib yozing!")}</div>`;
      return;
    }
    const msgs = snap.val();
    const myAdminId = localStorage.getItem("userId") || "admin";
    Object.values(msgs).forEach(m => {
      const isMe = String(m.senderId) === String(myAdminId) || m.senderRole === 'admin';
      msgsDiv.innerHTML += `
        <div class="sa-msg-row ${isMe ? 'me' : 'them'}">
          <div class="sa-msg-bubble">${m.text}</div>
          <div class="sa-msg-time">${m.senderName || ''} • ${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>`;
    });
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  });
};

window.sendStfMessage = function () {
  const input = document.getElementById('stfChatInput');
  const text = input.value.trim();
  const restId = localStorage.getItem("restaurantId");
  if (!text || !restId || !window.stfCurrentTarget) return;

  input.value = '';
  const now = Date.now();
  const senderName = t("head_admin", "Bosh Admin");
  const adminUserId = localStorage.getItem("userId") || "admin";

  const payload = {
    text: text,
    senderId: adminUserId,
    senderRole: "admin",
    senderName: senderName,
    targetId: window.stfCurrentTarget,
    createdAt: now,
    timestamp: now
  };

  if (window.stfCurrentTarget === "all") {
    push(ref(db, `restaurants/${restId}/internal_chat/group_${window.stfCurrentRole}`), payload);

    const users = window.allUsers || {};

    Object.entries(users).forEach(([uId, u]) => {
      if (u.role === window.stfCurrentRole && u.active) {
        // ✅ TO'G'RI PATH
        const chatNode = window.stfCurrentRole === 'chef'
          ? `chats/admin_chef_${uId}`
          : `chats/admin_waiter_${uId}`;

        update(ref(db, `restaurants/${restId}/${chatNode}/meta`), {
          targetId: uId,
          lastMessage: t("to_all_prefix", "📢 Barchaga: ") + text,
          updatedAt: now,
          lastSenderId: adminUserId,
          lastSenderRole: "admin"
        });
        const userPayload = { ...payload, targetId: uId, text: t("to_all_prefix", "📢 Barchaga: ") + text };
        push(ref(db, `restaurants/${restId}/${chatNode}/messages`), userPayload);
      }
    });

  } else {
    // ✅ TO'G'RI PATH: admin_chef_ yoki admin_waiter_
    const chatNode = window.stfCurrentRole === 'chef'
      ? `chats/admin_chef_${window.stfCurrentTarget}`
      : `chats/admin_waiter_${window.stfCurrentTarget}`;

    update(ref(db, `restaurants/${restId}/${chatNode}/meta`), {
      targetId: window.stfCurrentTarget,
      lastMessage: text,
      updatedAt: now,
      lastSenderId: adminUserId,
      lastSenderRole: "admin"
    });

    push(ref(db, `restaurants/${restId}/${chatNode}/messages`), payload);
  }
};

setTimeout(window.initStaffChatSystem, 2500);

// ==========================================
// 📦 OMBOR VA KALKULYATSIYA: MASALLIQLARNI AYIRISH
// ==========================================
window.deductOrderInventory = async function (orderId) {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;
  const BASE_PATH = `restaurants/${restId}`;

  try {
    const orderSnap = await get(ref(db, `${BASE_PATH}/orders/${orderId}`));
    if (!orderSnap.exists()) return;
    const order = orderSnap.val();

    if (order.inventoryDeducted) return;

    const items = order.items || {};
    const defaultThresholds = { kg: 1, l: 1, gr: 200, ml: 200, dona: 5 };

    for (const [, item] of Object.entries(items)) {
      const menuId = item.menuId || item.id || item.itemId;
      if (!menuId) continue;
      const qty = Number(item.qty || 1);

      // Menu dan recipe o'qish
      let recipe = [];
      try {
        const menuSnap = await get(ref(db, `${BASE_PATH}/menu/${menuId}`));
        if (!menuSnap.exists()) continue;
        const recipeRaw = menuSnap.val().recipe || [];
        recipe = Array.isArray(recipeRaw) ? recipeRaw : Object.values(recipeRaw);
      } catch (e) {
        console.warn(`Menu o'qishda xato (${menuId}):`, e);
        continue;
      }

      if (!recipe.length) continue;

      // Har bir masalliq uchun ALOHIDA try/catch — biri xato bo'lsa qolganlari davom etadi
      for (const ing of recipe) {
        const ingId = ing.id;
        const recipeUnit    = ing.unit || "gr";
        const inventoryUnit = window.allInventory?.[ingId]?.unit || "gr";
        const rawNeeded     = Number(ing.amount || 0) * qty;
        const needed        = convertToBaseUnit(rawNeeded, recipeUnit, inventoryUnit);
        if (!ingId || needed <= 0) continue;

        try {
          const ingRef = ref(db, `${BASE_PATH}/inventory/${ingId}/stock`);

          // runTransaction — atomic ayirish
          await runTransaction(ingRef, (currentStock) => {
            if (currentStock === null) return undefined; // abort — Firebase qayta urinadi
            return Math.max(0, currentStock - needed);
          });

          // Transaction tugagandan keyin yangi qiymatni o'qish (eng ishonchli usul)
          const afterSnap = await get(ingRef);
          const afterVal = afterSnap.val() ?? 0;

          // ingredients yo'lini sinxronlash
          await update(ref(db, `${BASE_PATH}/ingredients/${ingId}`), { stock: afterVal });

          // Low-stock ogohlantirish
          const ingName = translateIngName(window.allInventory?.[ingId]?.name || ing.name) || ingId;
          const ingUnit = window.allInventory?.[ingId]?.unit || ing.unit || "gr";
          const ingMinStock = parseFloat(window.allInventory?.[ingId]?.minStock || 0);
          const warnThreshold = ingMinStock > 0 ? ingMinStock : (defaultThresholds[ingUnit] ?? 10);

          if (afterVal <= 0) {
            console.warn(`⛔ "${ingName}" omborda tugadi!`);
            if (typeof showAdminNotification === "function") {
              showAdminNotification(`⛔ "${ingName}" ${t("stock_empty", "Tugagan")}!`, "error");
            }
          } else if (afterVal <= warnThreshold) {
            console.warn(`⚠️ "${ingName}" kam qoldi: ${afterVal} ${ingUnit}`);
            if (typeof showAdminNotification === "function") {
              showAdminNotification(`⚠️ "${ingName}" ${t("stock_low", "Kam qoldi")}: ${afterVal} ${ingUnit}`, "warning");
            }
          }
        } catch (ingErr) {
          // Bu masalliq xato berdi — keyingisiga o'tamiz, to'xtamaymiz
          console.error(`Inventory ayirishda xato (${ingId} / ${ing.name || ingId}):`, ingErr);
        }
      }
    }

    await update(ref(db, `${BASE_PATH}/orders/${orderId}`), {
      inventoryDeducted: true
    });

  } catch (error) {
    console.error(typeof t === "function" ? t("inventory_error_log", "Inventory error:") : "Inventory error:", error);
  }
};

/* =========================
   FOOTER VA HEADERNI YANGILASH
========================= */
window.loadFooterSettings = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  try {
    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (!database) return;

    const snap = await get(ref(database, `restaurants/${restId}/settings`));

    if (snap.exists()) {
      const settings = snap.val();

      const footerDiv = document.querySelector('.support-footer');
      if (footerDiv) {
        footerDiv.innerHTML = `
          <p><span data-i18n="support_working_hours">Ish vaqti</span>: <b>${settings.workingHours || "09:00 - 20:00"}</b></p>
          <p><span data-i18n="support_contact">Aloqa</span>: <b>${settings.contactPhone || "+998 90 123 45 67"}</b></p>
        `;
      }

      const logoEl = document.querySelector('.header .logo') || document.querySelector('.logo');
      if (logoEl && settings.restaurantName) {
        logoEl.innerText = settings.restaurantName;
        document.title = `${settings.restaurantName} — Nesta`;
      }

      if (settings.restaurantLogoUrl) {
        window.applyRestaurantLogo(settings.restaurantLogoUrl);
      }
    }
  } catch (error) {
    console.error(t("settings_load_error_log", "Sozlamalarni yuklashda xato:"), error);
  }
};

/* =========================
   LOGO YUKLASH VA KO'RSATISH
========================= */
window.applyRestaurantLogo = function (logoUrl) {
  if (!logoUrl) return;

  const headerLogoImg = document.getElementById("headerLogoImg");
  if (headerLogoImg) {
    headerLogoImg.src = logoUrl;
    headerLogoImg.style.display = "block";
    headerLogoImg.removeAttribute("onerror");
  }

  const existingLogoImg = document.getElementById("restaurantLogoImg");
  if (existingLogoImg) {
    existingLogoImg.src = logoUrl;
    existingLogoImg.style.display = "block";
  }

  if (!headerLogoImg && !existingLogoImg) {
    const logoEl = document.querySelector('.sidebar-logo')
      || document.querySelector('.header .logo')
      || document.querySelector('.brand')
      || document.querySelector('.logo');
    if (logoEl) {
      const imgEl = document.createElement("img");
      imgEl.id = "restaurantLogoImg";
      imgEl.src = logoUrl;
      imgEl.alt = t("restaurant_logo_alt", "Restoran logotipi");
      imgEl.style.cssText = "height:40px; width:40px; object-fit:contain; border-radius:50%; margin-right:8px; vertical-align:middle; flex-shrink:0;";
      logoEl.insertBefore(imgEl, logoEl.firstChild);
    }
  }

  const previewEl = document.getElementById("logoPreview");
  const previewContainer = document.getElementById("logoPreviewContainer");
  if (previewEl) {
    previewEl.src = logoUrl;
    previewEl.style.display = "block";
  }
  if (previewContainer) {
    previewContainer.style.display = "flex";
  }
};

/* =========================
   SOZLAMALARNI SAQLASH (ISH VAQTI + TELEFON + LOGO)
========================= */
window.saveRestaurantSettings = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) return;

  const workingHoursInput = document.getElementById("workingHoursInput");
  const contactPhoneInput = document.getElementById("contactPhoneInput");

  const workingHours = workingHoursInput ? workingHoursInput.value.trim() : "";
  const contactPhone = contactPhoneInput ? contactPhoneInput.value.trim() : "";

  if (!workingHours) {
    alert(t("enter_working_hours", "Iltimos, ish vaqtini kiriting!"));
    return;
  }
  if (!contactPhone) {
    alert(t("enter_contact_phone", "Iltimos, telefon raqamini kiriting!"));
    return;
  }

  try {
    await update(ref(database, `restaurants/${restId}/settings`), {
      workingHours,
      contactPhone
    });

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("update", t("settings_updated_log", "⚙️ Restoran sozlamalari yangilandi (ish vaqti va telefon)."));
    }

    if (typeof showAdminNotification === "function") {
      showAdminNotification(t("settings_saved", "✅ Sozlamalar saqlandi!"), "success");
    } else {
      alert(t("settings_saved", "✅ Sozlamalar saqlandi!"));
    }

    // Footer va headerni darhol yangilash
    if (typeof window.loadFooterSettings === "function") {
      window.loadFooterSettings();
    }
  } catch (error) {
    console.error(t("settings_save_error_log", "Sozlamalarni saqlashda xato:"), error);
    alert(t("notify.error", "Saqlashda xatolik yuz berdi."));
  }
};

/* =========================
   LOGOTIP YUKLASH (BASE64 → FIREBASE REALTIME DATABASE)
   Firebase Storage ishlatilmaydi — kvota muammosidan xoli
========================= */

// Rasmni canvas orqali kichraytiradi va Base64 qaytaradi
function _resizeImageToBase64(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Fayl o'qishda xato"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Rasm yuklashda xato"));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        // Nisbatni saqlab kichraytirish
        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // SVG bo'lsa PNG sifatida saqlash, aks holda JPEG
        const outputType = file.type === "image/svg+xml" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.uploadRestaurantLogo = async function () {
  const fileInput = document.getElementById("logoFileInput");
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert(t("select_logo_file", "Iltimos, logotip rasmini tanlang!"));
    return;
  }

  const file = fileInput.files[0];
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    alert(t("invalid_image_type", "Faqat rasm fayllarini yuklash mumkin (JPG, PNG, GIF, WEBP, SVG)!"));
    return;
  }
  // Base64 saqlaganda 5MB asl fayl ≈ ~6.7MB Base64 bo'ladi.
  // Firebase RTDB node limiti 10MB, shuning uchun 1.5MB gacha asl fayl qabul qilamiz.
  // Lekin biz canvas orqali kichraytirganiz uchun natija ancha kichik bo'ladi.
  if (file.size > 5 * 1024 * 1024) {
    alert(t("file_too_large", "Fayl hajmi 5 MB dan oshmasligi kerak!"));
    return;
  }

  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) return;

  const uploadBtn = document.getElementById("uploadLogoBtn");
  const uploadStatus = document.getElementById("logoUploadStatus");

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerText = t("uploading", "Yuklanmoqda...");
  }
  if (uploadStatus) {
    uploadStatus.innerText = t("uploading", "Rasmni qayta ishlamoqda...");
    uploadStatus.style.color = "#2563eb";
  }

  try {
    // Rasmni 400×400 px ga kichraytir, sifat 0.82 — hajm kichik, ko'rinish yaxshi
    const base64DataUrl = await _resizeImageToBase64(file, 400, 400, 0.82);

    // Base64 hajmini tekshirish (Firebase RTDB node ≤ 10 MB)
    const approxBytes = Math.round((base64DataUrl.length * 3) / 4);
    if (approxBytes > 9 * 1024 * 1024) {
      throw new Error("Qayta ishlangan rasm juda katta (>9 MB). Kichikroq rasm tanlang.");
    }

    // Base64 data URL ni bazaga saqlash (Storage ishlatilmaydi)
    await update(ref(database, `restaurants/${restId}/settings`), {
      restaurantLogoUrl: base64DataUrl
    });

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("update", t("logo_uploaded_log", "🖼️ Restoran logotipi yangilandi."));
    }

    // Darhol ko'rsatish
    window.applyRestaurantLogo(base64DataUrl);

    // Admin footerni ham yangilash (ish vaqti va telefon o'zgarishi yo'q, lekin yangilash uchun)
    try {
      const settingSnap = await get(ref(database, `restaurants/${restId}/settings`));
      if (settingSnap.exists()) {
        const s = settingSnap.val();
        if (typeof updateAdminFooter === "function") {
          updateAdminFooter(s.workingHours, s.contactPhone);
        }
      }
    } catch (_) {}

    if (uploadStatus) {
      uploadStatus.innerText = t("logo_uploaded_success", "✅ Logotip muvaffaqiyatli yuklandi!");
      uploadStatus.style.color = "#16a34a";
    }

    if (typeof showAdminNotification === "function") {
      showAdminNotification(t("logo_uploaded_success", "✅ Logotip muvaffaqiyatli yuklandi!"), "success");
    }

    if (fileInput) fileInput.value = "";
    const fileNameEl = document.getElementById("logoFileName");
    if (fileNameEl) fileNameEl.innerText = t("file_not_selected", "Fayl tanlanmagan");

  } catch (error) {
    console.error(t("logo_upload_error_log", "Logotip yuklashda xato:"), error);
    if (uploadStatus) {
      uploadStatus.innerText = t("logo_upload_error", "❌ Yuklashda xatolik yuz berdi!");
      uploadStatus.style.color = "#dc2626";
    }
    alert(t("logo_upload_error", "❌ Logotip yuklashda xatolik yuz berdi!") + "\n" + error.message);
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerText = t("upload_logo_btn", "Logotipni yuklash");
    }
  }
};

/* =========================
   SOZLAMALAR BO'LIMINI YUKLASH
========================= */
window.loadSettingsSection = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) return;

  try {
    const snap = await get(ref(database, `restaurants/${restId}/settings`));
    if (snap.exists()) {
      const settings = snap.val();

      const workingHoursInput = document.getElementById("workingHoursInput");
      const contactPhoneInput = document.getElementById("contactPhoneInput");

      if (workingHoursInput && settings.workingHours) {
        workingHoursInput.value = settings.workingHours;
      }
      if (contactPhoneInput && settings.contactPhone) {
        contactPhoneInput.value = settings.contactPhone;
      }

      // Logo preview
      if (settings.restaurantLogoUrl) {
        window.applyRestaurantLogo(settings.restaurantLogoUrl);
      }
    }
  } catch (error) {
    console.error(t("settings_load_error_log", "Sozlamalarni yuklashda xato:"), error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.loadFooterSettings === "function") {
    window.loadFooterSettings();
  }

  // Logo fayl input o'zgarganda nom ko'rsatish
  const logoFileInput = document.getElementById("logoFileInput");
  if (logoFileInput) {
    logoFileInput.addEventListener("change", () => {
      const fileNameEl = document.getElementById("logoFileName");
      if (fileNameEl) {
        fileNameEl.innerText = logoFileInput.files?.[0]?.name || t("file_not_selected", "Fayl tanlanmagan");
      }
    });
  }
});

window.startSubscriptionMonitor = function (db, restId) {
  const restRef = ref(db, `restaurants/${restId}`);

  onValue(restRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const status = data.info?.status;
    const expireAt = data.subscription?.expireDate || data.subscription?.expireAt;
    const now = Date.now();
    const diffDays = Math.ceil((expireAt - now) / (1000 * 60 * 60 * 24));

    if (status === "blocked" || status === "paused") {
      if (typeof hideWarningBanner === "function") hideWarningBanner();
      let dynamicOverlay = document.getElementById("blocking-overlay");
      if (dynamicOverlay) dynamicOverlay.style.display = "none";
      return;
    }

    if (now > expireAt) {
      showBlockingOverlay(typeof t === 'function' ? t("sa_msg_expired", "Tarifingiz muddati tugadi. Iltimos, xizmatni davom ettirish uchun to'lov qiling.") : "Tarif muddati tugadi.");
      return;
    } else {
      let dynamicOverlay = document.getElementById("blocking-overlay");
      if (dynamicOverlay) dynamicOverlay.style.display = "none";
    }

    if (diffDays <= 5 && diffDays > 0) {
      if (typeof showWarningBanner === "function") showWarningBanner(diffDays);
    } else {
      if (typeof hideWarningBanner === "function") hideWarningBanner();
    }
  });
};

function showBlockingOverlay(message) {
  let overlay = document.getElementById("blocking-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "blocking-overlay";
    overlay.innerHTML = `
      <div class="blocking-content">
        <i class="fa-solid fa-lock" style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"></i>
        <h2 id="blocking-message"></h2>
        <p>${t("sa_contact_info", "Ma'lumot uchun Super Admin bilan bog'laning.")}</p>
        <a href="https://t.me/nestacrm_admin" class="btn-contact">${t("sa_contact_btn", "Super Admin bilan bog'lanish")}</a>
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

  const warningText = t("sa_expiry_warning", "Tarifingiz muddati tugashiga {days} kun qoldi, iltimos obuna muddatini yangilang, aks holda tizim bloklanadi.")
    .replace("{days}", days);

  banner.innerHTML = `
    <div style="background: #fff7ed; color: #9a3412; padding: 12px; text-align: center; border-bottom: 2px solid #fdba74; font-weight: 500;">
      <i class="fa-solid fa-triangle-exclamation"></i> 
      ${warningText}
      <a href="https://t.me/nestacrm_admin" style="margin-left: 15px; color: #c2410c; text-decoration: underline; font-weight: 700;">
        ${t("sa_extend_period", "Muddatni uzaytirish")} <i class="fa-solid fa-arrow-right"></i>
      </a>
    </div>
  `;
  banner.style.display = "block";
}

function startSecurityMonitor() {
  const database = window.db || (typeof db !== 'undefined' ? db : null);

  if (!database) {
    console.warn("⚠️ Firebase bazasi hali tayyor emas, qayta urinib ko'riladi...");
    setTimeout(startSecurityMonitor, 1000);
    return;
  }

  const restId = (typeof currentRestaurantId !== 'undefined' && currentRestaurantId)
    ? currentRestaurantId
    : localStorage.getItem("restaurantId");

  if (!restId) return;

  try {
    const statusRef = ref(database, `restaurants/${restId}/info/status`);

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
          if (title) title.innerText = typeof t === 'function' ? t("system_blocked_title", "Tizim vaqtincha bloklangan") : "Tizim vaqtincha bloklangan";
          if (desc) desc.innerText = typeof t === 'function' ? t("system_blocked_desc", "Ma'lum sabablarga ko'ra tarifingiz to'xtatilgan. Iltimos, Super Admin bilan bog'laning.") : "Ma'lum sabablarga ko'ra tarifingiz to'xtatilgan.";

        } else if (status === "paused") {
          overlay.style.display = "flex";
          document.body.style.overflow = "hidden";
          if (icon) { icon.className = "fa-solid fa-circle-pause"; icon.style.color = "#f59e0b"; } // Sariq pauza ikonka
          if (title) title.innerText = typeof t === 'function' ? t("system_paused_title", "Obuna vaqtincha to'xtatilgan") : "Obuna vaqtincha to'xtatilgan";
          if (desc) desc.innerText = typeof t === 'function' ? t("system_paused_desc", "Restoraningiz faoliyati vaqtincha to'xtatib qo'yilgan. Qolgan kunlaringiz xotirada saqlanmoqda.") : "Restoraningiz faoliyati vaqtincha to'xtatib qo'yilgan. Qolgan kunlaringiz xotirada saqlanmoqda.";

        } else {
          overlay.style.display = "none";
          document.body.style.overflow = "auto";
        }
      }
    });

  } catch (err) {
    console.error("❌ Monitor ishga tushishida xato:", err);
  }
}

startSecurityMonitor();

async function checkPermissions() {
  // Endi listenPlanFeatures() real-time kuzatadi.
  // Bu funksiya rol-based permission uchun saqlanadi (admin/manager/cashier).
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  const restSnap = await get(ref(db, `restaurants/${restId}/subscription`));
  const currentPlan = restSnap.val()?.planId || "start";

  const settingsSnap = await get(ref(db, `systemData/settings/tariffs/${currentPlan}`));
  const tariffData = settingsSnap.val() || {};
  window._currentPlanKey  = currentPlan;
  window._currentPlanName = tariffData.name || currentPlan.toUpperCase();

  const features = Array.isArray(tariffData.features) ? tariffData.features : [];

  // subscription/features ni sinxron saqlash (superadmin.js ga mos)
  await update(ref(db, `restaurants/${restId}/subscription`), { features });

  applyPlanFeaturesToUI(features);
}

function applyPermissions(p) {
  // p — tariff obyekti: { features: [...], price: ..., name: ... }
  const features = Array.isArray(p?.features) ? p.features : [];
  applyPlanFeaturesToUI(features);
}

window.playSound = function () {
  try {
    const audio = new Audio("/img/notify.wav?v=2");
    audio.preload = "auto";
    audio.play().catch(err => {
      console.warn(t("audio_play_error", "Ovozni ijro etib bo'lmadi (Foydalanuvchi sahifa bilan o'zaro aloqada bo'lmagan bo'lishi mumkin):"), err);
    });
  } catch (error) {
    console.error(t("audio_system_error_log", "Audio tizimida xato:"), error);
  }
};

/* =========================
   CHAT SYSTEM INITIALIZATION 
========================= */
window.adminChatState = "main";

async function getAdminChatOptions(userId, restaurantId) {
  if (window.adminChatState === "chefs") {
    const snap = await get(ref(db, `restaurants/${restaurantId}/users`));
    const users = snap.val() || {};
    // Object.entries — Firebase key ni id sifatida olamiz
    const chefs = Object.entries(users)
      .filter(([, u]) => u.role === "chef" && u.active !== false)
      .map(([id, u]) => ({ ...u, id }));

    const options = [
      { icon: "⬅️", label: t("back_btn", "Orqaga"), type: "back_to_main" },
      { icon: "📢", label: t("chat_write_all_group", "Barchasiga yozish (Guruh)"), type: "group_chef" }
    ];

    chefs.forEach(chef => {
      options.push({
        icon: "👨‍🍳",
        label: chef.name || t("role_chef", "Oshpaz"),
        type: "single_chef",
        targetId: chef.id  // endi to'g'ri Firebase key
      });
    });

    return options;
  }

  if (window.adminChatState === "waiters") {
    const snap = await get(ref(db, `restaurants/${restaurantId}/users`));
    const users = snap.val() || {};
    const waiters = Object.entries(users)
      .filter(([, u]) => u.role === "waiter" && u.active !== false)
      .map(([id, u]) => ({ ...u, id }));

    const options = [
      { icon: "⬅️", label: t("back_btn", "Orqaga"), type: "back_to_main" },
      { icon: "📢", label: t("chat_write_all_group", "Barchasiga yozish (Guruh)"), type: "group_waiter" }
    ];

    waiters.forEach(waiter => {
      options.push({
        icon: "🧑‍🍳",
        label: waiter.name || t("role_waiter", "Ofitsiant"),
        type: "single_waiter",
        targetId: waiter.id
      });
    });

    return options;
  }

  return [
    { icon: "👨‍🍳", label: t("chat_with_chefs", "Oshpazlar bilan chat"), type: "menu_chefs" },
    { icon: "🧑‍🍳", label: t("chat_with_waiters", "Ofitsiantlar bilan chat"), type: "menu_waiters" }
  ];
}

async function getAdminChatId(option, userId, restaurantId) {
  const { get, ref } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
  const db = window.db;

  if (option.type === "menu_chefs") {
    const snap = await get(ref(db, `restaurants/${restaurantId}/users`));
    const users = snap.val() || {};
    const chefs = Object.entries(users)
      .filter(([, u]) => u.role === "chef" && u.active !== false)
      .map(([id, u]) => ({ ...u, id }));

    if (chefs.length === 1) {
      return `admin_chef_${chefs[0].id}`;
    }
    window.adminChatState = "chefs";
    return "RELOAD_MENU";
  }

  if (option.type === "menu_waiters") {
    const snap = await get(ref(db, `restaurants/${restaurantId}/users`));
    const users = snap.val() || {};
    const waiters = Object.entries(users)
      .filter(([, u]) => u.role === "waiter" && u.active !== false)
      .map(([id, u]) => ({ ...u, id }));

    if (waiters.length === 1) {
      return `admin_waiter_${waiters[0].id}`;
    }
    window.adminChatState = "waiters";
    return "RELOAD_MENU";
  }

  if (option.type === "back_to_main") {
    window.adminChatState = "main";
    return "RELOAD_MENU";
  }

  if (option.type === "group_chef") return "chef_group";
  if (option.type === "single_chef") return `admin_chef_${option.targetId}`;
  if (option.type === "group_waiter") return "waiter_group";
  if (option.type === "single_waiter") return `admin_waiter_${option.targetId}`;

  return null;
}

function initAdminChatUI() {
  if (typeof window.initChatSystem === "function") {
    window.initChatSystem({
      currentRestaurantId: localStorage.getItem("restaurantId"),
      currentUserId: localStorage.getItem("userId"),
      currentRole: "admin",
      db: window.db,
      getChatOptions: getAdminChatOptions,
      getChatId: getAdminChatId
    });
  }
}

function initAdminChat() {
  if (!window.initChatSystem) {
    console.error("❌ window.initChatSystem topilmadi!");
    return;
  }

  window.initChatSystem({
    currentRestaurantId,
    currentUserId,
    currentRole: "admin",
    db,
    getChatOptions: getAdminChatOptions,
    getChatId: getAdminChatId
  }).catch(err => {
    console.error("❌ Chat init error:", err);
    console.error("Stack trace:", err.stack);
  });
}

window.currentFinanceStaffId = null;

window.openStaffFinanceModal = async function (staffId) {
  window.currentFinanceStaffId = staffId;
  const restId = localStorage.getItem("restaurantId");
  const monthKey = new Date().toISOString().slice(0, 7);

  try {
    const userSnap = await get(ref(db, `restaurants/${restId}/users/${staffId}`));
    const statsSnap = await get(ref(db, `restaurants/${restId}/finance/staff_stats/${staffId}/${monthKey}`));

    if (!userSnap.exists()) return;
    const user = userSnap.val();
    const stats = statsSnap.val() || { totalEarned: 0, orderCount: 0 };

    document.getElementById("financeModalTitle").innerText = `${user.name} — ${t("salary_and_kpi", "Maosh va KPI")}`;
    document.getElementById("modal-fixed-salary").value = user.fixedSalary || 0;
    document.getElementById("modal-commission").value = user.commissionPercent || 0;

    document.getElementById("staffFinanceStats").innerHTML = `
            <div style="display:flex; justify-content:space-between; padding: 5px 0;">
                <span>${t("orders_this_month", "Ushbu oydagi buyurtmalari:")}</span> <b>${stats.orderCount || 0} ${t("sa_badge_count", "ta")}</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding: 5px 0; border-top: 1px solid #eee;">
                <span>${t("sales_kpi_share", "Sotuvdan ishlagan ulushi (KPI):")}</span> <b>${(stats.totalEarned || 0).toLocaleString()} ${t("currency", "so'm")}</b>
            </div>
        `;

    document.getElementById("staffFinanceModal").style.display = "flex";
  } catch (err) {
    console.error(t("finance_modal_error_log", "Finance modal error:"), err);
  }
};

window.saveStaffFinanceSettings = async function () {
  const staffId = window.currentFinanceStaffId;
  const restId = localStorage.getItem("restaurantId");
  const fixed = document.getElementById("modal-fixed-salary").value;
  const commission = document.getElementById("modal-commission").value;

  await update(ref(db, `restaurants/${restId}/users/${staffId}`), {
    fixedSalary: Number(fixed),
    commissionPercent: Number(commission)
  });

  showToast(t("salary_settings_updated", "Maosh sozlamalari yangilandi!"));
  window.renderStaffFinance();
};

window.addStaffAdjustmentFromModal = function () {
  if (window.currentFinanceStaffId) {
    window.addStaffAdjustment(window.currentFinanceStaffId);
  }
};

window.closeModal = function (modalElement) {
  if (modalElement) {
    modalElement.style.display = "none";
  } else {
    const el = document.getElementById(modalElement);
    if (el) el.style.display = "none";
  }
};

// ==========================================
// 🔄 BRON VA STOLLAR SINXRONIZATSIYASI
// ==========================================
window.updateReservationStatus = async function (id, status) {
  const restId = localStorage.getItem("restaurantId");

  try {
    await update(ref(db, `restaurants/${restId}/reservations/${id}`), {
      status: status,
      updatedAt: Date.now()
    });

    if (typeof reservationState !== 'undefined' && reservationState.list) {
      const resData = reservationState.list.find(r => r.id === id);

      if (resData && resData.tableNumber) {
        const tableRef = ref(db, `restaurants/${restId}/tables/${resData.tableNumber}`);

        if (status === "confirmed") {
          await update(tableRef, {
            status: "reserved",
            busy: true
          });
          if (typeof showToast === "function") showToast(t("table_reserved_toast", "{table}-stol BRON holatiga o'tdi!").replace("{table}", resData.tableNumber));

        } else if (status === "seated") {
          await update(tableRef, {
            status: "busy",
            busy: true
          });
          if (typeof showToast === "function") showToast(t("table_seated_toast", "{table}-stolda mijoz o'tirdi!").replace("{table}", resData.tableNumber));

        } else if (status === "canceled" || status === "no_show" || status === "completed") {
          await update(tableRef, {
            status: "free",
            busy: false
          });
          if (typeof showToast === "function") showToast(t("table_freed_toast", "{table}-stol bo'shatildi!").replace("{table}", resData.tableNumber));
        }
      }
    }

    if (typeof window.renderReservationList === "function") window.renderReservationList();
    if (typeof renderReservationStats === "function") renderReservationStats();

  } catch (error) {
    console.error(t("status_update_error_log", "Status yangilashda xato:"), error);
  }
};

// ==========================================
// 🪑 YANGI STOLLAR QO'SHISH
// ==========================================
window.addExtraTables = async function () {
  const restId = localStorage.getItem("restaurantId");
  const extraInput = document.getElementById("extraTablesInput");
  const currentInput = document.getElementById("tablesCountInput");

  const extraCount = Number(extraInput?.value);
  const currentLocalCount = Number(currentInput?.value) || 0;

  if (!extraCount || extraCount <= 0) {
    alert(t("enter_tables_count", "Iltimos, nechta stol qo'shmoqchi ekanligingizni yozing!"));
    return;
  }

  try {
    const snap = await get(ref(db, `restaurants/${restId}/settings/tablesCount`));
    let realCurrentCount = Number(snap.val() || currentLocalCount || 0);

    const newCount = realCurrentCount + extraCount;
    const updates = {};

    for (let i = realCurrentCount + 1; i <= newCount; i++) {
      updates[`restaurants/${restId}/tables/table_${i}/status`] = "free";
      updates[`restaurants/${restId}/tables/table_${i}/busy`] = false;
      updates[`restaurants/${restId}/tables/table_${i}/number`] = i;
      updates[`restaurants/${restId}/tables/table_${i}/id`] = `table_${i}`;
      updates[`restaurants/${restId}/tables/table_${i}/updatedAt`] = Date.now();
    }

    updates[`restaurants/${restId}/settings/tablesCount`] = newCount;

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("create", t("log_tables_added", "🪑 {count} ta yangi stol qo'shildi. Jami: {total}").replace("{count}", extraCount).replace("{total}", newCount));
    }

    await update(ref(db), updates);

    if (currentInput) currentInput.value = newCount;
    if (extraInput) extraInput.value = "";

    const msg = t("tables_added_success", "Muvaffaqiyatli! {count} ta yangi stol qo'shildi.").replace("{count}", extraCount);
    if (typeof showToast === "function") showToast(msg, "success");
    else alert(msg);

  } catch (error) {
    console.error(t("add_table_error_log", "Stol qo'shish xatosi:"), error);
    alert(t("add_table_error", "Stol qo'shishda xatolik yuz berdi."));
  }
};

// ==========================================
// 🕒 BRON VAQTINI O'ZGARTIRISH
// ==========================================
window.editReservationTime = async function (id, currentTime) {
  const newTime = prompt(t("prompt_new_time", "Yangi vaqtni kiriting (Masalan, 18:30):"), currentTime);

  if (!newTime || newTime === currentTime) return;

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newTime)) {
    alert(t("invalid_time_format", "⚠️ Vaqt noto'g'ri formatda kiritildi! Iltimos, 18:30 ko'rinishida yozing."));
    return;
  }

  const restId = localStorage.getItem("restaurantId");
  try {
    await update(ref(db, `restaurants/${restId}/reservations/${id}`), {
      time: newTime,
      updatedAt: Date.now()
    });

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("update", t("reservation_time_changed_log", "🕒 Bron vaqti o'zgartirildi: {newTime}. ID: {id}").replace("{newTime}", newTime).replace("{id}", id));
    }

    if (typeof showToast === "function") showToast(t("success_new_time", "Muvaffaqiyatli! Yangi vaqt: {newTime}").replace("{newTime}", newTime));
  } catch (error) {
    console.error(t("edit_time_error_log", "Vaqtni o'zgartirishda xato:"), error);
  }
};

// ==========================================
// 🗑 BRONNI O'CHIRISH VA STOLNI BO'SHATISH
// ==========================================
window.deleteReservation = async function (id, tableNumber) {
  const confirmMsg = typeof t === 'function' ? t("confirm_delete") || "Haqiqatan ham o'chirmoqchimisiz?" : "Haqiqatan ham o'chirmoqchimisiz?";
  if (!confirm(confirmMsg)) return;

  const restId = localStorage.getItem("restaurantId");
  try {
    await remove(ref(db, `restaurants/${restId}/reservations/${id}`));

    if (tableNumber && tableNumber !== "null" && tableNumber !== "undefined") {
      await update(ref(db, `restaurants/${restId}/tables/${tableNumber}`), {
        status: "free",
        busy: false,
        updatedAt: Date.now()
      });
    }

    if (typeof window.logSystemAction === "function") {
      await window.logSystemAction("delete", `🗑 ${t("log_reservation_deleted", "Bron o'chirildi. Stol: {tableNumber}").replace("{tableNumber}", tableNumber || t("unknown_label", "Noma'lum"))}`);
    }

    if (typeof showToast === "function") showToast(t("reservation_deleted", "Bron o'chirildi va stol bo'shatildi!"), "success");

    if (typeof loadReservations === "function") {
      loadReservations();
    } else {
      if (window.reservationState && window.reservationState.list) {
        window.reservationState.list = window.reservationState.list.filter(r => String(r.id) !== String(id));
      }
      if (typeof window.renderReservationList === "function") window.renderReservationList();
    }

    if (typeof renderReservationStats === "function") renderReservationStats();

  } catch (error) {
    console.error(t("delete_error_log", "O'chirishda xato:"), error);
    alert(t("delete_error", "O'chirishda xatolik yuz berdi."));
  }
};

// ==========================================
// 👁 AUDIT LOGLARNI EKRANGA CHIQARISH
// ==========================================
window.openAuditLogModal = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) {
    console.error(t("rest_id_not_found_log", "Restoran ID topilmadi!"));
    return;
  }

  if (!document.getElementById("auditLogModal")) {
    const modalHtml = `
      <div id="auditLogModal" onclick="if(event.target === this) this.style.display='none'" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
          <div style="background:#fff; width:95%; max-width:600px; border-radius:12px; padding:20px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e5e7eb; padding-bottom:12px; margin-bottom:15px;">
                  <h2 style="margin:0; font-size:20px; display:flex; align-items:center; gap:8px;">📜 ${t("system_history", "Tizim Tarixi")} <span style="font-size:12px; font-weight:normal; background:#f3f4f6; padding:2px 8px; border-radius:10px;">${t("audit_log", "Audit Log")}</span></h2>
                  <button onclick="document.getElementById('auditLogModal').style.display='none'" style="background:none; border:none; font-size:28px; cursor:pointer; color:#6b7280;">&times;</button>
              </div>
              <div id="auditLogContent" style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:12px; padding-right:5px;">
                  <p style="text-align:center; color:#6b7280;">⏳ ${t("loading", "Yuklanmoqda...")}</p>
              </div>
          </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  }

  const modal = document.getElementById("auditLogModal");
  const contentDiv = document.getElementById("auditLogContent");

  modal.style.display = "flex";
  contentDiv.innerHTML = `<p style="text-align:center; color:#6b7280;">⏳ ${t("logs_updating", "Loglar yangilanmoqda...")}</p>`;

  try {
    const recentLogsQuery = query(ref(db, `restaurants/${restId}/activityLogs`), orderByChild("createdAt"), limitToLast(100));
    const snap = await get(recentLogsQuery);

    if (!snap.exists()) {
      contentDiv.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#9ca3af;">
            <div style="font-size:40px; margin-bottom:10px;">📂</div>
            <p>${t("no_activity_recorded_yet", "Hozircha hech qanday harakat qayd etilmagan.")}</p>
        </div>`;
      return;
    }

    const logs = Object.values(snap.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    let html = "";
    logs.forEach(log => {
      const dateObj = new Date(log.createdAt || Date.now());
      const timeString = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

      let color = "#374151";
      const action = String(log.action || "").toLowerCase();
      const desc = String(log.description || log.message || "").toLowerCase();

      if (action.includes("delete") || desc.includes("o'chir")) color = "#dc2626";
      else if (action.includes("create") || desc.includes("yangi") || desc.includes("qo'sh")) color = "#16a34a";
      else if (action.includes("update") || desc.includes("tahrir") || desc.includes("o'zgar")) color = "#2563eb";

      html += `
        <div style="padding:12px; border:1px solid #f3f4f6; border-left: 4px solid ${color}; border-radius:8px; background:#f9fafb; transition: transform 0.2s;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#6b7280; margin-bottom:6px;">
                <span>👤 ${log.userName || 'Tizim'}</span>
                <span>🕒 ${timeString}</span>
            </div>
            <div style="font-size:14px; font-weight:500; color:#1f2937; line-height:1.4;">
                ${log.description || log.message || "Noma'lum harakat"}
            </div>
        </div>
      `;
    });

    contentDiv.innerHTML = html;

  } catch (error) {
    console.error(t("audit_log_load_error", "Audit log yuklashda xato:"), error);
    contentDiv.innerHTML = `<p style="color:#dc2626; text-align:center; padding:20px;">❌ ${t("data_load_error", "Ma'lumotlarni yuklashda xatolik yuz berdi!")}</p>`;
  }
};

// ==========================================
// 🛡 MENYULAR VA RUXSATLARNI QO'LLASH
// ==========================================
window.applyUserPermissions = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = localStorage.getItem("userId") || localStorage.getItem("adminId") || "admin_1";

  if (!restId || !userId) return;

  try {
    const userSnap = await get(ref(db, `restaurants/${restId}/users/${userId}`));
    if (!userSnap.exists()) return;

    const userData = userSnap.val();

    const isSuperAdmin = userData.role === "admin" && userData.isSubAdmin !== true;

    if (isSuperAdmin && userData.permissions && userData.permissions.length > 0) {
      await update(ref(db, `restaurants/${restId}/users/${userId}`), { permissions: null });
    }

    const header = document.querySelector(".header");
    let tempBanner = document.getElementById("tempAdminBanner");

    if (!isSuperAdmin && userData.role === "admin") {
      if (!tempBanner && header) {
        tempBanner = document.createElement("div");
        tempBanner.id = "tempAdminBanner";
        tempBanner.style.cssText = "background: #f59e0b; color: #fff; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 13px; margin-left: 15px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid #d97706;";
        tempBanner.innerHTML = `<span>⚠️</span> ${t("temp_admin_granted", "Sizga vaqtinchalik adminlik xuquqi berildi")}`;

        const langSelect = document.getElementById("langSelect");
        if (langSelect) langSelect.parentNode.insertBefore(tempBanner, langSelect);
        else header.appendChild(tempBanner);
      }
    } else {
      if (tempBanner) tempBanner.remove();
    }

    const menuMapping = {
      'dashboard': 'a[href="#dashboard"]',
      'orders': 'a[href="#orders"]',
      'menu': 'a[href="#menu"]',
      'tables': 'a[href="#tables"]',
      'staff': 'a[href="#staff"]',
      'customers': 'a[href="#crm"]',
      'report': 'a[href="#report"]',
      'notifications': 'a[href="#notifications"]',
      'roles': 'a[href="#roles"]',
      'audit_log': 'a[href="#audit-log"]',
      'settings': 'a[href="#settings"]',
      'reservations': 'a[href="#reservations"]',
      'warehouse': 'a[href="#warehouse"]',
      'finance': 'a[href="#finance"]',
      'add': 'a[href="#add"]'
    };

    if (isSuperAdmin) {
      Object.values(menuMapping).forEach(selector => {
        const el = document.querySelector(`.sidebar-nav ${selector}`);
        if (el) el.style.display = "flex";
      });
      return;
    }

    const permissions = userData.permissions || [];

    Object.entries(menuMapping).forEach(([key, selector]) => {
      const menuItem = document.querySelector(`.sidebar-nav ${selector}`);
      if (menuItem) {
        if (permissions.includes(key) && key !== "none") {
          menuItem.style.display = "flex";
        } else {
          menuItem.style.display = "none";
        }
      }
    });

    const currentHash = window.location.hash.replace("#", "") || "dashboard";
    if (currentHash !== "dashboard" && !permissions.includes(currentHash)) {
      const firstAllowed = (permissions.length > 0 && permissions[0] !== "none") ? permissions[0] : "dashboard";
      if (typeof window.showSection === "function") window.showSection(firstAllowed);
    }

  } catch (error) {
    console.error(t("permissions_load_error", "Ruxsatlarni yuklashda xato:"), error);
  }
};

// ==========================================
// 🔄 DİNAMIK ROL KUZATUVCHISI
// ==========================================
window.listenToMyRoleChange = async function () {
  const restId = localStorage.getItem("restaurantId");
  const userId = localStorage.getItem("userId") || localStorage.getItem("adminId") || "admin_1";

  if (!restId || !userId) return;

  try {
    onValue(ref(db, `restaurants/${restId}/users/${userId}`), (snap) => {
      if (!snap.exists()) return;

      const userData = snap.val();
      const newRole = userData.role;
      const isSubAdmin = userData.isSubAdmin;

      const currentPath = window.location.pathname.toLowerCase();
      let currentLocalRole = localStorage.getItem("role");

      if (!currentLocalRole) {
        if (currentPath.includes("admin.html")) currentLocalRole = "admin";
        else if (currentPath.includes("chef.html")) currentLocalRole = "chef";
        else currentLocalRole = "waiter";
      }

      if (newRole && newRole !== currentLocalRole) {
        localStorage.setItem("role", newRole);

        if (newRole === "admin" && !currentPath.includes("admin.html")) {
          alert(t("role_changed_admin", "👑 Sizga Boshqaruvchi (Admin) huquqlari berildi!"));
          window.location.replace(`admin.html?id=${restId}`);
        }
        else if (newRole === "chef" && !currentPath.includes("chef.html")) {
          alert(t("role_changed_chef", "👨‍🍳 Rolingiz o'zgardi. Oshpaz paneliga o'tilmoqda..."));
          window.location.replace(`chef.html?id=${restId}`);
        }
        else if (newRole === "waiter" && !currentPath.includes("waiter.html")) {
          alert(t("role_changed_waiter", "🧑‍🍳 Rolingiz o'zgardi. Ofitsiant paneliga o'tilmoqda..."));
          window.location.replace(`waiter.html?id=${restId}`);
        }
      }

      if (typeof window.applyUserPermissions === "function") {
        window.applyUserPermissions();
      }
    });
  } catch (error) {
    console.error(t("role_watch_error", "Rolni kuzatishda xatolik:"), error);
  }
};

// ====================================
// ⏳ OBUNA MUDDATINI KUZATISH TAYMERI
// ====================================
window.startSubscriptionTimer = async function () {
  const restId = localStorage.getItem("restaurantId");
  if (!restId) return;

  let container = document.getElementById("subTimerContainer");
  if (!container) {
    const logo = document.querySelector(".logo");
    if (logo) {
      container = document.createElement("div");
      container.id = "subTimerContainer";
      container.style.marginLeft = "20px";
      logo.parentNode.insertBefore(container, logo.nextSibling);
    } else return;
  }

  try {
    const infoSnap = await get(ref(db, `restaurants/${restId}/info/tariff`));
    const defaultTariff = String(infoSnap.val() || "START").toUpperCase();

    onValue(ref(db, `restaurants/${restId}/subscription`), (snap) => {
      const subData = snap.val();
      const expireVal = subData?.expireDate || subData?.expireAt || subData?.endDate;
      const planName = String(subData?.planId || subData?.tariff || defaultTariff).toUpperCase();

      if (!subData || !expireVal) {
        container.innerHTML = "";
        return;
      }

      const expiryDate = new Date(expireVal).getTime();

      const runTimer = () => {
        const now = new Date().getTime();
        const diff = expiryDate - now;

        if (diff <= 0) {
          container.innerHTML = `
            <div style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:10px; font-weight:700; font-size:12px; border:1px solid #f87171; display:flex; flex-direction:column; line-height:1.2; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                <span style="font-size:9px; opacity:0.8; letter-spacing:0.5px;">${t("tariff_label", "TARIF:")} ${planName}</span>
                <span>⚠️ ${t("sa_timer_expired", "MUDDAT TUGADI")}</span>
            </div>`;
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        let color = "#059669";
        if (d < 7) color = "#d97706";
        if (d < 2) color = "#dc2626";

        container.innerHTML = `
          <div style="background:#f8fafc; color:${color}; padding:6px 14px; border-radius:12px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-hourglass-half" style="font-size:16px;"></i>
              <div style="display:flex; flex-direction:column; line-height:1.1;">
                  <span style="font-size:9px; font-weight:800; opacity:0.6; letter-spacing:0.5px;">${t("tariff_label", "TARIF:")} ${planName}</span>
                  <span style="font-size:14px; font-weight:700;">${d > 0 ? d + 'k ' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}</span>
              </div>
          </div>`;
      };

      if (window.subInterval) clearInterval(window.subInterval);
      window.subInterval = setInterval(runTimer, 1000);
      runTimer();
    });
  } catch (e) { console.error(t("sub_timer_error_log", "Subscription timer error:"), e); }
};

// ==========================================
// 💬 WAITER CHAT: ADMIN VA OSHPAZGA YOZISH
// ==========================================
async function getWaiterChatOptions(userId, restaurantId) {
  return [
    {
      icon: "👑",
      label: t("chat_with_admin", "Admin bilan chat"),
      type: "admin"
    },
    {
      icon: "👨‍🍳",
      label: t("chat_with_chef", "Oshpaz bilan chat"),
      type: "chef"
    }
  ];
}

async function getWaiterChatId(option, waiterId, restaurantId) {
  if (option.type === "admin") {
    return `waiterChats/dm_${waiterId}`;
  }

  if (option.type === "chef") {
    return `waiterChats/waiter_chef`;
  }

  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menuToggleBtn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("visible");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
    });
  }
});

async function init() {
  console.log(t("admin_init_log"));
  applyLang();
  applyAdminPageTranslations();
  renderCategories(categorySelect);
  renderCategories(editCategory);
  initOrderCategoryFilter();
  renderOrderFilters();
  updateFullscreenButton();
  listenStaff();
  listenMenu();
  listenOrders();
  listenCustomersRealtime();
  listenPaymentNotifications();
  listenKitchenNotifications();

  // ── Dashboard kartochkalari uchun: sahifaga kirmasdan ham ma'lumot yuklash ──
  // Stollar statistikasini (Band/Bo'sh) darhol boshlash
  if (!window._tablesListenerStarted) {
    window._tablesListenerStarted = true;
    window.migrateTableKeys().then(() => window.listenTablesRealtime());
  }

  // Bronlar sonini darhol yuklash (reservations bo'limiga kirmasdan)
  if (!window._reservationsListenerStarted) {
    window._reservationsListenerStarted = true;
    onValue(ref(db, BASE_PATH + "/reservations"), (snap) => {
      reservationState.list = Object.entries(snap.val() || {})
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      updateRealTimeStats();
    });
  }

  setInterval(updateRealTimeStats, 30000);
  showSection("dashboard");
  startNotificationsAutoRefresh();

  if (typeof initAdminChat === "function") {
    initAdminChat();
  }

  window.renderStaffFinance();
  window.renderSalaryReport();

  if (typeof window.startSubscriptionTimer === "function") {
    window.startSubscriptionTimer();
  }

  console.log(t("finance_system_started", "Moliya tizimi ishga tushdi"));
  setInterval(window.autoCheckReservations, 60000);
  setTimeout(window.autoCheckReservations, 5000);
  window.applyUserPermissions();

  if (typeof window.listenToMyRoleChange === "function") {
    window.listenToMyRoleChange();
  }

  if (typeof checkPermissions === "function") {
    checkPermissions();
  }

  // Real-time: admin sozlamalari o'zgarganda footer va logotipni yangilash
  const _restId = localStorage.getItem("restaurantId");
  if (_restId) {
    onValue(ref(db, `restaurants/${_restId}/settings`), (snap) => {
      if (!snap.exists()) return;
      const settings = snap.val();

      // Ovozli bildirishnoma holati sinxronlash
      window._adminNotifEnabled = settings.notificationsEnabled !== false;

      // Footer yangilash
      if (typeof updateAdminFooter === "function") {
        updateAdminFooter(settings.workingHours, settings.contactPhone);
      }

      // Header logotipini yangilash
      if (settings.restaurantLogoUrl && typeof window.applyRestaurantLogo === "function") {
        window.applyRestaurantLogo(settings.restaurantLogoUrl);
      }
    });

    // Tarif o'zgarganda funksiyalarni real-time yoq/o'chir
    listenPlanFeatures();
  }
}

onLangChange(() => {
  applyLang();
  applyAdminPageTranslations();
  if (typeof initAdminChat === "function") initAdminChat();
  // Staff chat modal ni qayta render qilish (til o'zgarganda)
  if (typeof window.initStaffChatSystem === "function") window.initStaffChatSystem();
  updateFullscreenButton();
  renderCategories(categorySelect, categorySelect?.value || "");
  renderCategories(editCategory, editCategory?.value || "");
  renderSubcategories(
    subcategorySelect,
    categorySelect?.value || "",
    subcategorySelect?.value || ""
  );
  renderSubcategories(
    editSubCategory,
    editCategory?.value || "",
    editSubCategory?.value || ""
  );
  renderOrderFilters();
  renderMenu();
  renderOrders(window.allOrders);
  if (typeof window.mergeAndRender === "function") window.mergeAndRender();

  const activeLink = document.querySelector(".sidebar-nav a.active");
  const activeId = activeLink?.getAttribute("href")?.replace("#", "") || "dashboard";
  if (typeof loadSectionData === "function") {
    loadSectionData(activeId);
  }
});

/* ═══════════════════════════════════════════════════════
   📊 MENYU STATISTIKASI — Eng ko'p sotilgan taomlar
═══════════════════════════════════════════════════════ */

let _menuStatsChart = null;
let _menuStatsChartType = "bar";
let _menuStatsOpen = true;

window.setStatsChartType = function(type) {
  _menuStatsChartType = type;
  // Button styles
  ["bar","pie","doughnut"].forEach(t => {
    const btn = document.getElementById("statsBtnBar".replace("Bar", t.charAt(0).toUpperCase() + t.slice(1)));
    if (btn) {
      btn.style.background = t === type ? "#22c55e" : "var(--bg-body,#f8fafc)";
      btn.style.color = t === type ? "#fff" : "var(--text-primary,#1e293b)";
      btn.style.borderColor = t === type ? "#22c55e" : "var(--border-color,#e2e8f0)";
    }
  });
  const btnBar = document.getElementById("statsBtnBar");
  const btnPie = document.getElementById("statsBtnPie");
  const btnDoughnut = document.getElementById("statsBtnDoughnut");
  [btnBar, btnPie, btnDoughnut].forEach(b => {
    if (!b) return;
    b.style.background = "var(--bg-body,#f8fafc)";
    b.style.color = "var(--text-primary,#1e293b)";
    b.style.borderColor = "var(--border-color,#e2e8f0)";
  });
  const activeBtn = document.getElementById("statsBtn" + type.charAt(0).toUpperCase() + type.slice(1));
  if (activeBtn) {
    activeBtn.style.background = "#22c55e";
    activeBtn.style.color = "#fff";
    activeBtn.style.borderColor = "#22c55e";
  }
  window.renderMenuStats();
};

window.toggleMenuStats = function() {
  _menuStatsOpen = !_menuStatsOpen;
  const content = document.getElementById("menuStatsContent");
  const icon = document.getElementById("menuStatsToggleIcon");
  const btn = document.getElementById("menuStatsToggleBtn");
  if (content) content.style.display = _menuStatsOpen ? "block" : "none";
  if (icon) icon.textContent = _menuStatsOpen ? "▲" : "▼";
  if (btn) btn.innerHTML = `<span id="menuStatsToggleIcon">${_menuStatsOpen ? "▲" : "▼"}</span> ${_menuStatsOpen ? t("close_btn","Yopish") : t("view_btn","Ko'rsatish")}`;
};

window.restaurantFeatures = [];

onValue(ref(db, `restaurants/${currentRestaurantId}/subscription/features`), (snap) => {
    if (snap.exists()) {
        window.restaurantFeatures = snap.val() || [];
        console.log(t("loaded_features", "Faol funksiyalar:"), window.restaurantFeatures);
    } else {
        window.restaurantFeatures = [];
    }
});

window.checkFeatureAccess = function(featureKey, actionCallback) {
    if (window.restaurantFeatures.includes('all') || window.restaurantFeatures.includes(featureKey)) {
        if (typeof actionCallback === "function") actionCallback();
        return true;
    } else {
        const modal = document.getElementById("upgradePlanModal");
        if (modal) {
            modal.style.display = "flex";
            modal.classList.remove("hidden");
        }
        return false;
    }
};

window.closeUpgradeModal = function() {
    const modal = document.getElementById("upgradePlanModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
};

window.renderMenuStats = function() {
  const periodEl  = document.getElementById("statsFilterPeriod");
  const topEl     = document.getElementById("statsFilterTop");
  const metricEl  = document.getElementById("statsFilterMetric");
  const fromEl    = document.getElementById("statsDateFrom");
  const toEl      = document.getElementById("statsDateTo");
  const customDiv = document.getElementById("statsCustomRange");

  const period  = periodEl?.value  || "week";
  const topN    = Number(topEl?.value  || 10);
  const metric  = metricEl?.value  || "qty";
  if (customDiv) customDiv.style.display = period === "custom" ? "flex" : "none";

  const loader = document.getElementById("menuStatsChartLoader");
  if (loader) loader.style.display = "flex";

  const now   = Date.now();
  const MS_DAY = 86400000;
  let fromTs = 0;
  let toTs   = now;

  if (period === "today") {
    const d = new Date(); d.setHours(0,0,0,0);
    fromTs = d.getTime();
  } else if (period === "week") {
    fromTs = now - 7 * MS_DAY;
  } else if (period === "month") {
    fromTs = now - 30 * MS_DAY;
  } else if (period === "custom") {
    if (fromEl?.value) fromTs = new Date(fromEl.value).getTime();
    if (toEl?.value)   toTs   = new Date(toEl.value).getTime() + MS_DAY - 1;
  }

  // Filter orders
  const allOrders = window.allOrders || {};
  const filtered = Object.values(allOrders).filter(order => {
    const closed = ["yopildi","bekor qilindi","closed","cancelled","to'landi","paid","закрыто","отменён","оплачено","canceled"];
    const st = String(order.status || order.statusKey || "").trim().toLowerCase();
    if (!closed.includes(st)) return false;
    const ts = Number(order.createdAt || order.timestamp || order.time || 0);
    if (period !== "all" && (ts < fromTs || ts > toTs)) return false;
    return true;
  });

  // Aggregate
  const stats = {};
  filtered.forEach(order => {
    if (!order.items) return;
    Object.values(order.items).forEach(item => {
      const lang = typeof getLang === "function" ? getLang() : "uz";
      const name = typeof item.name === "object"
        ? item.name?.[lang] || item.name?.uz || item.name?.ru || item.name?.en || "—"
        : item.name || "—";
      const qty = Number(item.qty || 0);
      const sum = Number(item.price || 0) * qty;
      if (!stats[name]) stats[name] = { name, qty: 0, sum: 0 };
      stats[name].qty += qty;
      stats[name].sum += sum;
    });
  });

  const sorted = Object.values(stats)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, topN);

  // Update meta
  const metaEl = document.getElementById("menuStatsMeta");
  if (metaEl) {
    const periodLabels = {
      all: t("stats_all_time", "Barcha vaqt"),
      today: t("today_label", "Bugun"),
      week: t("stats_last_7_days", "Oxirgi 7 kun"),
      month: t("stats_last_30_days", "Oxirgi 30 kun"),
      custom: t("stats_custom_range", "Tanlangan davr")
    };
    metaEl.textContent = `${periodLabels[period] || ""} • ${filtered.length} ${t("orders_count_suffix", "ta buyurtma")} • ${Object.keys(stats).length} ${t("food_types_suffix", "xil taom")}`;
  }

  // Render table
  const tbody = document.getElementById("menuStatsTableBody");
  if (tbody) {
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#94a3b8;">📭 ${t("no_data", "Ma'lumot topilmadi")}</td></tr>`;
    } else {
      const medals = ["🥇","🥈","🥉"];
      tbody.innerHTML = sorted.map((item, i) => {
        const bar = sorted[0][metric] > 0
          ? Math.round((item[metric] / sorted[0][metric]) * 100) : 0;
        return `<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">
          <td style="padding:9px 10px;font-weight:700;color:#64748b;">${medals[i] || (i+1)}</td>
          <td style="padding:9px 10px;">
            <div style="font-weight:600;color:var(--text-primary,#1e293b);margin-bottom:3px;">${item.name}</div>
            <div style="height:4px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${bar}%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:99px;transition:width .4s;"></div>
            </div>
          </td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;color:#0f172a;">${item.qty.toLocaleString()}</td>
          <td style="padding:9px 10px;text-align:right;color:#16a34a;font-weight:600;">${item.sum.toLocaleString()} ${t("currency","so'm")}</td>
        </tr>`;
      }).join("");
    }
  }

  // Summary cards
  const summaryEl = document.getElementById("menuStatsSummary");
  if (summaryEl && sorted.length) {
    const totalQty = Object.values(stats).reduce((s,i) => s + i.qty, 0);
    const totalSum = Object.values(stats).reduce((s,i) => s + i.sum, 0);
    const topItem  = sorted[0];
    summaryEl.innerHTML = `
      <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;border-radius:12px;padding:12px 16px;">
        <div style="font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${t("stats_total_sold", "Jami sotilgan")}</div>
        <div style="font-size:22px;font-weight:800;color:#15803d;margin-top:2px;">${totalQty.toLocaleString()} ${t("qty_col_label", "dona")}</div>
      </div>
      <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;">
        <div style="font-size:11px;color:#3b82f6;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${t("stats_total_revenue", "Jami tushum")}</div>
        <div style="font-size:22px;font-weight:800;color:#1d4ed8;margin-top:2px;">${totalSum.toLocaleString()} ${t("currency","so'm")}</div>
      </div>
      <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#fffbeb,#fef9c3);border:1px solid #fde68a;border-radius:12px;padding:12px 16px;">
        <div style="font-size:11px;color:#d97706;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">🥇 ${t("stats_leader_food", "Lider taom")}</div>
        <div style="font-size:15px;font-weight:800;color:#92400e;margin-top:2px;">${topItem.name}</div>
        <div style="font-size:11px;color:#b45309;margin-top:1px;">${topItem.qty} ${t("qty_col_label","dona")} · ${topItem.sum.toLocaleString()} ${t("currency","so'm")}</div>
      </div>
    `;
  }

  // Render chart
  const ctx = document.getElementById("menuTopFoodsChart");
  if (!ctx) { if (loader) loader.style.display = "none"; return; }
  if (_menuStatsChart) _menuStatsChart.destroy();

  if (!sorted.length) {
    if (loader) loader.style.display = "none";
    return;
  }

  const COLORS = [
    "#22c55e","#3b82f6","#f59e0b","#ef4444","#8b5cf6",
    "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
    "#14b8a6","#a855f7","#0ea5e9","#eab308","#10b981",
    "#fb923c","#e879f9","#4ade80","#60a5fa","#fbbf24"
  ];

  const labels  = sorted.map(i => i.name);
  const dataVals= sorted.map(i => i[metric]);
  const label   = metric === "qty" ? t("stats_metric_qty", "Sotilgan (dona)") : t("stats_metric_sum", "Tushum (so'm)");

  const isBar = _menuStatsChartType === "bar";

  _menuStatsChart = new Chart(ctx, {
    type: _menuStatsChartType,
    data: {
      labels,
      datasets: [{
        label,
        data: dataVals,
        backgroundColor: isBar
          ? COLORS.slice(0, sorted.length).map(c => c + "CC")
          : COLORS.slice(0, sorted.length),
        borderColor: isBar
          ? COLORS.slice(0, sorted.length)
          : "#fff",
        borderWidth: isBar ? 1 : 2,
        borderRadius: isBar ? 8 : 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !isBar,
          position: "bottom",
          labels: { font: { size: 11 }, padding: 10, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => metric === "qty"
              ? ` ${ctx.raw.toLocaleString()} ${t("qty_col_label","dona")}`
              : ` ${ctx.raw.toLocaleString()} ${t("currency","so'm")}`
          }
        }
      },
      scales: isBar ? {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            callback: v => metric === "qty" ? v : v.toLocaleString(),
            font: { size: 11 }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
            maxRotation: 35,
            callback: function(val, idx) {
              const lbl = this.getLabelForValue(idx);
              return lbl.length > 14 ? lbl.slice(0, 14) + "…" : lbl;
            }
          }
        }
      } : {}
    }
  });

  if (loader) loader.style.display = "none";
};