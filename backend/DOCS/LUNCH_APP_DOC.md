# Almoços (Pacotes e Avulsos)

Base local: `http://localhost:8001`

## Permissões
- Apenas superusuários podem criar, listar, atualizar ou remover almoços e ajustar saldo de pacotes.

## Endpoints
- CRUD: `/api/lunch/lunches/`
  - Listar: `GET /api/lunch/lunches/`
  - Criar: `POST /api/lunch/lunches/`
  - Detalhar: `GET /api/lunch/lunches/{id}/`
  - Atualizar parcial: `PATCH /api/lunch/lunches/{id}/`
  - Remover: `DELETE /api/lunch/lunches/{id}/`
- Ajuste de saldo (somente pacotes):
  - Decrementar: `POST /api/lunch/lunches/{id}/decrement/` (body: `{"amount": 1}`)
  - Incrementar: `POST /api/lunch/lunches/{id}/increment/` (body: `{"amount": 1}`)

## Filtros
Use query params no `GET /api/lunch/lunches/`:
- `payment_status`: `PAGO` | `EM_ABERTO`
- `member`: id do membro
- `date`: `YYYY-MM-DD`
- `package_status`: `VALIDO` | `EXPIRADO`
- `lunch_type`: `AVULSO` | `PACOTE`

Exemplo: `/api/lunch/lunches/?member=2&payment_status=EM_ABERTO&package_status=VALIDO`

## Payloads de exemplo

### Criar almoço avulso
```json
{
  "member": 1,
  "value_cents": 3500,
  "date": "2025-02-10",
  "lunch_type": "AVULSO",
  "payment_status": "PAGO"
}
```

### Criar almoço pacote
```json
{
  "member": 1,
  "value_cents": 50000,
  "date": "2025-02-10",
  "lunch_type": "PACOTE",
  "payment_status": "EM_ABERTO",
  "quantity": 10,
  "package_expiration": "2025-04-10",
  "package_status": "VALIDO"
}
```

### Incrementar/decrementar saldo do pacote
- Decrementar 1: `POST /api/lunch/lunches/{id}/decrement/` body `{"amount": 1}`
- Incrementar 1: `POST /api/lunch/lunches/{id}/increment/` body `{"amount": 1}`

## Campos retornados
- Para pacotes: `quantity`, `remaining_quantity`, `package_expiration`, `package_status`.
- Para avulsos: campos de pacote vêm como `null`.
- Sempre inclui `member` (id) e `member_name`.

## Regras de validação principais
- `value_cents` > 0.
- Para `PACOTE`: `quantity`, `package_expiration` e `package_status` são obrigatórios.
- `remaining_quantity` não pode exceder `quantity`.
- Para `AVULSO`: campos de pacote são limpos automaticamente.
