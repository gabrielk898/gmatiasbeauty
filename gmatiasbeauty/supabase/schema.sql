-- =========================================================
-- gmatiasbeauty — Schema Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Dashboard > SQL Editor > New query > colar > Run)
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. SERVIÇOS
-- ---------------------------------------------------------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  duration_minutes int not null default 30,
  price_cents int not null default 0,
  icon text default '✨',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Garante a constraint mesmo se a tabela já existia de uma execução anterior
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_name_key'
  ) then
    alter table services add constraint services_name_key unique (name);
  end if;
end $$;

-- ---------------------------------------------------------
-- 2. HORÁRIO DE FUNCIONAMENTO
-- weekday: 0 = domingo, 1 = segunda, ... 6 = sábado
-- ---------------------------------------------------------
create table if not exists business_hours (
  weekday int primary key check (weekday between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false
);

-- ---------------------------------------------------------
-- 3. PERFIS (opcional — usado se o cliente criar conta)
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. AGENDAMENTOS
-- user_id fica nulo quando o cliente agenda como "convidado"
-- ---------------------------------------------------------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id),
  user_id uuid references auth.users(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_date on appointments(appointment_date);

-- ---------------------------------------------------------
-- 5. TRAVA CONTRA CONFLITO DE HORÁRIO (double booking)
-- Impede que dois agendamentos "confirmed" se sobreponham no mesmo dia
-- ---------------------------------------------------------
create or replace function prevent_double_booking()
returns trigger as $$
begin
  if new.status = 'confirmed' and exists (
    select 1 from appointments
    where appointment_date = new.appointment_date
      and status = 'confirmed'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
      and (new.start_time, new.end_time) overlaps (start_time, end_time)
  ) then
    raise exception 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_double_booking on appointments;
create trigger trg_prevent_double_booking
  before insert or update on appointments
  for each row execute function prevent_double_booking();

-- ---------------------------------------------------------
-- 6. FUNÇÃO PÚBLICA: horários já ocupados em uma data
-- Só devolve o horário (não nome/telefone do cliente) —
-- assim dá pra checar disponibilidade sem expor dados de outros clientes.
-- ---------------------------------------------------------
create or replace function get_booked_slots(p_date date)
returns table(start_time time, end_time time) as $$
  select start_time, end_time
  from appointments
  where appointment_date = p_date
    and status = 'confirmed';
$$ language sql security definer stable;

grant execute on function get_booked_slots(date) to anon, authenticated;

-- ---------------------------------------------------------
-- 7. RLS (Row Level Security)
-- ---------------------------------------------------------
alter table services enable row level security;
alter table business_hours enable row level security;
alter table appointments enable row level security;
alter table profiles enable row level security;

-- Qualquer visitante pode ver serviços ativos e horário de funcionamento
drop policy if exists "public read active services" on services;
create policy "public read active services"
  on services for select
  using (active = true);

drop policy if exists "public read business hours" on business_hours;
create policy "public read business hours"
  on business_hours for select
  using (true);

-- Qualquer visitante pode CRIAR um agendamento (guest checkout)
drop policy if exists "anyone can create appointment" on appointments;
create policy "anyone can create appointment"
  on appointments for insert
  with check (true);

-- Ninguém pode ler a lista de agendamentos diretamente (protege dados de clientes).
-- A checagem de disponibilidade é feita só via get_booked_slots().
-- Um cliente logado pode ver os PRÓPRIOS agendamentos:
drop policy if exists "user can read own appointments" on appointments;
create policy "user can read own appointments"
  on appointments for select
  using (auth.uid() = user_id);

-- Perfil: cada usuário só lê/edita o próprio
drop policy if exists "user can read own profile" on profiles;
create policy "user can read own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "user can upsert own profile" on profiles;
create policy "user can upsert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "user can update own profile" on profiles;
create policy "user can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------
-- 8. DADOS DE EXEMPLO (edite com seus serviços reais)
-- ---------------------------------------------------------
insert into services (name, description, duration_minutes, price_cents, icon, sort_order) values
  ('Depilação a Laser', 'Sessão de depilação a laser', 30, 15000, '✨', 1),
  ('Laser para Micose', 'Tratamento a laser para micose', 30, 15000, '✨', 2),
  ('Limpeza de Pele', 'Limpeza de pele profissional', 45, 12000, '✨', 3)
on conflict (name) do nothing;

insert into business_hours (weekday, open_time, close_time, is_closed) values
  (0, null, null, true),           -- domingo: fechado
  (1, '09:00', '18:00', false),    -- segunda
  (2, '09:00', '18:00', false),    -- terça
  (3, '09:00', '18:00', false),    -- quarta
  (4, '09:00', '18:00', false),    -- quinta
  (5, '09:00', '18:00', false),    -- sexta
  (6, '09:00', '13:00', false)     -- sábado
on conflict (weekday) do nothing;
