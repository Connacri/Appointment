-- data-contract: constraint-only (no generated-type change)
-- Same-day stays are valid in the app when check-out time is after check-in
-- time (BookingModal validates the full timestamps). The old date-only
-- constraint rejected every payment day-use booking with end_date = start_date.
-- Keep rejecting an end date before the start date.
alter table public.bookings
  drop constraint if exists bookings_check;

alter table public.bookings
  add constraint bookings_check check (end_date >= start_date);
