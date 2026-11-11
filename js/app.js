import { translations } from "./translations.js";
import {
  loadAppState,
  saveAppState,
  exportData,
  importData,
  resetData,
  loadDemoData,
  preserveLocalMigrationBackup,
  loadLocalMigrationBackup,
  hasMigratedLocalData,
  markLocalDataMigrated,
} from "./storage.js";
import { supabase, supabaseConfigurationError } from "./supabase-client.js";
import {
  loadUserData,
  saveIncome,
  deleteIncome,
  saveExpense,
  deleteExpense,
  saveBudget,
  deleteBudget,
  saveSavingsGoal,
  deleteSavingsGoal,
  addSavingsContribution,
  saveUserSettings,
  migrateLocalData,
  clearUserData,
} from "./supabase-data.js";
import {
  formatMoney,
  formatDate,
  getTotalsByCurrency,
  getRecentTransactions,
  getCategoryBreakdown,
  getMonthlyOverview,
  getBudgetSummaryByCategory,
  getSavingsGoalSummary,
  getAllTransactions,
  buildReport,
  calculateSafeToSpend,
  roundMoney,
} from "./finance.js";

const state = loadAppState();
preserveLocalMigrationBackup(state);
let activeUser = null;
let currentAuthMode = "login";
let authTransition = 0;
const app = {
  currentView: "dashboard-section",
};

const els = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("app-shell"),
  authForm: document.getElementById("authForm"),
  authHeading: document.getElementById("authHeading"),
  authIntro: document.getElementById("authIntro"),
  authEmail: document.getElementById("authEmail"),
  authEmailRow: document.getElementById("authEmailRow"),
  authPassword: document.getElementById("authPassword"),
  authPasswordRow: document.getElementById("authPasswordRow"),
  authPasswordConfirm: document.getElementById("authPasswordConfirm"),
  authPasswordConfirmRow: document.getElementById("authPasswordConfirmRow"),
  authRecoveryNote: document.getElementById("authRecoveryNote"),
  authSubmit: document.getElementById("authSubmit"),
  authModeToggle: document.getElementById("authModeToggle"),
  authResetLink: document.getElementById("authResetLink"),
  authStatus: document.getElementById("authStatus"),
  authLanguageSelect: document.getElementById("authLanguageSelect"),
  signedInEmail: document.getElementById("signedInEmail"),
  signOutBtn: document.getElementById("signOutBtn"),
  appStatus: document.getElementById("appStatus"),
  migrationPanel: document.getElementById("migrationPanel"),
  migrateLocalDataBtn: document.getElementById("migrateLocalDataBtn"),
  pageTitle: document.getElementById("pageTitle"),
  navItems: [...document.querySelectorAll(".nav-item")],
  views: [...document.querySelectorAll(".view")],
  dashboardStats: document.getElementById("dashboardStats"),
  recentTransactions: document.getElementById("recentTransactions"),
  monthlyOverview: document.getElementById("monthlyOverview"),
  categoryBreakdown: document.getElementById("categoryBreakdown"),
  incomeTableBody: document.getElementById("incomeTableBody"),
  expenseTableBody: document.getElementById("expenseTableBody"),
  historyTableBody: document.getElementById("historyTableBody"),
  budgetList: document.getElementById("budgetList"),
  savingsList: document.getElementById("savingsList"),
  reportSummary: document.getElementById("reportSummary"),
  reportChart: document.getElementById("reportChart"),
  safeToSpendResult: document.getElementById("safeToSpendResult"),
  languageSelect: document.getElementById("languageSelect"),
  themeSelect: document.getElementById("themeSelect"),
  preferredCurrencySelect: document.getElementById("preferredCurrencySelect"),
  exchangeRateInput: document.getElementById("exchangeRateInput"),
  profileName: document.getElementById("profileName"),
  incomeForm: document.getElementById("incomeForm"),
  expenseForm: document.getElementById("expenseForm"),
  budgetForm: document.getElementById("budgetForm"),
  safeToSpendForm: document.getElementById("safeToSpendForm"),
  savingsForm: document.getElementById("savingsForm"),
  incomeSearch: document.getElementById("incomeSearch"),
  expenseSearch: document.getElementById("expenseSearch"),
  historySearch: document.getElementById("historySearch"),
  incomeFilterSource: document.getElementById("incomeFilterSource"),
  expenseFilterCategory: document.getElementById("expenseFilterCategory"),
  incomeFilterCurrency: document.getElementById("incomeFilterCurrency"),
  expenseFilterCurrency: document.getElementById("expenseFilterCurrency"),
  historyType: document.getElementById("historyType"),
  historyCurrency: document.getElementById("historyCurrency"),
  reportType: document.getElementById("reportType"),
  reportCurrency: document.getElementById("reportCurrency"),
  reportStartDate: document.getElementById("reportStartDate"),
  reportEndDate: document.getElementById("reportEndDate"),
  newExpenseCategoryInput: document.getElementById("newExpenseCategoryInput"),
  newIncomeSourceInput: document.getElementById("newIncomeSourceInput"),
  addExpenseCategoryBtn: document.getElementById("addExpenseCategoryBtn"),
  addIncomeSourceBtn: document.getElementById("addIncomeSourceBtn"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataInput: document.getElementById("importDataInput"),
  resetDataBtn: document.getElementById("resetDataBtn"),
  loadDemoDataBtn: document.getElementById("loadDemoDataBtn"),
  demoDataNotice: document.getElementById("demoDataNotice"),
};

function t(key) {
  return (translations[state.language] && translations[state.language][key]) || (translations.en && translations.en[key]) || key;
}

function setAuthStatus(message, isError = false) {
  els.authStatus.textContent = message;
  els.authStatus.classList.toggle("error", isError);
  els.authStatus.hidden = !message;
}

