# Codex Project Notes

## Estado do documento

Este arquivo descreve o estado atual do `coletivo_system`. Ele deve ser atualizado sempre que
uma regra de domínio, endpoint, variável de ambiente, serviço de infraestrutura ou fluxo de
autenticação mudar. A implementação e as migrations continuam sendo a fonte de verdade.

## Regras de colaboração e Git

- Nunca executar `git commit`, `git commit --amend`, merge, rebase, criação de tag ou push sem
  uma aprovação explícita e imediata do usuário para aquela operação e para o conjunto exato de
  mudanças envolvido.
- Uma autorização anterior para criar commits não se estende automaticamente a mudanças feitas
  depois dela, mesmo que pertençam à mesma tarefa ou branch.
- Depois de implementar uma mudança, apresentar ao usuário o resumo, os arquivos alterados, as
  validações executadas e o diff relevante. Aguardar a revisão e uma nova autorização antes de
  criar o commit.
- Se houver dúvida sobre o alcance da autorização, considerar que o commit não está autorizado.

## Visão geral

O `coletivo_system` é uma aplicação web para administrar um almoço coletivo. O produto possui
uma área pública para apresentação e cadastro de interessados e um painel administrativo para
gerenciar integrantes, agenda, funções, almoços, pacotes, financeiro e banco de trocas.

A arquitetura é dividida em:

- `frontend`: SPA React/Vite, servida por Nginx em produção;
- `backend`: API Django REST Framework;
- `db`: PostgreSQL nos ambientes Docker e SQLite como fallback local quando `POSTGRES_DB` não
  está definido;
- `backup`: container que executa `pg_dump`, compacta o resultado e envia o arquivo com rclone.

Não há Celery, fila, cron interno ou GitHub Actions. O único processamento periódico incluído no
repositório é o loop do container de backup.

## Stack

### Backend

- Python `>=3.12,<3.13`
- Django `>=5.2.8,<6.0.0`
- Django REST Framework e django-filter
- SimpleJWT com autenticação por cookies HttpOnly
- django-cors-headers
- PostgreSQL/psycopg2 e fallback SQLite
- gunicorn
- phonenumbers e openpyxl
- pytest, pytest-django e factory-boy
- black, isort e ruff

### Frontend

- React 18 e TypeScript 5
- Vite 8
- React Router 7
- Mantine 8
- TanStack Query 5 e Axios
- React Hook Form, Zod e Day.js
- FullCalendar, Recharts e Tabler Icons
- Tailwind/PostCSS
- ESLint 9 e Prettier

### Infraestrutura

- Docker Compose
- Nginx para a SPA
- gunicorn para a API
- PostgreSQL 16 no compose de desenvolvimento
- pg_dump, gzip e rclone no serviço de backup

## Estrutura

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
    fiscal/
    lunch/
    users/
  config/
  DOCS/
backup/
frontend/
  src/
    components/
    context/
    features/
    shared/
