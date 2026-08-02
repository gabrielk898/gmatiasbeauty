// =========================================================
// gmatiasbeauty — Painel Administrativo
// =========================================================

const adminState = {
  user: null,
  activeTab: "servicos",
  services: [],
  editingServiceId: null,
  editingPromotionId: null,
};

const TABS = [
  { id: "servicos", label: "Serviços" },
  { id: "horarios", label: "Horários" },
  { id: "bloqueios", label: "Bloqueios de Agenda" },
  { id: "promocoes", label: "Promoções" },
  { id: "agendamentos", label: "Agendamentos" },
  { id: "clientes", label: "Clientes" },
];

const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function reaisToCents(value) {
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  return Math.round(parseFloat(normalized || "0") * 100);
}

function centsToReaisInput(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatDateBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

// =========================================================
// LOGIN / GATE DE ADMIN
// =========================================================
function renderLogin(errorMsg) {
  document.getElementById("admin-root").innerHTML = `
    <div class="admin-login-wrap">
      <div class="card form-card" style="max-width: 360px;">
        <h2 class="font-display" style="margin-bottom: 20px; text-align:center;">Painel Administrativo</h2>
        <form id="admin-login-form">
          <div class="form-field">
            <label for="admin-email">E-mail</label>
            <input type="email" id="admin-email" required autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="admin-password">Senha</label>
            <input type="password" id="admin-password" required autocomplete="current-password" />
          </div>
          ${errorMsg ? `<p class="form-error">${errorMsg}</p>` : ""}
          <button type="submit" class="btn btn-primary btn-block">Entrar</button>
        </form>
      </div>
    </div>`;

  document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      renderLogin(error.message);
      return;
    }

    checkAdminAndRender(data.user);
  });
}

function renderAccessDenied() {
  document.getElementById("admin-root").innerHTML = `
    <div class="admin-login-wrap">
      <div class="card form-card" style="max-width: 380px; text-align:center;">
        <h2 class="font-display" style="margin-bottom: 12px;">Acesso restrito</h2>
        <p style="color: var(--color-text-muted); margin-bottom: 20px;">
          Essa conta não tem permissão de administrador.
        </p>
        <button class="btn btn-secondary btn-block" id="admin-signout">Sair</button>
      </div>
    </div>`;

  document.getElementById("admin-signout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    renderLogin();
  });
}

async function checkAdminAndRender(user) {
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_admin) {
    renderAccessDenied();
    return;
  }

  adminState.user = { ...user, full_name: profile.full_name };
  renderShell();
}

// =========================================================
// SHELL (sidebar + conteúdo)
// =========================================================
function renderShell() {
  const root = document.getElementById("admin-root");
  root.innerHTML = `
    <div class="admin-page">
      <aside class="admin-sidebar">
        <div class="admin-brand">gmatias<span class="brand-accent">beauty</span> admin</div>
        <nav>
          ${TABS.map(
            (t) => `<button class="admin-tab" data-tab="${t.id}">${t.label}</button>`
          ).join("")}
        </nav>
        <div class="admin-tab-footer">
          <button class="btn-icon" id="admin-signout-shell">Sair</button>
        </div>
      </aside>
      <main class="admin-content" id="admin-content"></main>
    </div>`;

  root.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  document.getElementById("admin-signout-shell").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    renderLogin();
  });

  setActiveTab(adminState.activeTab);
}

function setActiveTab(tabId) {
  adminState.activeTab = tabId;
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  const renderers = {
    servicos: renderServicosTab,
    horarios: renderHorariosTab,
    bloqueios: renderBloqueiosTab,
    promocoes: renderPromocoesTab,
    agendamentos: renderAgendamentosTab,
    clientes: renderClientesTab,
  };

  renderers[tabId]();
}