function setAppStatus(message, status = "info") {
  els.appStatus.textContent = message;
  els.appStatus.dataset.status = status;
  els.appStatus.hidden = !message;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  const message = String(error?.message || "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return t("authErrorInvalidCredentials");
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return t("authErrorEmailNotConfirmed");
  if (code === "user_already_exists" || message.includes("already registered")) return t("authErrorEmailTaken");
  if (code === "weak_password" || message.includes("weak password")) return t("authErrorWeakPassword");
  return t("authGenericError");
}

function renderAuth() {
  const modes = {
    login: {
      heading: "authHeadingLogin",
      intro: "authIntroLogin",
      submit: "authLogin",
      password: true,
      confirm: false,
      email: true,
      toggle: "authToggleToSignUp",
      reset: true,
    },
    signup: {
      heading: "authHeadingSignup",
      intro: "authIntroSignup",
      submit: "authSignUp",
      password: true,
      confirm: true,
      email: true,
      toggle: "authToggleToLogin",
      reset: false,
    },
    reset: {
      heading: "authResetTitle",
      intro: "authResetIntro",
      submit: "authSendReset",
      password: false,
      confirm: false,
      email: true,
      toggle: "",
      reset: false,
    },
    "update-password": {
      heading: "authResetTitle",
      intro: "authRecoveryNote",
      submit: "authUpdatePassword",
      password: true,
      confirm: true,
      email: false,
      toggle: "",
      reset: false,
    },
  };
  const mode = modes[currentAuthMode] || modes.login;
  els.authHeading.textContent = t(mode.heading);
  els.authIntro.textContent = t(mode.intro);
  els.authSubmit.textContent = t(mode.submit);
  els.authEmailRow.hidden = !mode.email;
  els.authEmail.required = mode.email;
  els.authPasswordRow.hidden = !mode.password;
  els.authPassword.required = mode.password;
  els.authPassword.autocomplete = currentAuthMode === "login" ? "current-password" : "new-password";
  els.authPasswordConfirmRow.hidden = !mode.confirm;
  els.authPasswordConfirm.required = mode.confirm;
  els.authRecoveryNote.hidden = currentAuthMode !== "update-password";
  els.authModeToggle.hidden = !mode.toggle;
  els.authModeToggle.textContent = mode.toggle ? t(mode.toggle) : "";
  els.authResetLink.hidden = !mode.reset;
  els.authLanguageSelect.value = state.language;
}

function localStateHasRecords(localState) {
  return Boolean(localState && !localState.isDemo &&
    (localState.incomes.length || localState.expenses.length || localState.budgets.length || localState.savingsGoals.length));
}

async function loadAuthenticatedData(user, transition) {
  setAuthStatus("");
  let migrationBackup = null;
  let migrationBackupError = false;
  try {
    migrationBackup = loadLocalMigrationBackup();
  } catch (error) {
    migrationBackupError = true;
    console.error("Could not read the preserved local migration backup.", error);
  }
  const remote = await loadUserData();
  if (transition !== authTransition) return;

  state.incomes = remote.incomes;
  state.expenses = remote.expenses;
  state.budgets = remote.budgets;
  state.savingsGoals = remote.savingsGoals;
  state.savingsContributions = remote.savingsContributions;
  state.isDemo = false;
  if (remote.settings?.preferred_language && ["en", "fr", "ht"].includes(remote.settings.preferred_language)) {
    state.language = remote.settings.preferred_language;
  }
  if (Number(remote.settings?.exchange_rate) > 0) state.exchangeRate = Number(remote.settings.exchange_rate);
  if (remote.settings?.next_expected_income_date) {
    state.safeToSpend.nextIncomeDate = remote.settings.next_expected_income_date;
  }
  if (!remote.settings) await saveUserSettings(state);

  saveState();
  els.signedInEmail.textContent = user.email || "";
  els.authGate.hidden = true;
  els.appShell.hidden = false;
  els.migrationPanel.hidden = !localStateHasRecords(migrationBackup) || hasMigratedLocalData(user.id);
  renderAll();
  setAppStatus(migrationBackupError ? t("migrationBackupError") : t("cloudReady"), migrationBackupError ? "error" : "success");
}

async function applyAuthSession(session) {
  const transition = ++authTransition;
  if (!session?.user) {
    activeUser = null;
    els.appShell.hidden = true;
    els.authGate.hidden = false;
    els.migrationPanel.hidden = true;
    els.authEmail.value = "";
    els.authPassword.value = "";
    els.authPasswordConfirm.value = "";
    renderAuth();
    return;
  }

  activeUser = session.user;
  setAuthStatus(t("cloudLoading"));
  try {
    await loadAuthenticatedData(session.user, transition);
  } catch (error) {
    console.error("Could not load authenticated user data.", error);
    if (transition === authTransition) {
      els.appShell.hidden = true;
      els.authGate.hidden = false;
      setAuthStatus(t("cloudLoadError"), true);
    }
  }
}

function setPageTitle(text) {
  els.pageTitle.textContent = text;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key && t(key)) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) {
      el.placeholder = t(key);
    }
  });

  document.documentElement.lang = state.language;
  document.body.classList.toggle("dark", state.theme === "dark");
  els.languageSelect.value = state.language;
  els.themeSelect.value = state.theme;
  els.preferredCurrencySelect.value = state.preferredCurrency;
  els.exchangeRateInput.value = state.exchangeRate;
  els.profileName.value = state.profileName;
  els.reportType.value = "monthly";
  els.reportCurrency.value = state.preferredCurrency;

  setPageTitle(t("navDashboard"));
}

function openView(viewId) {
  app.currentView = viewId;
  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  els.navItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === viewId);
  });

  const map = {
    "dashboard-section": t("navDashboard"),
    "income-section": t("navIncome"),
    "expenses-section": t("navExpenses"),
    "budgets-section": t("navBudgets"),
    "safety-section": t("navSafeToSpend"),
    "savings-section": t("navSavings"),
    "reports-section": t("navReports"),
    "history-section": t("navHistory"),
    "settings-section": t("navSettings"),
  };
  setPageTitle(map[viewId] || t("navDashboard"));
}