```

Cada app Django mantém models, serializers, views, URLs e testes do seu domínio. Regras que
envolvem vários models ou precisam ser idempotentes ficam em services. No frontend, páginas e
clientes HTTP são organizados por feature, componentes reutilizáveis ficam em `components` e
helpers compartilhados em `shared`.

## Superfície do produto

### Rotas públicas do frontend

- `/`: landing page;
- `/cadastro`: formulário público de cadastro;
- `/login`: autenticação administrativa.

### Rotas autenticadas do frontend

- `/painel`: dashboard;
- `/painel/agenda`;
- `/painel/financeiro`;
- `/painel/notas-fiscais`;
- `/painel/creditos`;
- `/painel/almocos`;
- `/painel/pacotes`;
- `/painel/integrantes`;
- `/painel/funcoes`.
- `/painel/contas` (somente superusuário);
- `/painel/auditoria` (somente superusuário).

Rotas antigas sem o prefixo `/painel` redirecionam para as rotas atuais preservando a query
string.

## Autenticação e permissões

O backend grava access e refresh JWT em cookies HttpOnly. O frontend usa Axios com
`withCredentials`, envia `X-CSRFToken` em métodos inseguros e tenta renovar a sessão após `401`.
Os endpoints de login, refresh e logout também exigem CSRF.

Endpoints de autenticação:

- `GET /api/auth/csrf/`;
- `POST /api/auth/cookie/token/`;
- `POST /api/auth/cookie/token/refresh/`;
- `POST /api/auth/logout/`;
- `GET /api/auth/status/`.

O cadastro público e seus metadados aceitam acesso anônimo. Cada operador possui uma conta Django
individual e recebe capacidades independentes para almoços, pacotes, financeiro, notas fiscais,
trocas/créditos, agenda, integrantes e funções. Dashboard, gestão de contas e auditoria são
exclusivos do superusuário. A API valida todas as permissões; o frontend apenas reflete as
capacidades para navegação. A arquitetura e a matriz estão em
`backend/DOCS/PERMISSIONS_STRATEGY.md`.

## Apps e regras de domínio

### `users`

Models:

- `Member`: adulto ou criança, responsável, contatos, papel, dieta e observações;
- `PublicRegistration`: solicitação pública pendente, aprovada ou rejeitada;
- `PublicRegistrationChild`: crianças incluídas em uma solicitação pública.

Responsabilidades:

- CRUD, filtros, paginação e exportação de integrantes;
- submissão pública com throttling;
- aprovação e rejeição administrativa;
- metadados públicos de papéis e dietas.

### `lunch`

Models:

- `Lunch`: almoço avulso, por troca ou consumido de pacote;
- `Package`: compra de refeições com quantidade, saldo, validade, pagamento e status calculado;
- `PackageEntry`: histórico de créditos e débitos de um pacote, manuais ou originados por almoço.

Regras principais:

- pacote válido passa a `ESGOTADO` quando o saldo chega a zero e a `EXPIRADO` após a validade;
- almoço com pacote reduz o saldo e cria um `PackageEntry` de débito;
- troca de pacote ou exclusão do almoço restaura o saldo anterior de forma transacional;
- ajustes manuais criam histórico com autor e descrição;
- um consumo pode registrar beneficiário diferente do titular do pacote;
- almoço ou pacote promove o integrante, quando necessário, para `MENSALISTA`;
- almoço pago sem pacote e sem troca sincroniza uma entrada financeira;
- almoço pago por troca sincroniza um débito de crédito e não gera entrada financeira;
- pacote marcado como pago e com valor positivo sincroniza uma entrada financeira.

### `duties`

Model `Duty`: função, remuneração em centavos e integrantes relacionados. Oferece CRUD e
exportação. A atribuição pode promover integrantes segundo a regra de prioridade de papéis.

### `agenda`

Model `AgendaEntry`: data, início, término, função, integrantes, status e notas.

- término, quando informado, deve ser posterior ao início;
- registros concluídos sincronizam créditos de equipe pelo valor da função;
- alterações de status, função ou integrantes reconciliam os créditos existentes;
- oferece filtros, CRUD e exportação.

### `financial`

Model `FinancialEntry`: entrada ou saída, categoria, descrição, valor, data e vínculo opcional com
almoço ou pacote.

- entradas aceitam `ALMOCO` e `DOACAO`;
- saídas aceitam `NOTA`, `STAFF`, `DESPESA` e `ESTORNO`;
- lançamentos incompatíveis entre tipo e categoria são rejeitados;
- oferece CRUD, filtros, resumo e exportação.

### `fiscal`

Model `FiscalDocument`: registra NF-e/NFC-e, ambiente, origem (almoço ou pacote), snapshots da
operação, referência idempotente, situação na Focus/SEFAZ e URLs de XML/DANFE.

- emissão manual somente para almoço avulso pago ou pacote pago;
- CPF/consumidor não identificado gera NFC-e e CNPJ gera NF-e;
- primeira versão limitada a operações internas em Goiás com CFOP 5101;
- rejeições e payloads são preservados para auditoria;
- produção possui trava adicional por variável de ambiente;
- vendas antigas e regularização extemporânea não fazem parte do sistema.

Contrato e configuração: `backend/DOCS/FISCAL_APP_DOC.md`.

### `credits`

Model `CreditEntry`: crédito ou débito, origem, dono, beneficiário, valor, descrição e vínculos
opcionais com agenda ou almoço.

Services principais:

- `get_credit_summary` e `get_credit_balance`;
- `lock_members` e `ensure_credit_balance`;
- `can_use_credit_advance`;
- `sync_agenda_credit_entries`;
- `sync_lunch_credit_entry`;
- `create_manual_credit_entry`.

O app oferece extrato somente leitura, resumo individual ou agregado e criação manual de crédito
e débito. Operações de saldo usam transações e locks para evitar inconsistência concorrente.

### `dashboard`

Não possui models. Consolida saldo financeiro do mês, contagem de integrantes por papel,
estatísticas de almoços dos últimos 30 dias, pendências e almoços do dia.

### `common`

Reúne paginação, permissões, exportação XLSX, validações, limites de texto, datas, promoção de
papéis e o exception handler global. Exclusões bloqueadas por relações protegidas retornam
`409 Conflict` com uma mensagem legível.

O model `AuditEvent` mantém uma trilha append-only de criações, alterações, exclusões e ações
especiais, incluindo operador, origem, objeto, horário, alterações seguras, IP e identificador da
requisição. Os models principais registram `created_by` e `updated_by`; históricos anteriores à
migration permanecem com autoria desconhecida.

## Variáveis de ambiente

Use os arquivos versionados como referência:

- `backend/.env.dev.example` para desenvolvimento;
- `backend/.env.prod.example` para produção;
- `frontend/.env.production.example` para o build do frontend;
- `backup/.env.backup.example` para backups.

Nunca versione os arquivos `.env.*` reais. O frontend usa
`https://api.sistemacoletivo.com.br` quando `VITE_API_BASE_URL` não é definido.

