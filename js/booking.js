// =========================================================
// gmatiasbeauty — lógica do fluxo de agendamento
// =========================================================

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const SLOT_INTERVAL_MINUTES = 15;

const state = {
  step: 1,
  services: [],
  selectedService: null,
  businessHours: {}, // weekday(0-6) -> { open_time, close_time, is_closed }
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: null, // "YYYY-MM-DD"
  bookedSlots: [], // [{start_time, end_time}]
  selectedSlot: null, // {start, end} as "HH:MM"
  customer: { name: "", phone: "", email: "" },
  lastAppointment: null,
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------
// Stepper
// ---------------------------------------------------------
function renderStepper() {
  const labels = ["Serviço", "Data", "Horário", "Dados", "Confirmar"];
  const stepper = document.getElementById("stepper");
  stepper.innerHTML = labels
    .map((label, i) => {
      const n = i + 1;
      let cls = "step";
      if (n < state.step) cls += " done";
      if (n === state.step) cls += " active";
      return `
        <div class="${cls}">
          <div class="step-line"></div>
          <div class="step-circle">${n < state.step ? "✓" : n}</div>
          <div class="step-label">${label}</div>
        </div>`;
    })
    .join("");
}

function goToStep(n) {
  state.step = n;
  renderStepper();
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.toggle("hidden", Number(panel.dataset.step) !== n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (n === 2) renderCalendar();
  if (n === 3) loadSlotsForSelectedDate();
  if (n === 4) fillSummary();
}

// ---------------------------------------------------------
// PASSO 1 — Serviços
// ---------------------------------------------------------
async function loadServices() {
  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const list = document.getElementById("service-list");
  const empty = document.getElementById("service-empty");

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

  state.services = data;
  list.innerHTML = data
    .map(
      (s) => `
      <button type="button" class="service-option" data-id="${s.id}">
        <div class="icon">${s.icon || "✨"}</div>
        <div class="info">
          <h3>${s.name}</h3>
          <div class="duration">🕐 ${s.duration_minutes} min</div>
        </div>
        <div class="chevron">›</div>
      </button>`
    )
    .join("");

  list.querySelectorAll(".service-option").forEach((btn) => {
    btn.addEventListener("click", () => selectService(btn.dataset.id));
  });

  // Pré-seleciona se veio ?service=ID da home
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("service");
  if (preselect && data.some((s) => s.id === preselect)) {
    selectService(preselect);
  }
}

function selectService(id) {
  state.selectedService = state.services.find((s) => s.id === id);
  document.querySelectorAll(".service-option").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.id === id);
  });
  document.getElementById("step1-continue").disabled = false;
}

// ---------------------------------------------------------
// PASSO 2 — Calendário
// ---------------------------------------------------------
async function loadBusinessHours() {
  const { data, error } = await supabaseClient.from("business_hours").select("*");
  if (error) {
    console.error(error);
    return;
  }
  data.forEach((row) => {
    state.businessHours[row.weekday] = row;
  });
}

