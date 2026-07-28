// =========================================================
// Modal de login / cadastro — compartilhado entre index.html e agendar.html
// Não bloqueia o agendamento: é só um acesso opcional à conta.
// =========================================================

let authMode = "login"; // "login" | "signup"

function buildModalHTML() {
  const isLogin = authMode === "login";
  return `
    <div class="modal-overlay" id="auth-overlay">
      <div class="modal">
        <button class="modal-close" id="auth-close" aria-label="Fechar">✕</button>
        <h2>${isLogin ? "Entrar" : "Criar conta"}</h2>
        <form id="auth-form">
          <div class="form-field">
            <label for="auth-email">E-mail</label>
            <input type="email" id="auth-email" required autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="auth-password">Senha</label>
            <input type="password" id="auth-password" required minlength="6" autocomplete="current-password" />
          </div>
          <p id="auth-error" class="form-error hidden"></p>
          <button type="submit" class="btn btn-primary btn-block">
            ${isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <div class="modal-toggle">
          ${isLogin ? "Ainda não tem conta?" : "Já tem conta?"}
          <button id="auth-toggle">${isLogin ? "Criar conta" : "Entrar"}</button>
        </div>
      </div>
    </div>`;
}

function openAuthModal() {
  document.body.insertAdjacentHTML("beforeend", buildModalHTML());
  wireModalEvents();
}

function closeAuthModal() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.remove();
}

function wireModalEvents() {
  document.getElementById("auth-close").addEventListener("click", closeAuthModal);
  document.getElementById("auth-overlay").addEventListener("click", (e) => {
    if (e.target.id === "auth-overlay") closeAuthModal();
  });
  document.getElementById("auth-toggle").addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    closeAuthModal();
    openAuthModal();
  });
  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const errorEl = document.getElementById("auth-error");
  errorEl.classList.add("hidden");

  const action =
    authMode === "login"
      ? supabaseClient.auth.signInWithPassword({ email, password })
      : supabaseClient.auth.signUp({ email, password });

  const { error } = await action;

  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("hidden");
    return;
  }

  closeAuthModal();
  updateNavAuthState();
}

async function updateNavAuthState() {
  const nav = document.getElementById("nav-entrar");
  if (!nav) return;

  const { data } = await supabaseClient.auth.getSession();
  const user = data?.session?.user;

  if (user) {
    nav.textContent = "Sair";
    nav.onclick = async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      updateNavAuthState();
    };
  } else {
    nav.textContent = "Entrar";
    nav.onclick = (e) => {
      e.preventDefault();
      authMode = "login";
      openAuthModal();
    };
  }
}

updateNavAuthState();
