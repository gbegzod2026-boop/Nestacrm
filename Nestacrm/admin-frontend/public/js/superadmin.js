import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";
import "./superadmin_features.js";
window.ref = ref;
window.remove = remove;

window.updateGrowthChart = async function (period) {
  const ctx = document.getElementById('growthChart');
  if (!ctx) return;

  const dates = Object.values(window.allRestaurants || {})
    .map(r => r.info?.createdAt)
    .filter(d => d);

  let labels = [];
  let dataPoints = [];
  const now = new Date();

  if (period === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      labels.push(`${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`);

      const count = dates.filter(date => {
        const cd = new Date(date);
        return cd.getDate() === d.getDate() && cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      }).length;
      dataPoints.push(count);
    }
  } else if (period === 'monthly') {
    const monthNames = [
      t("month_jan", "Yanvar"), t("month_feb", "Fevral"), t("month_mar", "Mart"),
      t("month_apr", "Aprel"), t("month_may", "May"), t("month_jun", "Iyun"),
      t("month_jul", "Iyul"), t("month_aug", "Avgust"), t("month_sep", "Sentabr"),
      t("month_oct", "Oktabr"), t("month_nov", "Noyabr"), t("month_dec", "Dekabr")
    ];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);

      const count = dates.filter(date => {
        const cd = new Date(date);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      }).length;
      dataPoints.push(count);
    }
  }

  if (window.myGrowthChart) {
    window.myGrowthChart.data.labels = labels;
    window.myGrowthChart.data.datasets[0].data = dataPoints;
    window.myGrowthChart.data.datasets[0].label = t("sa_new_connections", "Yangi ulanishlar");
    window.myGrowthChart.update();
  } else {
    window.myGrowthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: t("sa_new_connections", "Yangi ulanishlar"),
          data: dataPoints,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
          x: { grid: { display: false } }
        }
      }
    });
  }
};

window.updateRevenueByFilter = async function () {
  console.log(t("sa_log_revenue_filter", "📊 Daromad filtri ishga tushdi..."));

  try {
    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (!database) throw new Error(t("sa_err_firebase_not_found", "Firebase ulanishi topilmadi."));

    const startInput = document.getElementById("revStartDate").value;
    const endInput = document.getElementById("revEndDate").value;

    const start = startInput ? new Date(startInput).getTime() : 0;
    const end = endInput ? new Date(endInput).setHours(23, 59, 59, 999) : Date.now();

    const selectedMethods = Array.from(document.querySelectorAll('.revMethod:checked'))
      .map(el => el.value.toLowerCase());

    if (selectedMethods.length === 0) {
      document.getElementById("totalRevenueDisplay").innerText = "0 " + t("sa_currency_uzs", "so'm");
      return;
    }

    const snap = await get(ref(database, "systemData/paymentHistory"));
    if (!snap.exists()) {
      document.getElementById("totalRevenueDisplay").innerText = "0 " + t("sa_currency_uzs", "so'm");
      return;
    }

    const payments = snap.val();
    let total = 0;

    Object.values(payments).forEach(p => {
      const payDate = p.date || 0;
      const payMethod = (p.method || "").toLowerCase();

      const dateMatch = payDate >= start && payDate <= end;

      const methodMatch = selectedMethods.some(m => payMethod.includes(m));

      if (dateMatch && methodMatch) {
        total += Number(p.amount || 0);
      }
    });

    const display = document.getElementById("totalRevenueDisplay");
    if (display) {
      display.innerText = total.toLocaleString('ru-RU') + " " + t("sa_currency_uzs", "so'm");
    }

    const label = document.getElementById("revenueLabel");
    if (label) {
      label.innerText = (start === 0 && !endInput)
        ? t("sa_stat_total_revenue", "Jami tushgan pullar")
        : t("sa_filtered_revenue", "Filtrlangan tushum");
    }

  } catch (err) {
    if (err.message.includes("Permission denied")) {
      console.error(t("sa_err_firebase_rules", "Firebase Rules xatosi!"));
      document.getElementById("totalRevenueDisplay").innerText = t("sa_err_no_permission", "Ruxsat yo'q (Rules)");
    } else {
      console.error(t("sa_err_revenue_filter", "Revenue filtrida xato:"), err);
    }
  }
};

window.handleChartPeriodChange = function (value) {
  const customDiv = document.getElementById("chartCustomDates");
  if (customDiv) {
    customDiv.style.display = (value === "custom") ? "flex" : "none";
  }

  if (typeof window.updateGrowthChart === "function") {
    window.updateGrowthChart(value);
  }
};

document.getElementById("chartStartDate")?.addEventListener("change", () => window.updateGrowthChart('custom'));
document.getElementById("chartEndDate")?.addEventListener("change", () => window.updateGrowthChart('custom'));

