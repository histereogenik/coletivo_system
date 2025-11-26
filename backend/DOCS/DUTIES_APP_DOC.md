# Funções (Duties)

Base local: `http://localhost:8001`

## Permissões
- Apenas superusuários podem criar/listar/atualizar/remover funções e atribuir membros.

## Endpoints
- CRUD: `/api/duties/duties/`
  - Listar: `GET /api/duties/duties/`
  - Criar: `POST /api/duties/duties/`
  - Detalhar: `GET /api/duties/duties/{id}/`
  - Atualizar parcial: `PATCH /api/duties/duties/{id}/`
  - Remover: `DELETE /api/duties/duties/{id}/`

## Payloads

### Criar função
```json
{
  "name": "Cozinha",
  "remuneration_cents": 0,
  "member_ids": [1, 2]
}
```
- Pode usar `members_input` (alias de `member_ids`) se preferir: `{"members_input": [1,2]}`
- Resposta inclui `members` como objetos `{id, full_name}`.

### Atualizar membros/remuneração
`PATCH /api/duties/duties/{id}/`
```json
{
  "remuneration_cents": 1500,
  "member_ids": [3, 4, 5]
}
```
ou
```json
{"members_input": [3, 4, 5]}
```

## Regras de validação
- `name`: mínimo 2 caracteres.
- `remuneration_cents`: não pode ser negativo (centavos).
- `member_ids`/`members_input`: lista de IDs de membros (pode ser vazia ou omitida).

## Regras de promoção de papel (role)
- Ao atribuir um membro a uma função, ele é promovido para `SUSTENTADOR` (prioridade máxima).
- A resposta sempre retorna os membros com nome para facilitar exibição no frontend.
