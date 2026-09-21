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
