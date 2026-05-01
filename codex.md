# Codex Project Notes

## Visão Geral da Arquitetura

O `coletivo_system` é uma aplicação web para gestão operacional do almoço coletivo. A arquitetura é separada em:

- `frontend`: SPA React/Vite servida por Nginx em produção.
- `backend`: API Django REST Framework com autenticação via JWT em cookies HTTP, proteção CSRF e regras de domínio.
- `db`: PostgreSQL em ambiente Docker de desenvolvimento/produção quando `POSTGRES_DB` está definido; SQLite é fallback local sem variáveis de Postgres.

O frontend consome a API por Axios com `withCredentials`, envia `X-CSRFToken` em métodos inseguros e tenta renovar token automaticamente em respostas `401`.

O backend concentra regras de negócio nos serializers, services e models. Integrações automáticas importantes:

- Almoço pago em dinheiro/pix/cartão sincroniza lançamento financeiro.
- Almoço pago por troca sincroniza débito em créditos.
- Registro de agenda concluído sincroniza crédito de equipe.
- Pacote pago sincroniza entrada financeira.
- Exclusões protegidas por FK retornam `409 Conflict` com `detail` legível.

## Stack Tecnológico Completo

Backend:

- Python `>=3.12,<3.13`
- Django `>=5.2.8,<6.0.0`
- Django REST Framework `>=3.16.1,<4.0.0`
- SimpleJWT / `djangorestframework-simplejwt`
- `django-cors-headers`
- `django-filter`
- `psycopg2-binary`
- `phonenumbers`
- `gunicorn`
- `openpyxl`
- Testes: `pytest`, `pytest-django`, `factory-boy`
- Qualidade: `black`, `isort`, `ruff`

Frontend:

- React `18.2`
- TypeScript `5.2`
- Vite `5`
- Mantine `8.3`
- React Router `7.9`
- TanStack Query `5.90`
- Axios
- FullCalendar
- Recharts
- Tabler Icons
- Tailwind/PostCSS
- ESLint/Prettier

Infra:

- Docker Compose
- Backend container Python/Gunicorn
- Frontend container Nginx
- PostgreSQL em desenvolvimento via `docker-compose.dev.yml`

## Variáveis de Ambiente

Backend desenvolvimento (`backend/.env.dev`):

```env
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=dev-secret-key-change-me
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

POSTGRES_DB=coletivo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=db
POSTGRES_PORT=5432

CORS_ALLOW_ALL_ORIGINS=True
CSRF_TRUSTED_ORIGINS=http://localhost:8001,http://localhost:5173

AUTH_COOKIE_SECURE=False
AUTH_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=False
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SECURE=False
CSRF_COOKIE_SAMESITE=Lax

SECURE_SSL_REDIRECT=False
SECURE_HSTS_SECONDS=0
```

Backend produção (`backend/.env.prod`, baseado no example):

```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=troque-esta-chave
DJANGO_ALLOWED_HOSTS=sistemacoletivo.com.br,www.sistemacoletivo.com.br,api.sistemacoletivo.com.br
CSRF_TRUSTED_ORIGINS=https://sistemacoletivo.com.br,https://www.sistemacoletivo.com.br,https://api.sistemacoletivo.com.br
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://sistemacoletivo.com.br,https://www.sistemacoletivo.com.br

POSTGRES_DB=coletivo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=troque-esta-senha
POSTGRES_HOST=host-do-postgres
POSTGRES_PORT=5432

AUTH_COOKIE_SECURE=True
AUTH_COOKIE_SAMESITE=None
AUTH_COOKIE_DOMAIN=.sistemacoletivo.com.br
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_SAMESITE=None
CSRF_COOKIE_SECURE=True
CSRF_COOKIE_SAMESITE=None
CSRF_COOKIE_DOMAIN=.sistemacoletivo.com.br

SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
SECURE_REFERRER_POLICY=same-origin
X_FRAME_OPTIONS=DENY

DRF_THROTTLE_ANON=60/min
DRF_THROTTLE_USER=600/min
DRF_THROTTLE_PUBLIC_REGISTRATION=10/min
DRF_THROTTLE_AUTH_LOGIN=10/min
DRF_THROTTLE_AUTH_REFRESH=30/min
DJANGO_AUTH_LOG_LEVEL=INFO

GUNICORN_WORKERS=4
GUNICORN_TIMEOUT=30
GUNICORN_GRACEFUL_TIMEOUT=30
```

Frontend:

```env
VITE_API_BASE_URL=https://api.sistemacoletivo.com.br
```

Se `VITE_API_BASE_URL` não for definido, o frontend usa `https://api.sistemacoletivo.com.br`.

## Estrutura do Diretório de Conteúdo

