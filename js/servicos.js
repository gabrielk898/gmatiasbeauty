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

  list.innerHTML = data
    .map(
      (s) => `
      <div class="service-page-card">
        <div class="icon">${s.icon || "✨"}</div>
        <div class="info">
          <h3>${s.name}</h3>
          ${s.description ? `<p>${s.description}</p>` : ""}
          <div class="duration">🕐 ${formatDuration(s.duration_minutes)}</div>
        </div>
        <div class="price-block">
          <span class="price">${formatPrice(s.price_cents)}</span>
          <a href="agendar.html?service=${s.id}">Agendar →</a>
        </div>
      </div>`
    )
    .join("");
}

loadServicesPage();
