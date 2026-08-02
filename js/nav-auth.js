// =========================================================
// Atualiza o link "Entrar" do menu conforme o estado de login.
// O link sempre aponta para portal.html — é lá que o login/cadastro
// e o painel do cliente realmente acontecem.
// =========================================================

async function updateNavAuthState() {
  const nav = document.getElementById("nav-entrar");
  if (!nav) return;

  const { data } = await supabaseClient.auth.getSession();
  const user = data?.session?.user;

  nav.textContent = user ? "Minha Conta" : "Entrar";
}

updateNavAuthState();
