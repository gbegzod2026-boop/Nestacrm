// login.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t, getLang, setLang, applyLang, onLangChange } from "./i18n.js";

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
const auth = getAuth(app);

window.hashPassword = async function (password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("errorMsg").style.display = "none";

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
    hideError();
    resetBtn();
  });

  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("passwordInput");

  togglePassword.addEventListener("click", function () {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);

    this.classList.toggle("fa-eye");
    this.classList.toggle("fa-eye-slash");
  });
});

document.getElementById("loginBtn").addEventListener("click", handleLogin);

['loginInput', 'passwordInput'].forEach(id => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
});

async function handleLogin() {
  let loginVal = document.getElementById("loginInput").value.trim().toLowerCase();
  const passVal = document.getElementById("passwordInput").value.trim();
  const btn = document.getElementById("loginBtn");

  if (!loginVal || !passVal) {
    showError(t("error_fill_fields", "Barcha maydonlarni to'ldiring!"));
    return;
  }

  if (loginVal === "superadmin") {
    loginVal = "superadmin@nesta.uz";
  }

  btn.innerText = t("login_checking", "Tekshirilmoqda... ⏳");
  btn.disabled = true;
  hideError();

  try {
    if (loginVal.includes("@")) {
      try {
        await signInWithEmailAndPassword(auth, loginVal, passVal); 
        
        localStorage.setItem("role", "superadmin");
        window.location.href = "superadmin.html";
        return;
      } catch (err) {
        showError(t("error_invalid_credentials", "Login yoki parol noto'g'ri!"));
        resetBtn();
        return;
      }
    }

    const hashedPassVal = await window.hashPassword(passVal);
    const restSnap = await get(ref(db, "restaurants")); 

    if (!restSnap.exists()) {
      showError(t("error_no_restaurants", "Tizimda hali restoranlar yo'q!"));
      resetBtn();
      return;
    }

    const allRestaurants = restSnap.val();
    let foundUser = null;
    let foundRestaurantId = null;

    for (const [restId, restData] of Object.entries(allRestaurants)) {
      if (restData.info?.status === "blocked") continue;

      if (restData.users) {
        for (const [userId, user] of Object.entries(restData.users)) {
          const isPasswordCorrect = (user.password === hashedPassVal) || (user.password === passVal);

          if ((user.login === loginVal || user.name === loginVal) && isPasswordCorrect) {
            foundUser = { id: userId, ...user };
            foundRestaurantId = restId;
            foundUser.restaurantData = restData;
            break;
          }
        }
      }
      if (foundUser) break;
    }

    if (foundUser && foundRestaurantId) {
      if (foundUser.active === false) {
        showError(t("error_profile_blocked", "Profilingiz bloklangan!"));
        resetBtn();
        return;
      }

      const expireAt = foundUser.restaurantData.subscription?.expireAt || 0;
      if (expireAt > 0 && Date.now() > Number(expireAt)) {
        window.location.href = `expired.html?rest=${encodeURIComponent(foundRestaurantId)}`;
        return;
      }

      localStorage.setItem("restaurantId", foundRestaurantId);
      localStorage.setItem("userId", foundUser.id);
      localStorage.setItem("role", foundUser.role);
      localStorage.setItem("name", foundUser.name);
      localStorage.setItem("currentUser", JSON.stringify({ id: foundUser.id, role: foundUser.role, name: foundUser.name }));

      const routes = {
        admin: "admin.html",
        manager: "admin.html",
        chef: "chef.html",
        waiter: "waiter.html"
      };
      window.location.href = routes[foundUser.role] || "admin.html";

    } else {
      showError(t("error_invalid_credentials", "Login yoki parol noto'g'ri!"));
      resetBtn();
    }

  } catch (error) {
    console.error(t("log_login_error", "Login xatoligi:"), error);
    showError(t("error_network", "Internet aloqasini tekshiring."));
    resetBtn();
  }
}

function showError(msg) {
  const errorBox = document.getElementById("errorMsg");
  errorBox.querySelector("span").innerText = msg;
  errorBox.style.display = "flex";
}

function hideError() {
  document.getElementById("errorMsg").style.display = "none";
}

function resetBtn() {
  const btn = document.getElementById("loginBtn");
  btn.innerText = t("login_btn", "Tizimga kirish");
  btn.disabled = false;
}

window.showGuide = function () {
  window.location.href = 'guid.html';
};

window.showSupport = function () {
  window.location.href = 'help.html';
};