// ============================================
// ENG FAOL VA ENG PASSIV RESTORANLAR REYTINGI
// ============================================
window.updateActivityRanking = function () {
  const activeList = document.getElementById("activeRestaurantsList");
  const passiveList = document.getElementById("passiveRestaurantsList");
  if (!activeList || !passiveList) return;

  let restaurantsArray = Object.entries(allRestaurants).map(([id, data]) => {
    const name = data.info?.name || t("sa_unknown", "Noma'lum");
    const domain = data.info?.domain || t("sa_not_defined", "nomalum");
    const activityScore = window.calculateActivityScore(id, data);

    return { id, name, domain, score: activityScore };
  });

  let topActive = [...restaurantsArray].sort((a, b) => b.score - a.score).slice(0, 4);
  let topPassive = [...restaurantsArray].sort((a, b) => a.score - b.score).slice(0, 4);

  const renderList = (arr, container, isFaol) => {
    container.innerHTML = "";
    if (arr.length === 0) {
      container.innerHTML = `<li style="color: #6b7280; font-size: 13px;">${t("sa_no_data", "Hozircha ma'lumot yo'q")}</li>`;
      return;
    }
    arr.forEach((r, index) => {
      const color = isFaol ? "#10b981" : "#f59e0b";
      const icon = isFaol ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
      container.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 800; color: #d1d5db; width: 15px; font-size: 14px;">${index + 1}.</span>
                        <div>
                            <div style="font-weight: 600; color: #374151; font-size: 14px;">${escapeHtml(r.name)}</div>
                            <div style="font-size: 11px; color: #9ca3af;">${escapeHtml(r.domain)}.nestacrm.uz</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 800; color: ${color}; font-size: 15px;">${r.score}</div>
                        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase;"><i class="fa-solid ${icon}"></i> ${t("sa_score", "ball")}</div>
                    </div>
                </li>
            `;
    });
  };

  renderList(topActive, activeList, true);
  renderList(topPassive, passiveList, false);
};

window.saveNewRestaurant = function () {
  const name = document.getElementById("newRestName")?.value.trim() || "";
  const domain = document.getElementById("newRestDomain")?.value.trim().toLowerCase() || "";
  const adminLogin = document.getElementById("newRestAdminLogin")?.value.trim() || "";
  const adminPass = document.getElementById("newRestAdminPass")?.value.trim() || "";

  const tariff = document.getElementById("newRestTariff")?.value || "pro";
  const duration = document.getElementById("newRestDuration")?.value || "1";

  if (!name || !domain || !adminLogin || !adminPass) {
    alert(t("sa_err_fill_all_fields", "Iltimos, barcha maydonlarni to'ldiring!"));
    return;
  }

  const isNameTaken = Object.values(window.allRestaurants || {}).some(
    r => (r.info?.name || "").toLowerCase() === name.toLowerCase()
  );

  if (isNameTaken) {
    alert(t("sa_err_name_taken", "Bunday nomli restoran allaqachon ro'yxatdan o'tgan!"));
    return;
  }

  window.closeAddRestaurantModal();
  window.isCreatingNewRestaurant = true;
  window.pendingNewRestaurantData = { name, domain, adminLogin, adminPass, tariff, duration };

  window.openSuperBillingModal("dummy_id", name);

  setTimeout(() => {
    const planSelect = document.getElementById("changePlanSelect");
    if (planSelect) {
      planSelect.value = tariff;
      window.handlePlanChangeInBilling(tariff);
    }

    setTimeout(() => {
      window.selectSuperPlan(Number(duration));
    }, 100);
  }, 100);
};

window.selectSuperPlan = function (months) {
  window.selectedSuperPlanMonths = months;

  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.remove('active');
    card.style.border = '1px solid #e5e7eb';
    card.style.background = 'white';
  });

  const activeEl = document.getElementById(`plan-${months}`);
  if (activeEl) {
    activeEl.classList.add('active');
    activeEl.style.border = '2px solid #10b981';
    activeEl.style.background = '#f0fdf4';
  }

  const methodsBlock = document.getElementById("superPaymentMethods");
  if (methodsBlock) {
    methodsBlock.style.setProperty("display", "grid", "important");
    methodsBlock.style.visibility = "visible";
    methodsBlock.style.opacity = "1";
  } else {
    console.error(t("sa_err_payment_methods_not_found", "Xato: 'superPaymentMethods' ID-li element topilmadi!"));
  }
};

// ============================================
// JADVALNI CHIZISH VA SARALASH (FILTR)
// ============================================
window.renderRestaurantsTable = function () {
  const tbody = document.getElementById("restaurantsTableBody");
  if (!tbody) return;

  const sourceData = window.allRestaurants || {};

  if (Object.keys(sourceData).length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">${t("sa_no_restaurants_yet", "Hozircha restoranlar yo'q")}</td></tr>`;
    return;
  }

  const searchTerm = document.getElementById("restaurantSearch")?.value.toLowerCase().trim() || "";
  const filterValue = document.getElementById("restaurantFilter")?.value || "newest";

  let arr = Object.entries(sourceData).map(([id, data]) => {
    let timestampFromId = id.startsWith("rest_") ? (parseInt(id.replace("rest_", "")) || 0) : 0;
    const finalTime = (data.info && data.info.createdAt) ? data.info.createdAt : timestampFromId;
    let score = 0;
    try { score = window.calculateActivityScore(id, data); } catch (e) { }
    return { id, sortTime: finalTime, score, ...data };
  });

  if (searchTerm) {
    arr = arr.filter(rest => {
      const name = (rest.info?.name || "").toLowerCase();
      const domain = (rest.info?.domain || "").toLowerCase();
      return name.includes(searchTerm) || domain.includes(searchTerm) || rest.id.toLowerCase().includes(searchTerm);
    });
  }
  arr.sort((a, b) => {
    if (filterValue === "most_active") return b.score - a.score;
    if (filterValue === "least_active") return a.score - b.score;
    return b.sortTime - a.sortTime;
  });

  const now = Date.now();
  let htmlContent = "";

  arr.forEach(rest => {
    try {
      const info = rest.info || {};
      const sub = rest.subscription || {};
      const expireAt = Number(sub.expireDate || sub.expireAt || 0);
      const tId = (info.tariff || "start").toLowerCase();

      const currentTariffName = (window.allTariffs && window.allTariffs[tId])
        ? (window.allTariffs[tId].name || tId.toUpperCase())
        : tId.toUpperCase();

      let tariffBgColor = "#3b82f6";
      let tariffTextColor = "#ffffff";

      if (tId === "start") {
        tariffBgColor = "#f3f4f6";
        tariffTextColor = "#374151";
      } else if (tId === "pro") {
        tariffBgColor = "#10b981";
        tariffTextColor = "#ffffff";
      } else if (tId === "premium" || tId === "vip") {
        tariffBgColor = "#8b5cf6";
        tariffTextColor = "#ffffff";
      }

      let statusHtml = "";
      const gracePeriodMs = 10 * 24 * 60 * 60 * 1000;
      const isPaused = info.status === "paused";

      if (info.status === "blocked") {
        statusHtml = `<span class="badge" style="background:#FEE2E2; color:#EF4444;">${t("sa_status_blocked", "Bloklangan")}</span>`;
      } else if (isPaused) {
        statusHtml = `<span class="badge" style="background:#E5E7EB; color:#4B5563;">${t("sa_status_paused", "To'xtatilgan")}</span>`;
      } else if (expireAt > now) {
        statusHtml = `<span class="badge" style="background:#D1FAE5; color:#059669;">${t("sa_status_active", "Faol")}</span>`;
      } else {
        const timePassed = now - expireAt;
        if (timePassed <= gracePeriodMs) {
          const daysLeft = Math.ceil((gracePeriodMs - timePassed) / (1000 * 60 * 60 * 24));
          const titleText = t("sa_days_left_title", "O'chishiga {days} kun qoldi").replace("{days}", daysLeft);
          const kunText = t("sa_days", "kun");
          statusHtml = `<span class="badge" style="background:#FEF3C7; color:#D97706;" title="${titleText}">${typeof t === 'function' ? t("sa_status_pending", "Kutmoqda") : "Kutmoqda"} (${daysLeft} ${kunText})</span>`;
        } else {
          statusHtml = `<span class="badge" style="background:#FEE2E2; color:#B91C1C; border: 1px solid #B91C1C;" title="${t("sa_data_will_be_deleted", "Ma'lumotlar o'chirilishi kerak")}">${t("sa_status_expired_clean", "Tugagan (Tozalanadi)")}</span>`;
        }
      }

      const pauseIcon = isPaused ? 'fa-play' : 'fa-pause';
      const pauseTitle = isPaused ? t("sa_action_resume", "Davom ettirish") : t("sa_action_pause", "Vaqtincha to'xtatish");
      const pauseColor = isPaused ? '#3b82f6' : '#f59e0b';

      htmlContent += `
<tr>
  <td>
    <div style="display: flex; align-items: center; gap: 6px;">
      <code title="${rest.id}">...${rest.id.slice(-6)}</code>
      <button class="btn-icon" onclick="window.copyToClipboard('${rest.id}', this)" 
              style="padding: 2px 5px; font-size: 11px; cursor: pointer; background: #f3f4f6; border-radius: 4px;" 
              title="${t("sa_copy_id", "IDdan nusxa olish")}">
        <i class="fa-regular fa-copy"></i>
      </button>
    </div>
  </td>
  <td><strong>${info.name || t("sa_unknown", "Noma'lum")}</strong></td>
  <td>${info.domain}.nestacrm.uz</td>
  <td><span class="badge" style="background:${tariffBgColor}; color:${tariffTextColor}; font-weight: bold;">${currentTariffName}</span></td>
  <td>${sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toLocaleDateString() : "—"}</td>
  <td>${expireAt ? new Date(expireAt).toLocaleDateString() : "—"}</td>
  <td>${statusHtml}</td>
  <td>
    <div style="display: flex; gap: 8px;">
      <button class="btn-icon" style="color: #10b981;" onclick="window.openSuperBillingModal('${rest.id}', '${info.name}')" title="${t("sa_billing", "To'lovni uzaytirish")}">
        <i class="fa-solid fa-money-bill-wave"></i>
      </button>
      <button class="btn-icon" style="color: ${pauseColor};" onclick="window.togglePauseRestaurant('${rest.id}', '${info.status}', ${expireAt})" title="${pauseTitle}">
            <i class="fa-solid ${pauseIcon}"></i>
          </button>
      
      <button class="btn-icon" onclick="window.loginAsRestaurantAdmin('${rest.id}')" title="${t("sa_login_as", "Admin bo'lib kirish")}"><i class="fa-solid fa-right-to-bracket"></i></button>
      <button class="btn-icon" onclick="window.editRestaurant('${rest.id}')" title="${t("sa_edit", "Tahrirlash")}"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon" onclick="window.toggleBlockRestaurant('${rest.id}', ${info.status === 'blocked'})" title="${info.status === 'blocked' ? t("sa_unblock", "Qulfdan chiqarish") : t("sa_block", "Bloklash")}">
        <i class="fa-solid ${info.status === 'blocked' ? 'fa-unlock' : 'fa-ban'}"></i>
      </button>
    </div>
  </td>
</tr>`;
    } catch (err) { console.error(t("sa_err_row_render", "Qatorni chizishda xato:"), err); }
  });

  tbody.innerHTML = htmlContent;
};

window.togglePauseRestaurant = async function (restId, currentStatus, currentExpireAt) {
  try {
    const database = window.db;
    const now = Date.now();
    const rest = window.allRestaurants[restId];
    if (!rest) return;

    let updates = {};

    if (currentStatus === "paused") {
      if (!confirm(t("sa_confirm_resume", "Restoran faoliyati davom ettirilsinmi?"))) return;

      const remainingMs = rest.info?.remainingMs || 0;
      const newExpireAt = now + remainingMs;

      updates = {
        "info/status": "active",
        "info/pausedAt": null,
        "info/remainingMs": null,
        "subscription/expireAt": newExpireAt,
        "subscription/expireDate": newExpireAt,
        "subscription/status": "active"
      };

    } else {
      if (currentExpireAt < now) {
        alert(t("sa_err_cannot_pause_expired", "Muddati allaqachon tugagan restoranni to'xtatib bo'lmaydi."));
        return;
      }

      if (!confirm(t("sa_confirm_pause", "Restoran obunasi vaqtincha to'xtatilsinmi?\n(Qolgan kunlari xotirada saqlanadi)"))) return;

      const remainingMs = currentExpireAt - now;

      updates = {
        "info/status": "paused",
        "info/pausedAt": now,
        "info/remainingMs": remainingMs,
        "subscription/status": "paused"
      };
    }

    await Promise.all([
      update(ref(database, `restaurants/${restId}`), updates),
      update(ref(database, `restaurants_meta/${restId}`), updates)
    ]);

  } catch (e) {
    console.error(t("sa_err_pause_process", "Pauza jarayonida xato:"), e);
    alert(t("sa_error_prefix", "Xatolik yuz berdi: ") + e.message);
  }
};

window.copyToClipboard = function (text, btn) {
  if (!navigator.clipboard) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showCopyFeedback(btn);
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showCopyFeedback(btn);
  }).catch(err => console.error(t("sa_err_copy", "Nusxalashda xato:"), err));
};

function showCopyFeedback(btn) {
  const icon = btn.querySelector('i');
  const originalClass = icon.className;

  icon.className = 'fa-solid fa-check';
  icon.style.color = '#10b981';

  setTimeout(() => {
    icon.className = originalClass;
    icon.style.color = '';
  }, 2000);
}

// ============================================
// ENG FAOL VA ENG PASSIV RESTORANLAR REYTINGI
// ============================================
window.calculateActivityScore = function (id, data) {
  const name = data.info?.name || t("sa_unknown", "Noma'lum");
  const isBlocked = data.info?.status === "blocked";

  let activityScore = data.stats?.totalOrders;
  if (activityScore === undefined) {
    activityScore = (id.charCodeAt(id.length - 1) * name.length * 7) % 800 + 10;
  }

  const expireAt = Number(data.subscription?.expireAt || 0);
  if (isBlocked || (expireAt && expireAt < Date.now())) {
    activityScore = Math.floor(activityScore / 10);
  }
  return activityScore;
};

window.t = t;

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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;
const auth = getAuth(app);
window.db = getDatabase(app);

window.allRestaurants = {};
window.allTariffs = {};
window.subscriptionPlans = { 1: { discount: 0, active: true }, 6: { discount: 11, active: true }, 12: { discount: 16, active: true } };
window.targetRestIdForBilling = null;
window.selectedSuperPlanMonths = 0;
window.currentPaymentMethod = null;
window.isCreatingNewRestaurant = false;
window.pendingNewRestaurantData = null;
window.paymentInterval = null;
window.listenRestaurants = listenRestaurants;
window.listenPaymentHistory = listenPaymentHistory;
window.listenDiscountSettings = listenDiscountSettings;
let globalPaymentsData = null;

// ============================================
// 1. INIT VA MARKAZIY LISTENERLAR
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user && localStorage.getItem("role") !== "superadmin") {
      window.location.href = "login.html";
    } else {
      initNavigation();
      if (typeof window.listenRestaurants === "function") window.listenRestaurants();
      if (typeof window.listenSystemSettings === "function") window.listenSystemSettings();
      if (typeof window.listenPaymentHistory === "function") window.listenPaymentHistory();
      if (typeof window.listenDiscountSettings === "function") window.listenDiscountSettings();
    }
  });

  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = getLang();
    langSelect.addEventListener("change", (e) => setLang(e.target.value));
  }
  applyLang();

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm(t("sa_logout_confirm", "Tizimdan chiqishni xohlaysizmi?"))) {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "login.html";
    }
  });

  document.addEventListener("input", (e) => {
    const target = e.target;
    const val = target.value;

    if (target.id === 'card_num' || target.id === 'cardNumber') {
      let digits = val.replace(/\D/g, '');
      const cardLogo = document.getElementById('card-type-logo');
      if (cardLogo) {
        if (digits.startsWith('8600')) {
          cardLogo.innerText = "🔹 " + t("sa_card_uzcard", "UzCard"); cardLogo.style.color = "#0052cc";
        } else if (digits.startsWith('9860')) {
          cardLogo.innerText = "🔸 " + t("sa_card_humo", "Humo"); cardLogo.style.color = "#ff6b00";
        } else {
          cardLogo.innerText = "";
        }
      }
      target.value = (digits.match(/.{1,4}/g)?.join(' ') || digits).substring(0, 19);
    }
    if (target.id === 'card_exp' || target.id === 'cardExpiry') {
      let digits = val.replace(/\D/g, '');
      target.value = digits.length >= 2 ? digits.substring(0, 2) + '/' + digits.substring(2, 4) : digits;
    }
    if (target.id === "newRestDomain") {
      const loginField = document.getElementById("newRestAdminLogin");
      if (loginField) loginField.value = val.trim().toLowerCase() + "_admin";
    }
    if (target.id === "newRestAdminPass") {
      target.value = val.replace(/\D/g, '').substring(0, 6);
    }
    if (target.id === 'card_cvc' || target.id === 'cardCvc') {
      target.value = val.replace(/\D/g, '').substring(0, 3);
    }
  });
});

