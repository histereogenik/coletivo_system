# Agenda

Base local: `http://localhost:8001`

## Permissões
- Toda a agenda é administrativa.
- Leitura, criação, atualização, remoção e exportação exigem superusuário.

## Endpoints
- CRUD: `/api/agenda/entries/`
  - Listar: `GET /api/agenda/entries/`
  - Criar: `POST /api/agenda/entries/`
  - Detalhar: `GET /api/agenda/entries/{id}/`
  - Atualizar parcial: `PATCH /api/agenda/entries/{id}/`
  - Remover: `DELETE /api/agenda/entries/{id}/`
- Exportar XLSX: `GET /api/agenda/entries/export/`

## Payload de criação
```json
{
  "date": "2026-03-30",
  "start_time": "09:00",
  "end_time": "12:00",
  "duty": 3,
  "member_ids": [5, 8],
  "status": "PLANEJADO",
  "notes": "Cobertura da manhã."
}
```

## Filtros
- `date`
- `date_from`
- `date_to`
- `date_range_after`
- `date_range_before`
- `duty`
- `member`
- `status`

Exemplo:
`GET /api/agenda/entries/?date_from=2026-03-01&date_to=2026-03-31&status=CONCLUIDO`

## Regras de negócio
- `start_time` deve ser menor que `end_time`, quando `end_time` existir.
- `member_ids` aceita múltiplos integrantes.
- Ao agendar um integrante em uma função, ele é associado ao duty e pode ser promovido para `SUSTENTADOR`.
- O mesmo integrante não pode ter dois agendamentos sobrepostos na mesma data.
- Em caso de conflito, a API retorna detalhes em `member_ids` e `member_conflicts`.

## Integração com trocas
- Quando uma entrada fica com `status=CONCLUIDO`, o backend sincroniza trocas automáticas no app `credits`.
- Cada integrante vinculado recebe uma entrada de troca com:
  - `origin = AGENDA`
  - `entry_type = CREDITO`
  - `value_cents = duty.remuneration_cents`
- Se a agenda sair de `CONCLUIDO`, mudar integrantes ou mudar a função/remuneração, os lançamentos automáticos são ressincronizados.
- A sincronização é idempotente: salvar repetidamente não duplica créditos.

## Campos principais do retorno
- `members`: lista de objetos `{id, full_name}`
- `duty_name`
- `status`
- `notes`
- `created_at`
- `updated_at`
