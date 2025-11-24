# Usuários e Autenticação

Base local: `http://localhost:8001`

## Autenticação (JWT)
- Obter token: `POST /api/auth/token/`
  ```json
  {"username": "admin", "password": "sua-senha"}
  ```
- Renovar token: `POST /api/auth/token/refresh/`
  ```json
  {"refresh": "<refresh_token>"}
  ```
- Enviar `Authorization: Bearer <access_token>` em todas as rotas protegidas.

## Permissões
- Apenas superusuários podem criar, listar, atualizar ou remover membros.
- Health check é público.

## Endpoints de Usuários
- Health: `GET /api/users/health/` → `{"status": "ok", "service": "users"}`
- CRUD de membros: `/api/users/members/`
  - Listar: `GET /api/users/members/`
  - Criar: `POST /api/users/members/`
  - Detalhar: `GET /api/users/members/{id}/`
  - Atualizar parcial: `PATCH /api/users/members/{id}/`
  - Remover: `DELETE /api/users/members/{id}/`

### Payload de criação/atualização de membro
```json
{
  "full_name": "Ana Pereira",
  "phone": "+55 11988887777",
  "email": "ana.pereira@example.com",
  "address": "Rua das Flores, 123, São Paulo - SP",
  "heard_about": "Indicação de amigos",
  "role": "MENSALISTA",      // SUSTENTADOR | MENSALISTA | AVULSO
  "diet": "VEGETARIANO",     // VEGANO | VEGETARIANO | CARNIVORO
  "observations": "Prefere chegar às 12h30."
}
```

### Regras de validação principais
- `full_name`: mínimo 3 caracteres.
- `email`: único (case-insensitive) e válido.
- `phone`: dígitos e `+ ( ) - .` ou espaços (máx. 20).
- `role` e `diet`: obrigatórios.

## Fluxo recomendado para testar via Thunder/Insomnia/Postman
1) Obtenha o access token em `/api/auth/token/`.
2) Envie o header `Authorization: Bearer <access_token>`.
3) Crie um membro com o payload acima em `POST /api/users/members/`.
4) Liste em `GET /api/users/members/` ou detalhe em `GET /api/users/members/{id}/`.