Configurações sensíveis incluem chave Django, credenciais PostgreSQL, origins CORS/CSRF,
atributos de cookies, throttling e configuração rclone. Em produção, o backend falha cedo se a
chave padrão ou cookies inseguros forem usados.

## Execução e deploy

- `docker-compose.dev.yml`: backend em `8001`, PostgreSQL em `5433` e frontend Nginx em `4173`;
- `docker-compose.yml`: imagens de produção do backend em `8000` e frontend em `3000`; o banco é
  externo e configurado pelo env;
- `docker-compose.backup.yml`: serviço de backup independente.

O Dockerfile do backend executa migrations e `collectstatic` antes de iniciar o gunicorn. O
frontend é compilado em Node e copiado para uma imagem Nginx.

## Convenções e cuidados

- valores monetários são armazenados em centavos;
- operações multi-model devem usar `transaction.atomic`;
- integrações automáticas precisam ser idempotentes;
- datas de domínio devem evitar conversões indevidas de timezone;
- mutations do frontend devem invalidar as queries relacionadas;
- selects obrigatórios usam `allowDeselect={false}`; filtros podem ser `clearable`;
- erros da API devem ser exibidos com `extractErrorMessage`;
- exclusões destrutivas usam `ConfirmDeleteModal`;
- o histórico financeiro, de créditos e de pacotes deve ser preservado.

## Problemas operacionais conhecidos

### Compatibilidade do CSS gerado

O build define `cssTarget: "chrome61"` para evitar sintaxe CSS incompatível com navegadores ou
Android WebViews antigos. O cabeçalho também mantém uma cor sólida de fallback sob o degradê.

### Contas administrativas e auditoria

Contas operacionais não devem ser compartilhadas. O superusuário cria e desativa operadores,
seleciona suas áreas e conserva a própria conta para administração principal. Autoria e eventos
de auditoria dependem do uso correto dessas identidades individuais.

### CSRF entre apex, `www` e subdomínio da API

Todos os origins usados precisam estar em `CSRF_TRUSTED_ORIGINS`; o frontend também precisa estar
em `CORS_ALLOWED_ORIGINS`. Cookies compartilhados entre subdomínios exigem domínio, `Secure` e
`SameSite` coerentes.

### Exclusão de registros históricos

Relações com `PROTECT` retornam `409`. Para entidades já usadas historicamente, prefira
inativação quando a exclusão física não fizer sentido.

### Bundle do frontend

Mantenha páginas carregadas por rota com `React.lazy`. Bibliotecas pesadas como calendário e
gráficos não devem entrar no carregamento inicial da landing page.

## Checklist de mudança

- executar os testes backend afetados e, para regras compartilhadas, a suíte completa;
- executar lint e build do frontend;
- conferir migrations quando models mudarem;
- validar efeitos em financeiro, créditos e pacotes;
- testar autenticação, CSRF e renovação quando o fluxo de sessão mudar;
- conferir filtros, paginação e invalidações de cache;
- atualizar este arquivo, o README e a documentação do domínio quando o contrato mudar.
