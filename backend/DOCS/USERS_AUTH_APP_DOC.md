# Usuários e Autenticação

Base local: `http://localhost:8001`

## Visão geral
- A API usa autenticação JWT por cookie HttpOnly como padrão do frontend.
- Também é possível usar JWT por header `Authorization: Bearer <token>` para testes manuais.
- Rotas administrativas de membros e revisão de cadastros públicos exigem superusuário.
- Rotas públicas de inscrição não exigem autenticação.

## Autenticação

### Fluxo por cookie HttpOnly
- Login com cookie: `POST /api/auth/cookie/token/`
  ```json
  {
    "username": "admin",
    "password": "sua-senha"
  }
  ```
- Refresh com cookie: `POST /api/auth/cookie/token/refresh/`
  - Pode ser chamado sem body se o cookie `refresh_token` já existir.
- Logout: `POST /api/auth/logout/`
- Status da sessão atual: `GET /api/auth/status/`

### Fluxo por Bearer token
- Obter token: `POST /api/auth/token/`
- Renovar token: `POST /api/auth/token/refresh/`
- Enviar `Authorization: Bearer <access_token>` nas rotas protegidas.

## Permissões
- `GET /api/users/health/` é público.
- `POST /api/users/public-registrations/` é público e sofre throttle anônimo.
- `GET /api/users/public-registrations/meta/` é público.
- CRUD de membros exige `SuperuserOnly`.
- Revisão administrativa de inscrições públicas exige `SuperuserOnly`.

## Endpoints de membros
- Health: `GET /api/users/health/`
- CRUD: `/api/users/members/`
  - Listar: `GET /api/users/members/`
  - Criar: `POST /api/users/members/`
  - Detalhar: `GET /api/users/members/{id}/`
  - Atualizar parcial: `PATCH /api/users/members/{id}/`
  - Remover: `DELETE /api/users/members/{id}/`
  - Exportar XLSX: `GET /api/users/members/export/`

### Paginação de membros
- O endpoint de membros usa paginação opcional.
- Sem `page`, retorna a lista completa.
- Com `page`, retorna resposta paginada:
  - `GET /api/users/members/?page=1&page_size=15`

### Filtros de membros
- `search`: busca por nome
- `role`: `SUSTENTADOR | MENSALISTA | AVULSO`
- `diet`: `VEGANO | VEGETARIANO | CARNIVORO`

Exemplo:
`GET /api/users/members/?search=ana&role=MENSALISTA`

### Payload de membro adulto
```json
{
  "full_name": "Ana Pereira",
  "is_child": false,
  "phone": "+5511988887777",
  "email": "ana.pereira@example.com",
  "address": "Rua das Flores, 123, São Paulo - SP",
  "heard_about": "Indicação de amigos",
  "role": "MENSALISTA",
  "diet": "VEGETARIANO",
  "observations": "Prefere chegar às 12h30."
}
```

### Payload de membro criança
```json
{
  "full_name": "Pedro Pereira",
  "is_child": true,
  "responsible": 1,
  "diet": "CARNIVORO",
  "observations": "Almoça com a mãe."
}
```

### Regras principais de membro
- `full_name`: mínimo de 3 caracteres.
- `email`: único, case-insensitive.
- `phone`: normalizado para E.164.
- `diet`: obrigatório.
- Se `is_child=true`, `responsible` é obrigatório.
- Crianças não mantêm `email`, `phone`, `role` ou `heard_about`.

## Cadastros públicos

### Endpoints públicos
- Enviar inscrição: `POST /api/users/public-registrations/`
- Metadados do formulário: `GET /api/users/public-registrations/meta/`

### Endpoints administrativos
- Listar inscrições: `GET /api/users/public-registrations-admin/`
- Detalhar inscrição: `GET /api/users/public-registrations-admin/{id}/`
- Aprovar: `POST /api/users/public-registrations-admin/{id}/approve/`
- Rejeitar: `POST /api/users/public-registrations-admin/{id}/reject/`

### Payload público
```json
{
  "full_name": "Carlos Lima",
  "phone": "+5521999990000",
  "email": "carlos.lima@example.com",
  "address": "Rua A, 42 - Rio de Janeiro/RJ",
  "heard_about": "Indicação de amigos",
  "role": "AVULSO",
  "diet": "CARNIVORO",
  "observations": "Posso ajudar quando necessário.",
  "children": [
    {
      "full_name": "Ana Lima",
      "diet": "VEGETARIANO",
      "observations": "Não consome leite."
    }
  ]
}
```

### Filtros administrativos de inscrições
- `status`: `PENDENTE | APROVADO | REJEITADO`
- `search`: busca por nome ou e-mail

Exemplo:
`GET /api/users/public-registrations-admin/?status=PENDENTE&search=carlos`

### Aprovação e rejeição
- Aprovar cria:
  - 1 membro adulto
  - 0..N membros criança com `responsible` apontando para o adulto criado
- Rejeitar muda o status para `REJEITADO` e aceita `review_notes`

Payload de rejeição:
```json
{
  "review_notes": "Cadastro incompleto para aprovação neste momento."
}
```

### Regras principais das inscrições públicas
- `role` e `diet` do adulto são obrigatórios.
- `diet` é obrigatório para cada criança.
- `email`, quando informado, não pode conflitar com membro existente.
- Também não pode conflitar com outra inscrição pendente.
- A inscrição sempre nasce como `PENDENTE`.
