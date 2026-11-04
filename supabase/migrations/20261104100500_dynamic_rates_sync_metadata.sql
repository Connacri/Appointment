-- Keep dynamic-rate metadata migration explicit and independently replayable.
alter table public.dynamic_rates
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
