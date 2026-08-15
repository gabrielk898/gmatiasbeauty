// =========================================================
// Portal do cliente — login/cadastro e painel com agendamentos
// =========================================================

let portalAuthMode = "login"; // "login" | "signup" | "forgot"

function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status) {
  return (
    { confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" }[
      status
    ] || status
  );
}

function getInitials(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0];
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------
// Tela de login / cadastro
// ---------------------------------------------------------
function renderLoginForm() {
  const container = document.getElementById("portal-content");
  const isLogin = portalAuthMode === "login";

  container.innerHTML = `
    <div class="portal-header">
      <h2>${isLogin ? "Entrar na minha conta" : "Criar minha conta"}</h2>
      <p>Acompanhe seus agendamentos e seu histórico de sessões.</p>
    </div>
    <div class="card form-card">
      <form id="portal-auth-form">
        <div class="form-field">
          <label for="portal-email">E-mail</label>
          <input type="email" id="portal-email" required autocomplete="email" />
        </div>
        <div class="form-field">
          <label for="portal-password">Senha</label>
          <input type="password" id="portal-password" required minlength="6" autocomplete="current-password" />
        </div>
        <p id="portal-auth-error" class="form-error hidden"></p>
        <button type="submit" class="btn btn-primary btn-block">
          ${isLogin ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <div class="modal-toggle">
        ${isLogin ? "Ainda não tem conta?" : "Já tem conta?"}
        <button id="portal-auth-toggle">${isLogin ? "Criar conta" : "Entrar"}</button>
      </div>
      ${isLogin ? `<div class="modal-toggle"><button id="portal-forgot-link">Esqueci minha senha</button></div>` : ""}
    </div>`;

  document.getElementById("portal-auth-toggle").addEventListener("click", () => {
    portalAuthMode = isLogin ? "signup" : "login";
    renderLoginForm();
  });

  if (isLogin) {
    document.getElementById("portal-forgot-link").addEventListener("click", () => {
      portalAuthMode = "forgot";
      renderForgotForm();
    });
  }

  document.getElementById("portal-auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("portal-email").value.trim();
    const password = document.getElementById("portal-password").value;
    const errorEl = document.getElementById("portal-auth-error");
    errorEl.classList.add("hidden");

    const action = isLogin
      ? supabaseClient.auth.signInWithPassword({ email, password })
      : supabaseClient.auth.signUp({ email, password });

    const { error } = await action;

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    initPortal();
  });
}

