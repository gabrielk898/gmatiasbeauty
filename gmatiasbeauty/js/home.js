function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function loadServices() {
  const grid = document.getElementById("services-grid");
  const empty = document.getElementById("services-empty");

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Erro ao carregar serviços:", error);
    empty.textContent = "Não foi possível carregar os serviços agora.";
    empty.classList.remove("hidden");
    return;
  }

  if (!data || data.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  grid.innerHTML = data
    .map(
      (service) => `
      <a href="agendar.html?service=${service.id}" class="service-card-home">
        <div class="icon">${service.icon || "✨"}</div>
        <h3>${service.name}</h3>
        <p class="meta">⏱ ${service.duration_minutes} min</p>
        <p class="price">${formatPrice(service.price_cents)}</p>
      </a>`
    )
    .join("");
}

loadServices();
