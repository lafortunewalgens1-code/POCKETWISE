import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const isPlaceholder = (value) => !value || value.startsWith("YOUR_SUPABASE_");
const keyLooksSecret = (key) => {
  if (key.startsWith("sb_secret_") || key.includes("service_role")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch (error) {
    return false;
  }
};

export const supabaseConfigurationError = (() => {
  if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_PUBLISHABLE_KEY)) {
    return "missing";
  }
  if (!/^https:\/\/[^/]+$/.test(SUPABASE_URL)) return "url";
  if (keyLooksSecret(SUPABASE_PUBLISHABLE_KEY)) return "secret";
  return "";
})();

export const supabase = supabaseConfigurationError
  ? null
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
