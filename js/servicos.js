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
    <div class="service-page-card in-group">
      <div class="icon">${s.icon || "✨"}</div>
      <div class="info">
        <h3>${s.name}</h3>
        ${s.description ? `<p>${s.description}</p>` : ""}
        <div class="duration">🕐 ${formatDuration(s.duration_minutes)}</div>
      </div>
      <div class="price-block">
        ${s.price_is_from ? `<span class="service-price-from-label">A partir de</span>` : ""}
        <span class="price">${formatPrice(s.price_cents)}</span>
        <a href="agendar.html?service=${s.id}">Agendar →</a>
      </div>
    </div>`;
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
          <span class="service-group-chevron">▾</span>
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