function renderCalendar() {
  const label = document.getElementById("cal-label");
  const grid = document.getElementById("calendar-grid");
  const year = state.calYear;
  const month = state.calMonth;

  label.textContent = `${MONTH_LABELS[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  let cells = WEEKDAY_LABELS.map((d) => `<div class="weekday">${d}</div>`).join("");

  // Dias em branco antes do dia 1
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = dateObj.getDay();
    const isPast = iso < today;
    const isToday = iso === today;
    const hours = state.businessHours[weekday];
    const isClosed = !hours || hours.is_closed;
    const isSelectable = !isPast && !isClosed;

    let cls = "calendar-day";
    if (isToday) cls += " today";
    if (isPast || isClosed) cls += " closed faded";
    if (isSelectable) cls += " selectable";
    if (state.selectedDate === iso) cls += " selected";

    cells += `<button type="button" class="${cls}" data-date="${iso}" ${isSelectable ? "" : "disabled"}>${day}</button>`;
  }

  grid.innerHTML = cells;

  grid.querySelectorAll(".calendar-day.selectable").forEach((btn) => {
    btn.addEventListener("click", () => selectDate(btn.dataset.date));
  });

  document.getElementById("cal-prev").disabled =
    year === new Date().getFullYear() && month === new Date().getMonth();
}

function selectDate(iso) {
  state.selectedDate = iso;
  state.selectedSlot = null;
  document.getElementById("step2-continue").disabled = false;
  renderCalendar();
}

document.getElementById("cal-prev").addEventListener("click", () => {
  state.calMonth -= 1;
  if (state.calMonth < 0) {
    state.calMonth = 11;
    state.calYear -= 1;
  }
  renderCalendar();
});

document.getElementById("cal-next").addEventListener("click", () => {
  state.calMonth += 1;
  if (state.calMonth > 11) {
    state.calMonth = 0;
    state.calYear += 1;
  }
  renderCalendar();
});

// ---------------------------------------------------------
// PASSO 3 — Horários
// ---------------------------------------------------------
function formatDateLong(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function loadSlotsForSelectedDate() {
  const loading = document.getElementById("slots-loading");
  const container = document.getElementById("slots-container");
  loading.classList.remove("hidden");
  container.classList.add("hidden");
  document.getElementById("step3-continue").disabled = true;

  document.getElementById("selected-date-label").textContent = formatDateLong(state.selectedDate);

  const { data, error } = await supabaseClient.rpc("get_booked_slots", {
    p_date: state.selectedDate,
  });

  if (error) {
    console.error(error);
    loading.textContent = "Não foi possível carregar os horários. Tente novamente.";
    return;
  }

  state.bookedSlots = data || [];
  renderSlots();
  loading.classList.add("hidden");
  container.classList.remove("hidden");
}

function renderSlots() {
  const container = document.getElementById("slots-container");
  const [y, m, d] = state.selectedDate.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  const hours = state.businessHours[weekday];

  if (!hours || hours.is_closed) {
    container.innerHTML = `<p class="empty-state">Não atendemos nesse dia. Volte e escolha outra data.</p>`;
    return;
  }

  const duration = state.selectedService.duration_minutes;
  const openMin = timeToMinutes(hours.open_time);
  const closeMin = timeToMinutes(hours.close_time);

  const morning = [];
  const afternoon = [];

  for (let start = openMin; start + duration <= closeMin; start += SLOT_INTERVAL_MINUTES) {
    const end = start + duration;
    const startStr = minutesToTime(start);
    const endStr = minutesToTime(end);

    const isBooked = state.bookedSlots.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return start < bEnd && end > bStart; // sobreposição
    });

    const slot = { start: startStr, end: endStr, isBooked };
    if (start < 12 * 60) morning.push(slot);
    else afternoon.push(slot);
  }

  const renderGroup = (label, slots) => {
    if (slots.length === 0) return "";
    return `
      <div class="slot-group">
        <div class="slot-group-label">${label}</div>
        <div class="slot-grid">
          ${slots
            .map(
              (s) => `
            <button type="button" class="slot-btn" data-start="${s.start}" data-end="${s.end}" ${s.isBooked ? "disabled" : ""}>
              ${s.start}
            </button>`
            )
            .join("")}
        </div>
      </div>`;
  };

  container.innerHTML = renderGroup("Manhã", morning) + renderGroup("Tarde", afternoon);

  if (morning.length === 0 && afternoon.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhum horário disponível para esse serviço nessa data.</p>`;
  }

  container.querySelectorAll(".slot-btn:not(:disabled)").forEach((btn) => {
    btn.addEventListener("click", () => selectSlot(btn.dataset.start, btn.dataset.end, btn));
  });
}

function selectSlot(start, end, btnEl) {
  state.selectedSlot = { start, end };
  document.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("selected"));
  btnEl.classList.add("selected");
  document.getElementById("step3-continue").disabled = false;
}

