# Plano de correcoes da revisao de codigo

Este documento acompanha os achados da revisao do controle de acesso, autoria e
auditoria. Os itens devem ser resolvidos na ordem abaixo. Um item so pode ser
marcado como concluido depois que sua correcao e seus testes de regressao passarem.

## Estado

- [x] 1. Impedir exclusoes em cascata entre areas de permissao diferentes.
  - Um operador de integrantes nao pode apagar almocos ou pacotes ao excluir um integrante.
  - Um operador de funcoes nao pode apagar agenda ou creditos ao excluir uma funcao.
  - Um operador de agenda nao pode apagar creditos ao excluir uma entrada da agenda.
- [x] 2. Registrar autoria e auditoria dos efeitos colaterais de alteracoes.
  - Promocoes automaticas de categoria do integrante devem registrar o ator.
  - Consumo, estorno e troca de pacote devem atualizar autoria e gerar auditoria propria.
- [x] 3. Restringir endpoints auxiliares para nao expor dados completos de outras areas.
  - A area fiscal deve acessar apenas as origens minimas necessarias para emissao.
  - A area de almocos deve acessar apenas as opcoes/saldos de credito necessarios.
- [x] 4. Revogar refresh tokens no logout e apos mudancas de seguranca.
  - Ativar o blacklist do SimpleJWT e invalidar o refresh token no logout.
  - Invalidar sessoes anteriores apos troca de senha ou permissoes.
- [x] 5. Corrigir PATCH parcial de contas de operadores sem `capabilities`.
- [x] 6. Alinhar a paginacao da auditoria entre backend e frontend.
- [x] 7. Limpar o estado React de autenticacao quando a renovacao da sessao falhar.
- [x] 8. Evitar auditoria de criacao falsa em repeticoes idempotentes de emissao fiscal.
- [x] 9. Registrar explicitamente alteracoes de senha sem armazenar o segredo.
- [x] 10. Validar o IP de auditoria e confiar em proxy encaminhado apenas quando configurado.
- [x] 11. Integrar eventos relevantes de webhook fiscal a auditoria unificada.
- [x] 12. Corrigir fluxos de navegacao e login com usuario sem rota permitida.
  - Evitar loop entre login e painel para usuario sem capacidades.
  - Nao classificar falha ao carregar a sessao como credenciais invalidas.
  - Preservar o destino original depois do login.
- [x] 13. Completar a cobertura e as regras operacionais restantes.
  - Adicionar testes de frontend para guardas de rota e expiracao de sessao.
  - Migrar tambem permissoes antigas herdadas por grupos, se existirem.
  - Documentar retencao e minimizacao dos registros de auditoria.

## Registro de validacao

Cada item concluido deve receber aqui a data, os testes executados e uma descricao
curta da decisao adotada.

- 2026-10-01 — Item 1: FKs historicas entre integrantes, almocos/pacotes,
  funcoes/agenda e agenda/creditos passaram a usar `PROTECT`. A API retorna 409 e
  preserva todos os registros. Validado por 5 testes focados, incluindo os fluxos
  preexistentes de exclusao de almoco e pacote.
- 2026-10-01 — Item 2: promocoes automaticas de categoria e todas as alteracoes
  indiretas no saldo de pacotes agora registram autoria e eventos de auditoria com
  a operacao executada. Validado por 13 testes focados e Ruff.
- 2026-10-01 — Item 3: os acessos auxiliares amplos foram removidos e substituidos
  por endpoints de origens fiscais e opcoes de titulares de credito com campos
  minimos. Validado por 32 testes backend, Ruff e build Vite/TypeScript.
- 2026-10-01 — Item 4: o blacklist do SimpleJWT foi ativado; logout e alteracoes
  de senha, capacidades ou ativacao revogam refresh tokens existentes. Tokens
  revogados retornam 401. Validado por 15 testes de autenticacao e Ruff.
- 2026-10-01 — Item 5: PATCH parcial de operadores preserva capacidades quando o
  campo e omitido. Validado por 9 testes de contas e Ruff.
- 2026-10-01 — Item 6: auditoria usa 15 itens por pagina de forma explicita no
  frontend e backend. Um teste com 16 eventos garante acesso a pagina 2; build
  TypeScript/Vite e Ruff tambem passaram.
- 2026-10-01 — Item 7: expiracao de refresh agora limpa estado React, usuario,
  sessionStorage, cache de consultas e navegacao, alem de rejeitar a fila pendente.
  Validado com teste Vitest, ESLint e build Vite/TypeScript.
- 2026-10-01 — Item 8: repeticoes idempotentes de emissao retornam HTTP 200 e
  registram uma acao especial atribuida ao operador da repeticao, sem novo CREATE.
  Validado por 18 testes fiscais e Ruff.
- 2026-10-01 — Item 9: trocas de senha registram apenas `password_changed: true`;
  nenhum segredo e incluido no evento. Validado por 9 testes de contas e Ruff.
- 2026-10-01 — Item 10: IPs sao normalizados e `X-Forwarded-For` so e aceito de
  proxies listados em `AUDIT_TRUSTED_PROXY_IPS`; entradas invalidas nao abortam a
  operacao. Validado por 5 testes, Ruff e Django check.
- 2026-10-01 — Item 11: atualizacoes, falhas e referencias ignoradas de webhooks
  entram na auditoria unificada com origem WEBHOOK; duplicatas nao geram ruido.
  Validado por 4 testes de webhook e Ruff.
- 2026-10-01 — Item 12: contas sem areas usam uma pagina autenticada propria;
  deep links sao preservados e falhas de carregamento de perfil sao diferenciadas
  de credenciais invalidas. Validado por 5 testes Vitest, ESLint e build.
- 2026-10-01 — Item 13: guardas e expiracao de sessao possuem testes de frontend;
  grupos com a permissao legada recebem as duas novas permissoes; retencao e
  minimizacao foram documentadas e o comando de limpeza e seguro por padrao.
  Validacao final: 156 testes backend, 7 testes frontend, Ruff, ESLint, Django
  check, verificacao de migrations, build Vite/TypeScript, auditoria npm sem
  vulnerabilidades e migrations locais.
