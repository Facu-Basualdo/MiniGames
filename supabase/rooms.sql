-- Esquema de las salas multijugador (party rooms) de los MiniGames.
-- Ejecutar una vez en el SQL Editor del proyecto Supabase (ademas de schema.sql).
-- Este archivo es solo para setup/reproducibilidad; el build no lo usa.
--
-- Modelo de confianza: igual que public.scores, todo se lee y escribe desde el
-- cliente con la anon key. Un usuario tecnico puede falsear salas o puntajes;
-- aceptable para minijuegos entre amigos. El "host" de una sala es autoritativo
-- por convencion del cliente, no por enforcement de la DB.

-- Una fila por sala. Solo el host la actualiza (por convencion).
create table if not exists public.rooms (
  code          text primary key,                 -- 6 chars, alfabeto A-Z2-9 sin ambiguos (sin O/0/I/1)
  host          text not null,                    -- nickname del anfitrion
  status        text not null default 'lobby',    -- lobby|playing|results|voting|time_voting|finished
  settings      jsonb not null default '{}',      -- { totalRounds, playlist: string[]|null, roundTimeLimitSec, timeVote }
  current_round int  not null default 0,
  current_game  text,
  vote_options  text[],                           -- candidatos durante 'voting' (ids de juego) o 'time_voting' (segundos)
  deadline      timestamptz,                      -- fin aproximado de la ronda o votacion en curso
  created_at    timestamptz not null default now(),
  constraint code_format check (code ~ '^[A-Z2-9]{6}$'),
  constraint host_len    check (char_length(host) between 1 and 12),
  constraint status_ok   check (status in ('lobby','playing','results','voting','time_voting','finished'))
);

-- Migracion idempotente del CHECK de status para salas ya creadas (agrega
-- 'time_voting'). create table ... if not exists no toca tablas existentes.
alter table public.rooms drop constraint if exists status_ok;
alter table public.rooms add constraint status_ok
  check (status in ('lobby','playing','results','voting','time_voting','finished'));

-- Jugadores registrados en cada sala. El upsert sobre la PK es el rejoin.
create table if not exists public.room_players (
  code      text not null references public.rooms(code) on delete cascade,
  player    text not null,
  joined_at timestamptz not null default now(),
  primary key (code, player),
  constraint player_len check (char_length(player) between 1 and 12)
);

-- Historial de rondas: que juego salio en cada ronda. Necesario para recomputar
-- puntos (cada juego tiene su direction) y para excluir juegos ya jugados del
-- pool de votacion.
create table if not exists public.room_rounds (
  code     text not null references public.rooms(code) on delete cascade,
  round_no int  not null,
  game_id  text not null,
  primary key (code, round_no)
);

-- Puntaje de cada jugador en cada ronda. finished=false marca un parcial
-- reportado al vencer el tope de tiempo (no comparable en juegos "lower").
create table if not exists public.room_round_scores (
  code       text not null references public.rooms(code) on delete cascade,
  round_no   int  not null,
  player     text not null,
  score      double precision not null,
  finished   boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (code, round_no, player),
  constraint player_len check (char_length(player) between 1 and 12),
  constraint score_sane check (score = score and score >= 0 and score < 1e9)
);

-- Voto de cada jugador para el juego de la ronda round_no (la proxima a jugar).
create table if not exists public.room_votes (
  code     text not null references public.rooms(code) on delete cascade,
  round_no int  not null,
  player   text not null,
  game_id  text not null,
  primary key (code, round_no, player),
  constraint player_len check (char_length(player) between 1 and 12)
);

