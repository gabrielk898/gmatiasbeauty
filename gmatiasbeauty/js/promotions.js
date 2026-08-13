// =========================================================
// Banner de promoções ativas — usado na home e na página de serviços
// =========================================================

async function loadPromoBanner() {
  const slot = document.getElementById("promo-banner-slot");
  if (!slot) return;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*, service:services(name)")
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
    .map(
      (p) => `
      <div class="promo-card">
        <span class="promo-icon">🎁</span>
        <div class="promo-text">
          <h3>${p.title}${p.service ? ` — ${p.service.name}` : ""}</h3>
          ${p.description ? `<p>${p.description}</p>` : ""}
        </div>
      </div>`
    )
    .join("");
}

loadPromoBanner();
