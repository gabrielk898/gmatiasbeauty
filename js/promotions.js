// =========================================================
// Banner de promoções ativas — usado na home e na página de serviços
// Cada banner leva direto ao agendamento: se a promoção é de um
// serviço específico, o agendamento já abre com ele escolhido.
// =========================================================

function promoEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function promoLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadPromoBanner() {
  const slot = document.getElementById("promo-banner-slot");
  if (!slot) return;

  const today = promoLocalToday();

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*, service:services(id, name, active)")
    .eq("active", true);

  if (error) {
    console.error("Erro ao carregar promoções:", error);
    return;
  }

  const current = (data || []).filter((p) => {
    const afterStart = !p.start_date || p.start_date <= today;
    const beforeEnd = !p.end_date || p.end_date >= today;
    return afterStart && beforeEnd;
  });

  if (current.length === 0) return;

  slot.innerHTML = current
    .map((p) => {
      // Serviço específico (e ativo) → abre o agendamento já com ele escolhido
      const hasService = p.service && p.service.active !== false;
      const href = hasService ? `agendar.html?service=${encodeURIComponent(p.service.id)}` : "agendar.html";
      const cta = hasService ? "Agendar com a promoção" : "Agendar agora";

      return `
      <a class="promo-card promo-card-link" href="${href}">
        <span class="promo-icon">🎁</span>
        <div class="promo-text">
          <h3>${promoEscape(p.title)}${p.service ? ` — ${promoEscape(p.service.name)}` : ""}</h3>
          ${p.description ? `<p>${promoEscape(p.description)}</p>` : ""}
        </div>
        <span class="promo-cta">${cta} <span aria-hidden="true">→</span></span>
      </a>`;
    })
    .join("");
}

loadPromoBanner();
