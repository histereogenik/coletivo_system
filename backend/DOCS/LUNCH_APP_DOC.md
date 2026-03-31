# Almoços e Pacotes

Base local: `http://localhost:8001`

## Permissões
- Todas as rotas de almoço e pacote exigem `SuperuserOnly`.

## Endpoints de almoços
- CRUD: `/api/lunch/lunches/`
  - Listar: `GET /api/lunch/lunches/`
  - Criar: `POST /api/lunch/lunches/`
  - Detalhar: `GET /api/lunch/lunches/{id}/`
  - Atualizar parcial: `PATCH /api/lunch/lunches/{id}/`
  - Remover: `DELETE /api/lunch/lunches/{id}/`
- Sumário filtrado: `GET /api/lunch/lunches/summary/`
- Exportar XLSX: `GET /api/lunch/lunches/export/`

## Endpoints de pacotes
- CRUD: `/api/lunch/packages/`
  - Listar: `GET /api/lunch/packages/`
  - Criar: `POST /api/lunch/packages/`
  - Detalhar: `GET /api/lunch/packages/{id}/`
  - Atualizar parcial: `PATCH /api/lunch/packages/{id}/`
  - Remover: `DELETE /api/lunch/packages/{id}/`
- Exportar XLSX: `GET /api/lunch/packages/export/`
- Ajustar saldo manualmente:
  - Decrementar: `POST /api/lunch/packages/{id}/decrement/`
  - Incrementar: `POST /api/lunch/packages/{id}/increment/`

## Filtros de almoços
- `payment_status`: `PAGO | EM_ABERTO`
- `date`
- `date_from`
- `date_to`
- `member`
- `credit_owner`
- `package`
- `has_package`: `true | false`
- `value_cents`
- `value_cents_min`
- `value_cents_max`

Exemplo:
`GET /api/lunch/lunches/?member=3&payment_status=PAGO&date_from=2026-03-01&date_to=2026-03-31`

## Filtros de pacotes
- `payment_status`
- `status`: `VALIDO | EXPIRADO`
- `member`
- `date`
- `date_from`
- `date_to`
- `expiration`
- `expiration_from`
- `expiration_to`

## Payloads de almoço

### Almoço avulso pago em dinheiro
```json
{
  "member": 3,
  "value_cents": 3500,
  "date": "2026-03-30",
  "payment_status": "PAGO",
  "payment_mode": "PIX"
}
```

### Almoço usando pacote disponível
```json
{
  "member": 3,
  "date": "2026-03-30",
  "use_package": true
}
```

### Almoço usando troca
```json
{
  "member": 5,
  "credit_owner": 2,
  "value_cents": 2800,
  "date": "2026-03-30",
  "payment_mode": "TROCA",
  "payment_status": "PAGO"
}
```

## Regras de almoço
- `value_cents` deve ser maior ou igual a zero.
- `use_package=true` procura automaticamente um pacote válido do integrante na data do almoço.
- Se usar pacote:
  - o `value_cents` é preenchido com `unit_value_cents` do pacote
  - o pacote tem `remaining_quantity` decrementado
  - o almoço fica efetivamente pago
- Se usar `payment_mode=TROCA`:
  - `credit_owner` é obrigatório
  - não pode existir `package` no mesmo almoço
  - `payment_status` é forçado para `PAGO`
  - não é criado `FinancialEntry`
  - é criado ou sincronizado um débito no app `credits`
- Se for pago normalmente (`PIX`, `CARTAO`, `DINHEIRO`) e estiver `PAGO`, cria `FinancialEntry`
- Ao editar ou remover almoço, as entradas financeiras e de troca são sincronizadas ou removidas automaticamente

## Payloads de pacote

### Criar pacote
```json
{
  "member": 3,
  "unit_value_cents": 2800,
  "quantity": 10,
  "date": "2026-03-30",
  "expiration": "2026-05-30",
  "payment_status": "PAGO",
  "payment_mode": "PIX"
}
```

### Decrementar saldo do pacote
```json
{
  "amount": 1
}
```

## Regras de pacote
- `quantity` é obrigatória.
- `expiration` é obrigatória.
- `remaining_quantity` não pode exceder `quantity`.
- `value_cents` é calculado automaticamente quando `unit_value_cents` e `quantity` são enviados.
- `status` é recalculado automaticamente:
  - `VALIDO` se `expiration >= hoje`
  - `EXPIRADO` se `expiration < hoje`
- Pacote pago gera `FinancialEntry`.
- Se o pagamento deixar de ser `PAGO`, a entrada financeira vinculada é removida.

## Sumário de almoços
`GET /api/lunch/lunches/summary/` retorna:
```json
{
  "received_cents": 8400,
  "open_cents": 2800,
  "count": 5
}
```
