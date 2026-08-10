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
  return { confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado" }[status] || status;
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
    .select("*, service:services(name, price_cents)")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = `<p class="empty-state">Não foi possível carregar seus agendamentos agora.</p>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (appointments || []).filter(
    (a) => a.status === "confirmed" && a.appointment_date >= today
  );
  const history = (appointments || []).filter(
    (a) => a.status !== "confirmed" || a.appointment_date < today
  );

  const renderCard = (a) => `
    <div class="appointment-card">
      <div class="row-top">
        <h3>${a.service?.name || "Serviço"}</h3>
        <span class="appointment-status ${a.status}">${statusLabel(a.status)}</span>
      </div>
      <p class="meta">📅 ${formatDateShort(a.appointment_date)} às ${a.start_time.slice(0, 5)}</p>
      ${a.service ? `<p class="meta">${formatPrice(a.service.price_cents)}</p>` : ""}
    </div>`;

  container.innerHTML = `
    <div class="portal-header">
      <h2>Minha Conta</h2>
    </div>

    <div class="account-box">
      <div>
        <div class="name">${profile?.full_name || "Olá!"}</div>
        <div class="email">${user.email}</div>
      </div>
      <button class="btn btn-secondary" id="portal-logout">Sair</button>
    </div>

    <div class="portal-section-label">Próximos agendamentos</div>
    ${
      upcoming.length
        ? upcoming.map(renderCard).join("")
        : `<p class="empty-state">Você ainda não tem agendamentos futuros. <a href="agendar.html" style="color: var(--color-gold-dark); font-weight:600;">Agendar agora →</a></p>`
    }

    <div class="portal-section-label">Histórico</div>
    ${
      history.length
        ? history.map(renderCard).join("")
        : `<p class="empty-state">Nenhum atendimento anterior.</p>`
    }
  `;

  document.getElementById("portal-logout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    initPortal();
  });
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
