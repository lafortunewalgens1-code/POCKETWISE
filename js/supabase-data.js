import { supabase } from "./supabase-client.js";

function requireConfiguredClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function getAuthenticatedUserId() {
  const client = requireConfiguredClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("You must be signed in to access financial data.");
  return data.user.id;
}

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function upsertOwnedRow(table, values) {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  return throwOnError(await client.from(table).upsert({ ...values, user_id: userId }, { onConflict: "id" }));
}

async function deleteOwnedRow(table, id) {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  return throwOnError(await client.from(table).delete().eq("id", id).eq("user_id", userId));
}

function sumContributions(contributions, goalId) {
  return contributions
    .filter((contribution) => contribution.goalId === goalId)
    .reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0);
}

export async function loadUserData() {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  const [incomeResult, expenseResult, budgetResult, goalResult, contributionResult, settingsResult] = await Promise.all([
    client.from("incomes").select("*").eq("user_id", userId).order("received_at", { ascending: false }),
    client.from("expenses").select("*").eq("user_id", userId).order("spent_at", { ascending: false }),
    client.from("budgets").select("*").eq("user_id", userId),
    client.from("savings_goals").select("*").eq("user_id", userId),
    client.from("savings_contributions").select("*").eq("user_id", userId).order("contributed_at", { ascending: false }),
    client.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  for (const result of [incomeResult, expenseResult, budgetResult, goalResult, contributionResult, settingsResult]) {
    if (result.error) throw result.error;
  }

  const savingsContributions = (contributionResult.data || []).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    amount: Number(row.amount),
    date: row.contributed_at,
  }));
  const savingsGoals = (goalResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    savedAmount: sumContributions(savingsContributions, row.id),
    currency: row.currency,
    targetDate: row.target_date || "",
  }));

  return {
    incomes: (incomeResult.data || []).map((row) => ({
      id: row.id,
      source: row.source,
      description: row.description || "",
      amount: Number(row.amount),
      currency: row.currency,
      date: row.received_at,
    })),
    expenses: (expenseResult.data || []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description || "",
      amount: Number(row.amount),
      currency: row.currency,
      date: row.spent_at,
    })),
    budgets: (budgetResult.data || []).map((row) => ({
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      currency: row.currency,
      month: String(row.month).slice(0, 7),
    })),
    savingsGoals,
    savingsContributions,
    settings: settingsResult.data,
  };
}

export async function saveIncome(record) {
  return upsertOwnedRow("incomes", {
    id: record.id,
    source: record.source,
    description: record.description || null,
    amount: record.amount,
    currency: record.currency,
    received_at: record.date,
  });
}

export async function deleteIncome(id) {
  return deleteOwnedRow("incomes", id);
}

export async function saveExpense(record) {
  return upsertOwnedRow("expenses", {
    id: record.id,
    category: record.category,
    description: record.description || null,
    amount: record.amount,
    currency: record.currency,
    spent_at: record.date,
  });
}

export async function deleteExpense(id) {
  return deleteOwnedRow("expenses", id);
}

export async function saveBudget(record) {
  return upsertOwnedRow("budgets", {
    id: record.id,
    category: record.category,
    amount: record.amount,
    currency: record.currency,
    month: `${record.month}-01`,
  });
}

export async function deleteBudget(id) {
  return deleteOwnedRow("budgets", id);
}

export async function saveSavingsGoal(record) {
  return upsertOwnedRow("savings_goals", {
    id: record.id,
    name: record.name,
    target_amount: record.targetAmount,
    currency: record.currency,
    target_date: record.targetDate || null,
  });
}

export async function deleteSavingsGoal(id) {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  throwOnError(await client.from("savings_contributions").delete().eq("goal_id", id).eq("user_id", userId));
  return throwOnError(await client.from("savings_goals").delete().eq("id", id).eq("user_id", userId));
}

export async function addSavingsContribution(contribution) {
  return upsertOwnedRow("savings_contributions", {
    id: contribution.id,
    goal_id: contribution.goalId,
    amount: contribution.amount,
    contributed_at: contribution.date,
  });
}

export async function saveUserSettings(settings) {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  return throwOnError(await client.from("user_settings").upsert({
    user_id: userId,
    preferred_language: settings.language,
    exchange_rate: settings.exchangeRate || null,
    next_expected_income_date: settings.safeToSpend.nextIncomeDate || null,
  }, { onConflict: "user_id" }));
}

async function insertById(table, rows) {
  if (!rows.length) return 0;
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  const ownedRows = rows.map((row) => ({ ...row, user_id: userId }));
  const { data, error } = await client.from(table).upsert(ownedRows, {
    onConflict: "id",
    ignoreDuplicates: true,
  }).select("id");
  if (error) throw error;
  return data?.length || 0;
}

export async function migrateLocalData(localState) {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  const counts = { incomes: 0, expenses: 0, budgets: 0, savingsGoals: 0, contributions: 0, skippedBudgets: 0 };

  counts.incomes = await insertById("incomes", localState.incomes.map((row) => ({
    id: row.id,
    source: row.source,
    description: row.description || null,
    amount: row.amount,
    currency: row.currency,
    received_at: row.date,
  })));
  counts.expenses = await insertById("expenses", localState.expenses.map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description || null,
    amount: row.amount,
    currency: row.currency,
    spent_at: row.date,
  })));

  for (const budget of localState.budgets) {
    const month = `${budget.month}-01`;
    const { data: existing, error: lookupError } = await client
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("category", budget.category)
      .eq("currency", budget.currency)
      .eq("month", month)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      counts.skippedBudgets += 1;
      continue;
    }
    const { error } = await client.from("budgets").insert({
      id: budget.id,
      user_id: userId,
      category: budget.category,
      amount: budget.amount,
      currency: budget.currency,
      month,
    });
    if (error) throw error;
    counts.budgets += 1;
  }

  counts.savingsGoals = await insertById("savings_goals", localState.savingsGoals.map((row) => ({
    id: row.id,
    name: row.name,
    target_amount: row.targetAmount,
    currency: row.currency,
    target_date: row.targetDate || null,
  })));
  const goalIds = new Set(localState.savingsGoals.map((goal) => goal.id));
  counts.contributions = await insertById("savings_contributions", localState.savingsContributions
    .filter((row) => goalIds.has(row.goalId))
    .map((row) => ({
      id: row.id,
      goal_id: row.goalId,
      amount: row.amount,
      contributed_at: row.date,
    })));

  const { data: settings, error: settingsError } = await client
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings) await saveUserSettings(localState);

  return counts;
}

export async function clearUserData() {
  const client = requireConfiguredClient();
  const userId = await getAuthenticatedUserId();
  for (const table of ["savings_contributions", "savings_goals", "budgets", "expenses", "incomes", "user_settings"]) {
    const { error } = await client.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
}
