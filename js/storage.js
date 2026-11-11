const STORAGE_KEY = "pocketwise-app-v1";

const defaultCategories = [
  "Food",
  "Transportation",
  "Housing",
  "Education",
  "Health",
  "Shopping",
  "Entertainment",
  "Bills",
  "Personal Care",
  "Family",
  "Business",
  "Other",
];

const defaultSources = [
  "Allowance",
  "Salary",
  "Business",
  "Freelance work",
  "Gifts",
  "Investments",
  "Other",
];

export function createEmptyState() {
  const today = new Date();
  const iso = (offsetDays = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  return {
    language: "en",
    theme: "light",
    preferredCurrency: "USD",
    exchangeRate: 60,
    profileName: "",
    isDemo: false,
    expenseCategories: defaultCategories.slice(),
    incomeSources: defaultSources.slice(),
    safeToSpend: {
      nextIncomeDate: iso(14),
      nextIncomeAmount: 1500,
      nextIncomeCurrency: "USD",
      reservedSavings: 200,
      essentialExpenses: 350,
      displayCurrency: "USD",
    },
    budgets: [],
    savingsGoals: [],
    incomes: [],
    expenses: [],
  };
}

export function createDemoState() {
  const today = new Date();
  const iso = (offsetDays = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const base = createEmptyState();

  return {
    ...base,
    isDemo: true,
    budgets: [
      {
        id: crypto.randomUUID(),
        category: "Food",
        amount: 400,
        currency: "USD",
        month: new Date().toISOString().slice(0, 7),
      },
      {
        id: crypto.randomUUID(),
        category: "Housing",
        amount: 900,
        currency: "USD",
        month: new Date().toISOString().slice(0, 7),
      },
    ],
    savingsGoals: [
      {
        id: crypto.randomUUID(),
        name: "Emergency fund",
        targetAmount: 5000,
        savedAmount: 1500,
        currency: "USD",
        targetDate: iso(180),
      },
    ],
    incomes: [
      { id: crypto.randomUUID(), amount: 2400, currency: "USD", source: "Salary", date: iso(-10), description: "Monthly salary" },
      { id: crypto.randomUUID(), amount: 1800, currency: "HTG", source: "Freelance work", date: iso(-18), description: "Website design" },
    ],
    expenses: [
      { id: crypto.randomUUID(), amount: 320, currency: "USD", category: "Food", date: iso(-2), description: "Groceries" },
      { id: crypto.randomUUID(), amount: 125, currency: "USD", category: "Transportation", date: iso(-5), description: "Fuel" },
      { id: crypto.randomUUID(), amount: 760, currency: "USD", category: "Housing", date: iso(-7), description: "Rent" },
      { id: crypto.randomUUID(), amount: 6800, currency: "HTG", category: "Food", date: iso(-12), description: "Market" },
    ],
  };
}

function isValidCurrency(value) {
  return value === "USD" || value === "HTG";
}

function sanitizeArray(value, fallback) {
  if (!Array.isArray(value)) return fallback.slice();
  return value.filter((item) => typeof item === "string" && item.trim());
}

export function normalizeState(raw) {
  const base = createDemoState();
  const safe = raw && typeof raw === "object" ? raw : {};

  return {
    language: safe.language && ["en", "fr", "ht"].includes(safe.language) ? safe.language : base.language,
    theme: safe.theme === "dark" ? "dark" : "light",
    preferredCurrency: isValidCurrency(safe.preferredCurrency) ? safe.preferredCurrency : base.preferredCurrency,
    exchangeRate: Number(safe.exchangeRate) > 0 ? Number(safe.exchangeRate) : base.exchangeRate,
    profileName: typeof safe.profileName === "string" ? safe.profileName : "",
    isDemo: typeof safe.isDemo === "boolean" ? safe.isDemo : false,
    expenseCategories: sanitizeArray(safe.expenseCategories, base.expenseCategories),
    incomeSources: sanitizeArray(safe.incomeSources, base.incomeSources),
    safeToSpend: {
      nextIncomeDate: typeof safe.safeToSpend?.nextIncomeDate === "string" ? safe.safeToSpend.nextIncomeDate : base.safeToSpend.nextIncomeDate,
      nextIncomeAmount: Number(safe.safeToSpend?.nextIncomeAmount) > 0 ? Number(safe.safeToSpend.nextIncomeAmount) : base.safeToSpend.nextIncomeAmount,
      nextIncomeCurrency: isValidCurrency(safe.safeToSpend?.nextIncomeCurrency) ? safe.safeToSpend.nextIncomeCurrency : base.safeToSpend.nextIncomeCurrency,
      reservedSavings: Number(safe.safeToSpend?.reservedSavings) >= 0 ? Number(safe.safeToSpend.reservedSavings) : base.safeToSpend.reservedSavings,
      essentialExpenses: Number(safe.safeToSpend?.essentialExpenses) >= 0 ? Number(safe.safeToSpend.essentialExpenses) : base.safeToSpend.essentialExpenses,
      displayCurrency: isValidCurrency(safe.safeToSpend?.displayCurrency) ? safe.safeToSpend.displayCurrency : base.safeToSpend.displayCurrency,
    },
    budgets: Array.isArray(safe.budgets) ? safe.budgets.map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
      category: typeof entry.category === "string" ? entry.category : "Other",
      amount: Number(entry.amount) >= 0 ? Number(entry.amount) : 0,
      currency: isValidCurrency(entry.currency) ? entry.currency : "USD",
      month: typeof entry.month === "string" ? entry.month : new Date().toISOString().slice(0, 7),
    })) : base.budgets,
    savingsGoals: Array.isArray(safe.savingsGoals) ? safe.savingsGoals.map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
      name: typeof entry.name === "string" ? entry.name : "Savings goal",
      targetAmount: Number(entry.targetAmount) >= 0 ? Number(entry.targetAmount) : 0,
      savedAmount: Number(entry.savedAmount) >= 0 ? Number(entry.savedAmount) : 0,
      currency: isValidCurrency(entry.currency) ? entry.currency : "USD",
      targetDate: typeof entry.targetDate === "string" ? entry.targetDate : "",
    })) : base.savingsGoals,
    incomes: Array.isArray(safe.incomes) ? safe.incomes.map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
      amount: Number(entry.amount) >= 0 ? Number(entry.amount) : 0,
      currency: isValidCurrency(entry.currency) ? entry.currency : "USD",
      source: typeof entry.source === "string" ? entry.source : "Other",
      date: typeof entry.date === "string" ? entry.date : new Date().toISOString().slice(0, 10),
      description: typeof entry.description === "string" ? entry.description : "",
    })) : base.incomes,
    expenses: Array.isArray(safe.expenses) ? safe.expenses.map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
      amount: Number(entry.amount) >= 0 ? Number(entry.amount) : 0,
      currency: isValidCurrency(entry.currency) ? entry.currency : "USD",
      category: typeof entry.category === "string" ? entry.category : "Other",
      date: typeof entry.date === "string" ? entry.date : new Date().toISOString().slice(0, 10),
      description: typeof entry.description === "string" ? entry.description : "",
    })) : base.expenses,
  };
}

export function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = normalizeState(createEmptyState());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    const fallback = normalizeState(createEmptyState());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

export function loadDemoData() {
  const demoState = normalizeState(createDemoState());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoState));
  return demoState;
}

export function saveAppState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function exportData(state) {
  const exportBlob = new Blob([JSON.stringify(normalizeState(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(exportBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pocketwise-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const normalized = normalizeState(json);
        resolve(normalized);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsText(file);
  });
}

export function resetData() {
  const resetState = normalizeState(createEmptyState());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
  return resetState;
}
