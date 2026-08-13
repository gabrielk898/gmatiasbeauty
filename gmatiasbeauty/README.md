# gmatiasbeauty

Site de agendamento — HTML/CSS/JS puro (sem framework, sem build) +
Supabase (banco de dados + autenticação) + Netlify (hospedagem).

## Estrutura

```
gmatiasbeauty/
├── index.html            # Home (mostra os serviços)
├── agendar.html           # Fluxo de agendamento (5 passos)
├── css/style.css          # Paleta e componentes visuais
├── js/
│   ├── supabase-client.js # Configuração da conexão com o Supabase
│   ├── home.js             # Carrega os serviços na home
│   ├── booking.js          # Lógica do fluxo de agendamento
│   └── auth-modal.js       # Modal opcional de login/cadastro
└── supabase/schema.sql    # Script para criar as tabelas no Supabase
```

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (grátis).
2. Vá em **SQL Editor** → **New query**, cole todo o conteúdo de
   `supabase/schema.sql` e clique em **Run**.
   - Isso cria as tabelas `services`, `business_hours`, `appointments`,
     `profiles`, as políticas de segurança (RLS) e alguns serviços de
     exemplo (edite depois com os seus serviços reais, na tabela
     `services` pelo **Table Editor**).
3. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**
4. Abra `js/supabase-client.js` e substitua:
   ```js
   const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA_AQUI";
   ```
   pelos valores copiados.
5. (Opcional) Em **Authentication → Providers**, confirme que
   "Email" está habilitado — é o que o modal de login/cadastro usa.

⚠️ Nunca coloque a chave **service_role** no código do site — só a
**anon public**, que é segura para uso no navegador (as regras de RLS
que criamos no schema já protegem os dados dos clientes).

## 2. Editar seus serviços e horário de funcionamento

No **Table Editor** do Supabase:
- **services**: edite/adicione linhas com nome, duração (minutos),
  preço (em centavos, ex: R$ 150,00 = `15000`) e ícone (emoji).
- **business_hours**: uma linha por dia da semana (0 = domingo … 6 =
  sábado), com horário de abertura/fechamento ou `is_closed = true`.

## 3. Testar localmente

Como não há build, basta abrir os arquivos com um servidor estático
simples (não abra o `.html` direto com duplo clique, porque alguns
navegadores bloqueiam requisições — use um servidor local):

```bash
# qualquer uma das opções abaixo funciona:
npx serve .
# ou
python3 -m http.server 8080
```

## 4. Deploy no Netlify

**Opção A — arrastar e soltar (mais rápido):**
1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arraste a pasta `gmatiasbeauty` inteira
3. Pronto — o Netlify te dá uma URL pública na hora

**Opção B — conectado ao Git (recomendado para manter atualizando):**
1. Suba esta pasta para um repositório no GitHub
2. No Netlify: **Add new site → Import an existing project**
3. Conecte o repositório
4. Build command: (deixe vazio) — Publish directory: `.`
5. Deploy

Depois, sempre que você editar o site e der `git push`, o Netlify
publica a nova versão automaticamente.

## O que foi corrigido em relação à versão anterior (Vercel)

- **Login não trava mais o agendamento**: o cliente agenda como
  convidado (nome + telefone) e só recebe a *opção* de criar conta
  na tela de confirmação — não é mais uma barreira no meio do fluxo.
- **Seção "Nossos Serviços" da home** agora é preenchida de verdade,
  puxando do Supabase.
- **Tipografia consistente**: título serif (Fraunces) em toda parte
  onde antes misturava com sans-serif.
- **Cores dentro da mesma paleta**: ícones, rodapé e cards usam os
  mesmos tons dourado/creme/marrom, sem o laranja fora do tom.
- **Calendário** agora marca visualmente "hoje", desabilita dias
  passados e dias fechados (com base no `business_hours`).
- **Horários ocupados** são checados de verdade no banco (função
  `get_booked_slots`) e aparecem riscados/desabilitados — evita que
  dois clientes reservem o mesmo horário. Além disso, existe uma
  trava no banco de dados (trigger) que impede a sobreposição mesmo
  em caso de dois cliques simultâneos.
- **Botão "Voltar"** em todos os passos, sem perder o que já foi
  selecionado.
