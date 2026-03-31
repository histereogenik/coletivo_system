# Credits / Trocas

Base local: `http://localhost:8001`

## Visão geral
- O app backend se chama `credits`.
- No frontend e na operação diária, essa área aparece como **Trocas**.
- O sistema funciona como um ledger:
  - créditos aumentam saldo
  - débitos reduzem saldo
- O saldo atual é calculado a partir do histórico e não é salvo como campo materializado.

## Permissões
- Todas as rotas do app de trocas exigem `SuperuserOnly`.

## Modelo principal
`CreditEntry`
- `owner`: dono do banco de trocas
- `beneficiary`: quem gerou ou consumiu a troca
- `entry_type`: `CREDITO | DEBITO`
- `origin`: `AGENDA | MANUAL | LUNCH | ESTORNO`
- `value_cents`
- `description`
- `agenda_entry` opcional
- `lunch` opcional
- `created_by` opcional
- `created_at`
- `updated_at`

## Regras de integridade
- `value_cents` deve ser maior que zero.
- Lançamento manual exige `description`.
- `origin=AGENDA` exige `agenda_entry`.
- `origin=LUNCH` exige `lunch`.
- Existe constraint para impedir duplicidade automática:
  - 1 crédito automático por `agenda_entry + owner`
  - 1 débito automático por `lunch`
- Débito nunca pode deixar o saldo negativo.

## Endpoints
- Listar extrato: `GET /api/credits/entries/`
- Detalhar lançamento: `GET /api/credits/entries/{id}/`
- Resumo por integrante: `GET /api/credits/summary/?owner={id}`
- Lista paginada de donos com saldo positivo: `GET /api/credits/summary/`
- Crédito manual: `POST /api/credits/manual-credit/`
- Débito manual: `POST /api/credits/manual-debit/`

## Filtros do extrato
Disponíveis em `GET /api/credits/entries/`:
- `owner`
- `beneficiary`
- `origin`
- `entry_type`
- `created_from`
- `created_to`

Exemplo:
`GET /api/credits/entries/?owner=2&origin=AGENDA&entry_type=CREDITO`

## Resumo de trocas

### Resumo individual
`GET /api/credits/summary/?owner=2`

Resposta:
```json
{
  "owner": 2,
  "owner_name": "Carlos Lima",
  "credits_cents": 9000,
  "debits_cents": 2800,
  "balance_cents": 6200
}
```

### Lista de donos com saldo positivo
`GET /api/credits/summary/?search=carlos&page=1&page_size=15`

Regras:
- retorna somente integrantes com `balance_cents > 0`
- aceita filtro `search` por nome
- resposta é paginada

## Lançamentos manuais

### Crédito manual
```json
{
  "owner": 2,
  "value_cents": 3000,
  "description": "Troca manual por apoio extra à equipe."
}
```

Regras:
- o beneficiário do crédito manual é sempre o próprio `owner`
- se algum `beneficiary` for enviado, o backend ignora e usa o dono

### Débito manual
```json
{
  "owner": 2,
  "beneficiary": 5,
  "value_cents": 1200,
  "description": "Ajuste manual referente a almoço consumido."
}
```

Regras:
- exige saldo suficiente
- registra `created_by`
- mantém `origin = MANUAL`

## Integração com agenda
- Quando uma `AgendaEntry` fica `CONCLUIDO`, o sistema cria ou sincroniza créditos automáticos.
- Cada integrante da agenda recebe:
  - `owner = integrante`
  - `beneficiary = integrante`
  - `entry_type = CREDITO`
  - `origin = AGENDA`
  - `value_cents = duty.remuneration_cents`
- Se a agenda for alterada depois, o sistema ressincroniza os lançamentos.

## Integração com almoço
- Quando um almoço usa `payment_mode = TROCA`, ele consome o banco de trocas do `credit_owner`.
- O sistema cria ou sincroniza um débito automático com:
  - `owner = credit_owner`
  - `beneficiary = member` do almoço
  - `entry_type = DEBITO`
  - `origin = LUNCH`
  - `value_cents = lunch.value_cents`
- Não é permitido usar `package` e `TROCA` no mesmo almoço.
- Almoço pago com troca não gera `FinancialEntry`.

## Cálculo de saldo
O saldo é calculado assim:
```text
saldo = soma(CREDITO) - soma(DEBITO)
```

Helpers principais:
- `get_credit_summary(owner_id)`
- `get_credit_balance(owner_id)`

## Segurança
- Todas as validações críticas acontecem no backend.
- Débitos usam transação e lock dos membros envolvidos para evitar corrida.
- O backend valida saldo antes de criar débito.
- A duplicidade de lançamentos automáticos é protegida por constraints.
