# Financeiro

Base local: `http://localhost:8001`

## Permissões
- Apenas superusuários podem criar/listar/atualizar/remover lançamentos.

## Endpoints
- CRUD: `/api/financial/entries/`
  - Listar: `GET /api/financial/entries/`
  - Criar: `POST /api/financial/entries/`
  - Detalhar: `GET /api/financial/entries/{id}/`
  - Atualizar parcial: `PATCH /api/financial/entries/{id}/`
  - Remover: `DELETE /api/financial/entries/{id}/`

## Tipos e categorias
- `entry_type`: `ENTRADA` | `SAIDA`
- Categorias permitidas:
  - Entradas: `ALMOCO` (pagamento de almoço), `DOACAO`
  - Saídas: `NOTA` (compras/notas), `STAFF` (pagamento de equipe), `DESPESA` (aluguel, gás, etc.)

## Payloads de exemplo

### Entrada (pagamento de almoço)
```json
{
  "entry_type": "ENTRADA",
  "category": "ALMOCO",
  "description": "Pagamento de almoço",
  "value_cents": 2500,
  "date": "2025-12-10"
}
```

### Entrada (doação)
```json
{
  "entry_type": "ENTRADA",
  "category": "DOACAO",
  "description": "Doação em espécie",
  "value_cents": 5000,
  "date": "2025-12-15"
}
```

### Saída (despesa)
```json
{
  "entry_type": "SAIDA",
  "category": "DESPESA",
  "description": "Gás da cozinha",
  "value_cents": 8000,
  "date": "2025-12-11"
}
```

## Filtros (GET)
- Por tipo: `/api/financial/entries/?entry_type=ENTRADA`
- Por categoria: `/api/financial/entries/?category=DESPESA`
- Por data exata: `/api/financial/entries/?date=2025-12-10`
- Por intervalo: `/api/financial/entries/?date_range_after=2025-12-01&date_range_before=2025-12-31`

## Integração com Almoço
- Almoços com `payment_status = PAGO` criam/atualizam uma entrada financeira automaticamente (`ENTRADA/ALMOCO`, valor e data do almoço, descrição padrão com nome do membro e data).
- Se um almoço pago volta para `EM_ABERTO`, o lançamento financeiro vinculado é removido.
- Campo `lunch` no modelo financeiro mantém o vínculo (OneToOne); útil para rastrear origem dos lançamentos de almoço.

## Regras de validação
- `value_cents` > 0.
- Categoria deve ser compatível com o tipo (`ENTRADA` aceita apenas `ALMOCO` ou `DOACAO`; `SAIDA` aceita `NOTA`, `STAFF`, `DESPESA`).
