// =========================================================
// Configuração do Supabase
// Pegue esses valores em: Supabase Dashboard > Project Settings > API
// - SUPABASE_URL     -> "Project URL"
// - SUPABASE_ANON_KEY -> "anon public" key (NUNCA use a "service_role" aqui)
// =========================================================
const SUPABASE_URL = "https://tojmpetzhbjwixvbzbjh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvam1wZXR6aGJqd2l4dmJ6YmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTgwOTcsImV4cCI6MjEwMDgzNDA5N30.tUxp_rWh-qzBBw-9AcKU6JqGt2Go_h2dtmvBCs3qXvQ";

if (SUPABASE_URL.includes("SEU-PROJETO")) {
  console.warn(
    "[gmatiasbeauty] Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/supabase-client.js antes de usar em produção."
  );
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
