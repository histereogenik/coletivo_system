# Estratégia de permissões administrativas

Status: decisão registrada; implementação de RBAC adiada até existirem usuários operacionais
reais além do administrador principal.

## Decisão atual

O sistema continuará exigindo superusuário em toda a área administrativa. Os dois endpoints de
cadastro público permanecem anônimos e protegidos por throttling.

Essa é a opção segura enquanto o produto é operado por um grupo administrativo pequeno. Abrir
recursos parcialmente sem uma matriz confirmada criaria risco de alteração financeira, uso de
créditos ou exposição de dados pessoais.

`Member.role` não deve ser usado para autorização. Ele representa a relação de um integrante com
o almoço coletivo (`AVULSO`, `MENSALISTA` ou `SUSTENTADOR`) e não uma identidade autenticada.

## Sinal para iniciar RBAC

Implementar perfis distintos quando pelo menos uma destas condições ocorrer:

- pessoas diferentes passarem a cuidar de cadastro, operação e financeiro;
- houver necessidade de acesso somente leitura;
- credenciais de superusuário começarem a ser compartilhadas;
- auditoria exigir atribuir ações a operadores específicos.

Cada operador deve ter seu próprio usuário Django antes de qualquer expansão de acesso.

## Matriz proposta

| Recurso | Administrador | Operação | Financeiro | Cadastro |
| --- | --- | --- | --- | --- |
| Dashboard | total | leitura | leitura | sem acesso |
| Agenda e funções | total | CRUD | leitura | sem acesso |
| Almoços e pacotes | total | CRUD | leitura | leitura |
| Financeiro | total | leitura | CRUD | sem acesso |
| Trocas/créditos | total | leitura | CRUD | sem acesso |
| Integrantes | total | leitura/edição operacional | leitura | CRUD |
| Cadastros públicos | total | leitura | sem acesso | aprovar/rejeitar |
| Usuários e grupos | total | sem acesso | sem acesso | sem acesso |

A matriz é uma proposta inicial e precisa ser confirmada com os responsáveis pelo coletivo antes
de virar código.

## Implementação recomendada

1. Criar grupos Django estáveis: `administradores`, `operacao`, `financeiro` e `cadastro`.
2. Criar permissões por ação, não apenas por model, incluindo exportação, resumo, aprovação,
   rejeição e ajustes manuais.
3. Implementar classes DRF que combinem grupo, método HTTP e action do ViewSet.
4. Manter superusuários com bypass total para recuperação administrativa.
5. Retornar capacidades do usuário no endpoint `/api/auth/status/`.
6. Ocultar navegação não autorizada no frontend, sem tratar isso como controle de segurança.
7. Registrar `created_by`/`updated_by` nas operações sensíveis que ainda não possuem autoria.
8. Cobrir cada célula da matriz com testes de permissão positivos e negativos.

## Restrições de segurança

- A API é sempre a autoridade; esconder botões no frontend não concede nem revoga acesso.
- Exportações devem usar as mesmas permissões das listagens correspondentes.
- Ajustes de pacote, créditos manuais e lançamentos financeiros exigem autorização explícita.
- Aprovação de cadastro envolve dados pessoais e não deve ser liberada para usuários genéricos.
- Mudanças de grupo precisam ser executadas por administrador e registradas.
