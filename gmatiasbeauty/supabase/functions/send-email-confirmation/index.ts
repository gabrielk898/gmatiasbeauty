// =========================================================
// gmatiasbeauty — Confirmação por E-MAIL de agendamentos
// Deploy: cole em Supabase > Edge Functions > New Function
// Nome sugerido: send-email-confirmation
// Disparo: Database Webhook em "appointments", evento INSERT
// Variável de ambiente (Secret) necessária:
//   RESEND_API_KEY
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// E-mail remetente — precisa ser em um domínio verificado no Resend.
// Pode trocar o nome antes do @ (ex: contato@, agendamentos@), mas
// o domínio depois do @ tem que ser exatamente o verificado.
const FROM_ADDRESS = "gmatiasbeauty <agendamentos@gmatiasbeauty.com.br>";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Erro ao enviar e-mail:", await res.text());
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    // Só envia se tiver e-mail cadastrado (é opcional no formulário) e o agendamento estiver confirmado
    if (!record || record.status !== "confirmed" || !record.customer_email) {
      return new Response("ok");
    }

    const { data: service } = await supabase
      .from("services")
      .select("name, price_cents")
      .eq("id", record.service_id)
      .maybeSingle();

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #2B2620;">
        <h2 style="color: #A68A5B;">Agendamento confirmado! ✅</h2>
        <p>Olá, ${record.customer_name}!</p>
        <p>Seu agendamento na <strong>gmatiasbeauty</strong> foi confirmado com sucesso:</p>
        <div style="background: #F4F0E4; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>${service?.name || "Serviço"}</strong>${
      service?.price_cents ? ` — ${formatPrice(service.price_cents)}` : ""
    }</p>
          <p style="margin: 4px 0;">📅 ${formatDateBR(record.appointment_date)}</p>
          <p style="margin: 4px 0;">🕐 ${record.start_time.slice(0, 5)}</p>
        </div>
        <p>Chegue com uns 10 minutos de antecedência. Qualquer dúvida ou se precisar remarcar, é só entrar em contato.</p>
        <p style="color: #6E6656; font-size: 0.85rem; margin-top: 32px;">gmatiasbeauty</p>
      </div>`;

    await sendEmail(record.customer_email, "Agendamento confirmado — gmatiasbeauty", html);

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("ok");
  }
});
