# Supabase do LotoCross

O projeto Supabase conectado ao LotoCross é `lotocross-users` (`lpvisjgalthkopmddaff`), na região de Tóquio.

## Perfis

- `participant`: usuário comum;
- `organizer`: pode administrar bolões;
- `admin`: pode administrar bolões e alterar os perfis cadastrados.

Novos cadastros começam sempre como `participant`. Isso evita que alguém escolha privilégios elevados no formulário público.

## Ativar o primeiro administrador

Depois de criar a primeira conta no site, abra o SQL Editor do Supabase e execute:

```sql
select id, email from auth.users order by created_at;
```

Copie o `id` da conta escolhida e execute:

```sql
update public.profiles
set role = 'admin', updated_at = timezone('utc', now())
where id = 'COLE_O_UUID_DO_USUARIO_AQUI';
```

Depois de sair e entrar novamente, o painel de perfis ficará disponível para o administrador.

## URLs de autenticação

No Supabase, em **Authentication → URL Configuration**, configure:

- Site URL: `https://baito.online`
- Redirect URL: `https://baito.online`

Nunca publique uma chave `service_role`. O site usa somente a chave pública do Supabase, protegida pelas políticas RLS.

## Apostas vinculadas ao perfil

As apostas cadastradas em **Nova Aposta** são gravadas na tabela privada por usuário `public.user_bets`. Quando a pessoa está autenticada, elas aparecem no bloco **Minhas apostas** dentro do perfil. O acesso é protegido por RLS: cada participante consulta apenas as próprias apostas, enquanto administradores podem consultar os registros para suporte.

Se a pessoa cadastrar uma aposta sem entrar na conta, ela fica disponível somente neste dispositivo e o formulário informa essa limitação.

Cada linha de `user_bets` representa uma cartela individual. Para permitir mais de uma cartela no mesmo concurso, remova a restrição antiga que tornava `user_id + lottery_type + round` único (o campo `id` continua sendo a identidade da aposta):

```sql
do $$
declare
  constraint_name text;
  index_name text;
begin
  alter table public.user_bets
    drop constraint if exists user_bets_user_id_lottery_type_round_key;

  for constraint_name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.user_bets'::regclass
      and c.contype = 'u'
      and array(select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey) order by a.attname)
        = array['lottery_type', 'round', 'user_id']::name[]
  loop
    execute format('alter table public.user_bets drop constraint %I', constraint_name);
  end loop;
  for index_name in
    select i.indexrelid::regclass::text from pg_index i
    where i.indrelid = 'public.user_bets'::regclass
      and i.indisunique
      and array(select a.attname from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any(i.indkey) order by a.attname)
        = array['lottery_type', 'round', 'user_id']::name[]
  loop
    execute format('drop index if exists %s', index_name);
  end loop;
end $$;
```

Essa migração está versionada em `supabase/migrations/20260923_remove_user_bets_unique_round.sql`. Execute-a no SQL Editor do Supabase (ou aplique-a pelo Supabase CLI) antes de cadastrar várias cartelas no mesmo concurso. Depois disso, não existe limite de quantidade por concurso: novas apostas são inseridas separadamente e podem ser editadas ou excluídas individualmente no perfil.
