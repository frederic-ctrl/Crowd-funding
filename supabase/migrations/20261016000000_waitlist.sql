-- Wachtlijst van de community-ronde.
-- Enkel de server (secret key of service role) leest en schrijft: RLS staat aan, zonder policies.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  lang text not null default 'nl',
  source text not null default 'site',
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint waitlist_email_unique unique (email),
  constraint waitlist_email_lowercase check (email = lower(email)),
  constraint waitlist_lang_valid check (lang in ('nl', 'fr', 'en', 'de'))
);

alter table public.waitlist enable row level security;

comment on table public.waitlist is
  'Wachtlijst community-ronde. Persoonsgegevens: enkel e-mail, taal en toestemming. Bewaren tot 12 maanden na de laatste fase.';