onLangChange(() => {
  applyLang();
  if (typeof window.renderRestaurantsTable === "function") window.renderRestaurantsTable();
  if (typeof updateDashboardStats === "function") updateDashboardStats();
  if (typeof window.updateActivityRanking === "function") window.updateActivityRanking();
  if (typeof window.renderPaymentHistory === "function") window.renderPaymentHistory();
  if (typeof window.renderSystemSettingsUI === "function") window.renderSystemSettingsUI();

  const searchInput = document.getElementById("restaurantSearch");
  if (searchInput) searchInput.placeholder = t("sa_placeholder_search", "Restoran qidirish...");

  if (typeof window.updateGrowthChart === "function") {
    const period = document.getElementById('chartPeriodSelect')?.value || 'monthly';
    window.updateGrowthChart(period);
  }

  if (document.getElementById('saChatModal')) {
    const saChatSearchInput = document.getElementById('saChatSearchInput');
    if (saChatSearchInput) saChatSearchInput.placeholder = t("sa_placeholder_search_rest", "🔍 Restoran qidirish...");

    const saChatInput = document.getElementById('saChatInput');
    if (saChatInput) saChatInput.placeholder = t("sa_placeholder_type_msg", "Xabar yozing...");

    if (!window.currentChatRestId) {
      document.getElementById('saChatTitle').innerText = t("sa_chat_title_active", "Faol Restoranlar");

      if (!document.getElementById('saChatModal').classList.contains('hidden')) {
        window.loadSaChatList();
      }
    } else {
      const backBtn = document.querySelector('#saChatRoom button');
      if (backBtn) backBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> ${t("sa_btn_back", "Orqaga")}`;
    }
  }
});

window.hashPassword = async function (password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

function initNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  const sections = document.querySelectorAll('.saas-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      e.preventDefault();

      navLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active-section'));

      link.classList.add('active');
      const targetId = href.substring(1);
      if (targetId) document.getElementById(targetId)?.classList.add('active-section');
    });
  });
}

// ============================================
// 2. DATA LISTENERS & DASHBOARD
// ============================================
function listenRestaurants() {
  onValue(ref(db, "restaurants"), async (snapshot) => {
    if (snapshot.exists()) {
      window.allRestaurants = snapshot.val();
      updateDashboardStats();
      window.renderRestaurantsTable();
      window.updateActivityRanking();
      const period = document.getElementById('chartPeriodSelect')?.value || 'monthly';
      window.updateGrowthChart(period);
    }
  });
}

function listenPaymentHistory() {
  onValue(ref(db, "systemData/paymentHistory"), (snap) => {
    console.log(t("sa_log_payment_history_updated", "💳 To'lovlar tarixi yangilandi!"));
    globalPaymentsData = snap.exists() ? snap.val() : null;

    if (typeof window.renderPaymentHistory === "function") {
      window.renderPaymentHistory();
    }
  });
}

function listenDiscountSettings() {
  onValue(ref(db, "systemData/settings/subscriptionPlans"), (snap) => {
    if (snap.exists()) {
      window.subscriptionPlans = snap.val();
      [1, 6, 12].forEach(m => {
        if (document.getElementById(`disc_m${m}`)) document.getElementById(`disc_m${m}`).value = window.subscriptionPlans[m].discount;
        if (document.getElementById(`active_m${m}`)) document.getElementById(`active_m${m}`).checked = window.subscriptionPlans[m].active;
      });
    }
  });
}

window.listenSystemSettings = function () {
  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) return;

  onValue(ref(database, "systemData/settings/tariffs"), (snap) => {
    if (snap.exists()) {
      window.allTariffs = snap.val();
      console.log(t("sa_log_tariffs_updated_live", "✅ Tariflar bazadan jonli yangilandi:"), window.allTariffs);
    } else {
      window.allTariffs = {
        start: { name: "START", price: 150000, features: [] },
        pro: { name: "PRO", price: 350000, features: ['qr_menu', 'kds', 'promo', 'reservations', 'inventory'] },
        premium: { name: "PREMIUM", price: 700000, features: ['qr_menu', 'kds', 'promo', 'finance', 'reservations', 'inventory'] }
      };
    }

    if (typeof window.renderSystemSettingsUI === "function") window.renderSystemSettingsUI();

    if (typeof updateDashboardStats === "function") updateDashboardStats();

    if (typeof window.renderRestaurantsTable === "function") window.renderRestaurantsTable();

    const billingModal = document.getElementById("superBillingModal");
    if (billingModal && (billingModal.style.display === "flex" || billingModal.style.display === "block")) {
      if (typeof window.renderTariffCards === "function") {
        const currentTariff = window.selectedTariffKey || "pro";
        window.renderTariffCards(currentTariff);
      }
    }
  });
};

// Oylik/Yillik narx ko'rsatish
window._pricingPeriod = 'monthly'; // default

window.setPricingPeriod = function (period) {
  window._pricingPeriod = period;
  const btnMonthly = document.getElementById('btn-monthly');
  const btnAnnual = document.getElementById('btn-annual');
  if (btnMonthly) btnMonthly.classList.toggle('active', period === 'monthly');
  if (btnAnnual) btnAnnual.classList.toggle('active', period === 'annual');
  window.renderSystemSettingsUI();
};

window.renderSystemSettingsUI = function () {
  const period = window._pricingPeriod || 'monthly';
  const isAnnual = period === 'annual';
  const DISCOUNT = 0.80; // 20% chegirma

  if (!document.getElementById("fix-double-checkmarks")) {
    const style = document.createElement("style");
    style.id = "fix-double-checkmarks";
    style.innerHTML = `
      .price-features li::before { content: none !important; display: none !important; }
      .price-features li { padding-left: 0 !important; display: flex !important; align-items: center; gap: 8px; }
    `;
    document.head.appendChild(style);
  }

  const tariffs = window.allTariffs || {};

  ['start', 'pro', 'premium'].forEach(tKey => {
    const plan = tariffs[tKey] || { price: 0, features: [] };
    const prefix = tKey.charAt(0).toUpperCase() + tKey.slice(1);
    const basePrice = plan.price || 0;

    if (document.getElementById(`price${prefix}`)) {
      document.getElementById(`price${prefix}`).value = basePrice;
    }
    if (document.getElementById(`f_${tKey}_qr`)) {
      document.getElementById(`f_${tKey}_qr`).checked = (plan.features || []).includes("qr_menu");
    }
    if (document.getElementById(`f_${tKey}_kds`)) {
      document.getElementById(`f_${tKey}_kds`).checked = (plan.features || []).includes("kds");
    }
    if (document.getElementById(`f_${tKey}_promo`)) {
      document.getElementById(`f_${tKey}_promo`).checked = (plan.features || []).includes("promo");
    }
    if (document.getElementById(`f_${tKey}_finance`)) {
      document.getElementById(`f_${tKey}_finance`).checked = (plan.features || []).includes("finance");
    }
    if (document.getElementById(`f_${tKey}_inventory`)) {
      document.getElementById(`f_${tKey}_inventory`).checked = (plan.features || []).includes("inventory");
    }
    if (document.getElementById(`f_${tKey}_reservations`)) {
      document.getElementById(`f_${tKey}_reservations`).checked = (plan.features || []).includes("reservations");
    }

    // Narxni hisoblash (oylik yoki yillik chegirma bilan)
    const displayedPrice = isAnnual ? Math.round(basePrice * DISCOUNT) : basePrice;
    const annualTotal = basePrice * 12;
    const annualDiscounted = Math.round(annualTotal * DISCOUNT);
    const saving = annualTotal - annualDiscounted;

    const displayPrice = document.getElementById(`display-price-${tKey}`);
    if (displayPrice) {
      displayPrice.textContent = displayedPrice.toLocaleString('ru-RU');
    }

    const periodLabel = document.getElementById(`period-label-${tKey}`);
    if (periodLabel) {
      periodLabel.textContent = isAnnual ? t("sa_period_annual", "oyiga / 1 yillik to'lov") : t("sa_period_monthly", "oyiga / 1 oylik to'lov");
    }

    const savingEl = document.getElementById(`saving-${tKey}`);
    if (savingEl) {
      if (isAnnual) {
        savingEl.textContent = t("sa_saving_annual", "Yilga {amount} UZS tejaysiz").replace("{amount}", saving.toLocaleString('ru-RU'));
        savingEl.style.display = 'inline-block';
      } else {
        savingEl.style.display = 'none';
      }
    }

    const compPrice = document.getElementById(`comp-price-${tKey}`);
    if (compPrice) {
      compPrice.textContent = t("sa_comp_price_per_month", "{price} so'm/oy").replace("{price}", displayedPrice.toLocaleString('ru-RU'));
    }

    const ul = document.getElementById(`list-${tKey}`);
    if (ul) {
      ul.innerHTML = `
        <li><i class="fa-solid fa-check" style="color:#10b981;"></i> <span>${t("sa_feat_pos", "Kassa va Ofitsiant paneli")}</span></li>
        <li><i class="fa-solid fa-check" style="color:#10b981;"></i> <span>${t("sa_feat_admin", "Tizimda 1 ta Admin profil")}</span></li>
      `;

      const feats = [
        { id: 'qr_menu', n: t("feat_qr", "QR-Menyu va Self-service") },
        { id: 'kds', n: t("feat_kds", "Oshpaz ekrani (KDS)") },
        { id: 'promo', n: t("feat_promo", "Promokod / Keshbek") },
        { id: 'finance', n: t("feat_finance", "Moliya hisobotlari") },
        { id: 'inventory', n: t("feat_inventory", "Ombor / Inventarizatsiya") },
        { id: 'reservations', n: t("feat_reservations", "Bron tizimi") }
      ];

      feats.forEach(f => {
        const has = (plan.features || []).includes(f.id);
        if (has) {
          ul.innerHTML += `<li><i class="fa-solid fa-check" style="color:#10b981;"></i> <span>${f.n}</span></li>`;
        } else {
          ul.innerHTML += `<li style="opacity:0.5;"><i class="fa-solid fa-xmark" style="color:#ef4444;"></i> <span style="text-decoration:line-through;">${f.n}</span></li>`;
        }
      });
    }
  });
};

function updateDashboardStats() {
  let total = 0, active = 0, expired = 0, expectedRevenue = 0;

  let salesCount = {};
  Object.keys(window.allTariffs || {}).forEach(k => salesCount[k.toLowerCase()] = 0);

  const now = Date.now();

  Object.values(window.allRestaurants || {}).forEach(rest => {
    total++;
    const info = rest.info || {};
    const sub = rest.subscription || {};
    const expireAt = Number(sub.expireAt || 0);

    const tariffKey = (info.tariff || "pro").toLowerCase();

    if (salesCount.hasOwnProperty(tariffKey)) {
      salesCount[tariffKey]++;
    } else {
      salesCount[tariffKey] = (salesCount[tariffKey] || 0) + 1;
    }

    if (expireAt > now && info.status !== "blocked") {
      active++;
      const tariffPrice = window.allTariffs[tariffKey]?.price || 0;
      expectedRevenue += Number(tariffPrice);
    } else {
      expired++;
    }
  });

  if (document.getElementById("totalRestaurants")) document.getElementById("totalRestaurants").innerText = total;
  if (document.getElementById("activeRestaurants")) document.getElementById("activeRestaurants").innerText = active;
  if (document.getElementById("expiredRestaurants")) document.getElementById("expiredRestaurants").innerText = expired;

  const revDisplay = document.getElementById("totalRevenueDisplay");
  if (revDisplay) revDisplay.innerText = expectedRevenue.toLocaleString('ru-RU') + " " + t("sa_currency_uzs", "so'm");

  const taText = typeof t === 'function' ? t("sa_piece", "ta") : "ta";

  Object.keys(salesCount).forEach(tKey => {
    const badgeId = `badge-sales-${tKey}`;
    const badgeElement = document.getElementById(badgeId);

    if (badgeElement) {
      const count = salesCount[tKey];
      if (tKey === 'pro') {
        badgeElement.innerHTML = `🔥 ${t("sa_badge_most_sold", "Eng ko'p sotilgan:")} ${count} ${taText}`;
      } else {
        badgeElement.innerHTML = `${t("sa_badge_clients", "Mijozlar:")} ${count} ${taText}`;
      }
    }
  });

  console.log(t("sa_log_total_rests", "📊 Umumiy restoranlar:"), total, "| " + t("sa_log_by_tariffs", "Tariflar kesimida:"), salesCount);
}

window.selectedTariffKey = null;

window.openSuperBillingModal = function (restId, restName) {
  console.log(t("sa_log_billing_modal_opening", "📂 Billing modal ochilmoqda:"), restId, restName);

  if (restId !== "dummy_id" && window.allRestaurants[restId]) {
    const rest = window.allRestaurants[restId];
    const expireAt = Number(rest.subscription?.expireAt || 0);
    const now = Date.now();
    const gracePeriodMs = 10 * 24 * 60 * 60 * 1000;

    if (expireAt < now && (now - expireAt) > gracePeriodMs) {
      const confirmResetMsg = t("sa_confirm_reset_billing", "DIQQAT! {restName} restoranining to'lov muddati tugaganiga 10 kundan oshgan.\n\nQoidaga ko'ra, barcha eski ma'lumotlar (taomlar, ishchilar) o'chib ketadi va restoran noldan boshlanadi.\n\nShunga rozimisiz (Tozalab, yangi to'lov qilish)?")
        .replace("{restName}", restName)
        .replace("${restName}", restName);
      const confirmReset = confirm(confirmResetMsg);

      if (!confirmReset) {
        return;
      } else {
        window.pendingResetForRestId = restId;
      }
    } else {
      window.pendingResetForRestId = null;
    }
  }

  window.isCreatingNewRestaurant = (restId === "dummy_id");
  window.targetRestIdForBilling = restId;
  window.selectedSuperPlanMonths = 0;
  window.selectedTariffKey = null;
  window.currentPaymentMethod = null;

  const modal = document.getElementById("superBillingModal");
  if (modal) modal.style.display = "flex";

  const nameDisplay = document.getElementById("targetRestNameText");
  if (nameDisplay) nameDisplay.innerText = restName || t("sa_unknown", "Noma'lum");

  let initialTariff = "pro";
  if (window.pendingNewRestaurantData && window.pendingNewRestaurantData.tariff) {
    initialTariff = window.pendingNewRestaurantData.tariff;
  } else if (window.allRestaurants && window.allRestaurants[restId]) {
    initialTariff = window.allRestaurants[restId].info?.tariff || "pro";
  }

  if (typeof window.renderTariffCards === "function") {
    window.renderTariffCards(initialTariff);
  } else {
    console.error(t("sa_err_render_tariff_cards_not_found", "Xato: renderTariffCards funksiyasi topilmadi!"));
  }
};

window.renderTariffCards = function (activeTariffKey) {
  const container = document.getElementById("tariffCardsContainer");
  if (!container) return;
  container.innerHTML = "";

  const tariffs = window.allTariffs && Object.keys(window.allTariffs).length > 0
    ? window.allTariffs
    : {
      start: { name: "START", price: 150000 },
      pro: { name: "PRO", price: 350000 },
      premium: { name: "PREMIUM", price: 700000 }
    };

  Object.keys(tariffs).forEach(tKey => {
    const tariff = tariffs[tKey];
    const isActive = tKey.toLowerCase() === activeTariffKey.toLowerCase();

    if (isActive) window.selectedTariffKey = tKey;

    const card = document.createElement("div");
    card.style.cssText = `
      border: ${isActive ? '2px solid #10b981' : '1px solid #e5e7eb'};
      background: ${isActive ? '#f0fdf4' : '#ffffff'};
      padding: 12px 10px;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: 0.2s;
    `;

    card.innerHTML = `
      <div style="font-weight: 700; color: #374151; font-size: 14px;">${tariff.name || tKey.toUpperCase()}</div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${(tariff.price || 0).toLocaleString()} ${t("sa_currency_uzs", "so'm")}</div>
    `;

    card.onclick = () => {
      window.renderTariffCards(tKey);
    };

    container.appendChild(card);
  });

  if (typeof window.calculateAndDisplayPrices === "function") {
    window.calculateAndDisplayPrices(window.selectedTariffKey);
  }

  window.selectedSuperPlanMonths = 0;

  const methods = document.getElementById("superPaymentMethods");
  if (methods) methods.style.display = "none";

  const form = document.getElementById("cardDetailsForm");
  if (form) form.style.display = "none";

  const payBtn = document.getElementById("modalPayBtn");
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.style.opacity = "0.5";
    payBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${t("sa_pay_btn", "TO'LASH")}`;
  }
};

window.calculateAndDisplayPrices = function (tariffKey) {
  const basePrice = window.allTariffs[tariffKey?.toLowerCase()]?.price || 350000;
  const container = document.querySelector("#superBillingModal .pricing-plans");
  window.currentCalculatedAmounts = {};

  if (container && window.subscriptionPlans) {
    container.innerHTML = "";

    Object.entries(window.subscriptionPlans).forEach(([months, data]) => {
      if (!data.active) return;
      months = Number(months);

      const totalPrice = Math.round((basePrice * months) * (1 - data.discount / 100));
      window.currentCalculatedAmounts[months] = totalPrice;

      const planCard = document.createElement("div");
      planCard.className = "plan-card";
      planCard.id = `plan-${months}`;

      planCard.onclick = () => window.selectSuperPlan(months);

      planCard.style.cssText = `
        flex: 1;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        padding: 15px 10px;
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: 0.2s;
        position: relative;
        margin-top: 10px;
      `;

      planCard.innerHTML = `
        ${data.discount > 0 ? `<div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#3b82f6; color:white; font-size:10px; padding:3px 8px; border-radius:10px; font-weight:bold; white-space:nowrap;">-${data.discount}% ${t("sa_discount_badge", "CHEGIRMA")}</div>` : ''}
        <div style="font-weight: 700; color: #374151; font-size: 14px; margin-bottom: 5px;">
          ${months === 12 ? t("sa_1_year", "1 Yillik") : months + " " + t("sa_months", "Oylik")}
        </div>
        <div style="font-size: 13px; color: #10b981; font-weight: 700;">
          ${totalPrice.toLocaleString()} ${t("sa_currency_uzs", "so'm")}
        </div>
      `;

      container.appendChild(planCard);
    });
  }
};

window.toggleCardForm = function (showForm, method) {
  window.currentPaymentMethod = method;
  const form = document.getElementById('cardDetailsForm');
  const payBtn = document.getElementById('modalPayBtn');

  if (window.paymentInterval) clearInterval(window.paymentInterval);

  if (form) form.style.display = showForm ? 'block' : 'none';
  if (!payBtn) return;

  if (showForm) {
    payBtn.disabled = false;
    payBtn.style.opacity = "1";
    payBtn.style.cursor = "pointer";
    payBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${t("sa_pay_btn", "TO'LASH")} (${method})`;
  } else if (method === t("sa_pay_cash", "Naqd pul") || method === "Naqd pul") {
    payBtn.disabled = true;
    payBtn.style.opacity = "0.5";
    payBtn.style.cursor = "not-allowed";

    let seconds = 5;

    payBtn.innerHTML = `<i class="fa-solid fa-clock"></i> ${seconds} ${t("sa_wait_seconds", "soniya kuting...")}`;

    window.paymentInterval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        payBtn.innerHTML = `<i class="fa-solid fa-clock"></i> ${seconds} ${t("sa_wait_seconds", "soniya kuting...")}`;
      } else {
        clearInterval(window.paymentInterval);
        payBtn.disabled = false;
        payBtn.style.opacity = "1";
        payBtn.style.cursor = "pointer";
        payBtn.innerHTML = `<i class="fa-solid fa-money-bill-1-wave"></i> ${t("sa_pay_btn", "TO'LASH")} (${t("sa_cash_short", "Naqd")})`;
      }
    }, 1000);
  }
};

async function loadRestaurantsOnce() {
  const snap = await get(ref(db, 'restaurants'));
  const data = snap.val() || {};
  renderRestaurants(data);
}

window.handlePlanChangeInBilling = function (newTariff) {
  if (typeof calculateAndDisplayPrices === "function") {
    calculateAndDisplayPrices(newTariff);
    window.selectedSuperPlanMonths = 0;
    const form = document.getElementById("cardDetailsForm");
    if (form) form.style.display = "none";
    const payBtn = document.getElementById("modalPayBtn");
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.style.opacity = "0.5";
      payBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${t("sa_pay_btn", "TO'LASH")}`;
    }
  }
};

window.closeSuperBillingModal = function () {
  document.getElementById("superBillingModal").style.display = "none";
  window.pendingNewRestaurantData = null;
};

window.processSimulatedPayment = async function () {
  const method = window.currentPaymentMethod;
  const planMonths = window.selectedSuperPlanMonths;
  const isNew = window.isCreatingNewRestaurant;
  const newRestData = window.pendingNewRestaurantData;

  if (!planMonths) return alert(typeof t === 'function' ? t("sa_err_select_period", "Iltimos, muddatni tanlang!") : "Iltimos, muddatni tanlang!");
  if (!method) return alert(typeof t === 'function' ? t("sa_err_select_payment", "Iltimos, to'lov usulini tanlang!") : "Iltimos, to'lov usulini tanlang!");

  try {
    const database = window.db;

    const msToAdd = planMonths * 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let amount = window.currentCalculatedAmounts ? (window.currentCalculatedAmounts[planMonths] || 0) : 0;

    let restId = window.targetRestIdForBilling;
    let selectedPlanId, selectedPlanName;

    const activeTariff = window.selectedTariffKey || "pro";

    if (isNew && newRestData) {
      restId = "rest_" + now;

      selectedPlanId = activeTariff.toLowerCase();
      selectedPlanName = window.allTariffs[selectedPlanId]?.name || selectedPlanId.toUpperCase();

      // Tarifga mos features ni olish
      const planFeatures = window.allTariffs[selectedPlanId]?.features || [];

      const commonData = {
        info: {
          name: newRestData.name,
          domain: newRestData.domain,
          tariff: selectedPlanId,
          status: "active",
          createdAt: now
        },
        subscription: {
          plan: selectedPlanName,
          planId: selectedPlanId,
          status: "active",
          expireAt: now + msToAdd,
          expireDate: now + msToAdd,
          lastPaymentDate: now,
          features: planFeatures   // ← tarifga mos funksiyalar ro'yxati
        }
      };

      await Promise.all([
        set(ref(database, `restaurants/${restId}`), commonData),
        set(ref(database, `restaurants_meta/${restId}`), commonData)
      ]);

      const hashedPassword = typeof window.hashPassword === 'function'
        ? await window.hashPassword(newRestData.adminPass)
        : newRestData.adminPass;

      await set(ref(database, `restaurants/${restId}/users/admin_1`), {
        name: typeof t === 'function' ? t("sa_main_admin", "Asosiy Boshqaruvchi") : "Asosiy Boshqaruvchi",
        login: newRestData.adminLogin,
        password: hashedPassword,
        role: "admin",
        active: true,
        createdAt: now
      });

    } else {
      const rest = window.allRestaurants[restId];
      if (!rest) throw new Error(typeof t === 'function' ? t("sa_rest_not_found", "Restoran topilmadi!") : "Restoran topilmadi!");

      selectedPlanId = activeTariff.toLowerCase();
      selectedPlanName = window.allTariffs[selectedPlanId]?.name || selectedPlanId.toUpperCase();

      // Tarifga mos features ni olish
      const planFeatures = window.allTariffs[selectedPlanId]?.features || [];

      const currentExpireAt = Number(rest.subscription?.expireAt || 0);
      const startTime = (currentExpireAt > now) ? currentExpireAt : now;
      const newExpireDate = startTime + msToAdd;

      const updates = {
        "info/tariff": selectedPlanId,
        "subscription/planId": selectedPlanId,
        "subscription/planName": selectedPlanName,
        "subscription/status": "active",
        "subscription/expireAt": newExpireDate,
        "subscription/expireDate": newExpireDate,
        "subscription/lastPaymentDate": now,
        "subscription/lastPaymentMethod": method,
        "subscription/features": planFeatures   // ← tarifga mos funksiyalar ro'yxati
      };

      if (window.pendingResetForRestId === restId) {
        console.log(t("sa_log_10_days_expired", "⚠️ 10 kunlik muddat o'tgan! Eski ma'lumotlar tozalanyapti..."));

        updates["users"] = null;
        updates["products"] = null;
        updates["orders"] = null;
        updates["categories"] = null;
        updates["tables"] = null;
      }

      await Promise.all([
        update(ref(database, `restaurants/${restId}`), updates),
        update(ref(database, `restaurants_meta/${restId}`), updates)
      ]);

      if (window.pendingResetForRestId === restId) {
        const defaultPass = typeof window.hashPassword === 'function' ? await window.hashPassword("123456") : "123456";
        await set(ref(database, `restaurants/${restId}/users/admin_1`), {
          name: t("sa_main_admin_restored", "Asosiy Boshqaruvchi (Tiklandi)"),
          login: rest.info?.domain + "_admin",
          password: defaultPass,
          role: "admin",
          active: true,
          createdAt: now
        });
        window.pendingResetForRestId = null;
      }
    }

    const restNameForHistory = isNew ? newRestData.name : (window.allRestaurants[restId]?.info?.name || t("sa_unknown", "Noma'lum"));

    await push(ref(database, "systemData/paymentHistory"), {
      restaurantName: restNameForHistory,
      restaurantId: restId,
      amount: amount,
      method: method,
      months: planMonths,
      newTariff: selectedPlanName,
      date: now
    });

    window.closeSuperBillingModal();

    if (typeof window.showSuccessReceipt === "function") {
      window.showSuccessReceipt({
        orderId: "REC-" + now.toString().slice(-6),
        restaurantName: restNameForHistory,
        plan: `${planMonths} ${t("sa_months_short", "oylik")} (${selectedPlanName})`,
        method: method,
        date: new Date().toLocaleString('ru-RU'),
        amount: amount.toLocaleString() + " " + t("sa_currency_uzs", "so'm")
      });
    }

    if (typeof window.renderRestaurantsTable === "function") {
      window.renderRestaurantsTable();
    }

  } catch (error) {
    console.error(t("sa_err_payment_process", "To'lov jarayonida xatolik:"), error);
    alert(t("sa_error_prefix", "Xatolik: ") + (error?.message || ""));
  }
};

window.showSuccessReceipt = function (data) {
  const m = document.getElementById('receiptModal');
  if (!m) return;
  document.getElementById('r_orderId').innerText = "#" + data.orderId;
  document.getElementById('r_restName').innerText = data.restaurantName;
  document.getElementById('r_plan').innerText = data.plan;
  document.getElementById('r_method').innerText = data.method;
  document.getElementById('r_date').innerText = data.date;
  document.getElementById('r_amount').innerText = data.amount;
  m.style.display = 'flex';
};

window.closeReceipt = function () {
  document.getElementById('receiptModal').style.display = 'none';
};

window.downloadReceipt = function (format) {
  const area = document.getElementById("captureArea");
  if (typeof html2canvas !== "undefined") {
    html2canvas(area, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${t("sa_receipt_label", "Chek")}-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    });
  } else {
    alert(t("sa_html2canvas_error", "html2canvas yuklanmagan!"));
  }
};

// ============================================
// 4. RESTORANLAR JADVALI VA HARAKATLAR
// ============================================
window.openAddRestaurantModal = function () {
  const modal = document.getElementById("addRestaurantModal");
  if (modal) { modal.style.display = "flex"; modal.classList.remove("hidden"); }
  if (document.getElementById("newRestName")) document.getElementById("newRestName").value = "";
  if (document.getElementById("newRestDomain")) document.getElementById("newRestDomain").value = "";
  if (document.getElementById("newRestAdminLogin")) document.getElementById("newRestAdminLogin").value = "";
  if (document.getElementById("newRestAdminPass")) document.getElementById("newRestAdminPass").value = "";
};

window.closeAddRestaurantModal = function () {
  const modal = document.getElementById("addRestaurantModal");
  if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
};

window.editRestaurant = function (restId) {
  window.editingRestaurantId = restId;
  const rest = window.allRestaurants[restId];
  if (!rest) return;

  if (document.getElementById("editRestName")) document.getElementById("editRestName").value = rest.info?.name || "";
  if (document.getElementById("editRestDomain")) document.getElementById("editRestDomain").value = rest.info?.domain || "";

  const modal = document.getElementById("editRestaurantModal");
  if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; }
};

window.closeEditRestaurantModal = function () {
  const modal = document.getElementById("editRestaurantModal");
  if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
};

window.saveEditedRestaurant = async function () {
  const restId = window.editingRestaurantId;
  if (!restId) return;
  const name = document.getElementById("editRestName").value.trim();
  const domain = document.getElementById("editRestDomain").value.trim().toLowerCase();

  if (!name || !domain) return alert(t("sa_fill_all_fields", "Maydonlarni to'ldiring"));

  try {
    await update(ref(window.db, `restaurants/${restId}/info`), { name, domain, updatedAt: Date.now() });
    await update(ref(window.db, `restaurants_meta/${restId}/info`), { name, domain, updatedAt: Date.now() });
    await update(ref(window.db, `restaurants/${restId}/settings`), { restaurantName: name });
    window.closeEditRestaurantModal();
  } catch (error) {
    alert(t("sa_error_prefix", "Xatolik: ") + (error?.message || ""));
  }
};

window.renderPaymentHistory = function () {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!globalPaymentsData || Object.keys(globalPaymentsData).length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#6b7280;">${t("sa_no_payments", "Hozircha to'lovlar tarixi yo'q")}</td></tr>`;
    return;
  }

  const historyArray = Object.entries(globalPaymentsData).map(([id, data]) => ({ id, ...data }));

  historyArray.sort((a, b) => {
    const timeA = Number(a.date || a.createdAt || 0);
    const timeB = Number(b.date || b.createdAt || 0);
    return timeB - timeA;
  });

  historyArray.forEach(pay => {
    const dateValue = pay.date || pay.createdAt;
    const formattedDate = dateValue ? new Date(dateValue).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : "—";

    let methodText = pay.method || t("sa_pay_cash", "Naqd pul");
    let methodIcon = "💵";
    if (methodText.includes("Karta") || methodText.includes("Click") || methodText.includes("Payme") || methodText.includes("Card")) {
      methodIcon = "💳";
      methodText = t("payment_card", "Karta");
    } else if (methodText.includes("Naqd")) {
      methodIcon = "💵";
      methodText = t("sa_cash_short", "Naqd");
    } else if (methodText.includes("Promokod")) {
      methodIcon = "🎁";
      methodText = t("promo_label", "Promokod");
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>${formattedDate}</td>
  <td><strong>${pay.restaurantName || t("sa_unknown_rest", "Noma'lum restoran")}</strong></td>
  <td><span class="badge" style="background:#dbeafe; color:#1e40af;">${pay.months || 0} ${t("sa_months_short", "Oylik")}</span></td>
  <td style="font-weight: bold; color: #10b981;">+ ${(pay.amount || 0).toLocaleString()} ${t("sa_currency_uzs", "so'm")}</td>
  <td><span class="badge" style="background:#f3f4f6; color:#374151;">${methodIcon} ${methodText}</span></td>
`;
    tbody.appendChild(tr);
  });
};

// ===============================
// BARCHA RESTORANLARNI O'CHIRISH 
// ===============================
window.deleteAllRestaurants = async function () {
  const confirmMsg = typeof t === 'function'
    ? t("sa_confirm_delete_all_rests", "⚠️ DIQQAT! Tizimdagi BARCHA restoranlarni va ularning ma'lumotlarini butunlay o'chirib tashlamoqchimisiz? Bu amalni qaytarib bo'lmaydi!")
    : "⚠️ DIQQAT! Tizimdagi BARCHA restoranlarni va ularning ma'lumotlarini butunlay o'chirib tashlamoqchimisiz? Bu amalni qaytarib bo'lmaydi!";

  const confirmFirst = confirm(confirmMsg);

  if (!confirmFirst) return;

  try {
    const database = window.db;

    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(async ({ ref, remove }) => {

      await remove(ref(database, "restaurants"));
      await remove(ref(database, "restaurants_meta"));

      const successMsg = typeof t === 'function' ? t("sa_all_deleted_success", "✅ Barcha restoranlar muvaffaqiyatli o'chirildi.") : "✅ Barcha restoranlar muvaffaqiyatli o'chirildi.";
      alert(successMsg);

      if (typeof window.renderRestaurantsTable === "function") {
        window.renderRestaurantsTable();
      }

      if (typeof updateDashboardStats === "function") {
        updateDashboardStats();
      }
    });

  } catch (error) {
    console.error(t("sa_err_delete_all", "Barchasini o'chirishda xato:"), error);
    const errorPrefix = typeof t === 'function' ? t("sa_error_prefix", "Xatolik: ") : "Xatolik: ";
    alert(errorPrefix + error.message);
  }
};

window.saveGlobalSettings = async function () {
  console.log(t("sa_log_save_btn_clicked", "1. Saqlash tugmasi bosildi!"));

  const btn = document.querySelector("button[onclick*='saveGlobalSettings']");
  if (btn) btn.innerText = t("sa_saving_wait", "Saqlanmoqda... ⏳");

  try {
    const getFeatures = (tKey) => {
      const arr = [];
      if (document.getElementById(`f_${tKey}_qr`)?.checked) arr.push("qr_menu");
      if (document.getElementById(`f_${tKey}_kds`)?.checked) arr.push("kds");
      if (document.getElementById(`f_${tKey}_promo`)?.checked) arr.push("promo");
      if (document.getElementById(`f_${tKey}_finance`)?.checked) arr.push("finance");
      if (document.getElementById(`f_${tKey}_inventory`)?.checked) arr.push("inventory");
      if (document.getElementById(`f_${tKey}_reservations`)?.checked) arr.push("reservations");
      return arr;
    };

    const newTariffs = {
      start: {
        name: "START",
        price: Number(document.getElementById("priceStart")?.value || 150000),
        features: getFeatures("start")
      },
      pro: {
        name: "PRO",
        price: Number(document.getElementById("pricePro")?.value || 350000),
        features: getFeatures("pro")
      },
      premium: {
        name: "PREMIUM",
        price: Number(document.getElementById("pricePremium")?.value || 700000),
        features: getFeatures("premium")
      }
    };

    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (!database) {
      throw new Error(t("sa_err_db_refresh", "Firebase bazasi topilmadi! Sahifani yangilang."));
    }

    const { ref, set } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
    await set(ref(database, "systemData/settings/tariffs"), newTariffs);

    window.allTariffs = newTariffs;
    if (typeof window.renderSystemSettingsUI === "function") {
      window.renderSystemSettingsUI();
    }

    alert(t("sa_success_settings_saved", "✅ Narxlar va huquqlar saqlandi! Barcha sahifalarda yangilandi."));

  } catch (err) {
    console.error(t("sa_err_saving_uppercase", "❌ SAQLASHDA XATOLIK:"), err);
    alert(t("sa_err_saving", "Saqlashda xatolik: ") + err.message);
  } finally {
    if (btn) btn.innerHTML = `${t("sa_btn_save_settings", "Sozlamalarni Saqlash")}`;
  }
};

window.saveDiscountSettings = async function () {
  const newPlans = {
    1: { discount: Number(document.getElementById('disc_m1')?.value || 0), active: !!document.getElementById('active_m1')?.checked },
    6: { discount: Number(document.getElementById('disc_m6')?.value || 0), active: !!document.getElementById('active_m6')?.checked },
    12: { discount: Number(document.getElementById('disc_m12')?.value || 0), active: !!document.getElementById('active_m12')?.checked }
  };

  try {
    await set(ref(window.db || db, "systemData/settings/subscriptionPlans"), newPlans);
    alert(t("sa_success_packages_saved", "Paketlar va chegirmalar saqlandi!"));
  } catch (err) {
    alert(t("sa_error_prefix", "Xatolik: ") + err.message);
  }
};

async function logPaymentToHistory(restName, months, method, amount) {
  const pushRef = push(ref(db, `systemData/paymentHistory`));
  await set(pushRef, {
    restaurantName: restName, months: months, amount: amount, method: method, date: Date.now()
  });
}

window.renderPaymentHistory = renderPaymentHistory;

// ============================================
// TAHRIRLASH, BLOKLASH VA LOGIN
// ============================================
window.toggleBlockRestaurant = async function (restId, isCurrentlyBlocked) {
  const newStatus = isCurrentlyBlocked ? "active" : "blocked";

  const confirmMsg = isCurrentlyBlocked
    ? t("sa_unblock_confirm_full", "Siz rostdan ham bu restoranni qulfdan chiqarmoqchimisiz?")
    : t("sa_block_confirm_full", "Siz rostdan ham bu restoranni bloklamoqchimisiz?");

  if (!confirm(confirmMsg)) return;

  const database = window.db || (typeof db !== 'undefined' ? db : null);

  if (!database) {
    console.error(t("sa_err_db_not_found_log", "❌ Xato: Firebase Database ob'ekti topilmadi!"));
    alert(t("sa_err_db_refresh", "Ma'lumotlar bazasi bilan aloqa o'rnatib bo'lmadi. Sahifani yangilang."));
    return;
  }

  try {
    const updates = {
      "info/status": newStatus,
      "info/updatedAt": Date.now()
    };

    console.log(t("sa_log_status_changing", "📡 Restoran holati o'zgartirilmoqda: {id} -> {status}").replace("{id}", restId).replace("{status}", newStatus));

    await update(ref(database, `restaurants/${restId}`), updates);
    await update(ref(database, `restaurants_meta/${restId}`), updates);

    alert(t("sa_success_msg", "Muvaffaqiyatli bajarildi!"));

    if (typeof window.renderRestaurantsTable === "function") {
      window.renderRestaurantsTable();
    }
  } catch (err) {
    console.error(t("sa_err_block_process", "❌ Bloklashda xato yuz berdi:"), err);
    alert(t("sa_error_prefix", "Xatolik: ") + (err?.message || ""));
  }
};

let editingRestaurantId = null;

window.editRestaurant = function (restId) {
  console.log(t("sa_log_edit_opening", "✏️ Tahrirlash ochilmoqda:"), restId);

  window.editingRestaurantId = restId;

  const rest = window.allRestaurants && window.allRestaurants[restId];
  if (!rest) {
    alert(t("sa_rest_not_found", "Restoran topilmadi!"));
    return;
  }

  const nameInput = document.getElementById("editRestName");
  const domainInput = document.getElementById("editRestDomain");

  if (nameInput) nameInput.value = rest.info?.name || "";
  if (domainInput) domainInput.value = rest.info?.domain || "";

  const modal = document.getElementById("editRestaurantModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.setProperty("display", "flex", "important");

    modal.style.opacity = "1";
    modal.style.visibility = "visible";
  } else {
    console.error(t("sa_err_modal_not_found", "❌ Modal topilmadi! ID: editRestaurantModal"));
  }
};

window.closeEditRestaurantModal = function () {
  const modal = document.getElementById("editRestaurantModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.setProperty("display", "none", "important");
  }
};

window.saveEditedRestaurant = async function () {
  const restId = window.editingRestaurantId;
  if (!restId) return;

  const name = document.getElementById("editRestName").value.trim();
  const domain = document.getElementById("editRestDomain").value.trim().toLowerCase();

  const translate = (key, def) => (typeof t === 'function' ? t(key, def) : def);

  if (!name || !domain) {
    alert(translate("sa_fill_all_fields", "Iltimos, barcha maydonlarni to'ldiring!"));
    return;
  }

  const isDomainTaken = Object.entries(window.allRestaurants || {}).some(([id, r]) => {
    return id !== restId && (r.info?.domain || "") === domain;
  });

  if (isDomainTaken) {
    alert(`"${domain}.nestacrm.uz" ${translate("sa_domain_taken", "subdomeni allaqachon boshqa restoran tomonidan band qilingan.")}`);
    return;
  }

  const btn = document.querySelector("#editRestaurantModal .btn-primary");
  const originalText = btn ? btn.innerText : "";
  if (btn) {
    btn.innerText = translate("sa_saving", "Saqlanmoqda...");
    btn.disabled = true;
  }

  try {
    const database = window.db;

    const infoUpdates = {
      name: name,
      domain: domain,
      updatedAt: Date.now()
    };

    await update(ref(database, `restaurants/${restId}/info`), infoUpdates);

    await update(ref(database, `restaurants_meta/${restId}/info`), infoUpdates);

    await update(ref(database, `restaurants/${restId}/settings`), {
      restaurantName: name
    });

    alert(translate("sa_changes_saved", "✅ O'zgarishlar muvaffaqiyatli saqlandi!"));
    window.closeEditRestaurantModal();

    if (typeof window.renderRestaurantsTable === "function") {
      window.renderRestaurantsTable();
    }
  } catch (error) {
    console.error(t("sa_err_edit", "Tahrirlashda xatolik:"), error);
    alert(translate("sa_network_error", "Xatolik yuz berdi. Konsolni tekshiring."));
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
};

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.loginAsRestaurantAdmin = async function (restId) {
  try {
    console.log(t("sa_log_search_admin", "🔍 Restoran adminini qidirish:"), restId);

    const restaurantData = window.allRestaurants && window.allRestaurants[restId];

    if (!restaurantData) {
      alert(t("sa_err_rest_not_found_mem", "Restoran ma'lumotlari xotirada topilmadi. Sahifani yangilang."));
      return;
    }

    if (!restaurantData.users) {
      alert(typeof t === 'function' ? t("sa_err_no_admin_account", "Ushbu restoran uchun hali xodim/admin akkaunti yaratilmagan.") : "Admin akkaunti topilmadi.");
      return;
    }

    const users = restaurantData.users;
    let adminId = null;
    let adminName = typeof t === 'function' ? t("sa_default_admin", "Admin") : "Admin";

    for (const [uId, user] of Object.entries(users)) {
      if (user.role === 'admin' || (user.permissions && user.permissions.includes('all'))) {
        adminId = uId;
        adminName = user.name || (typeof t === 'function' ? t("sa_default_admin", "Admin") : "Admin");
        break;
      }
    }

    if (!adminId) {
      const userKeys = Object.keys(users);
      if (userKeys.length > 0) {
        adminId = userKeys[0];
        adminName = users[userKeys[0]].name || (typeof t === 'function' ? t("sa_default_staff", "Xodim") : "Staff");
      } else {
        alert(typeof t === 'function' ? t("sa_err_no_admin_account", "Restoranda foydalanuvchilar yo'q.") : "Foydalanuvchilar topilmadi.");
        return;
      }
    }

    localStorage.setItem("restaurantId", restId);
    localStorage.setItem("userId", adminId);
    localStorage.setItem("role", "admin");
    localStorage.setItem("name", adminName);

    console.log(t("sa_log_redirecting_admin", "🚀 Admin panelga yo'naltirilmoqda..."));
    window.open("admin.html?id=" + restId, "_blank");

  } catch (err) {
    console.error(t("sa_err_login_admin", "❌ Adminga kirishda xato yuz berdi:"), err);
    alert(t("sa_error_prefix", "Xatolik: ") + err.message);
  }
};

window.deleteRestaurant = async function (restId, restName) {
  const deleteMsg = t("sa_delete_confirm_full", "Diqqat! \"{name}\" restoranini va uning barcha ma'lumotlarini bazadan butunlay o'chirib tashlamoqchimisiz?")
    .replace("{name}", restName);

  if (!confirm(deleteMsg)) return;
  try {
    const database = window.db;

    await remove(ref(database, `restaurants/${restId}`));
    await remove(ref(database, `restaurants_meta/${restId}`));

    alert(t("sa_delete_success", "Restoran muvaffaqiyatli o'chirildi."));

    if (typeof window.renderRestaurantsTable === "function") {
      window.renderRestaurantsTable();
    }
  } catch (err) {
    console.error(t("sa_err_delete", "O'chirishda xato:"), err);
    alert(t("sa_error_prefix", "Xatolik: ") + (err?.message || ""));
  }
};

window.toggleRevenueFilter = function () {
  const menu = document.getElementById("revenueFilterMenu");
  if (menu) menu.style.display = (menu.style.display === "none" ? "block" : "none");
};

setTimeout(() => {
  if (typeof window.updateRevenueByFilter === "function") window.updateRevenueByFilter();
}, 1000);

window.loadGlobalPayments = function () {
  onValue(ref(db, 'payments'), (snapshot) => {
    const data = snapshot.val();
    const list = document.getElementById('payments-list');
    const totalRev = document.getElementById('total-revenue');
    let total = 0;
    if (list) list.innerHTML = "";

    if (data) {
      Object.values(data).reverse().forEach(pay => {
        total += pay.amount;
        if (list) list.innerHTML += `
                    <tr>
                        <td>${pay.restaurantId}</td>
                        <td>${pay.amount.toLocaleString()} ${t("sa_currency_uzs", "so'm")}</td>
                        <td><b>${pay.method}</b></td>
                        <td>${new Date(pay.date).toLocaleString()}</td>
                    </tr>
                `;
      });
    }
    if (totalRev) totalRev.innerText = total.toLocaleString();
  });
};

window.selectedSuperPlanMonths = 12;
window.currentPaymentMethod = t("sa_pay_cash", "Naqd pul");
window.selectedSuperPlanMonths = 0;
window.currentPaymentMethod = null;
window.isCreatingNewRestaurant = false;
window.pendingNewRestaurantData = null;

function resetModalState() {
  const form = document.getElementById('cardDetailsForm');
  if (form) form.style.display = 'none';

  const methods = document.getElementById('superPaymentMethods');
  if (methods) methods.style.display = 'grid';

  const payBtn = document.getElementById('modalPayBtn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.style.opacity = "0.5";
    payBtn.style.cursor = "not-allowed";
    payBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> <span>${t("sa_pay_btn", "TO'LASH")}</span>`;
  }
}
window.closeAddRestaurantModal = closeAddRestaurantModal;
window.openAddRestaurantModal = openAddRestaurantModal;
window.paymentInterval = null;

window.showSuccessReceipt = function (data) {
  document.getElementById('r_orderId').innerText = "#" + data.orderId;
  document.getElementById('r_restName').innerText = data.restaurantName;
  document.getElementById('r_plan').innerText = data.plan;
  document.getElementById('r_method').innerText = data.method;
  document.getElementById('r_date').innerText = data.date;
  document.getElementById('r_amount').innerText = data.amount;

  document.getElementById('receiptModal').style.display = 'flex';
};

let selectedMethod = null;

window.handlePlanChangeInBilling = function (newTariff) {
  console.log(t("sa_log_tariff_changed", "🔄 Tarif o'zgartirildi:"), newTariff);

  if (typeof calculateAndDisplayPrices === "function") {
    calculateAndDisplayPrices(newTariff);

    window.selectedSuperPlanMonths = 0;

    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.remove('active');
      card.classList.remove('selected');
      card.style.border = '1px solid #e5e7eb';
      card.style.background = 'white';
    });

    const methods = document.getElementById("superPaymentMethods");
    const cardDetails = document.getElementById("cardDetailsForm");
    if (methods) methods.style.display = "none";
    if (cardDetails) cardDetails.style.display = "none";

    const payBtn = document.getElementById("modalPayBtn");
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.style.opacity = "0.5";
      payBtn.style.cursor = "not-allowed";
      payBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${t("sa_pay_btn", "TO'LASH")}`;
    }
  }
};

window.growthChartInstance = null;

// ============================================
// TO'LOV CHEKI (RECEIPT) FUNKSIYALARI
// ============================================
window.showFinalReceipt = function (data) {
  const modal = document.getElementById("receiptModal");
  if (!modal) {
    console.warn(t("sa_receipt_not_found", "Chek HTML kodi topilmadi!"));
    return;
  }

  document.getElementById("r_orderId").innerText = data.orderId;
  document.getElementById("r_restName").innerText = data.restName;
  document.getElementById("r_plan").innerText = data.months + " " + t("sa_monthly_sub", "Oylik Obuna");
  document.getElementById("r_amount").innerText = data.amount.toLocaleString() + " " + t("sa_currency_uzs", "so'm");
  document.getElementById("r_method").innerText = data.method;
  document.getElementById("r_date").innerText = data.date;

  modal.style.display = "flex";
};

window.downloadReceipt = function (format) {
  const area = document.getElementById("captureArea");

  if (typeof html2canvas !== "undefined") {
    html2canvas(area, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${t("sa_receipt_label", "Chek")}-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else if (format === 'pdf') {
        const dataUrl = canvas.toDataURL("image/png");
        const win = window.open('', '_blank');
        win.document.write(`<img src="${dataUrl}" style="width:100%; max-width: 500px; display: block; margin: 0 auto;">`);
        win.document.close();
        setTimeout(() => {
          win.print();
          win.close();
        }, 500);
      }
    });
  } else {
    alert(t("sa_html2canvas_error", "Rasmga yuklash uchun html2canvas kutubxonasi ulanmagan!"));
  }
};

window.allTariffs = {};

async function addNewRestaurantToSystem(name) {
  const newRestId = "rest_" + Date.now();

  const newRestData = {
    info: {
      name: name,
      status: "active"
    },
    subscription: {
      plan: "VIP",
      planId: "vip",
      status: "active",
      expireDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
      createdAt: Date.now()
    }
  };

  try {
    await set(ref(db, 'restaurants/' + newRestId), newRestData);
    alert(t("sa_vip_added", "Yangi VIP restoran qo'shildi!"));
  } catch (error) {
    console.error(t("sa_error", "Xatolik:"), error);
    alert(t("sa_error_prefix", "Xatolik: ") + (error?.message || ""));
  }
}

async function makeEverythingVIP() {
  const restSnap = await get(ref(db, 'restaurants'));
  if (!restSnap.exists()) return;

  const allData = restSnap.val();
  const updates = {};

  Object.keys(allData).forEach(restId => {
    updates[`restaurants/${restId}/subscription`] = {
      plan: "VIP",
      planId: "vip",
      status: "active",
      expireDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
      updatedAt: Date.now()
    };
    updates[`restaurants/${restId}/info/status`] = "active";
  });

  await update(ref(db), updates);
  alert(t("sa_all_vip", "Barcha restoranlar 100% VIP bo'ldi!"));
}

async function upgradeAllRestaurantsToVIP() {
  if (!confirm(t("sa_confirm_upgrade_all_vip", "DIQQAT! Barcha restoranlarni VIP tarifga o'tkazmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi."))) return;

  console.log(t("sa_vip_start_log", "⏳ Barcha restoranlarni..."));
  try {
    const restaurantsSnap = await get(ref(db, 'restaurants'));

    if (!restaurantsSnap.exists()) {
      console.error(t("sa_err_no_rests_found", "Hech qanday restoran topilmadi."));
      return;
    }

    const allRestorans = restaurantsSnap.val();
    const updates = {};

    Object.keys(allRestorans).forEach(restId => {
      updates[`restaurants/${restId}/subscription`] = {
        plan: "VIP",
        planId: "vip",
        status: "active",
        expireDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
        updatedAt: Date.now(),
        isTest: true
      };

      updates[`restaurants/${restId}/info/status`] = "active";
    });

    await update(ref(db), updates);

    alert(t("sa_all_vip_success", "🚀 TABRIKLAYMIZ! Barcha restoranlar 100% VIP tarifga o'tkazildi."));
    console.log(t("sa_log_update_success", "✅ Yangilanish muvaffaqiyatli yakunlandi."));

  } catch (error) {
    console.error(t("sa_err_occurred_log", "❌ Xatolik yuz berdi:"), error);
    alert(t("sa_error_prefix", "Xatolik: ") + (error?.message || ""));
  }
}

// ============================================
// TAVSIYA ETILGAN SOZLAMALARNI TIKLASH
// ============================================
window.resetToRecommendedSettings = function () {
  if (!confirm(typeof t === 'function' ? t("sa_confirm_reset_settings", "Barcha narxlar va chegirmalarni standart (tavsiya etilgan) holatga qaytarmoqchimisiz?") : "Barcha narxlar va chegirmalarni standart holatga qaytarmoqchimisiz?")) {
    return;
  }

  const defaultTariffs = {
    start: { name: "START", price: 150000, features: [] },
    pro: { name: "PRO", price: 350000, features: ['qr_menu', 'kds', 'promo', 'reservations', 'inventory'] },
    premium: { name: "PREMIUM", price: 700000, features: ['qr_menu', 'kds', 'promo', 'finance', 'reservations', 'inventory'] }
  };

  const defaultPlans = {
    1: { discount: 0, active: true },
    6: { discount: 10, active: true },
    12: { discount: 20, active: true }
  };

  const database = window.db || (typeof db !== 'undefined' ? db : null);
  if (!database) {
    alert(t("sa_err_db_connect", "Ma'lumotlar bazasiga ulanib bo'lmadi."));
    return;
  }

  Promise.all([
    set(ref(database, "systemData/settings/tariffs"), defaultTariffs),
    set(ref(database, "systemData/settings/subscriptionPlans"), defaultPlans)
  ]).then(() => {
    alert(t("sa_success_settings_reset", "✅ Sozlamalar muvaffaqiyatli tiklandi!"));

    if (typeof window.renderSystemSettingsUI === "function") window.renderSystemSettingsUI();
    if (typeof window.listenDiscountSettings === "function") window.listenDiscountSettings();

  }).catch((err) => {
    console.error(t("sa_err_reset_settings", "Sozlamalarni tiklashda xato:"), err);
    alert(t("sa_error_prefix", "Xatolik: ") + err.message);
  });
};

// ==========================================
// 🚀 SUPERADMIN: JONLI CHAT TIZIMI
// ==========================================
window.initSuperadminChat = function () {
  const chatHtml = `
  <style>
    .sa-chat-btn { position: fixed; bottom: 30px; right: 30px; background: #10b981; color: #fff; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; cursor: pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); z-index: 99999; transition: 0.3s; }
    .sa-chat-btn:hover { transform: scale(1.1); }
    .sa-chat-modal { position: fixed; bottom: 100px; right: 30px; width: 360px; height: 500px; background: #fff; border-radius: 15px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); display: flex; flex-direction: column; z-index: 99999; overflow: hidden; font-family: sans-serif; transition: 0.3s; }
    .sa-chat-modal.hidden { opacity: 0; pointer-events: none; transform: translateY(20px); }
    .sa-chat-header { background: #1e293b; color: #fff; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
    .sa-chat-header button { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
    
    .sa-chat-search { padding: 10px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; }
    .sa-chat-search input { width: 100%; padding: 8px 15px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 13px; transition: 0.2s; }
    .sa-chat-search input:focus { border-color: #10b981; box-shadow: 0 0 5px rgba(16,185,129,0.3); }

    .sa-chat-list { flex: 1; overflow-y: auto; background: #fff; }
    .sa-rest-item { padding: 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; font-size: 14px; font-weight: 600; color: #333;}
    .sa-rest-item:hover { background: #f8f9fa; }
    .sa-chat-room { flex: 1; display: flex; flex-direction: column; background: #fff; }
    .sa-chat-messages { flex: 1; overflow-y: auto; padding: 15px; background: #f0f2f5; display: flex; flex-direction: column; gap: 10px; }
    .sa-msg-row { display: flex; flex-direction: column; max-width: 85%; }
    .sa-msg-row.me { align-self: flex-end; align-items: flex-end; }
    .sa-msg-row.them { align-self: flex-start; align-items: flex-start; }
    .sa-msg-bubble { padding: 10px 14px; border-radius: 15px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); line-height: 1.4; color: #111;}
    .sa-msg-row.me .sa-msg-bubble { background: #dcf8c6; border-bottom-right-radius: 2px; }
    .sa-msg-row.them .sa-msg-bubble { background: #fff; border-bottom-left-radius: 2px; }
    .sa-msg-time { font-size: 11px; color: #64748b; margin-top: 4px; }
    .sa-chat-input-area { padding: 10px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }
    .sa-chat-input-area input { flex: 1; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 14px;}
    .sa-chat-input-area button { background: #10b981; color: #fff; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;}
  </style>
  <div class="sa-chat-btn" onclick="window.toggleSaChat()"><i class="fa-solid fa-headset"></i></div>
  <div id="saChatModal" class="sa-chat-modal hidden">
    <div class="sa-chat-header">
      <span id="saChatTitle">${t("sa_chat_title_active", "Faol Restoranlar")}</span>
      <button onclick="window.toggleSaChat()"><i class="fa-solid fa-xmark"></i></button>
    </div>
    
    <div id="saChatSearchContainer" class="sa-chat-search">
      <input type="text" id="saChatSearchInput" placeholder="${t("sa_placeholder_search_rest", "🔍 Restoran qidirish...")}" oninput="window.filterSaChatList()" autocomplete="off">
    </div>

    <div id="saChatList" class="sa-chat-list"></div>
    <div id="saChatRoom" class="sa-chat-room" style="display:none;">
      <div style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #ddd; display:flex; align-items:center;">
        <button onclick="window.closeSaChatRoom()" style="background:none; border:none; color:#10b981; cursor:pointer; font-weight:bold; font-size: 14px;"><i class="fa-solid fa-arrow-left"></i> ${t("sa_btn_back", "Orqaga")}</button>
      </div>
      <div id="saChatMessages" class="sa-chat-messages"></div>
      <div class="sa-chat-input-area">
        <input type="text" id="saChatInput" placeholder="${t("sa_placeholder_type_msg", "Xabar yozing...")}" autocomplete="off" onkeypress="if(event.key==='Enter') window.sendSaMessage()">
        <button onclick="window.sendSaMessage()"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  </div>`;

  if (!document.getElementById('saChatModal')) {
    document.body.insertAdjacentHTML('beforeend', chatHtml);
  }
};

window.toggleSaChat = function () {
  const modal = document.getElementById('saChatModal');
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    window.loadSaChatList();
  } else {
    modal.classList.add('hidden');
  }
};

window.loadSaChatList = function () {
  document.getElementById('saChatList').style.display = 'block';
  document.getElementById('saChatSearchContainer').style.display = 'block';
  document.getElementById('saChatRoom').style.display = 'none';
  document.getElementById('saChatTitle').innerText = t("sa_chat_title_active", "Faol Restoranlar");

  const searchInput = document.getElementById('saChatSearchInput');
  if (searchInput) searchInput.value = '';

  const listContainer = document.getElementById('saChatList');
  listContainer.innerHTML = '';

  const now = Date.now();
  const activeRests = Object.entries(window.allRestaurants || {}).filter(([id, data]) => {
    const expireAt = Number(data.subscription?.expireAt || 0);
    return data.info?.status !== "blocked" && data.info?.status !== "paused" && expireAt > now;
  });

  if (activeRests.length === 0) {
    listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">${t("sa_chat_no_active", "Faol restoranlar yo'q")}</div>`;
    return;
  }

  activeRests.forEach(([id, data]) => {
    const restName = data.info?.name || t("sa_unknown_rest", "Nomsiz restoran");
    listContainer.innerHTML += `
      <div class="sa-rest-item" data-name="${restName.toLowerCase()}" onclick="window.openSaChatRoom('${id}', '${restName}')">
        <span>🍽 ${restName}</span>
        <span style="font-size: 11px; padding: 4px 8px; background: #d1fae5; color: #059669; border-radius: 12px;">${t("sa_status_active", "Faol")}</span>
      </div>`;
  });
};

window.filterSaChatList = function () {
  const query = document.getElementById('saChatSearchInput').value.toLowerCase().trim();
  const items = document.querySelectorAll('.sa-rest-item');

  items.forEach(item => {
    const name = item.getAttribute('data-name') || "";
    if (name.includes(query)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
};

window.currentChatRestId = null;

window.openSaChatRoom = function (restId, restName) {
  window.currentChatRestId = restId;
  document.getElementById('saChatList').style.display = 'none';
  document.getElementById('saChatSearchContainer').style.display = 'none';
  document.getElementById('saChatRoom').style.display = 'flex';
  document.getElementById('saChatTitle').innerText = restName;

  const msgsDiv = document.getElementById('saChatMessages');
  msgsDiv.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px;">${t("sa_loading", "Yuklanmoqda...")}</div>`;

  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ ref, onValue }) => {
    const chatRef = ref(window.db, `restaurants/${restId}/superadmin_chat`);

    if (window.saChatUnsubscribe) window.saChatUnsubscribe();

    window.saChatUnsubscribe = onValue(chatRef, (snap) => {
      msgsDiv.innerHTML = '';
      if (!snap.exists()) {
        msgsDiv.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px; font-size:13px;">${t("sa_chat_empty", "Hali xabarlar yo'q. Birinchi bo'lib yozing!")}</div>`;
        return;
      }
      const msgs = snap.val();
      Object.values(msgs).forEach(m => {
        const isMe = m.sender === 'superadmin';
        msgsDiv.innerHTML += `
          <div class="sa-msg-row ${isMe ? 'me' : 'them'}">
            <div class="sa-msg-bubble">${m.text}</div>
            <div class="sa-msg-time">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>`;
      });
      msgsDiv.scrollTop = msgsDiv.scrollHeight;
    });
  });
};

window.closeSaChatRoom = function () {
  window.currentChatRestId = null;
  if (window.saChatUnsubscribe) window.saChatUnsubscribe();
  window.loadSaChatList();
};

document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menuToggleBtn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function toggleSidebar() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("visible");
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", toggleSidebar);
  }
});

window.sendSaMessage = function () {
  const input = document.getElementById('saChatInput');
  const text = input.value.trim();
  const restId = window.currentChatRestId;
  if (!text || !restId) return;

  input.value = '';
  const now = Date.now();

  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({ ref, push }) => {
    push(ref(window.db, `restaurants/${restId}/superadmin_chat`), {
      sender: "superadmin",
      text: text,
      timestamp: now
    });

    push(ref(window.db, `restaurants/${restId}/notifications`), {
      title: t("sa_notification_title", "Tizim Egasi (Superadmin)"),
      message: text,
      type: "superadmin_chat",
      date: now,
      isRead: false
    });
  });
};

setTimeout(() => { if (typeof window.initSuperadminChat === 'function') window.initSuperadminChat(); }, 1000);

window.closeAddRestaurantModal = closeAddRestaurantModal;
window.openAddRestaurantModal = openAddRestaurantModal;

document.querySelectorAll('.revMethod').forEach(el => {
  el.addEventListener('change', () => window.updateRevenueByFilter());
});

const startD = document.getElementById("revStartDate");
const endD = document.getElementById("revEndDate");
if (startD) startD.addEventListener("change", () => window.updateRevenueByFilter());
if (endD) endD.addEventListener("change", () => window.updateRevenueByFilter());

document.getElementById("revStartDate")?.addEventListener("change", window.updateRevenueByFilter);
document.getElementById("revEndDate")?.addEventListener("change", window.updateRevenueByFilter);