Construa diretórios por domínio funcional. Cada app Django deve manter sua própria superfície de domínio: `models.py`, `serializers.py`, `views.py`, `urls.py`, `tests/` e, quando necessário, `services.py`.

No frontend, mantenha páginas e APIs por feature em `frontend/src/features/<dominio>/`, componentes reutilizáveis em `frontend/src/components/`, helpers compartilhados em `frontend/src/shared/` e estado global em `frontend/src/context/`.

Estrutura geral:

```text
backend/
  apps/
    agenda/
    authentication/
    common/
    credits/
    dashboard/
    duties/
    financial/
    lunch/
    users/
  config/
frontend/
  src/
    components/
    context/
    features/
    shared/
```

## Serviços, Jobs e Models por App

### `authentication`

Models:

- Sem models de domínio.

Serviços/Views:

- Login com cookies JWT.
- Refresh token por cookie.
- Logout com limpeza de cookies.
- Endpoint de status de autenticação.
- Endpoint para definir cookie CSRF.

Jobs:

- Nenhum job assíncrono configurado.

### `users`

Models:

- `Member`: integrante adulto/criança, responsável, contato, categoria, dieta e observações.
- `PublicRegistration`: cadastro público pendente/aprovado/rejeitado.
- `PublicRegistrationChild`: crianças vinculadas a cadastro público.

Serviços/Views:

- CRUD de integrantes.
- Submissão pública de cadastro.
- Aprovação/rejeição administrativa de cadastros.
- Metadados públicos para opções de categoria e dieta.

Jobs:

- Nenhum job assíncrono configurado.

### `lunch`

Models:

- `Package`: pacote de refeições, quantidade, saldo, validade, pagamento e status.
- `Lunch`: almoço avulso ou via pacote, integrante, valor, data, pagamento e conta de troca.

Serviços/Views:

- CRUD de almoços.
- CRUD de pacotes.
- Resumo e exportação de almoços.
- Exportação de pacotes.
- Incremento/decremento de saldo de pacote.
- Sincronização financeira e de créditos via serializers/services relacionados.

Jobs:

- Nenhum job assíncrono configurado.

### `duties`

Models:

- `Duty`: função de equipe, remuneração em centavos e integrantes vinculados.

Serviços/Views:

- CRUD de funções.
- Exportação de funções.

Jobs:

- Nenhum job assíncrono configurado.

### `agenda`

Models:

- `AgendaEntry`: data, horário, função, integrantes, status e notas.

Serviços/Views:

- CRUD de agenda.
- Exportação.
- Validação de horário final posterior ao início.
- Ao concluir registros, sincroniza créditos automáticos de equipe via `credits.services`.

Jobs:

- Nenhum job assíncrono configurado.

### `financial`

Models:

- `FinancialEntry`: entrada/saída, categoria, descrição, valor, data e vínculo opcional com almoço/pacote.

Serviços/Views:

- CRUD de lançamentos financeiros.
- Resumo financeiro.
- Exportação.
- Validação de compatibilidade entre tipo e categoria.

Jobs:

- Nenhum job assíncrono configurado.

### `credits`

Models:

- `CreditEntry`: crédito/débito de troca, origem, dono, beneficiário, valor, descrição e vínculos opcionais com agenda/almoço.

Serviços:

- `get_credit_summary`
- `get_credit_balance`
- `lock_members`
- `can_use_credit_advance`
- `ensure_credit_balance`
- `sync_agenda_credit_entries`
- `sync_lunch_credit_entry`
- `create_manual_credit_entry`

Views:

- Histórico de créditos.
- Resumo por integrante.
- Criação manual de crédito.
- Criação manual de débito.

Jobs:

- Nenhum job assíncrono configurado.

### `dashboard`

Models:

- Sem models de domínio.

Serviços/Views:

- Resumo consolidado para dashboard.

Jobs:

- Nenhum job assíncrono configurado.

### `common`

Models:

- Sem models de domínio.

Serviços/utilitários:

- Exportação XLSX.
- Paginação.
- Permissões.
- Papéis/categorias.
- Limites de texto.
- Validadores.
- Exception handler global.

Jobs:

- Nenhum job assíncrono configurado.

## Common Hurdles

### CSRF em produção com `www`

Sintoma:

```json
{"detail": "CSRF Failed: Origin checking failed"}
```

Solução:

- Incluir todos os origins usados em `CSRF_TRUSTED_ORIGINS`.
- Incluir apex e `www` quando ambos forem acessíveis.
- Conferir `CORS_ALLOWED_ORIGINS`.
- Reiniciar o backend após alterar `.env.prod`.

### Erro ao excluir registro vinculado

Sintoma:

- `ProtectedError`
- Pacote usado por almoço.
- Integrante usado por registros históricos.

Solução:

