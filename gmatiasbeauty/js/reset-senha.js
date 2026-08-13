// =========================================================
// Redefinição de senha — chegada pelo link enviado por e-mail
// =========================================================

function renderResetForm(errorMsg) {
  const content = document.getElementById("reset-content");
  content.innerHTML = `
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
        <button type="submit" class="btn btn-primary btn-block">Salvar nova senha</button>
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

    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) {
      renderResetForm(
        "Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo link de redefinição e tente de novo."
      );
      return;
    }

    renderResetSuccess();
  });
}

function renderResetSuccess() {
  document.getElementById("reset-content").innerHTML = `
    <div class="portal-header">
      <h2>Senha atualizada!</h2>
      <p>Sua senha foi redefinida com sucesso.</p>
    </div>
    <div style="text-align:center;">
      <a href="portal.html" class="btn btn-primary">Ir para Minha Conta</a>
    </div>`;
}

renderResetForm();
