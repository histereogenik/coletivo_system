# Usuarios e Autenticacao

Base local: `http://localhost:8001`

## Visao geral
- A API usa autenticacao JWT por cookie HttpOnly como padrao do frontend.
- Rotas administrativas de membros e revisao de cadastros publicos exigem superusuario.
- Rotas publicas de inscricao nao exigem autenticacao.

## Autenticacao

### Fluxo por cookie HttpOnly
- Obter cookie CSRF: `GET /api/auth/csrf/`
- Login com cookie: `POST /api/auth/cookie/token/`
  ```json
  {
    "username": "admin",
    "password": "sua-senha"
  }
  ```
- Refresh com cookie: `POST /api/auth/cookie/token/refresh/`
  - Pode ser chamado sem body se o cookie `refresh_token` ja existir.
- Logout: `POST /api/auth/logout/`
- Status da sessao atual: `GET /api/auth/status/`
- No fluxo por cookie, `access_token` e `refresh_token` ficam apenas em cookies HttpOnly.
- As respostas de login e refresh retornam apenas mensagens de sucesso no JSON, sem expor tokens.

### Observacao sobre CSRF
- O fluxo por cookie exige header `X-CSRFToken` nas operacoes unsafe (`POST`, `PATCH`, `DELETE`).
- O frontend obtem o cookie `csrftoken` em `GET /api/auth/csrf/` e o envia automaticamente nas chamadas seguintes.

## Permissoes
- `POST /api/users/public-registrations/` e publico e sofre throttle anonimo.
- `GET /api/users/public-registrations/meta/` e publico.
- CRUD de membros exige `SuperuserOnly`.
- Revisao administrativa de inscricoes publicas exige `SuperuserOnly`.

## Endpoints de membros
- CRUD: `/api/users/members/`
  - Listar: `GET /api/users/members/`
  - Criar: `POST /api/users/members/`
  - Detalhar: `GET /api/users/members/{id}/`
  - Atualizar parcial: `PATCH /api/users/members/{id}/`
  - Remover: `DELETE /api/users/members/{id}/`
  - Exportar XLSX: `GET /api/users/members/export/`

### Paginacao de membros
- O endpoint de membros usa paginacao opcional.
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
  "address": "Rua das Flores, 123, Sao Paulo - SP",
  "heard_about": "Indicacao de amigos",
  "role": "MENSALISTA",
  "diet": "VEGETARIANO",
  "observations": "Prefere chegar as 12h30."
}
```

### Payload de membro crianca
```json
{
  "full_name": "Pedro Pereira",
  "is_child": true,
  "responsible": 1,
  "diet": "CARNIVORO",
  "observations": "Almoca com a mae."
}
```

### Regras principais de membro
- `full_name`: minimo de 3 caracteres.
- `email`: unico, case-insensitive.
- `phone`: normalizado para E.164.
- `diet`: obrigatorio.
- Se `is_child=true`, `responsible` e obrigatorio.
- Criancas nao mantem `email`, `phone`, `role` ou `heard_about`.

## Cadastros publicos

### Endpoints publicos
- Enviar inscricao: `POST /api/users/public-registrations/`
- Metadados do formulario: `GET /api/users/public-registrations/meta/`

### Endpoints administrativos
- Listar inscricoes: `GET /api/users/public-registrations-admin/`
- Detalhar inscricao: `GET /api/users/public-registrations-admin/{id}/`
- Aprovar: `POST /api/users/public-registrations-admin/{id}/approve/`
- Rejeitar: `POST /api/users/public-registrations-admin/{id}/reject/`

### Payload publico
```json
{
  "full_name": "Carlos Lima",
  "phone": "+5521999990000",
  "email": "carlos.lima@example.com",
  "address": "Rua A, 42 - Rio de Janeiro/RJ",
  "heard_about": "Indicacao de amigos",
  "role": "AVULSO",
  "diet": "CARNIVORO",
  "observations": "Posso ajudar quando necessario.",
  "children": [
    {
      "full_name": "Ana Lima",
      "diet": "VEGETARIANO",
      "observations": "Nao consome leite."
    }
  ]
}
```

### Filtros administrativos de inscricoes
- `status`: `PENDENTE | APROVADO | REJEITADO`
- `search`: busca por nome ou e-mail

Exemplo:
`GET /api/users/public-registrations-admin/?status=PENDENTE&search=carlos`

### Aprovacao e rejeicao
- Aprovar cria:
  - 1 membro adulto
  - 0..N membros crianca com `responsible` apontando para o adulto criado
- Rejeitar muda o status para `REJEITADO` e aceita `review_notes`

Payload de rejeicao:
```json
{
  "review_notes": "Cadastro incompleto para aprovacao neste momento."
}
```

### Regras principais das inscricoes publicas
- `role` e `diet` do adulto sao obrigatorios.
- `diet` e obrigatorio para cada crianca.
- `email`, quando informado, nao pode conflitar com membro existente.
- Tambem nao pode conflitar com outra inscricao pendente.
- A inscricao sempre nasce como `PENDENTE`.
