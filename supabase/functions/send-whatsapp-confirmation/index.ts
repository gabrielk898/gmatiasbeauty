// =========================================================
// gmatiasbeauty — Confirmação por WhatsApp para agendamentos feitos no site
// Deploy: cole em Supabase > Edge Functions > New Function
// Nome sugerido: send-whatsapp-confirmation
// Disparo: Database Webhook em "appointments", evento INSERT
// Variáveis de ambiente (Secrets) necessárias:
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID")!;
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN")!;
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

async function zapiSendText(phone: string, message: string) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone, message }),
  });
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    // Só manda confirmação automática pra quem agendou pelo SITE.
    // Quem agenda pelo WhatsApp já recebe a confirmação direto do bot.
    if (!record || record.booking_source !== "web" || record.status !== "confirmed") {
      return new Response("ok");
    }

    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", record.service_id)
      .maybeSingle();

    const phone = (record.customer_phone || "").replace(/\D/g, "");
    if (!phone) return new Response("ok");

    const message =
      `✅ Olá, ${record.customer_name}! Seu agendamento na *gmatiasbeauty* foi confirmado:\n\n` +
      `*${service?.name || "Serviço"}*\n` +
      `${formatDateBR(record.appointment_date)} às ${record.start_time.slice(0, 5)}\n\n` +
      `Qualquer dúvida ou se precisar remarcar, é só chamar por aqui. Até breve!`;

    await zapiSendText(phone, message);

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("ok");
  }
});