// =========================================================
// TAB: SERVIÇOS
// =========================================================
async function renderServicosTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Serviços</h2>
    <p class="admin-sub">Cadastre, edite ou desative os procedimentos oferecidos.</p>
    <div class="admin-toolbar">
      <button class="btn btn-primary" id="new-service-btn">+ Novo serviço</button>
    </div>
    <div id="service-form-slot"></div>
    <table class="admin-table">
      <thead>
        <tr><th>Nome</th><th>Duração</th><th>Preço</th><th>Status</th><th></th></tr>
      </thead>
      <tbody id="services-tbody">
        <tr><td colspan="5">Carregando…</td></tr>
      </tbody>
    </table>`;

  document.getElementById("new-service-btn").addEventListener("click", () => {
    adminState.editingServiceId = null;
    renderServiceForm();
  });

  const { data, error } = await supabaseClient.from("services").select("*").order("sort_order");
  const tbody = document.getElementById("services-tbody");

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Não foi possível carregar os serviços.</td></tr>`;
    return;
  }

  adminState.services = data || [];

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum serviço cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (s) => `
      <tr>
        <td>${s.icon || "✨"} ${s.name}</td>
        <td>${s.duration_minutes} min</td>
        <td>${formatPrice(s.price_cents)}</td>
        <td><span class="badge ${s.active ? "on" : "off"}">${s.active ? "Ativo" : "Inativo"}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" data-edit="${s.id}">Editar</button>
            <button class="btn-icon danger" data-delete="${s.id}">Excluir</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminState.editingServiceId = btn.dataset.edit;
      renderServiceForm();
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteService(btn.dataset.delete));
  });
}

function renderServiceForm() {
  const slot = document.getElementById("service-form-slot");
  const editing = adminState.services.find((s) => s.id === adminState.editingServiceId);

  slot.innerHTML = `
    <div class="admin-form-card">
      <h3 style="margin-bottom:16px;">${editing ? "Editar serviço" : "Novo serviço"}</h3>
      <form id="service-form">
        <div class="admin-form-grid">
          <div class="form-field">
            <label>Nome</label>
            <input type="text" id="sf-name" required value="${editing?.name || ""}" />
          </div>
          <div class="form-field">
            <label>Ícone (emoji)</label>
            <input type="text" id="sf-icon" value="${editing?.icon || "✨"}" />
          </div>
          <div class="form-field">
            <label>Duração (minutos)</label>
            <input type="number" id="sf-duration" required min="5" step="5" value="${editing?.duration_minutes || 30}" />
          </div>
          <div class="form-field">
            <label>Preço (R$)</label>
            <input type="text" id="sf-price" required value="${editing ? centsToReaisInput(editing.price_cents) : ""}" placeholder="150,00" />
          </div>
          <div class="form-field">
            <label>Ordem de exibição</label>
            <input type="number" id="sf-sort" value="${editing?.sort_order ?? 0}" />
          </div>
          <div class="form-field">
            <label class="checkbox-field" style="margin-top: 28px;">
              <input type="checkbox" id="sf-active" ${editing?.active !== false ? "checked" : ""} />
              Serviço ativo (visível para clientes)
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>Descrição (opcional)</label>
          <input type="text" id="sf-description" value="${editing?.description || ""}" />
        </div>
        <p id="service-form-error" class="form-error hidden"></p>
        <div style="display:flex; gap:10px;">
          <button type="submit" class="btn btn-primary">${editing ? "Salvar alterações" : "Criar serviço"}</button>
          <button type="button" class="btn btn-secondary" id="service-form-cancel">Cancelar</button>
        </div>
      </form>
    </div>`;

  document.getElementById("service-form-cancel").addEventListener("click", () => {
    slot.innerHTML = "";
  });

  document.getElementById("service-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("service-form-error");
    errorEl.classList.add("hidden");

    const payload = {
      name: document.getElementById("sf-name").value.trim(),
      icon: document.getElementById("sf-icon").value.trim() || "✨",
      duration_minutes: parseInt(document.getElementById("sf-duration").value, 10),
      price_cents: reaisToCents(document.getElementById("sf-price").value),
      sort_order: parseInt(document.getElementById("sf-sort").value, 10) || 0,
      active: document.getElementById("sf-active").checked,
      description: document.getElementById("sf-description").value.trim() || null,
    };

    const query = editing
      ? supabaseClient.from("services").update(payload).eq("id", editing.id)
      : supabaseClient.from("services").insert(payload);

    const { error } = await query;

    if (error) {
      errorEl.textContent = error.message.includes("duplicate")
        ? "Já existe um serviço com esse nome."
        : "Não foi possível salvar. Tente novamente.";
      errorEl.classList.remove("hidden");
      return;
    }

    slot.innerHTML = "";
    renderServicosTab();
  });
}

async function deleteService(id) {
  if (!confirm("Excluir esse serviço? Se ele já tiver agendamentos vinculados, use 'Editar' e desative em vez de excluir.")) {
    return;
  }
  const { error } = await supabaseClient.from("services").delete().eq("id", id);
  if (error) {
    alert("Não foi possível excluir (provavelmente esse serviço já tem agendamentos vinculados). Edite e desative em vez de excluir.");
    return;
  }
  renderServicosTab();
}

// =========================================================
// TAB: HORÁRIOS
// =========================================================
async function renderHorariosTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Horário de Funcionamento</h2>
    <p class="admin-sub">Defina os horários semanais padrão do salão.</p>
    <div class="admin-form-card" id="hours-form-card">Carregando…</div>`;

  const { data, error } = await supabaseClient.from("business_hours").select("*").order("weekday");
  const card = document.getElementById("hours-form-card");

  if (error) {
    card.innerHTML = "Não foi possível carregar os horários.";
    return;
  }

  const hoursByDay = {};
  (data || []).forEach((row) => (hoursByDay[row.weekday] = row));

  card.innerHTML = `
    <form id="hours-form">
      ${WEEKDAY_NAMES.map((name, weekday) => {
        const row = hoursByDay[weekday] || { open_time: "09:00", close_time: "18:00", is_closed: weekday === 0 };
        return `
        <div class="hours-row">
          <span class="day-label">${name}</span>
          <input type="time" id="hr-open-${weekday}" value="${(row.open_time || "09:00").slice(0, 5)}" ${row.is_closed ? "disabled" : ""} />
          <input type="time" id="hr-close-${weekday}" value="${(row.close_time || "18:00").slice(0, 5)}" ${row.is_closed ? "disabled" : ""} />
          <label class="checkbox-field">
            <input type="checkbox" class="hr-closed" data-weekday="${weekday}" ${row.is_closed ? "checked" : ""} />
            Fechado
          </label>
        </div>`;
      }).join("")}
      <p id="hours-form-error" class="form-error hidden" style="margin-top:16px;"></p>
      <button type="submit" class="btn btn-primary" style="margin-top:20px;">Salvar horários</button>
    </form>`;

  card.querySelectorAll(".hr-closed").forEach((cb) => {
    cb.addEventListener("change", () => {
      const wd = cb.dataset.weekday;
      document.getElementById(`hr-open-${wd}`).disabled = cb.checked;
      document.getElementById(`hr-close-${wd}`).disabled = cb.checked;
    });
  });

  document.getElementById("hours-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("hours-form-error");
    errorEl.classList.add("hidden");

    const rows = WEEKDAY_NAMES.map((_, weekday) => ({
      weekday,
      is_closed: document.querySelector(`.hr-closed[data-weekday="${weekday}"]`).checked,
      open_time: document.getElementById(`hr-open-${weekday}`).value,
      close_time: document.getElementById(`hr-close-${weekday}`).value,
    }));

    const { error } = await supabaseClient.from("business_hours").upsert(rows);

    if (error) {
      errorEl.textContent = "Não foi possível salvar os horários.";
      errorEl.classList.remove("hidden");
      return;
    }

    alert("Horários atualizados com sucesso.");
  });
}

