-- 056 · Entraînement › Simulateur (Romain 2026-11-11) : l'appel de vente simulé avec un prospect joué par Claude, en texte ou à
-- la voix, en appel complet, en diagnostic ou en objections, à trois difficultés. Le moteur (confiance du prospect, conscience,
-- résistance aux objections) est dans supabase/functions/_shared/simulateur ; la fonction Edge `simulateur` écrit tout.
--   crm_sim_offers       une offre (LNP) : ses données lues par le prospect (offer_identity, offer_details, outils), ses sources
--   crm_sim_personas     un prospect de l'offre : identité, douleurs, objections, style, briefing, voix (full_persona_data)
--   crm_sim_simulations  une simulation : qui, quel prospect, quel mode, quelle difficulté, l'état du moteur, la durée
--   crm_sim_messages     les répliques (role 'commercial' ou 'prospect')
--   crm_sim_feedback     la note de la simulation par la personne (1 à 5), une fois par simulation
--   crm_sim_analyses     l'analyse de fin d'appel : statut, résultat, retour d'expérience (AAR) et son miroir, coût
--   crm_sim_config       les réglages (une ligne) : modèle du prospect, voix, plafond quotidien d'analyses
-- Lecture : chacun ses simulations, un administrateur toutes ; les offres, les prospects et les réglages pour toute l'équipe.
-- Écriture : seulement par la fonction `simulateur` (clé de service) ; le navigateur n'écrit rien directement.
-- Peut être rejoué.

create table if not exists crm_sim_offers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  description text,
  price text,
  sector text,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  sources jsonb not null default '[]',
  fingerprint text,                                   -- empreinte des sources : une même source réutilise l'offre
  status text not null default 'ready' check (status in ('extracting', 'generating', 'ready', 'failed')),
  error text,
  archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create unique index if not exists crm_sim_offers_fingerprint on crm_sim_offers (fingerprint) where fingerprint is not null and not archived;

