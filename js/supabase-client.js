// =========================================================
// Configuração do Supabase
// Pegue esses valores em: Supabase Dashboard > Project Settings > API
// - SUPABASE_URL     -> "Project URL"
// - SUPABASE_ANON_KEY -> "anon public" key (NUNCA use a "service_role" aqui)
// =========================================================
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA_AQUI";

if (SUPABASE_URL.includes("SEU-PROJETO")) {
  console.warn(
    "[gmatiasbeauty] Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/supabase-client.js antes de usar em produção."
  );
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
