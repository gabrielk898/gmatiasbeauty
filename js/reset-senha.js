// =========================================================
// Redefinição de senha — chegada pelo link enviado por e-mail
// =========================================================
// O link do e-mail traz um token (no #hash ou em ?code=). O supabase-js
// troca esse token por uma sessão de recuperação automaticamente; só
// depois disso dá para salvar a nova senha. Por isso esperamos a sessão
// antes de mostrar o formulário, e explicamos quando o link não serve.

const resetContent = document.getElementById("reset-content");
let resetFormShown = false;

function getUrlParam(name) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get(name) || query.get(name);
}

function renderResetLoading() {
  resetContent.innerHTML = `
    <div class="portal-header">
      <h2>Definir nova senha</h2>
      <p>Validando seu link…</p>
    </div>`;
}

function renderResetInvalid(reason) {
  resetContent.innerHTML = `
    <div class="portal-header">
      <h2>Link inválido ou expirado</h2>
      <p>${reason || "Esse link de redefinição não é mais válido."}</p>
    </div>
    <div class="card form-card" style="text-align:center;">
      <p style="margin-top:0;">Os links valem por pouco tempo e só podem ser usados uma vez.
      Peça um novo link na tela de login, em <strong>"Esqueci minha senha"</strong>, e abra o e-mail mais recente.</p>
      <a href="portal.html" class="btn btn-primary">Ir para o login</a>
    </div>`;
}

function renderResetForm(errorMsg) {
  resetFormShown = true;
  resetContent.innerHTML = `
    <div class="portal-header">
      <h2>Definir nova senha</h2>
      <p>Escolha uma nova senha para sua conta.</p>
    </div>
    <div class="card form-card">
      <form id="reset-form">
        <div class="form-field">
          <label for="reset-password">Nova senha</label>
          <input type="password" id="reset-password" required minlength="6" autocomplete="new-password" />
        </div>
        <div class="form-field">
          <label for="reset-password-confirm">Confirmar nova senha</label>
          <input type="password" id="reset-password-confirm" required minlength="6" autocomplete="new-password" />
        </div>
        ${errorMsg ? `<p class="form-error">${errorMsg}</p>` : ""}
        <button type="submit" class="btn btn-primary btn-block" id="reset-submit">Salvar nova senha</button>
      </form>
    </div>`;

  document.getElementById("reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("reset-password").value;
    const confirm = document.getElementById("reset-password-confirm").value;

    if (password !== confirm) {
      renderResetForm("As senhas não coincidem.");
      return;
    }

    const submitBtn = document.getElementById("reset-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando…";

    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) {
      const msg = /different from the old/i.test(error.message)
        ? "A nova senha precisa ser diferente da senha atual."
        : /at least|characters|weak/i.test(error.message)
          ? "Senha muito fraca. Use pelo menos 6 caracteres."
          : "Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo link e tente de novo.";
      renderResetForm(msg);
      return;
    }

    renderResetSuccess();
  });
}

function renderResetSuccess() {
  resetContent.innerHTML = `
    <div class="portal-header">
      <h2>Senha atualizada!</h2>
      <p>Sua senha foi redefinida com sucesso.</p>
    </div>
    <div style="text-align:center;">
      <a href="portal.html" class="btn btn-primary">Ir para Minha Conta</a>
    </div>`;
}

(async function initReset() {
  // Erro já vindo do Supabase no próprio link (ex.: link expirado/usado)
  const urlError = getUrlParam("error_description") || getUrlParam("error");
  if (urlError) {
    const expired = /expired|invalid/i.test(urlError) || getUrlParam("error_code") === "otp_expired";
    renderResetInvalid(expired ? "Esse link expirou ou já foi usado." : decodeURIComponent(urlError.replace(/\+/g, " ")));
    return;
  }

  renderResetLoading();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!resetFormShown && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      renderResetForm();
    }
  });

  // Fluxo com ?code= (PKCE): troca explícita, caso não tenha sido feita
  const code = getUrlParam("code");
  if (code) {
    const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (error && !resetFormShown) {
      renderResetInvalid("Esse link expirou ou já foi usado.");
      return;
    }
  }

  // Dá um tempo para o supabase-js processar o token do link
  for (let i = 0; i < 20 && !resetFormShown; i++) {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) {
      renderResetForm();
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!resetFormShown) renderResetInvalid();
})();