function renderForgotForm() {
  const container = document.getElementById("portal-content");
  container.innerHTML = `
    <div class="portal-header">
      <h2>Recuperar senha</h2>
      <p>Enviaremos um link para você redefinir sua senha.</p>
    </div>
    <div class="card form-card">
      <form id="portal-forgot-form">
        <div class="form-field">
          <label for="forgot-email">E-mail</label>
          <input type="email" id="forgot-email" required autocomplete="email" />
        </div>
        <p id="forgot-error" class="form-error hidden"></p>
        <p id="forgot-success" class="hidden" style="color: var(--color-success); font-size:0.88rem; margin-bottom:14px;">
          Link enviado! Confira seu e-mail (e a caixa de spam).
        </p>
        <button type="submit" class="btn btn-primary btn-block">Enviar link de redefinição</button>
      </form>
      <div class="modal-toggle">
        <button id="forgot-back">← Voltar para o login</button>
      </div>
    </div>`;

  document.getElementById("forgot-back").addEventListener("click", () => {
    portalAuthMode = "login";
    renderLoginForm();
  });

  document.getElementById("portal-forgot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();
    const errorEl = document.getElementById("forgot-error");
    const successEl = document.getElementById("forgot-success");
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha.html`,
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    successEl.classList.remove("hidden");
  });
}

// ---------------------------------------------------------
// Painel logado
// ---------------------------------------------------------
let dashboardAppointments = [];
let dashboardTab = "upcoming"; // "upcoming" | "history"

async function renderDashboard(user) {
  const container = document.getElementById("portal-content");
  container.innerHTML = `<p class="empty-state">Carregando seus agendamentos…</p>`;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: appointments, error } = await supabaseClient
    .from("appointments")
    .select("*, service:services(id, name, price_cents)")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = `<p class="empty-state">Não foi possível carregar seus agendamentos agora.</p>`;
    return;
  }

  dashboardAppointments = appointments || [];
  dashboardTab = "upcoming";

  const navEntrar = document.getElementById("nav-entrar");
  if (navEntrar) navEntrar.textContent = "Minha Conta";

  container.innerHTML = `
    <div class="portal-header">
      <h2>Minha Conta</h2>
    </div>

    <div class="account-box">
      <div style="display:flex; align-items:center; gap:14px;">
        <div class="avatar-circle">${getInitials(profile?.full_name, user.email)}</div>
        <div>
          <div class="name">${profile?.full_name || "Olá!"}</div>
          <div class="email">${user.email}</div>
        </div>
      </div>
      <button class="btn btn-secondary" id="portal-logout">Sair</button>
    </div>

    <a href="agendar.html" class="btn btn-primary btn-block" style="margin-top: 16px;">+ Novo agendamento</a>

    <div class="portal-tabs" style="margin-top: 24px;">
      <button class="portal-tab" id="tab-upcoming">Próximos</button>
      <button class="portal-tab" id="tab-history">Histórico</button>
    </div>

    <div id="dashboard-list"></div>
  `;

  document.getElementById("portal-logout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    initPortal();
  });

  document.getElementById("tab-upcoming").addEventListener("click", () => {
    dashboardTab = "upcoming";
    renderDashboardList();
  });
  document.getElementById("tab-history").addEventListener("click", () => {
    dashboardTab = "history";
    renderDashboardList();
  });

  renderDashboardList();
}

function renderDashboardList() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dashboardAppointments.filter((a) => a.status === "confirmed" && a.appointment_date >= today);
  const history = dashboardAppointments.filter((a) => a.status !== "confirmed" || a.appointment_date < today);

  document.getElementById("tab-upcoming").classList.toggle("active", dashboardTab === "upcoming");
  document.getElementById("tab-upcoming").textContent = `Próximos (${upcoming.length})`;
  document.getElementById("tab-history").classList.toggle("active", dashboardTab === "history");
  document.getElementById("tab-history").textContent = `Histórico (${history.length})`;

  const list = document.getElementById("dashboard-list");
  const items = dashboardTab === "upcoming" ? upcoming : history;

  if (items.length === 0) {
    list.innerHTML =
      dashboardTab === "upcoming"
        ? `<p class="empty-state">Você ainda não tem agendamentos futuros. <a href="agendar.html" style="color: var(--color-gold-dark); font-weight:600;">Agendar agora →</a></p>`
        : `<p class="empty-state">Nenhum atendimento anterior.</p>`;
    return;
  }

  list.innerHTML = items
    .map(
      (a) => `
      <div class="appointment-card">
        <div class="row-top">
          <h3>${a.service?.name || "Serviço"}</h3>
          <span class="appointment-status ${a.status}">${statusLabel(a.status)}</span>
        </div>
        <p class="meta">📅 ${formatDateShort(a.appointment_date)} às ${a.start_time.slice(0, 5)}</p>
        ${a.service ? `<p class="meta">${formatPrice(a.service.price_cents)}</p>` : ""}
        ${
          dashboardTab === "upcoming"
            ? `<div class="appointment-actions">
                <button data-reschedule="${a.id}" data-service="${a.service?.id || ""}">Remarcar</button>
                <button class="danger" data-cancel="${a.id}">Cancelar</button>
              </div>`
            : ""
        }
      </div>`
    )
    .join("");

  list.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => cancelAppointment(btn.dataset.cancel));
  });

  list.querySelectorAll("[data-reschedule]").forEach((btn) => {
    btn.addEventListener("click", () => rescheduleAppointment(btn.dataset.reschedule, btn.dataset.service));
  });
}

async function cancelAppointment(id) {
  if (!confirm("Cancelar esse agendamento?")) return;
  const { error } = await supabaseClient.from("appointments").update({ status: "cancelled" }).eq("id", id);
  if (error) {
    alert("Não foi possível cancelar agora. Tente novamente.");
    return;
  }
  const item = dashboardAppointments.find((a) => a.id === id);
  if (item) item.status = "cancelled";
  renderDashboardList();
}

async function rescheduleAppointment(id, serviceId) {
  if (!confirm("Vamos cancelar esse horário e te levar para escolher um novo. Continuar?")) return;
  await supabaseClient.from("appointments").update({ status: "cancelled" }).eq("id", id);
  window.location.href = serviceId ? `agendar.html?service=${serviceId}` : "agendar.html";
}

// ---------------------------------------------------------
// Inicialização
// ---------------------------------------------------------
async function initPortal() {
  const { data } = await supabaseClient.auth.getSession();
  const user = data?.session?.user;

  if (user) {
    renderDashboard(user);
  } else {
    portalAuthMode = "login";
    renderLoginForm();
  }
}

initPortal();
