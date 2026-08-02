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
    .eq("active", true)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (error || !data || data.length === 0) return;

  slot.innerHTML = data
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
