# Coletivo System

Sistema open source para administrar a operação de um almoço coletivo: integrantes, cadastro
público, funções, agenda, almoços, pacotes, banco de trocas e fluxo financeiro.

## Arquitetura

- **Frontend:** React 18, TypeScript, Vite, Mantine e TanStack Query.
- **Backend:** Python 3.12, Django 5, Django REST Framework e JWT em cookies HttpOnly.
- **Banco:** PostgreSQL 16 no Docker; SQLite como fallback local.
- **Produção:** frontend em Nginx e backend em gunicorn.
- **Backup:** `pg_dump` compactado e enviado por rclone.

Mais detalhes sobre regras de negócio e decisões técnicas estão em [codex.md](codex.md). A
documentação dos endpoints por domínio fica em [backend/DOCS](backend/DOCS).

## Pré-requisitos

Para o fluxo recomendado:

- Docker Desktop com Docker Compose;
- Git.

Para executar sem Docker:

- Python 3.12;
- Poetry 2;
- Node.js 20.19 ou superior;
- npm.

## Início rápido com Docker

1. Crie o arquivo de ambiente de desenvolvimento:

   ```powershell
   Copy-Item backend/.env.dev.example backend/.env.dev
   ```

   Em Linux/macOS:

   ```bash
   cp backend/.env.dev.example backend/.env.dev
   ```

2. Suba banco, API e frontend:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

3. Crie o primeiro administrador:

   ```bash
   docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
   ```

Serviços:

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:4173 |
| API | http://localhost:8001/api/ |
| Django Admin | http://localhost:8001/admin/ |
| PostgreSQL | localhost:5433 |

Para encerrar:

```bash
docker compose -f docker-compose.dev.yml down
```

Use `down -v` apenas quando quiser apagar também o volume local do PostgreSQL.

## Desenvolvimento sem Docker

### Backend

O backend usa SQLite quando `POSTGRES_DB` não está definido.

```bash
cd backend
poetry install
poetry run python manage.py migrate
poetry run python manage.py createsuperuser
poetry run python manage.py runserver
```

A API ficará em http://localhost:8000. Para usar PostgreSQL fora do Docker, exporte as variáveis
`POSTGRES_*` antes de iniciar o Django.

### Frontend

Crie `frontend/.env.local` se a API não estiver no endereço de produção padrão:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Depois:

```bash
cd frontend
npm ci
npm run dev
```

O Vite informará a URL local, normalmente http://localhost:5173.

## Qualidade e testes

Backend:

```bash
cd backend
poetry run pytest
poetry run ruff check .
poetry run black --check .
poetry run isort --check-only .
```

Pelo Docker:

```bash
docker compose -f docker-compose.dev.yml run --rm backend pytest
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run format
npm run build
```

## Variáveis de ambiente

Arquivos de referência versionados:

- `backend/.env.dev.example`: desenvolvimento;
- `backend/.env.prod.example`: backend de produção;
- `frontend/.env.production.example`: URL da API no build do frontend;
- `backup/.env.backup.example`: banco, retenção e credenciais rclone.

Os arquivos reais `.env.dev`, `.env.prod`, `.env.production` e `.env.backup` são ignorados pelo
Git e não devem conter valores de exemplo em produção.

## Produção

O compose de produção espera um PostgreSQL acessível pelo host definido em `backend/.env.prod`:

```bash
docker compose up --build -d
docker compose exec backend python manage.py createsuperuser
```

Portas padrão:

- frontend: `3000`;
- backend: `8000`.

O frontend precisa ser construído com `VITE_API_BASE_URL` apontando para a API pública. O backend
em produção exige chave secreta própria, CORS restrito, cookies seguros e HTTPS. Consulte
`backend/.env.prod.example`.

## Backup

Crie `backup/.env.backup` a partir do exemplo e configure uma conexão rclone por conteúdo ou em
base64. Depois:

```bash
docker compose -f docker-compose.backup.yml up --build -d
docker compose -f docker-compose.backup.yml logs -f backup
```

Por padrão, o container executa um backup ao iniciar, repete a operação a cada 24 horas e remove
arquivos remotos com mais de 30 dias. Os parâmetros podem ser alterados no env.

Teste uma única execução antes de habilitar o loop:

```env
BACKUP_MODE=once
```

## Estrutura do repositório

```text
backend/                 API e regras de domínio
  apps/                  apps Django por domínio
  config/                settings, URLs, ASGI e WSGI
  DOCS/                  contratos e regras por app
frontend/                SPA React
  src/features/          páginas e APIs por domínio
  src/components/        componentes compartilhados
  src/shared/            cliente HTTP, tema e helpers
backup/                  imagem e scripts de backup
docker-compose.dev.yml   ambiente de desenvolvimento
docker-compose.yml       serviços de produção
docker-compose.backup.yml serviço de backup
```

## Segurança operacional

- Toda a área administrativa exige autenticação e, atualmente, superusuário.
- Não exponha PostgreSQL diretamente na internet.
- Restrinja `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` aos domínios usados.
- Preserve os atributos `Secure`, domínio e `SameSite` dos cookies em produção.
- Teste regularmente a restauração dos backups; a existência do arquivo não garante que ele seja
  restaurável.

## Licença

MIT.