function escapeHtml(value) {
  const safeValue = String(value ?? "");
  return safeValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function saveState() {
  saveAppState(state);
}

function getDefaultFilterOptions() {
  const sourceOptions = ["<option value='all'>All</option>", ...state.incomeSources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`)].join("");
  els.incomeFilterSource.innerHTML = sourceOptions;

  const categoryOptions = ["<option value='all'>All</option>", ...state.expenseCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)].join("");
  els.expenseFilterCategory.innerHTML = categoryOptions;

  const incomeSelect = document.getElementById("incomeSource");
  const expenseSelect = document.getElementById("expenseCategory");
  const budgetCategorySelect = document.getElementById("budgetCategory");
  const incomeOptions = state.incomeSources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("");
  const expenseOptions = state.expenseCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");

  incomeSelect.innerHTML = incomeOptions || "<option value='Other'>Other</option>";
  expenseSelect.innerHTML = expenseOptions || "<option value='Other'>Other</option>";
  budgetCategorySelect.innerHTML = expenseOptions || "<option value='Other'>Other</option>";

  if (state.incomeSources.length) document.getElementById("incomeSource").value = state.incomeSources[0];
  if (state.expenseCategories.length) document.getElementById("expenseCategory").value = state.expenseCategories[0];
  if (state.expenseCategories.length) document.getElementById("budgetCategory").value = state.expenseCategories[0];
}

function renderDashboard() {
  const totals = getTotalsByCurrency(state);
  const savingsByCurrency = state.savingsGoals.reduce((accumulator, goal) => {
    accumulator[goal.currency] = (accumulator[goal.currency] || 0) + roundMoney(goal.savedAmount);
    return accumulator;
  }, { USD: 0, HTG: 0 });

  const remainingBudgetByCurrency = ["USD", "HTG"].reduce((accumulator, currency) => {
    const summary = getBudgetSummaryByCategory(state, currency);
    accumulator[currency] = Object.values(summary).reduce((sum, item) => sum + roundMoney(item.remaining), 0);
    return accumulator;
  }, { USD: 0, HTG: 0 });

  const stats = [
    { label: t("totalAvailableBalanceUSD"), value: formatMoney(totals.USD.balance, "USD"), detail: "USD" },
    { label: t("totalAvailableBalanceHTG"), value: formatMoney(totals.HTG.balance, "HTG"), detail: "HTG" },
    { label: `${t("totalIncome")} (USD)`, value: formatMoney(totals.USD.income, "USD"), detail: "USD" },
    { label: `${t("totalIncome")} (HTG)`, value: formatMoney(totals.HTG.income, "HTG"), detail: "HTG" },
    { label: `${t("totalExpenses")} (USD)`, value: formatMoney(totals.USD.expenses, "USD"), detail: "USD" },
    { label: `${t("totalExpenses")} (HTG)`, value: formatMoney(totals.HTG.expenses, "HTG"), detail: "HTG" },
    { label: `${t("totalSavings")} (USD)`, value: formatMoney(savingsByCurrency.USD, "USD"), detail: "USD" },
    { label: `${t("totalSavings")} (HTG)`, value: formatMoney(savingsByCurrency.HTG, "HTG"), detail: "HTG" },
    { label: `${t("remainingBudget")} (USD)`, value: formatMoney(remainingBudgetByCurrency.USD, "USD"), detail: "USD" },
    { label: `${t("remainingBudget")} (HTG)`, value: formatMoney(remainingBudgetByCurrency.HTG, "HTG"), detail: "HTG" },
  ];

  if (els.demoDataNotice) {
    const hasFinancialData = state.incomes.length || state.expenses.length || state.budgets.length || state.savingsGoals.length;
    els.demoDataNotice.textContent = state.isDemo
      ? t("demoDataNotice")
      : activeUser
        ? t("accountDataNotice")
      : hasFinancialData
        ? t("localDataNotice")
        : t("emptyStateNotice");
    els.demoDataNotice.hidden = false;
  }

  els.dashboardStats.innerHTML = stats.map((item) => `
    <div class="stat-card">
      <div class="stat-label">
        <span>${escapeHtml(item.label)}</span>
        <span>${escapeHtml(item.detail)}</span>
      </div>
      <div class="stat-value">${escapeHtml(item.value)}</div>
    </div>
  `).join("");

  const recent = getRecentTransactions(state);
  els.recentTransactions.innerHTML = recent.length
    ? recent.map((item) => `
        <div class="transaction-row">
          <div class="row-meta">
            <span class="transaction-type ${item.type}">${t(item.type)}</span>
            <strong>${escapeHtml(item.category || item.source || "—")}</strong>
            <small>${escapeHtml(item.description || t("noData"))}</small>
          </div>
          <div class="row-meta">
            <span class="${item.type === "income" ? "amount-positive" : "amount-negative"}">${item.type === "income" ? "+" : "-"}${escapeHtml(formatMoney(item.amount, item.currency))}</span>
            <small>${escapeHtml(formatDate(item.date))}</small>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">${t("noRecentTransactions")}</div>`;

  const monthly = getMonthlyOverview(state);
  const maxIncome = Math.max(...monthly.map((month) => month.income), 1);
  els.monthlyOverview.innerHTML = monthly.map((month) => `
    <div class="bar-row">
      <div class="label-row">
        <span>${escapeHtml(month.label)}</span>
        <span>${escapeHtml(formatMoney(month.income, "USD"))}</span>
      </div>
      <div class="progress-bar">
        <span style="width:${((month.income / maxIncome) * 100).toFixed(1)}%"></span>
      </div>
    </div>
  `).join("");

  const breakdown = getCategoryBreakdown(state, state.preferredCurrency || "USD");
  const maxValue = Math.max(...breakdown.map((row) => row.value), 1);
  els.categoryBreakdown.innerHTML = breakdown.length
    ? breakdown.map((item) => `
        <div class="category-row">
          <div class="meta-row">
            <strong>${escapeHtml(item.category)}</strong>
            <span>${escapeHtml(formatMoney(item.value, state.preferredCurrency || "USD"))}</span>
          </div>
          <div class="progress-bar">
            <span style="width:${((item.value / maxValue) * 100).toFixed(1)}%"></span>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">${t("noData")}</div>`;
}

function renderIncomeTable() {
  const filtered = state.incomes.filter((item) => {
    const searchText = els.incomeSearch.value.trim().toLowerCase();
    const sourceFilter = els.incomeFilterSource.value;
    const currencyFilter = els.incomeFilterCurrency.value;

    const matchesText = !searchText || [item.source, item.description, item.currency].join(" ").toLowerCase().includes(searchText);
    const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
    const matchesCurrency = currencyFilter === "all" || item.currency === currencyFilter;
    return matchesText && matchesSource && matchesCurrency;
  });

  els.incomeTableBody.innerHTML = filtered.length
    ? filtered.map((item) => `
        <tr>
          <td>${escapeHtml(item.source)}</td>
          <td>${escapeHtml(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${escapeHtml(item.description || "—")}</td>
          <td>
            <div class="table-actions">
              <button class="small-btn edit" data-edit-income="${item.id}">Edit</button>
              <button class="small-btn delete" data-delete-income="${item.id}">Delete</button>
            </div>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="5"><div class="empty-state">${t("noTransactions")}</div></td></tr>`;
}

function renderExpensesTable() {
  const filtered = state.expenses.filter((item) => {
    const text = els.expenseSearch.value.trim().toLowerCase();
    const categoryFilter = els.expenseFilterCategory.value;
    const currencyFilter = els.expenseFilterCurrency.value;

    const matchesText = !text || [item.category, item.description, item.currency].join(" ").toLowerCase().includes(text);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesCurrency = currencyFilter === "all" || item.currency === currencyFilter;
    return matchesText && matchesCategory && matchesCurrency;
  });

  els.expenseTableBody.innerHTML = filtered.length
    ? filtered.map((item) => `
        <tr>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${escapeHtml(item.description || "—")}</td>
          <td>
            <div class="table-actions">
              <button class="small-btn edit" data-edit-expense="${item.id}">Edit</button>
              <button class="small-btn delete" data-delete-expense="${item.id}">Delete</button>
            </div>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="5"><div class="empty-state">${t("noTransactions")}</div></td></tr>`;
}

function renderBudgetList() {
  const budgets = state.budgets;
  els.budgetList.innerHTML = budgets.length
    ? budgets.map((budget) => {
        const summary = getBudgetSummaryByCategory(state, budget.currency)[budget.category] || { spent: 0, remaining: budget.amount, percentage: 0, overBudget: false };
        const percentage = Math.min((summary.spent / Math.max(budget.amount, 1)) * 100, 100);
        const statusClass = summary.overBudget ? "warn" : "";

        return `
          <div class="budget-card">
            <div class="budget-card-header">
              <strong>${escapeHtml(budget.category)}</strong>
              <span class="badge">${escapeHtml(budget.currency)}</span>
            </div>
            <div class="meta-row"><span>${t("allocatedAmount")}</span><strong>${escapeHtml(formatMoney(budget.amount, budget.currency))}</strong></div>
            <div class="meta-row"><span>${t("amountSpent")}</span><strong class="${statusClass}">${escapeHtml(formatMoney(summary.spent, budget.currency))}</strong></div>
            <div class="meta-row"><span>${t("remainingAmount")}</span><strong>${escapeHtml(formatMoney(summary.remaining, budget.currency))}</strong></div>
            <div class="progress-bar"><span style="width:${percentage}%"></span></div>
            <div class="meta-row"><span>${t("percentageUsed")}</span><strong>${percentage.toFixed(1)}%</strong></div>
            <div class="table-actions">
              <button class="small-btn edit" data-edit-budget="${budget.id}">Edit</button>
              <button class="small-btn delete" data-delete-budget="${budget.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty-state">${t("noBudgets")}</div>`;
}

function renderSavingsList() {
  const goals = getSavingsGoalSummary(state);
  els.savingsList.innerHTML = goals.length
    ? goals.map((goal) => `
        <div class="goal-card">
          <div class="goal-card-header">
            <strong>${escapeHtml(goal.name)}</strong>
            <span class="badge">${escapeHtml(goal.currency)}</span>
          </div>
          <div class="meta-row"><span>${t("targetAmount")}</span><strong>${escapeHtml(formatMoney(goal.targetAmount, goal.currency))}</strong></div>
          <div class="meta-row"><span>${t("amountSpent")}</span><strong>${escapeHtml(formatMoney(goal.savedAmount, goal.currency))}</strong></div>
          <div class="progress-bar"><span style="width:${goal.percent.toFixed(1)}%"></span></div>
          <div class="meta-row"><span>${t("percentageUsed")}</span><strong>${goal.percent.toFixed(1)}%</strong></div>
          <div class="table-actions">
            <button class="small-btn edit" data-add-contribution="${goal.id}">Add</button>
            <button class="small-btn edit" data-edit-goal="${goal.id}">Edit</button>
            <button class="small-btn delete" data-delete-goal="${goal.id}">Delete</button>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">${t("noGoals")}</div>`;
}

function renderReports() {
  const currency = els.reportCurrency.value || state.preferredCurrency;
  const startDate = els.reportStartDate.value;
  const endDate = els.reportEndDate.value;
  const report = buildReport(state, els.reportType.value, currency, startDate, endDate);

  const summaryCards = [
    { label: t("totalIncome"), value: formatMoney(report.income, currency) },
    { label: t("totalExpenses"), value: formatMoney(report.expenses, currency) },
    { label: "Net cash flow", value: formatMoney(report.net, currency) },
  ];

  els.reportSummary.innerHTML = `
    <div class="summary-metric">
      ${summaryCards.map((item) => `
        <div class="meta-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>
      `).join("")}
    </div>
  `;

  const bars = getCategoryBreakdown(state, currency).slice(0, 6);
  const max = Math.max(...bars.map((entry) => entry.value), 1);
  els.reportChart.innerHTML = bars.length
    ? bars.map((entry) => `
        <div class="chart-bar">
          <div class="bar-label"><span>${escapeHtml(entry.category)}</span><span>${escapeHtml(formatMoney(entry.value, currency))}</span></div>
          <div class="track"><span class="fill" style="width:${((entry.value / max) * 100).toFixed(1)}%"></span></div>
        </div>
      `).join("")
    : `<div class="empty-state">${t("noData")}</div>`;
}

function renderHistory() {
  const type = els.historyType.value;
  const currency = els.historyCurrency.value;
  const query = els.historySearch.value.trim().toLowerCase();
  const rows = getAllTransactions(state).filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const matchesCurrency = currency === "all" || item.currency === currency;
    const matchesText = !query || [item.category, item.source, item.description, item.type].join(" ").toLowerCase().includes(query);
    return matchesType && matchesCurrency && matchesText;
  });

  els.historyTableBody.innerHTML = rows.length
    ? rows.map((item) => `
        <tr>
          <td>${escapeHtml(t(item.type))}</td>
          <td>${escapeHtml(item.category || item.source || "—")}</td>
          <td>${escapeHtml(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${escapeHtml(item.description || "—")}</td>
          <td>
            <div class="table-actions">
              ${item.type === "income" ? `<button class="small-btn edit" data-edit-income="${item.id}">Edit</button>` : `<button class="small-btn edit" data-edit-expense="${item.id}">Edit</button>`}
              ${item.type === "income" ? `<button class="small-btn delete" data-delete-income="${item.id}">Delete</button>` : `<button class="small-btn delete" data-delete-expense="${item.id}">Delete</button>`}
            </div>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="6"><div class="empty-state">${t("noTransactions")}</div></td></tr>`;
}

function renderSafeToSpend() {
  const preferredCurrency = state.preferredCurrency || "USD";
  const safeData = {
    nextIncomeDate: state.safeToSpend?.nextIncomeDate || "",
    nextIncomeAmount: Number(state.safeToSpend?.nextIncomeAmount || 0),
    nextIncomeCurrency: state.safeToSpend?.nextIncomeCurrency || preferredCurrency,
    reservedSavings: Number(state.safeToSpend?.reservedSavings || 0),
    essentialExpenses: Number(state.safeToSpend?.essentialExpenses || 0),
    displayCurrency: state.safeToSpend?.displayCurrency || preferredCurrency,
  };

  document.getElementById("safeIncomeDate").value = safeData.nextIncomeDate;
  document.getElementById("safeIncomeAmount").value = safeData.nextIncomeAmount;
  document.getElementById("safeIncomeCurrency").value = safeData.nextIncomeCurrency;
  document.getElementById("safeReservedSavings").value = safeData.reservedSavings;
  document.getElementById("safeUpcomingExpenses").value = safeData.essentialExpenses;
  document.getElementById("safeDisplayCurrency").value = safeData.displayCurrency;

  const result = calculateSafeToSpend(state, {
    exchangeRate: state.exchangeRate,
    preferredCurrency,
    safeToSpend: safeData,
  });

  els.safeToSpendResult.innerHTML = `
    <div>
      <span>${t("safeSpendSummaryText")}</span>
      <strong>${escapeHtml(formatMoney(result.spendable, safeData.displayCurrency))}</strong>
    </div>
    <div>
      <span>${t("safeSpendDailyLimit")}</span>
      <strong>${escapeHtml(formatMoney(result.dailyLimit, safeData.displayCurrency))}</strong>
    </div>
    <div>
      <span>${t("safeSpendDaysLeft")}</span>
      <strong>${escapeHtml(String(result.daysRemaining))}</strong>
    </div>
    <div>
      <span>${t("safeSpendRemainingAfterCommitments")}</span>
      <strong>${escapeHtml(formatMoney(result.remainingAfterCommitments, safeData.displayCurrency))}</strong>
    </div>
    ${result.warning ? `<div class="warn">${t("safeSpendWarning")}</div>` : ""}
  `;
}

function renderSettings() {
  els.languageSelect.value = state.language;
  els.themeSelect.value = state.theme;
  els.preferredCurrencySelect.value = state.preferredCurrency;
  els.exchangeRateInput.value = state.exchangeRate;
  els.profileName.value = state.profileName;
}

function renderAll() {
  applyTranslations();
  getDefaultFilterOptions();
  renderDashboard();
  renderIncomeTable();
  renderExpensesTable();
  renderBudgetList();
  renderSavingsList();
  renderReports();
  renderHistory();
  renderSafeToSpend();
  renderSettings();
}

async function persistDataChange(operation, applyChange) {
  setAppStatus(t("cloudSaving"), "loading");
  try {
    await operation();
    applyChange();
    saveState();
    renderAll();
    setAppStatus(t("cloudSaved"), "success");
  } catch (error) {
    console.error("Could not save account data.", error);
    try {
      const remote = await loadUserData();
      state.incomes = remote.incomes;
      state.expenses = remote.expenses;
      state.budgets = remote.budgets;
      state.savingsGoals = remote.savingsGoals;
      state.savingsContributions = remote.savingsContributions;
      saveState();
      renderAll();
    } catch (refreshError) {
      console.error("Could not refresh account data after a failed save.", refreshError);
    }
    setAppStatus(t("cloudSaveError"), "error");
  }
}

async function persistUserSettings(applyChange) {
  const previousState = JSON.parse(JSON.stringify(state));
  setAppStatus(t("cloudSaving"), "loading");
  try {
    applyChange();
    await saveUserSettings(state);
    saveState();
    renderAll();
    setAppStatus(t("cloudSaved"), "success");
  } catch (error) {
    console.error("Could not save account settings.", error);
    Object.assign(state, previousState);
    try {
      const remote = await loadUserData();
      if (remote.settings) {
        if (["en", "fr", "ht"].includes(remote.settings.preferred_language)) {
          state.language = remote.settings.preferred_language;
        }
        if (Number(remote.settings.exchange_rate) > 0) state.exchangeRate = Number(remote.settings.exchange_rate);
        state.safeToSpend.nextIncomeDate = remote.settings.next_expected_income_date || "";
      }
    } catch (refreshError) {
      console.error("Could not refresh account settings after a failed save.", refreshError);
    }
    saveState();
    renderAll();
    setAppStatus(t("cloudSaveError"), "error");
  }
}

async function handleIncomeSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("incomeId").value;
  const amount = Number(document.getElementById("incomeAmount").value);
  const currency = document.getElementById("incomeCurrency").value;
  const source = document.getElementById("incomeSource").value;
  const date = document.getElementById("incomeDate").value;
  const description = document.getElementById("incomeDescription").value.trim();

  if (!amount || !date || !source) {
    alert(t("formRequired"));
    return;
  }

  const record = { id: id || crypto.randomUUID(), amount, currency, source, date, description };
  await persistDataChange(() => saveIncome(record), () => {
    const index = state.incomes.findIndex((item) => item.id === record.id);
    if (index >= 0) state.incomes[index] = record;
    else state.incomes.push(record);
    els.incomeForm.reset();
    document.getElementById("incomeId").value = "";
  });
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("expenseId").value;
  const amount = Number(document.getElementById("expenseAmount").value);
  const currency = document.getElementById("expenseCurrency").value;
  const category = document.getElementById("expenseCategory").value;
  const date = document.getElementById("expenseDate").value;
  const description = document.getElementById("expenseDescription").value.trim();

  if (!amount || !date || !category) {
    alert(t("formRequired"));
    return;
  }

  const record = { id: id || crypto.randomUUID(), amount, currency, category, date, description };
  await persistDataChange(() => saveExpense(record), () => {
    const index = state.expenses.findIndex((item) => item.id === record.id);
    if (index >= 0) state.expenses[index] = record;
    else state.expenses.push(record);
    els.expenseForm.reset();
    document.getElementById("expenseId").value = "";
  });
}

async function handleBudgetSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("budgetId").value;
  const category = document.getElementById("budgetCategory").value;
  const amount = Number(document.getElementById("budgetAmount").value);
  const currency = document.getElementById("budgetCurrency").value;
  const month = document.getElementById("budgetMonth").value;

  if (!category || !amount || !month) {
    alert(t("formRequired"));
    return;
  }

  const record = { id: id || crypto.randomUUID(), category, amount, currency, month };
  await persistDataChange(() => saveBudget(record), () => {
    const index = state.budgets.findIndex((item) => item.id === record.id);
    if (index >= 0) state.budgets[index] = record;
    else state.budgets.push(record);
    els.budgetForm.reset();
    document.getElementById("budgetId").value = "";
  });
}

async function handleSavingsSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("savingsGoalId").value;
  const name = document.getElementById("goalName").value.trim();
  const targetAmount = Number(document.getElementById("goalTargetAmount").value);
  const currency = document.getElementById("goalCurrency").value;
  const targetDate = document.getElementById("goalTargetDate").value;

  if (!name || !targetAmount) {
    alert(t("formRequired"));
    return;
  }

  const existing = state.savingsGoals.find((item) => item.id === id);
  const record = { id: id || crypto.randomUUID(), name, targetAmount, savedAmount: existing?.savedAmount || 0, currency, targetDate };
  await persistDataChange(() => saveSavingsGoal(record), () => {
    const index = state.savingsGoals.findIndex((item) => item.id === record.id);
    if (index >= 0) state.savingsGoals[index] = record;
    else state.savingsGoals.push(record);
    els.savingsForm.reset();
    document.getElementById("savingsGoalId").value = "";
  });
}

async function handleSafeToSpendSubmit(event) {
  event.preventDefault();
  const nextIncomeDate = document.getElementById("safeIncomeDate").value;
  const nextIncomeAmount = Number(document.getElementById("safeIncomeAmount").value || 0);
  const nextIncomeCurrency = document.getElementById("safeIncomeCurrency").value;
  const reservedSavings = Number(document.getElementById("safeReservedSavings").value || 0);
  const essentialExpenses = Number(document.getElementById("safeUpcomingExpenses").value || 0);
  const displayCurrency = document.getElementById("safeDisplayCurrency").value;

  const safeToSpend = {
    nextIncomeDate,
    nextIncomeAmount,
    nextIncomeCurrency,
    reservedSavings,
    essentialExpenses,
    displayCurrency,
  };

  await persistUserSettings(() => {
    state.safeToSpend = safeToSpend;
  });
}

function attachEventHandlers() {
  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthStatus("");
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    els.authSubmit.disabled = true;
    try {
      if (!supabase) {
        setAuthStatus(t(supabaseConfigurationError === "missing" ? "authConfigMissing" : "authConfigInvalid"), true);
        return;
      }

      if (currentAuthMode === "signup") {
        if (password !== els.authPasswordConfirm.value) {
          setAuthStatus(t("authPasswordMismatch"), true);
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          currentAuthMode = "login";
          renderAuth();
          setAuthStatus(t("authCheckEmail"));
        }
      } else if (currentAuthMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (currentAuthMode === "reset") {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setAuthStatus(t("authResetSent"));
      } else if (currentAuthMode === "update-password") {
        if (password !== els.authPasswordConfirm.value) {
          setAuthStatus(t("authPasswordMismatch"), true);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        currentAuthMode = "login";
        renderAuth();
        setAuthStatus(t("authPasswordUpdated"));
      }
    } catch (error) {
      console.error("Authentication request failed.", error);
      setAuthStatus(authErrorMessage(error), true);
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  els.authModeToggle.addEventListener("click", () => {
    currentAuthMode = currentAuthMode === "signup" ? "login" : "signup";
    setAuthStatus("");
    renderAuth();
  });
  els.authResetLink.addEventListener("click", () => {
    currentAuthMode = "reset";
    setAuthStatus("");
    renderAuth();
  });
  els.authLanguageSelect.addEventListener("change", () => {
    state.language = els.authLanguageSelect.value;
    saveState();
    applyTranslations();
    renderAuth();
  });
  els.signOutBtn.addEventListener("click", async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out.", error);
      setAppStatus(t("authGenericError"), "error");
    }
  });
  els.migrateLocalDataBtn.addEventListener("click", async () => {
    if (!activeUser || !window.confirm(t("migrationConfirm"))) return;
    try {
      const backup = loadLocalMigrationBackup();
      if (!localStateHasRecords(backup)) {
        setAppStatus(t("migrationNoData"), "error");
        return;
      }
      setAppStatus(t("cloudSaving"), "loading");
      const counts = await migrateLocalData(backup);
      markLocalDataMigrated(activeUser.id);
      await loadAuthenticatedData(activeUser, authTransition);
      const count = counts.incomes + counts.expenses + counts.budgets + counts.savingsGoals + counts.contributions;
      setAppStatus(t("migrationSuccess").replace("{count}", String(count)), "success");
      if (counts.skippedBudgets) {
        setAppStatus(`${t("migrationSuccess").replace("{count}", String(count))} ${t("migrationSkipped").replace("{count}", String(counts.skippedBudgets))}`, "success");
      }
    } catch (error) {
      console.error("Local data migration failed.", error);
      setAppStatus(t("migrationError"), "error");
    }
  });

  els.navItems.forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.target));
  });

  document.querySelectorAll("[data-target]").forEach((button) => {
    if (button.dataset.target) {
      button.addEventListener("click", () => openView(button.dataset.target));
    }
  });

  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openForm;
      const viewId = id.includes("income") ? "income-section" : "expenses-section";
      openView(viewId);
      setTimeout(() => {
        const target = document.getElementById(id);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    });
  });

  document.querySelectorAll("[data-reset-form]").forEach((button) => {
    button.addEventListener("click", () => {
      const formId = button.dataset.resetForm;
      const form = document.getElementById(formId);
      if (form) form.reset();
    });
  });

  els.incomeForm.addEventListener("submit", handleIncomeSubmit);
  els.expenseForm.addEventListener("submit", handleExpenseSubmit);
  els.budgetForm.addEventListener("submit", handleBudgetSubmit);
  els.savingsForm.addEventListener("submit", handleSavingsSubmit);
  els.safeToSpendForm.addEventListener("submit", handleSafeToSpendSubmit);

  els.languageSelect.addEventListener("change", () => {
    void persistUserSettings(() => {
      state.language = els.languageSelect.value;
    });
    renderAuth();
  });

  els.themeSelect.addEventListener("change", () => {
    state.theme = els.themeSelect.value;
    saveState();
    renderAll();
  });

  els.preferredCurrencySelect.addEventListener("change", () => {
    state.preferredCurrency = els.preferredCurrencySelect.value;
    saveState();
    renderAll();
  });

  els.exchangeRateInput.addEventListener("change", () => {
    void persistUserSettings(() => {
      state.exchangeRate = Number(els.exchangeRateInput.value) || 1;
    });
  });

  els.profileName.addEventListener("input", () => {
    state.profileName = els.profileName.value;
    saveState();
  });

  els.incomeSearch.addEventListener("input", renderIncomeTable);
  els.expenseSearch.addEventListener("input", renderExpensesTable);
  els.historySearch.addEventListener("input", renderHistory);
  els.incomeFilterSource.addEventListener("change", renderIncomeTable);
  els.expenseFilterCategory.addEventListener("change", renderExpensesTable);
  els.incomeFilterCurrency.addEventListener("change", renderIncomeTable);
  els.expenseFilterCurrency.addEventListener("change", renderExpensesTable);
  els.historyType.addEventListener("change", renderHistory);
  els.historyCurrency.addEventListener("change", renderHistory);
  els.reportType.addEventListener("change", renderReports);
  els.reportCurrency.addEventListener("change", renderReports);
  els.reportStartDate.addEventListener("change", renderReports);
  els.reportEndDate.addEventListener("change", renderReports);

  document.addEventListener("click", (event) => {
    const editIncomeButton = event.target.closest("[data-edit-income]");
    if (editIncomeButton) {
      const item = state.incomes.find((entry) => entry.id === editIncomeButton.dataset.editIncome);
      if (item) {
        document.getElementById("incomeId").value = item.id;
        document.getElementById("incomeAmount").value = item.amount;
        document.getElementById("incomeCurrency").value = item.currency;
        document.getElementById("incomeSource").value = item.source;
        document.getElementById("incomeDate").value = item.date;
        document.getElementById("incomeDescription").value = item.description;
        openView("income-section");
      }
      return;
    }

    const deleteIncomeButton = event.target.closest("[data-delete-income]");
    if (deleteIncomeButton) {
      const id = deleteIncomeButton.dataset.deleteIncome;
      void persistDataChange(() => deleteIncome(id), () => {
        state.incomes = state.incomes.filter((entry) => entry.id !== id);
      });
      return;
    }

    const editExpenseButton = event.target.closest("[data-edit-expense]");
    if (editExpenseButton) {
      const item = state.expenses.find((entry) => entry.id === editExpenseButton.dataset.editExpense);
      if (item) {
        document.getElementById("expenseId").value = item.id;
        document.getElementById("expenseAmount").value = item.amount;
        document.getElementById("expenseCurrency").value = item.currency;
        document.getElementById("expenseCategory").value = item.category;
        document.getElementById("expenseDate").value = item.date;
        document.getElementById("expenseDescription").value = item.description;
        openView("expenses-section");
      }
      return;
    }

    const deleteExpenseButton = event.target.closest("[data-delete-expense]");
    if (deleteExpenseButton) {
      const id = deleteExpenseButton.dataset.deleteExpense;
      void persistDataChange(() => deleteExpense(id), () => {
        state.expenses = state.expenses.filter((entry) => entry.id !== id);
      });
      return;
    }

    const editBudgetButton = event.target.closest("[data-edit-budget]");
    if (editBudgetButton) {
      const item = state.budgets.find((entry) => entry.id === editBudgetButton.dataset.editBudget);
      if (item) {
        document.getElementById("budgetId").value = item.id;
        document.getElementById("budgetCategory").value = item.category;
        document.getElementById("budgetAmount").value = item.amount;
        document.getElementById("budgetCurrency").value = item.currency;
        document.getElementById("budgetMonth").value = item.month;
        openView("budgets-section");
      }
      return;
    }

    const deleteBudgetButton = event.target.closest("[data-delete-budget]");
    if (deleteBudgetButton) {
      const id = deleteBudgetButton.dataset.deleteBudget;
      void persistDataChange(() => deleteBudget(id), () => {
        state.budgets = state.budgets.filter((entry) => entry.id !== id);
      });
      return;
    }

    const editGoalButton = event.target.closest("[data-edit-goal]");
    if (editGoalButton) {
      const item = state.savingsGoals.find((entry) => entry.id === editGoalButton.dataset.editGoal);
      if (item) {
        document.getElementById("savingsGoalId").value = item.id;
        document.getElementById("goalName").value = item.name;
        document.getElementById("goalTargetAmount").value = item.targetAmount;
        document.getElementById("goalCurrency").value = item.currency;
        document.getElementById("goalTargetDate").value = item.targetDate;
        openView("savings-section");
      }
      return;
    }

    const deleteGoalButton = event.target.closest("[data-delete-goal]");
    if (deleteGoalButton) {
      const id = deleteGoalButton.dataset.deleteGoal;
      void persistDataChange(() => deleteSavingsGoal(id), () => {
        state.savingsGoals = state.savingsGoals.filter((entry) => entry.id !== id);
        state.savingsContributions = state.savingsContributions.filter((entry) => entry.goalId !== id);
      });
      return;
    }

    const addContributionButton = event.target.closest("[data-add-contribution]");
    if (addContributionButton) {
      const goal = state.savingsGoals.find((entry) => entry.id === addContributionButton.dataset.addContribution);
      if (goal) {
        const contribution = Number(prompt(t("contributionAmount"), "0"));
        if (Number.isFinite(contribution) && contribution > 0) {
          const record = {
            id: crypto.randomUUID(),
            goalId: goal.id,
            amount: roundMoney(contribution),
            date: new Date().toISOString().slice(0, 10),
          };
          void persistDataChange(() => addSavingsContribution(record), () => {
            state.savingsContributions.push(record);
            goal.savedAmount = roundMoney(goal.savedAmount + record.amount);
          });
        }
      }
      return;
    }
  });

  els.addExpenseCategoryBtn.addEventListener("click", () => {
    const value = els.newExpenseCategoryInput.value.trim();
    if (!value) return;
    if (!state.expenseCategories.includes(value)) {
      state.expenseCategories.push(value);
      els.newExpenseCategoryInput.value = "";
      saveState();
      renderAll();
    }
  });

  els.addIncomeSourceBtn.addEventListener("click", () => {
    const value = els.newIncomeSourceInput.value.trim();
    if (!value) return;
    if (!state.incomeSources.includes(value)) {
      state.incomeSources.push(value);
      els.newIncomeSourceInput.value = "";
      saveState();
      renderAll();
    }
  });

  els.loadDemoDataBtn.addEventListener("click", async () => {
    if (state.incomes.length || state.expenses.length || state.budgets.length || state.savingsGoals.length) {
      setAppStatus(t("demoOnlyEmpty"), "error");
      return;
    }
    if (!window.confirm(t("demoAccountConfirm"))) return;
    const demoState = loadDemoData();
    demoState.incomes.forEach((row) => {
      row.description = `[DEMO] ${row.description}`;
    });
    demoState.expenses.forEach((row) => {
      row.description = `[DEMO] ${row.description}`;
    });
    demoState.budgets.forEach((row) => {
      row.category = `${row.category} (DEMO)`;
    });
    demoState.expenses.forEach((row) => {
      if (row.category === "Food" || row.category === "Housing") row.category = `${row.category} (DEMO)`;
    });
    demoState.savingsGoals.forEach((row) => {
      row.name = `[DEMO] ${row.name}`;
    });
    try {
      await migrateLocalData(demoState);
      await loadAuthenticatedData(activeUser, authTransition);
      state.isDemo = true;
      saveState();
      renderAll();
      setAppStatus(t("demoDataLoaded"), "success");
    } catch (error) {
      console.error("Could not save demo records to the account.", error);
      setAppStatus(t("cloudSaveError"), "error");
    }
  });

  els.exportDataBtn.addEventListener("click", () => {
    exportData(state);
    alert(t("exportSuccess"));
  });

  els.importDataInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      await migrateLocalData(imported);
      await loadAuthenticatedData(activeUser, authTransition);
      alert(t("importSuccess"));
    } catch (error) {
      alert(t("importError"));
    }
    event.target.value = "";
  });

  els.resetDataBtn.addEventListener("click", async () => {
    if (window.confirm(t("resetCloudConfirm"))) {
      try {
        await clearUserData();
      } catch (error) {
        console.error("Could not reset account data.", error);
        try {
          const remote = await loadUserData();
          state.incomes = remote.incomes;
          state.expenses = remote.expenses;
          state.budgets = remote.budgets;
          state.savingsGoals = remote.savingsGoals;
          state.savingsContributions = remote.savingsContributions;
          saveState();
          renderAll();
        } catch (refreshError) {
          console.error("Could not refresh account data after a failed reset.", refreshError);
        }
        setAppStatus(t("resetCloudError"), "error");
        return;
      }
      const fresh = resetData();
      Object.assign(state, fresh);
      saveState();
      renderAll();
      setAppStatus(t("cloudReady"), "success");
    }
  });
}

async function init() {
  document.body.classList.toggle("dark", state.theme === "dark");
  applyTranslations();
  renderAuth();
  attachEventHandlers();
  if (!supabase) {
    setAuthStatus(t(supabaseConfigurationError === "missing" ? "authConfigMissing" : "authConfigInvalid"), true);
    return;
  }

  let initialized = false;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      currentAuthMode = "update-password";
      activeUser = session?.user || null;
      els.appShell.hidden = true;
      els.authGate.hidden = false;
      renderAuth();
      return;
    }
    if (event === "INITIAL_SESSION" && !initialized) return;
    queueMicrotask(() => applyAuthSession(session));
  });

  const { data, error } = await supabase.auth.getSession();
  initialized = true;
  if (error) {
    console.error("Could not restore the Supabase session.", error);
    setAuthStatus(t("authGenericError"), true);
    return;
  }
  await applyAuthSession(data.session);
}

void init();