- O backend retorna `409 Conflict` via `apps.common.exceptions.custom_exception_handler`.
- O frontend deve mostrar `detail` usando `extractErrorMessage`.
- Para entidades históricas, avaliar inativação em vez de exclusão física.

### Select do Mantine limpa valor ao clicar na opção selecionada

Sintoma:

- Campo obrigatório volta para default ao clicar na opção já selecionada.

Solução:

```tsx
<Select allowDeselect={false} ... />
```

Usar em selects obrigatórios. Não usar em filtros `clearable`.

### Scroll pequeno em células de ação

Sintoma:

- Clique em ação cria scroll horizontal dentro da linha.

Solução:

- Evitar `overflow-x: auto` dentro de `Table.Td`.
- Usar `Group gap="xs" justify="flex-end" wrap="nowrap"`.

### Build frontend com aviso de chunk grande

Sintoma:

- Vite avisa que chunks têm mais de 500 kB.

Solução:

- Não é erro.
- Avaliar lazy loading de rotas e code splitting se o carregamento inicial ficar pesado.

### Cookies em produção

Sintoma:

- Login funciona em um domínio, mas falha em outro subdomínio.

Solução:

- Conferir `AUTH_COOKIE_DOMAIN=.sistemacoletivo.com.br`.
- Conferir `CSRF_COOKIE_DOMAIN=.sistemacoletivo.com.br`.
- Conferir `AUTH_COOKIE_SAMESITE=None` e cookies `Secure=True` em HTTPS.

## Design Patterns do Projeto

Backend:

- Apps Django por domínio.
- `ModelViewSet` para CRUD padrão.
- `APIView` para endpoints agregados ou comandos de domínio.
- Serializers com validação e sincronização de efeitos colaterais quando vinculados à persistência.
- Services para regras multi-model e idempotentes, especialmente em `credits`.
- Factories por app em `tests/factories.py`.
- Testes de regressão para bugs.
- `transaction.atomic` em operações com múltiplas escritas relacionadas.
- Exceções comuns tratadas globalmente em `apps.common.exceptions`.

Frontend:

- Features por domínio em `frontend/src/features`.
- Arquivos `api.ts` por feature para encapsular chamadas HTTP.
- TanStack Query para cache e invalidação.
- Mantine para UI.
- Componentes compartilhados em `components`.
- Helpers compartilhados em `shared`.
- Formulários controlados por estado local nas páginas.
- Confirmações destrutivas via `ConfirmDeleteModal`.
- Selects obrigatórios com `allowDeselect={false}`.
- Filtros com `clearable` e estado separado.

## Pipeline Semanal Completo com Horários

Não há cron, Celery, GitHub Actions ou pipeline agendado configurado no repositório. A rotina abaixo é operacional recomendada para manter o projeto saudável.

Segunda-feira:

- 09:00: revisar bugs reportados e priorizar backlog semanal.
- 10:00: rodar suíte backend completa: `backend/.venv/Scripts/python.exe -m pytest` no Windows ou `python -m pytest` no ambiente Linux.
- 11:00: revisar erros de produção e problemas de autenticação/CSRF.

Terça-feira:

- 09:00: implementar features pequenas com teste de backend primeiro quando envolver regra de domínio.
- 16:00: rodar `npm run build` no frontend.

Quarta-feira:

- 09:00: revisão de dados financeiros/créditos/pacotes.
- 14:00: revisar integrações automáticas: agenda concluída, almoço pago, almoço por troca e pacote pago.

Quinta-feira:

- 09:00: hardening e refatorações pequenas.
- 15:00: rodar testes backend e build frontend.

Sexta-feira:

- 09:00: revisar envs de produção, backups e deploy pendente.
- 11:00: smoke test manual: login, dashboard, integrantes, almoço, pacote, financeiro, agenda e trocas.
- 16:00: registrar pendências para a próxima semana.

## Checklist Pós-Implementação

- Confirmar que a mudança está limitada ao domínio necessário.
- Rodar testes backend afetados.
- Rodar suíte backend completa quando tocar regra compartilhada.
- Rodar `npm run build` quando tocar frontend.
- Verificar mensagens de erro vindas da API.
- Conferir invalidações de TanStack Query após mutations.
- Conferir CSRF/cookies se a mudança envolver autenticação ou deploy.
- Testar fluxo feliz e fluxo de erro.
- Para exclusões, confirmar modal e tratamento de `409 Conflict`.
- Para campos `Select`, decidir se deve ter `clearable` ou `allowDeselect={false}`.
- Para valores monetários, armazenar centavos no backend e formatar reais no frontend.
- Para datas, evitar shift de timezone usando data local quando aplicável.
- Atualizar documentação quando criar env var, endpoint, regra de domínio ou app novo.