-- Estado de partida compartido (juegos de tablero comun, p.ej. Memoria): una
-- fila por (sala, ronda) con el estado completo del juego en jsonb. La columna
-- version implementa concurrencia optimista: cada escritura hace
-- update ... where version = <esperada> e incrementa; si no matchea, el
-- cliente refetchea. Solo escribe el jugador de turno (o el host para
-- destrabar), por convencion del cliente como todo lo demas.
create table if not exists public.room_match_state (
  code       text not null references public.rooms(code) on delete cascade,
  round_no   int  not null,
  state      jsonb not null,
  version    int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (code, round_no)
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_rounds enable row level security;
alter table public.room_round_scores enable row level security;
alter table public.room_votes enable row level security;
alter table public.room_match_state enable row level security;

-- Lectura publica de todo (los codigos de sala son el unico "secreto").
drop policy if exists "rooms_select_public" on public.rooms;
create policy "rooms_select_public" on public.rooms
  for select using (true);

drop policy if exists "room_players_select_public" on public.room_players;
create policy "room_players_select_public" on public.room_players
  for select using (true);

drop policy if exists "room_rounds_select_public" on public.room_rounds;
create policy "room_rounds_select_public" on public.room_rounds
  for select using (true);

drop policy if exists "room_round_scores_select_public" on public.room_round_scores;
create policy "room_round_scores_select_public" on public.room_round_scores
  for select using (true);

drop policy if exists "room_votes_select_public" on public.room_votes;
create policy "room_votes_select_public" on public.room_votes
  for select using (true);

drop policy if exists "room_match_state_select_public" on public.room_match_state;
create policy "room_match_state_select_public" on public.room_match_state
  for select using (true);

-- Escritura anonima con validaciones minimas (los checks de tabla ya cubren
-- formato y rangos). Updates: solo rooms (transiciones del host) y
-- room_round_scores / room_votes (upserts idempotentes del propio jugador).
drop policy if exists "rooms_insert_public" on public.rooms;
create policy "rooms_insert_public" on public.rooms
  for insert with check (true);

drop policy if exists "rooms_update_public" on public.rooms;
create policy "rooms_update_public" on public.rooms
  for update using (true) with check (true);

drop policy if exists "room_players_insert_public" on public.room_players;
create policy "room_players_insert_public" on public.room_players
  for insert with check (true);

drop policy if exists "room_players_update_public" on public.room_players;
create policy "room_players_update_public" on public.room_players
  for update using (true) with check (true);

drop policy if exists "room_rounds_insert_public" on public.room_rounds;
create policy "room_rounds_insert_public" on public.room_rounds
  for insert with check (true);

-- El cliente usa upsert (insert ... on conflict do update) al reintentar.
drop policy if exists "room_rounds_update_public" on public.room_rounds;
create policy "room_rounds_update_public" on public.room_rounds
  for update using (true) with check (true);

drop policy if exists "room_round_scores_insert_public" on public.room_round_scores;
create policy "room_round_scores_insert_public" on public.room_round_scores
  for insert with check (true);

drop policy if exists "room_round_scores_update_public" on public.room_round_scores;
create policy "room_round_scores_update_public" on public.room_round_scores
  for update using (true) with check (true);

drop policy if exists "room_votes_insert_public" on public.room_votes;
create policy "room_votes_insert_public" on public.room_votes
  for insert with check (true);

drop policy if exists "room_votes_update_public" on public.room_votes;
create policy "room_votes_update_public" on public.room_votes
  for update using (true) with check (true);

drop policy if exists "room_match_state_insert_public" on public.room_match_state;
create policy "room_match_state_insert_public" on public.room_match_state
  for insert with check (true);

drop policy if exists "room_match_state_update_public" on public.room_match_state;
create policy "room_match_state_update_public" on public.room_match_state
  for update using (true) with check (true);

-- "Jugar otra vez": al terminar, el host resetea la sala al lobby borrando el
-- historial de rondas/puntajes/votos (los jugadores registrados se conservan).
drop policy if exists "room_rounds_delete_public" on public.room_rounds;
create policy "room_rounds_delete_public" on public.room_rounds
  for delete using (true);

drop policy if exists "room_round_scores_delete_public" on public.room_round_scores;
create policy "room_round_scores_delete_public" on public.room_round_scores
  for delete using (true);

drop policy if exists "room_votes_delete_public" on public.room_votes;
create policy "room_votes_delete_public" on public.room_votes
  for delete using (true);

drop policy if exists "room_match_state_delete_public" on public.room_match_state;
create policy "room_match_state_delete_public" on public.room_match_state
  for delete using (true);

-- Limpieza opcional: las filas son minusculas, pero si algun dia molesta se
-- puede correr a mano (o con pg_cron):
--   delete from public.rooms where created_at < now() - interval '2 days';
-- El on delete cascade arrastra players/rounds/scores/votes.
