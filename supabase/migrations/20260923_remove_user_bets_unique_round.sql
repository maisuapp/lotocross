-- Each row is one independent ticket. Do not limit a user to one ticket
-- for a lottery and draw; the primary key remains the ticket identity.
alter table if exists public.user_bets
  drop constraint if exists user_bets_user_id_lottery_type_round_key;

drop index if exists public.user_bets_user_id_lottery_type_round_key;