// =========================================================
// TAB: BLOQUEIOS DE AGENDA
// =========================================================
async function renderBloqueiosTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Bloqueios de Agenda</h2>
    <p class="admin-sub">Feche um dia inteiro (feriado, folga) ou um intervalo específico de horário.</p>

    <div class="admin-form-card">
      <form id="block-form">
        <div class="admin-form-grid">
          <div class="form-field">
            <label>Data</label>
            <input type="date" id="bf-date" required />
          </div>
          <div class="form-field">
            <label class="checkbox-field" style="margin-top:28px;">
              <input type="checkbox" id="bf-fullday" checked />
              Bloquear o dia inteiro
            </label>
          </div>
          <div class="form-field">
            <label>Das</label>
            <input type="time" id="bf-start" disabled />
          </div>
          <div class="form-field">
            <label>Até</label>
            <input type="time" id="bf-end" disabled />
          </div>
        </div>
        <div class="form-field">
          <label>Motivo (opcional)</label>
          <input type="text" id="bf-reason" placeholder="Ex: Feriado, folga, manutenção" />
        </div>
        <p id="block-form-error" class="form-error hidden"></p>
        <button type="submit" class="btn btn-primary">Adicionar bloqueio</button>
      </form>
    </div>

    <table class="admin-table">
      <thead><tr><th>Data</th><th>Horário</th><th>Motivo</th><th></th></tr></thead>
      <tbody id="blocks-tbody"><tr><td colspan="4">Carregando…</td></tr></tbody>
    </table>`;

  document.getElementById("bf-fullday").addEventListener("change", (e) => {
    document.getElementById("bf-start").disabled = e.target.checked;
    document.getElementById("bf-end").disabled = e.target.checked;
  });

  document.getElementById("block-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("block-form-error");
    errorEl.classList.add("hidden");

    const fullDay = document.getElementById("bf-fullday").checked;
    const payload = {
      block_date: document.getElementById("bf-date").value,
      start_time: fullDay ? null : document.getElementById("bf-start").value || null,
      end_time: fullDay ? null : document.getElementById("bf-end").value || null,
      reason: document.getElementById("bf-reason").value.trim() || null,
    };

    if (!payload.block_date) {
      errorEl.textContent = "Escolha uma data.";
      errorEl.classList.remove("hidden");
      return;
    }

    const { error } = await supabaseClient.from("schedule_blocks").insert(payload);
    if (error) {
      errorEl.textContent = "Não foi possível adicionar o bloqueio.";
      errorEl.classList.remove("hidden");
      return;
    }

    renderBloqueiosTab();
  });

  const { data, error } = await supabaseClient
    .from("schedule_blocks")
    .select("*")
    .order("block_date", { ascending: true });

  const tbody = document.getElementById("blocks-tbody");

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4">Não foi possível carregar os bloqueios.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Nenhum bloqueio cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map(
      (b) => `
      <tr>
        <td>${formatDateBR(b.block_date)}</td>
        <td>${b.start_time && b.end_time ? `${b.start_time.slice(0, 5)} – ${b.end_time.slice(0, 5)}` : "Dia inteiro"}</td>
        <td>${b.reason || "—"}</td>
        <td><button class="btn-icon danger" data-delete-block="${b.id}">Excluir</button></td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-delete-block]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("schedule_blocks").delete().eq("id", btn.dataset.deleteBlock);
      renderBloqueiosTab();
    });
  });
}

