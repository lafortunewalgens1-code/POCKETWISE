export const CURRENCIES = ["USD", "HTG"];

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function formatMoney(value, currency = "USD") {
  const amount = roundMoney(value);
  const normalized = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return normalized;
}

export function formatDate(input) {
  if (!input) return "—";
  const date = new Date(input + "T00:00:00");
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function convertCurrency(amount, fromCurrency, toCurrency, exchangeRate) {
  const numeric = roundMoney(amount);
  if (fromCurrency === toCurrency) return numeric;
  if (fromCurrency === "USD" && toCurrency === "HTG") return numeric * exchangeRate;
  if (fromCurrency === "HTG" && toCurrency === "USD") return numeric / exchangeRate;
  return numeric;
}

export function getTotalsByCurrency(state) {
  const totals = {
    USD: { income: 0, expenses: 0, balance: 0 },
    HTG: { income: 0, expenses: 0, balance: 0 },
  };

  state.incomes.forEach((item) => {
    totals[item.currency].income += roundMoney(item.amount);
  });

  state.expenses.forEach((item) => {
    totals[item.currency].expenses += roundMoney(item.amount);
  });

  totals.USD.balance = roundMoney(totals.USD.income - totals.USD.expenses);
  totals.HTG.balance = roundMoney(totals.HTG.income - totals.HTG.expenses);

  return totals;
}

export function getBudgetSummaryByCategory(state, currency = "USD") {
  const summary = {};
  const relevantBudgets = state.budgets.filter((entry) => entry.currency === currency);

  relevantBudgets.forEach((budget) => {
    const monthKey = budget.month || new Date().toISOString().slice(0, 7);
    const spent = state.expenses
      .filter((expense) => expense.category === budget.category && expense.currency === currency)
      .filter((expense) => expense.date.startsWith(monthKey))
      .reduce((sum, expense) => sum + roundMoney(expense.amount), 0);

    summary[budget.category] = {
      budget,
      spent,
      remaining: roundMoney(budget.amount - spent),
      percentage: budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0,
      overBudget: spent > budget.amount,
      monthKey,
    };
  });

  return summary;
}

export function getSavingsGoalSummary(state) {
  return state.savingsGoals.map((goal) => {
    const percent = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0;
    return {
      ...goal,
      percent,
      remaining: Math.max(goal.targetAmount - goal.savedAmount, 0),
    };
  });
}

export function getRecentTransactions(state) {
  return [...state.incomes.map((item) => ({ ...item, type: "income" })), ...state.expenses.map((item) => ({ ...item, type: "expense" }))]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
}

export function getAllTransactions(state) {
  return [...state.incomes.map((item) => ({ ...item, type: "income" })), ...state.expenses.map((item) => ({ ...item, type: "expense" }))]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getMonthlyOverview(state) {
  const months = {};
  const current = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months[key] = { income: 0, expenses: 0, label: d.toLocaleDateString(undefined, { month: "short" }) };
  }

  state.incomes.forEach((entry) => {
    if (entry.date && entry.date.slice(0, 7) in months) {
      months[entry.date.slice(0, 7)].income += roundMoney(entry.amount);
    }
  });

  state.expenses.forEach((entry) => {
    if (entry.date && entry.date.slice(0, 7) in months) {
      months[entry.date.slice(0, 7)].expenses += roundMoney(entry.amount);
    }
  });

  return Object.entries(months).map(([key, value]) => ({ key, ...value }));
}

export function getCategoryBreakdown(state, currency = "USD") {
  const map = {};
  state.expenses
    .filter((entry) => entry.currency === currency)
    .forEach((entry) => {
      map[entry.category] = (map[entry.category] || 0) + roundMoney(entry.amount);
    });

  return Object.entries(map)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildReport(state, reportType, currency, startDate, endDate) {
  const transactions = getAllTransactions(state).filter((entry) => entry.currency === currency);
  const filtered = transactions.filter((entry) => {
    const date = new Date(entry.date + "T00:00:00");
    if (startDate && date < new Date(startDate + "T00:00:00")) return false;
    if (endDate && date > new Date(endDate + "T00:00:00")) return false;
    return true;
  });

  const report = {
    income: filtered.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + roundMoney(entry.amount), 0),
    expenses: filtered.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + roundMoney(entry.amount), 0),
    net: 0,
    entries: filtered,
    type: reportType,
  };
  report.net = roundMoney(report.income - report.expenses);
  return report;
}

export function calculateSafeToSpend(state, settings) {
  const totals = getTotalsByCurrency(state);
  const exchangeRate = Number(settings.exchangeRate) || 1;
  const preferredCurrency = settings.preferredCurrency;
  const displayCurrency = settings.safeToSpend.displayCurrency || preferredCurrency;

  const liquidBalance = {
    USD: totals.USD.balance,
    HTG: totals.HTG.balance,
  };

  const convertedBalance = convertCurrency(liquidBalance.USD, "USD", displayCurrency, exchangeRate) +
    convertCurrency(liquidBalance.HTG, "HTG", displayCurrency, exchangeRate);

  const reserved = convertCurrency(settings.safeToSpend.reservedSavings || 0, settings.safeToSpend?.reservedSavingsCurrency || "USD", displayCurrency, exchangeRate);
  const essential = convertCurrency(settings.safeToSpend.essentialExpenses || 0, settings.safeToSpend?.essentialExpensesCurrency || "USD", displayCurrency, exchangeRate);

  const spendable = roundMoney(convertedBalance - reserved - essential);
  const hasIncome = settings.safeToSpend.nextIncomeDate && Number(settings.safeToSpend.nextIncomeAmount) > 0;
  const nextIncomeAmount = hasIncome
    ? convertCurrency(settings.safeToSpend.nextIncomeAmount, settings.safeToSpend.nextIncomeCurrency || "USD", displayCurrency, exchangeRate)
    : 0;

  let daysRemaining = 0;
  if (settings.safeToSpend.nextIncomeDate) {
    const diff = new Date(settings.safeToSpend.nextIncomeDate + "T00:00:00") - new Date();
    daysRemaining = Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
  }

  const suggestedDailyLimit = daysRemaining > 0 ? roundMoney(spendable / daysRemaining) : 0;
  const remainingAfterCommitments = spendable;

  return {
    spendable,
    dailyLimit: suggestedDailyLimit,
    daysRemaining,
    nextIncomeAmount,
    remainingAfterCommitments,
    hasIncome,
    warning: spendable < 0,
  };
}

export function parseCurrencyValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
