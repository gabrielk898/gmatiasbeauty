function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDuration(minutes) {
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes} min`;
}

function serviceCardHtml(s) {
  return `
    <a href="agendar.html?service=${s.id}" class="service-page-card in-group">
      <div class="icon">${s.icon || "✨"}</div>
      <div class="info">
        <h3>${s.name}</h3>
        ${s.description ? `<p>${s.description}</p>` : ""}
        <div class="duration">🕐 ${formatDuration(s.duration_minutes)}</div>
      </div>
      <div class="price-block">
        <span class="service-price-from-label${s.price_is_from ? "" : " is-empty"}">A partir de</span>
        <span class="price">${formatPrice(s.price_cents)}</span>
      </div>
      <span class="service-card-arrow" aria-hidden="true">→</span>
      <span class="sr-only">Agendar ${s.name}</span>
    </a>`;
}

function groupByCategory(services) {
  const groups = [];
  const byKey = new Map();
  const SEM_CATEGORIA = "Outros serviços";

  services.forEach((s) => {
    const label = (s.category || "").trim() || SEM_CATEGORIA;
    const key = label.toLowerCase();
    if (!byKey.has(key)) {
      const group = { label, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(s);
  });

  return groups;
}

const CHEVRON_SVG = `
  <svg class="service-group-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>`;

async function loadServicesPage() {
  const list = document.getElementById("service-page-list");
  const empty = document.getElementById("service-page-empty");

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    empty.textContent = "Não foi possível carregar os serviços agora.";
    empty.classList.remove("hidden");
    return;
  }

  if (!data || data.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  const groups = groupByCategory(data);

  list.innerHTML = groups
    .map(
      (g, gi) => `
      <div class="service-group" data-group="${gi}">
        <button type="button" class="service-group-header" data-group-toggle="${gi}">
          <span class="service-group-header-left">
            <span class="service-group-icon">${g.items[0]?.icon || "✨"}</span>
            <span>
              <span class="service-group-title">${g.label}</span>
              <span class="service-group-count">${g.items.length} ${g.items.length === 1 ? "serviço" : "serviços"}</span>
            </span>
          </span>
          ${CHEVRON_SVG}
        </button>
        <div class="service-group-body">
          ${g.items.map(serviceCardHtml).join("")}
        </div>
      </div>`
    )
    .join("");

  list.querySelectorAll("[data-group-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".service-group").classList.toggle("collapsed");
    });
  });
}

loadServicesPage();
