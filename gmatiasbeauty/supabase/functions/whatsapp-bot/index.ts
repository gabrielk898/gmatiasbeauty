// =========================================================
// gmatiasbeauty — Bot de agendamento via WhatsApp (Z-API)
// Deploy: cole este código em Supabase > Edge Functions > New Function
// Nome sugerido da função: whatsapp-bot
// Variáveis de ambiente (Secrets) necessárias:
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontas automaticamente)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID")!;
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN")!;
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SLOT_INTERVAL_MINUTES = 15;

const MENU_TEXT = `Olá! 👋 Bem-vindo(a) à *gmatiasbeauty*.

Como posso te ajudar?

*1* - Agendar horário
*2* - Ver meus agendamentos
*3* - Cancelar um agendamento
*4* - Falar com um atendente

Digite o número da opção.`;

// ---------------------------------------------------------
// Utilitários
// ---------------------------------------------------------
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function normalizePhone(raw: string) {
  return (raw || "").replace(/\D/g, "");
}

function parseDateInput(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const [, dStr, mStr, yStr] = match;
  const day = parseInt(dStr, 10);
  const month = parseInt(mStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const now = new Date();
  const year = yStr ? parseInt(yStr.length === 2 ? "20" + yStr : yStr, 10) : now.getFullYear();

  let candidate = new Date(year, month - 1, day);
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!yStr && candidate < todayMid) {
    candidate = new Date(year + 1, month - 1, day);
  }

  if (candidate.getMonth() !== month - 1) return null; // dia inválido pro mês (ex: 31/02)

  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(
    candidate.getDate()
  ).padStart(2, "0")}`;
}

// ---------------------------------------------------------
// Z-API
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Sessão de conversa (por número de telefone)
// ---------------------------------------------------------
async function getSession(phone: string) {
  const { data } = await supabase.from("whatsapp_sessions").select("*").eq("phone", phone).maybeSingle();
  if (data) return data;
  return { phone, step: "menu", context: {} as Record<string, any> };
}

async function saveSession(phone: string, step: string, context: Record<string, any>) {
  await supabase
    .from("whatsapp_sessions")
    .upsert({ phone, step, context, updated_at: new Date().toISOString() });
}

// ---------------------------------------------------------
// Disponibilidade (mesma lógica do site, reimplementada aqui)
// ---------------------------------------------------------
async function getAvailableSlots(iso: string, durationMinutes: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  const { data: hours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("weekday", weekday)
    .maybeSingle();

  if (!hours || hours.is_closed) return [];

  const { data: blocks } = await supabase.from("schedule_blocks").select("*").eq("block_date", iso);
  const blockList = blocks || [];
  const fullDayBlocked = blockList.some((b: any) => !b.start_time && !b.end_time);
  if (fullDayBlocked) return [];
  const partialBlocks = blockList.filter((b: any) => b.start_time && b.end_time);

  const { data: booked } = await supabase.rpc("get_booked_slots", { p_date: iso });
  const bookedList = booked || [];

  const openMin = timeToMinutes(hours.open_time);
  const closeMin = timeToMinutes(hours.close_time);

  const overlaps = (list: any[], start: number, end: number) =>
    list.some((b) => {
      const bs = timeToMinutes(b.start_time);
      const be = timeToMinutes(b.end_time);
      return start < be && end > bs;
    });

  const slots: { start: string; end: string }[] = [];
  for (let start = openMin; start + durationMinutes <= closeMin; start += SLOT_INTERVAL_MINUTES) {
    const end = start + durationMinutes;
    if (!overlaps(bookedList, start, end) && !overlaps(partialBlocks, start, end)) {
      slots.push({ start: minutesToTime(start), end: minutesToTime(end) });
    }
  }
  return slots;
}

// ---------------------------------------------------------
// Handler principal
// ---------------------------------------------------------
Deno.serve(async (req) => {
  try {
    const body = await req.json();

    // Ignora mensagens enviadas pelo próprio número do salão e mensagens de grupo
    if (body.fromMe || body.isGroup) {
      return new Response("ok");
    }

    const phone = normalizePhone(body.phone);
    const text = (body.text?.message || "").trim();

    if (!phone || !text) {
      return new Response("ok");
    }

    const session = await getSession(phone);
    let step = session.step || "menu";
    let ctx: Record<string, any> = session.context || {};

    const lower = text.toLowerCase();
    if (["menu", "oi", "olá", "ola", "inicio", "início"].includes(lower)) {
      step = "menu";
      ctx = {};
    }

    let reply = "";

    if (step === "menu") {
      if (text === "1") {
        const { data: services } = await supabase
          .from("services")
          .select("*")
          .eq("active", true)
          .order("sort_order");

        if (!services || services.length === 0) {
          reply = "No momento não temos serviços disponíveis para agendamento. Tente novamente mais tarde.";
        } else {
          ctx.services = services.map((s: any) => ({
            id: s.id,
            name: s.name,
            duration_minutes: s.duration_minutes,
            price_cents: s.price_cents,
          }));
          reply =
            "Ótimo! Qual serviço você quer agendar?\n\n" +
            ctx.services
              .map(
                (s: any, i: number) =>
                  `*${i + 1}* - ${s.name} (${s.duration_minutes} min) — ${formatPrice(s.price_cents)}`
              )
              .join("\n") +
            "\n\nDigite o número do serviço.";
          step = "choose_service";
        }
      } else if (text === "2") {
        const today = new Date().toISOString().slice(0, 10);
        const { data: upcoming } = await supabase
          .from("appointments")
          .select("*, service:services(name)")
          .eq("customer_phone", phone)
          .eq("status", "confirmed")
          .gte("appointment_date", today)
          .order("appointment_date")
          .order("start_time");

        if (!upcoming || upcoming.length === 0) {
          reply = "Você não tem nenhum agendamento futuro.\n\nDigite *menu* para ver as opções.";
        } else {
          reply =
            "Seus próximos agendamentos:\n\n" +
            upcoming
              .map(
                (a: any) =>
                  `📅 ${formatDateBR(a.appointment_date)} às ${a.start_time.slice(0, 5)} — ${
                    a.service?.name || "Serviço"
                  }`
              )
              .join("\n") +
            "\n\nDigite *menu* para voltar.";
        }
      } else if (text === "3") {
        const today = new Date().toISOString().slice(0, 10);
        const { data: upcoming } = await supabase
          .from("appointments")
          .select("*, service:services(name)")
          .eq("customer_phone", phone)
          .eq("status", "confirmed")
          .gte("appointment_date", today)
          .order("appointment_date")
          .order("start_time");

        if (!upcoming || upcoming.length === 0) {
          reply = "Você não tem nenhum agendamento futuro para cancelar.\n\nDigite *menu* para voltar.";
        } else {
          ctx.cancelable = upcoming.map((a: any) => a.id);
          reply =
            "Qual agendamento você quer cancelar?\n\n" +
            upcoming
              .map(
                (a: any, i: number) =>
                  `*${i + 1}* - ${formatDateBR(a.appointment_date)} às ${a.start_time.slice(0, 5)} — ${
                    a.service?.name || "Serviço"
                  }`
              )
              .join("\n") +
            "\n\nDigite o número.";
          step = "cancel_choose";
        }
      } else if (text === "4") {
        reply = "Combinado! Em breve alguém da nossa equipe vai te responder por aqui. 💬";
      } else {
        reply = MENU_TEXT;
      }
    } else if (step === "choose_service") {
      const idx = parseInt(text, 10) - 1;
      const services = ctx.services || [];
      if (isNaN(idx) || !services[idx]) {
        reply =
          "Não entendi. Digite o número correspondente ao serviço:\n\n" +
          services.map((s: any, i: number) => `*${i + 1}* - ${s.name}`).join("\n");
      } else {
        ctx.service = services[idx];
        reply = `Perfeito, *${ctx.service.name}*.\n\nQual data você prefere? Envie no formato *DD/MM* (ex: 20/08).`;
        step = "choose_date";
      }
    } else if (step === "choose_date") {
      const iso = parseDateInput(text);
      const today = new Date().toISOString().slice(0, 10);

      if (!iso) {
        reply = "Data inválida. Envie no formato *DD/MM* (ex: 20/08).";
      } else if (iso < today) {
        reply = "Essa data já passou. Envie uma data futura no formato *DD/MM*.";
      } else {
        const slots = await getAvailableSlots(iso, ctx.service.duration_minutes);
        if (slots.length === 0) {
          reply = `Não temos horários disponíveis em ${formatDateBR(iso)}. Tente outra data (DD/MM).`;
        } else {
          ctx.date = iso;
          ctx.slots = slots;
          reply =
            `Horários disponíveis em ${formatDateBR(iso)}:\n\n` +
            slots.map((s, i) => `*${i + 1}* - ${s.start}`).join("\n") +
            "\n\nDigite o número do horário.";
          step = "choose_time";
        }
      }
    } else if (step === "choose_time") {
      const idx = parseInt(text, 10) - 1;
      const slots = ctx.slots || [];
      if (isNaN(idx) || !slots[idx]) {
        reply = "Não entendi. Digite o número do horário desejado.";
      } else {
        ctx.slot = slots[idx];
        reply = "Quase lá! Qual é o seu nome completo?";
        step = "ask_name";
      }
    } else if (step === "ask_name") {
      ctx.name = text;
      reply =
        `Confirme os dados do agendamento:\n\n` +
        `*Serviço:* ${ctx.service.name}\n` +
        `*Data:* ${formatDateBR(ctx.date)}\n` +
        `*Horário:* ${ctx.slot.start}\n` +
        `*Nome:* ${ctx.name}\n\n` +
        `Está tudo certo? Responda *sim* para confirmar ou *não* para cancelar.`;
      step = "confirm";
    } else if (step === "confirm") {
      if (lower === "sim" || lower === "s") {
        const { error } = await supabase.from("appointments").insert({
          service_id: ctx.service.id,
          customer_name: ctx.name,
          customer_phone: phone,
          appointment_date: ctx.date,
          start_time: ctx.slot.start,
          end_time: ctx.slot.end,
          status: "confirmed",
          booking_source: "whatsapp",
        });

        if (error) {
          reply = (error.message || "").includes("reservado")
            ? "Ih, esse horário acabou de ser reservado por outra pessoa. Digite *1* para escolher outro horário."
            : "Não consegui concluir o agendamento agora. Tente novamente em instantes.";
        } else {
          reply = `✅ Agendamento confirmado!\n\n*${ctx.service.name}*\n${formatDateBR(ctx.date)} às ${
            ctx.slot.start
          }\n\nAté breve! Digite *menu* a qualquer momento para outras opções.`;
        }
      } else {
        reply = "Sem problemas, agendamento não confirmado. Digite *menu* para recomeçar.";
      }
      step = "menu";
      ctx = {};
    } else if (step === "cancel_choose") {
      const idx = parseInt(text, 10) - 1;
      const ids = ctx.cancelable || [];
      if (isNaN(idx) || !ids[idx]) {
        reply = "Não entendi. Digite o número do agendamento que quer cancelar.";
      } else {
        await supabase.from("appointments").update({ status: "cancelled" }).eq("id", ids[idx]);
        reply = "Agendamento cancelado. Digite *menu* para outras opções.";
        step = "menu";
        ctx = {};
      }
    } else {
      reply = MENU_TEXT;
      step = "menu";
      ctx = {};
    }

    await saveSession(phone, step, ctx);
    await zapiSendText(phone, reply);

    return new Response("ok");
  } catch (err) {
    console.error(err);
    // Sempre responde 200, senão a Z-API fica reenviando o mesmo evento
    return new Response("ok");
  }
});