// =========================================================
// TAB: PROMOÇÕES
// =========================================================
async function renderPromocoesTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Promoções</h2>
    <p class="admin-sub">Banners informativos de promoção (o preço em si é ajustado direto no serviço).</p>
    <div class="admin-toolbar">
      <button class="btn btn-primary" id="new-promo-btn">+ Nova promoção</button>
    </div>
    <div id="promo-form-slot"></div>
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Serviço</th><th>Período</th><th>Status</th><th></th></tr></thead>
      <tbody id="promos-tbody"><tr><td colspan="5">Carregando…</td></tr></tbody>
    </table>`;

  document.getElementById("new-promo-btn").addEventListener("click", () => {
    adminState.editingPromotionId = null;
    renderPromoForm([]);
  });

  const [{ data: services }, { data: promos, error }] = await Promise.all([
    supabaseClient.from("services").select("id, name").order("sort_order"),
    supabaseClient.from("promotions").select("*, service:services(name)").order("created_at", { ascending: false }),
  ]);

  const tbody = document.getElementById("promos-tbody");

  document.getElementById("new-promo-btn").onclick = () => {
    adminState.editingPromotionId = null;
    renderPromoForm(services || []);
  };

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Não foi possível carregar as promoções.</td></tr>`;
    return;
  }

  if (!promos || promos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhuma promoção cadastrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = promos
    .map(
      (p) => `
      <tr>
        <td>${p.title}</td>
        <td>${p.service?.name || "Todos os serviços"}</td>
        <td>${p.start_date ? formatDateBR(p.start_date) : "—"} a ${p.end_date ? formatDateBR(p.end_date) : "—"}</td>
        <td><span class="badge ${p.active ? "on" : "off"}">${p.active ? "Ativa" : "Inativa"}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" data-edit-promo="${p.id}">Editar</button>
            <button class="btn-icon danger" data-delete-promo="${p.id}">Excluir</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit-promo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminState.editingPromotionId = btn.dataset.editPromo;
      renderPromoForm(services || [], promos.find((p) => p.id === btn.dataset.editPromo));
    });
  });

  tbody.querySelectorAll("[data-delete-promo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir essa promoção?")) return;
      await supabaseClient.from("promotions").delete().eq("id", btn.dataset.deletePromo);
      renderPromocoesTab();
    });
  });
}

function renderPromoForm(services, editing) {
  const slot = document.getElementById("promo-form-slot");

  slot.innerHTML = `
    <div class="admin-form-card">
      <h3 style="margin-bottom:16px;">${editing ? "Editar promoção" : "Nova promoção"}</h3>
      <form id="promo-form">
        <div class="admin-form-grid">
          <div class="form-field">
            <label>Título</label>
            <input type="text" id="pf-title" required value="${editing?.title || ""}" />
          </div>
          <div class="form-field">
            <label>Serviço</label>
            <select id="pf-service">
              <option value="">Todos os serviços</option>
              ${services.map((s) => `<option value="${s.id}" ${editing?.service_id === s.id ? "selected" : ""}>${s.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Início</label>
            <input type="date" id="pf-start" value="${editing?.start_date || ""}" />
          </div>
          <div class="form-field">
            <label>Fim</label>
            <input type="date" id="pf-end" value="${editing?.end_date || ""}" />
          </div>
          <div class="form-field">
            <label class="checkbox-field" style="margin-top:28px;">
              <input type="checkbox" id="pf-active" ${editing?.active !== false ? "checked" : ""} />
              Promoção ativa
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>Descrição</label>
          <input type="text" id="pf-description" value="${editing?.description || ""}" />
        </div>
        <p id="promo-form-error" class="form-error hidden"></p>
        <div style="display:flex; gap:10px;">
          <button type="submit" class="btn btn-primary">${editing ? "Salvar alterações" : "Criar promoção"}</button>
          <button type="button" class="btn btn-secondary" id="promo-form-cancel">Cancelar</button>
        </div>
      </form>
    </div>`;

  document.getElementById("promo-form-cancel").addEventListener("click", () => {
    slot.innerHTML = "";
  });

  document.getElementById("promo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("promo-form-error");
    errorEl.classList.add("hidden");

    const payload = {
      title: document.getElementById("pf-title").value.trim(),
      service_id: document.getElementById("pf-service").value || null,
      start_date: document.getElementById("pf-start").value || null,
      end_date: document.getElementById("pf-end").value || null,
      active: document.getElementById("pf-active").checked,
      description: document.getElementById("pf-description").value.trim() || null,
    };

    const query = editing
      ? supabaseClient.from("promotions").update(payload).eq("id", editing.id)
      : supabaseClient.from("promotions").insert(payload);

    const { error } = await query;

    if (error) {
      errorEl.textContent = "Não foi possível salvar a promoção.";
      errorEl.classList.remove("hidden");
      return;
    }

    slot.innerHTML = "";
    renderPromocoesTab();
  });
}

// =========================================================
// TAB: AGENDAMENTOS
// =========================================================
async function renderAgendamentosTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Agendamentos</h2>
    <p class="admin-sub">Todos os horários marcados. Atualize o status conforme o atendimento acontece.</p>
    <table class="admin-table">
      <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Status</th></tr></thead>
      <tbody id="appointments-tbody"><tr><td colspan="4">Carregando…</td></tr></tbody>
    </table>`;

  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*, service:services(name)")
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(200);

  const tbody = document.getElementById("appointments-tbody");

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4">Não foi possível carregar os agendamentos.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Nenhum agendamento ainda.</td></tr>`;
    return;
  }

  const statusOptions = ["confirmed", "completed", "cancelled", "no_show"];
  const statusLabels = { confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };

  tbody.innerHTML = data
    .map(
      (a) => `
      <tr>
        <td>${formatDateBR(a.appointment_date)} às ${a.start_time.slice(0, 5)}</td>
        <td>${a.customer_name}<br><span style="color:var(--color-text-soft); font-size:0.82rem;">${a.customer_phone}</span></td>
        <td>${a.service?.name || "—"}</td>
        <td>
          <select data-status-id="${a.id}">
            ${statusOptions.map((s) => `<option value="${s}" ${a.status === s ? "selected" : ""}>${statusLabels[s]}</option>`).join("")}
          </select>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-status-id]").forEach((select) => {
    select.addEventListener("change", async () => {
      const { error } = await supabaseClient
        .from("appointments")
        .update({ status: select.value })
        .eq("id", select.dataset.statusId);
      if (error) {
        alert("Não foi possível atualizar o status.");
      }
    });
  });
}

// =========================================================
// TAB: CLIENTES
// =========================================================
async function renderClientesTab() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <h2>Clientes</h2>
    <p class="admin-sub">Histórico por cliente. Destacamos quem não retorna há mais de 45 dias.</p>
    <table class="admin-table">
      <thead><tr><th>Cliente</th><th>Contato</th><th>Atendimentos</th><th>Último atendimento</th><th></th></tr></thead>
      <tbody id="clients-tbody"><tr><td colspan="5">Carregando…</td></tr></tbody>
    </table>`;

  const { data, error } = await supabaseClient.rpc("get_client_summary");
  const tbody = document.getElementById("clients-tbody");

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Não foi possível carregar os clientes.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum cliente ainda.</td></tr>`;
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);

  tbody.innerHTML = data
    .map((c) => {
      const lastDate = c.last_appointment_date ? new Date(c.last_appointment_date) : null;
      const inactive = lastDate && lastDate < cutoff;
      return `
      <tr>
        <td>${c.customer_name}</td>
        <td>${c.customer_phone}${c.customer_email ? `<br><span style="color:var(--color-text-soft); font-size:0.82rem;">${c.customer_email}</span>` : ""}</td>
        <td>${c.total_appointments}</td>
        <td>${formatDateBR(c.last_appointment_date)}</td>
        <td>${inactive ? `<span class="badge off">Sem retorno</span>` : ""}</td>
      </tr>`;
    })
    .join("");
}

// =========================================================
// Inicialização
// =========================================================
(async function initAdmin() {
  const { data } = await supabaseClient.auth.getSession();
  const user = data?.session?.user;

  if (user) {
    checkAdminAndRender(user);
  } else {
    renderLogin();
  }
})();
