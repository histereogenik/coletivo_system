# Agenda

Base local: `http://localhost:8001`

## Permissões
- Apenas superusuários podem criar/listar/atualizar/remover entradas de agenda.

## Endpoints
- CRUD: `/api/agenda/entries/`
  - Listar: `GET /api/agenda/entries/`
  - Criar: `POST /api/agenda/entries/`
  - Detalhar: `GET /api/agenda/entries/{id}/`
  - Atualizar parcial: `PATCH /api/agenda/entries/{id}/`
  - Remover: `DELETE /api/agenda/entries/{id}/`

## Payloads

### Criar entrada (agendamento)
```json
{
  "date": "2025-12-02",
  "start_time": "09:00",
  "end_time": "10:00",
  "duty": 3,
  "member_ids": [5, 3],
  "status": "PLANEJADO",
  "notes": "Cobertura de manhã."
}
```
- `members_input` é um alias de `member_ids`, se preferir.
- Resposta inclui `members` como objetos `{id, full_name}` e `duty_name`.

### Filtros (GET)
- Por data exata: `/api/agenda/entries/?date=2025-12-02`
- Por intervalo: `/api/agenda/entries/?date_range_after=2025-12-01&date_range_before=2025-12-10`
- Por duty: `/api/agenda/entries/?duty=3`
- Por membro: `/api/agenda/entries/?member=5`
- Por status: `/api/agenda/entries/?status=PLANEJADO`

## Regras de negócio e validação
- `start_time` < `end_time` (se `end_time` informado).
- IDs de membros inexistentes → erro em `member_ids_invalid`.
- Membros não precisam estar previamente no duty: ao agendar, eles são associados ao duty e promovidos a `SUSTENTADOR`.
- Conflitos de horário: o mesmo membro não pode ter dois agendamentos sobrepostos na mesma data. Em caso de conflito, retorna:
  - `member_ids`: "Conflito de horário..."
  - `member_conflicts`: lista de objetos `{member, agenda_entry}` para tratar no frontend.

## Modelos (referência)
- `AgendaEntry`: `date`, `start_time`, `end_time` (opcional), `duty` (FK), `members` (M2M), `status` (`PLANEJADO|CONCLUIDO|CANCELADO`), `notes`.

