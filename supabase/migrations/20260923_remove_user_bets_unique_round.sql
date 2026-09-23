-- Each row is one independent ticket. Remove any old uniqueness rule over
-- user_id, lottery_type and round, regardless of the generated object name.
do $$
declare
  constraint_name text;
  index_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.user_bets'::regclass
      and c.contype = 'u'
      and array(
        select a.attname
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = any(c.conkey)
        order by a.attname
      ) = array['lottery_type', 'round', 'user_id']::name[]
  loop
    execute format('alter table public.user_bets drop constraint %I', constraint_name);
  end loop;

  for index_name in
    select i.indexrelid::regclass::text
    from pg_index i
    where i.indrelid = 'public.user_bets'::regclass
      and i.indisunique
      and array(
        select a.attname
        from pg_attribute a
        where a.attrelid = i.indrelid
          and a.attnum = any(i.indkey)
        order by a.attname
      ) = array['lottery_type', 'round', 'user_id']::name[]
  loop
    execute format('drop index if exists %s', index_name);
  end loop;
end $$;
