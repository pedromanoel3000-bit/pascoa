-- Cole isto no Supabase: menu SQL Editor -> New query -> Run.
create table if not exists families (
  family text primary key,
  epoch text not null,
  created_at timestamptz not null default now()
);

create table if not exists items (
  family text not null references families(family) on delete cascade,
  id text not null,
  rev bigint not null,
  data jsonb not null,
  primary key (family, id)
);

-- Bloqueia o acesso público: só o servidor (com a chave secreta) lê e grava.
alter table families enable row level security;
alter table items enable row level security;