create table if not exists crm_sim_personas (
  id text primary key check (id ~ '^[a-z0-9_-]{3,80}$'),
  offer_id uuid references crm_sim_offers(id) on delete cascade,
  first_name text not null,
  age int,
  city text,
  profession text,
  situation text,
  difficulty text not null default 'moyen' check (difficulty in ('moyen', 'difficile', 'expert')),
  consciousness_level int check (consciousness_level between 1 and 5),
  pcm_type text check (pcm_type in ('travaillomane', 'empathique', 'promoteur', 'perseverant')),
  voice_id text,
  full_persona_data jsonb not null default '{}' check (jsonb_typeof(full_persona_data) = 'object'),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists crm_sim_personas_offer on crm_sim_personas (offer_id, position);

create table if not exists crm_sim_simulations (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  prospect_name text not null,
  prospect_profile text not null default '',
  persona_id text references crm_sim_personas(id) on delete set null,
  offer_id uuid references crm_sim_offers(id) on delete set null,
  difficulty text not null default 'moyen' check (difficulty in ('moyen', 'difficile', 'expert')),
  simulation_mode text not null default 'full' check (simulation_mode in ('full', 'diagnostic', 'objections')),
  call_structure text not null default 'lnp',
  persona_data jsonb,
  simulation_state jsonb,
  use_modular_prompt boolean not null default true,
  version_referentiel text,
  voice boolean not null default false,               -- démarrée à la voix
  usage jsonb not null default '{}',                  -- jetons consommés (prospect, signaux, voix)
  created_at timestamptz not null default now());
create index if not exists crm_sim_simulations_user on crm_sim_simulations (user_id, started_at desc);
create index if not exists crm_sim_simulations_active on crm_sim_simulations (user_id) where status = 'active';

create table if not exists crm_sim_messages (
  id bigint generated always as identity primary key,
  simulation_id bigint not null references crm_sim_simulations(id) on delete cascade,
  role text not null check (role in ('commercial', 'prospect')),
  content text not null,
  created_at timestamptz not null default clock_timestamp());
create index if not exists crm_sim_messages_sim on crm_sim_messages (simulation_id, id);

create table if not exists crm_sim_feedback (
  id uuid primary key default gen_random_uuid(),
  simulation_id bigint not null unique references crm_sim_simulations(id) on delete cascade,
  user_id uuid not null,
  user_email text,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now());

create table if not exists crm_sim_analyses (
  id uuid primary key default gen_random_uuid(),
  simulation_id bigint not null references crm_sim_simulations(id) on delete cascade,
  user_id uuid not null,
  status text not null check (status in ('processing', 'deferred', 'completed', 'failed', 'rejected')),
  reason text,
  type_appel text,
  transcript text,
  result jsonb,
  raw jsonb,
  aar jsonb,
  miroir jsonb,
  cost jsonb not null default '{}',
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz);
create unique index if not exists crm_sim_analyses_sim on crm_sim_analyses (simulation_id);
create index if not exists crm_sim_analyses_status on crm_sim_analyses (status, created_at);

create table if not exists crm_sim_config (
  id int primary key default 1 check (id = 1),
  claude_model text not null default 'claude-sonnet-5-5' check (claude_model in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5')),
  voice_mode_enabled boolean not null default true,
  eleven_labs_model_id text not null default 'eleven_flash_v2_5',
  eleven_labs_stability numeric(3, 2) not null default 0.20 check (eleven_labs_stability between 0 and 1),
  eleven_labs_style numeric(3, 2) not null default 0.20 check (eleven_labs_style between 0 and 1),
  eleven_labs_speed numeric(3, 2) not null default 1.20 check (eleven_labs_speed between 0.7 and 1.2),
  silence_timeout_ms int not null default 800 check (silence_timeout_ms between 300 and 5000),
  daily_analysis_limit int not null default 10 check (daily_analysis_limit between 0 and 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid);
insert into crm_sim_config (id) values (1) on conflict (id) do nothing;

-- lecture : RLS ; écriture : la fonction Edge seulement (clé de service, qui passe outre la RLS)
alter table crm_sim_offers enable row level security;
alter table crm_sim_personas enable row level security;
alter table crm_sim_simulations enable row level security;
alter table crm_sim_messages enable row level security;
alter table crm_sim_feedback enable row level security;
alter table crm_sim_analyses enable row level security;
alter table crm_sim_config enable row level security;

drop policy if exists sim_offers_read on crm_sim_offers;
create policy sim_offers_read on crm_sim_offers for select using (crm_role() is not null and (not archived or crm_role() = 'admin'));
drop policy if exists sim_personas_read on crm_sim_personas;
create policy sim_personas_read on crm_sim_personas for select using (crm_role() is not null and (active or crm_role() = 'admin'));
drop policy if exists sim_config_read on crm_sim_config;
create policy sim_config_read on crm_sim_config for select using (crm_role() is not null);
drop policy if exists sim_simulations_read on crm_sim_simulations;
create policy sim_simulations_read on crm_sim_simulations for select using (user_id = auth.uid() or crm_role() = 'admin');
drop policy if exists sim_messages_read on crm_sim_messages;
create policy sim_messages_read on crm_sim_messages for select
  using (exists (select 1 from crm_sim_simulations s where s.id = simulation_id and (s.user_id = auth.uid() or crm_role() = 'admin')));
drop policy if exists sim_feedback_read on crm_sim_feedback;
create policy sim_feedback_read on crm_sim_feedback for select using (user_id = auth.uid() or crm_role() = 'admin');
drop policy if exists sim_analyses_read on crm_sim_analyses;
create policy sim_analyses_read on crm_sim_analyses for select using (user_id = auth.uid() or crm_role() = 'admin');

revoke all on crm_sim_offers, crm_sim_personas, crm_sim_simulations, crm_sim_messages, crm_sim_feedback, crm_sim_analyses, crm_sim_config
  from public, anon, authenticated;
grant select on crm_sim_offers, crm_sim_personas, crm_sim_simulations, crm_sim_messages, crm_sim_feedback, crm_sim_analyses, crm_sim_config
  to authenticated;
grant all on crm_sim_offers, crm_sim_personas, crm_sim_simulations, crm_sim_messages, crm_sim_feedback, crm_sim_analyses, crm_sim_config
  to service_role;

-- l'historique (une ligne par simulation) : la personne, le prospect, la durée, le nombre de répliques, l'analyse et la note
create or replace function crm_sim_history(p_user uuid default null, p_limit int default 200) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'started_at' desc), '[]') from (
    select jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'name', coalesce(m.full_name, m.email), 'status', s.status,
      'started_at', s.started_at, 'ended_at', s.ended_at, 'duration_seconds', s.duration_seconds,
      'prospect_name', s.prospect_name, 'persona_id', s.persona_id, 'offer_id', s.offer_id, 'offer_name', o.name,
      'mode', s.simulation_mode, 'difficulty', s.difficulty, 'voice', s.voice,
      'messages', (select count(*) from crm_sim_messages k where k.simulation_id = s.id),
      'analysis', (select jsonb_build_object('id', a.id, 'status', a.status, 'reason', a.reason,
                     'score', a.result->'score_total', 'niveau', a.result->>'niveau') from crm_sim_analyses a where a.simulation_id = s.id),
      'rating', (select f.rating from crm_sim_feedback f where f.simulation_id = s.id)) x
    from crm_sim_simulations s
    left join crm_members m on m.id = s.user_id
    left join crm_sim_offers o on o.id = s.offer_id
    where (s.user_id = auth.uid() or crm_role() = 'admin')
      and (p_user is null or s.user_id = p_user)
    order by s.started_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000)) q
$$;
revoke execute on function crm_sim_history(uuid, int) from public, anon;
grant execute on function crm_sim_history(uuid, int) to authenticated;

-- Les analyses mises en attente (plafond quotidien atteint) repartent d'elles-mêmes : toutes les 10 minutes, la fonction
-- `simulateur/balayer` relance celles du jour dans la limite du plafond et clôt en échec celles bloquées depuis 30 minutes.
-- Ne prend rien en entrée, ne répond que des nombres. Seulement là où pg_cron existe (le projet Supabase ; pas les tests).
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'crm-simulateur-balayer';
    perform cron.schedule('crm-simulateur-balayer', '*/10 * * * *', $job$
      select net.http_post(
        url := (select value #>> '{}' from public.crm_settings where key = 'functions_url') || '/simulateur/balayer',
        body := '{}'::jsonb,
        headers := '{"content-type": "application/json"}'::jsonb,
        timeout_milliseconds := 60000)
      where exists (select 1 from public.crm_settings where key = 'functions_url')
        and exists (select 1 from public.crm_sim_analyses where status in ('deferred', 'processing'))
    $job$);
  end if;
end $do$;