// ---------------------------------------------------------
// PASSO 4 — Dados (guest checkout)
// ---------------------------------------------------------
function fillSummary() {
  document.getElementById("summary-service-name").textContent = state.selectedService.name;
  document.getElementById("summary-service-price").textContent = formatPrice(state.selectedService.price_cents);
  document.getElementById("summary-date").textContent = formatDateLong(state.selectedDate);
  document.getElementById("summary-time").textContent =
    `${state.selectedSlot.start} (${state.selectedService.duration_minutes} min)`;
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

async function submitBooking() {
  const name = document.getElementById("customer-name").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const errorEl = document.getElementById("form-error");
  errorEl.classList.add("hidden");

  if (!name) {
    errorEl.textContent = "Informe seu nome completo.";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!validatePhone(phone)) {
    errorEl.textContent = "Informe um telefone válido com DDD.";
    errorEl.classList.remove("hidden");
    return;
  }

  state.customer = { name, phone, email };

  const continueBtn = document.getElementById("step4-continue");
  const label = document.getElementById("step4-continue-label");
  continueBtn.disabled = true;
  label.innerHTML = `<span class="spinner"></span>`;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const payload = {
    service_id: state.selectedService.id,
    user_id: userId,
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    appointment_date: state.selectedDate,
    start_time: state.selectedSlot.start,
    end_time: state.selectedSlot.end,
    status: "confirmed",
  };

  const { error } = await supabaseClient.from("appointments").insert(payload);

  continueBtn.disabled = false;
  label.textContent = "Confirmar Agendamento";

  if (error) {
    console.error(error);
    // Erro do gatilho de conflito de horário: manda de volta pro passo 3 com dados atualizados
    if (error.message && error.message.includes("já foi reservado")) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      goToStep(3);
      return;
    }
    errorEl.textContent = "Não foi possível concluir o agendamento. Tente novamente.";
    errorEl.classList.remove("hidden");
    return;
  }

  fillConfirmation();
  goToStep(5);
}

// ---------------------------------------------------------
// PASSO 5 — Confirmação
// ---------------------------------------------------------
function fillConfirmation() {
  document.getElementById("confirm-service-name").textContent = state.selectedService.name;
  document.getElementById("confirm-service-price").textContent = formatPrice(state.selectedService.price_cents);
  document.getElementById("confirm-date").textContent = formatDateLong(state.selectedDate);
  document.getElementById("confirm-time").textContent =
    `${state.selectedSlot.start} (${state.selectedService.duration_minutes} min)`;
}

// ---------------------------------------------------------
// Navegação entre passos
// ---------------------------------------------------------
document.getElementById("step1-continue").addEventListener("click", () => goToStep(2));
document.getElementById("step2-back").addEventListener("click", () => goToStep(1));
document.getElementById("step2-continue").addEventListener("click", () => goToStep(3));
document.getElementById("step3-back").addEventListener("click", () => goToStep(2));
document.getElementById("step3-continue").addEventListener("click", () => goToStep(4));
document.getElementById("step4-back").addEventListener("click", () => goToStep(3));
document.getElementById("step4-continue").addEventListener("click", submitBooking);

// ---------------------------------------------------------
// Criar conta (opcional) na tela de confirmação
// ---------------------------------------------------------
document.getElementById("create-account-btn").addEventListener("click", () => {
  const offer = document.getElementById("account-offer");
  offer.innerHTML = `
    <span>✨</span>
    <div style="flex:1; text-align:left;">
      <div class="form-field">
        <label for="signup-email">E-mail</label>
        <input type="email" id="signup-email" value="${state.customer.email || ""}" />
      </div>
      <div class="form-field">
        <label for="signup-password">Crie uma senha</label>
        <input type="password" id="signup-password" />
      </div>
      <p id="signup-error" class="form-error hidden"></p>
      <button class="btn btn-primary" id="signup-submit">Criar conta</button>
    </div>`;

  document.getElementById("signup-submit").addEventListener("click", async () => {
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const errorEl = document.getElementById("signup-error");

    if (!email || password.length < 6) {
      errorEl.textContent = "Informe um e-mail válido e uma senha com pelo menos 6 caracteres.";
      errorEl.classList.remove("hidden");
      return;
    }

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: state.customer.name, phone: state.customer.phone } },
    });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    offer.innerHTML = `<p>✅ Conta criada! Verifique seu e-mail para confirmar o cadastro.</p>`;
  });
});

// ---------------------------------------------------------
// Inicialização
// ---------------------------------------------------------
(async function init() {
  renderStepper();
  await Promise.all([loadServices(), loadBusinessHours()]);
})();
