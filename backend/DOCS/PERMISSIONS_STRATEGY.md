# Estratégia de permissões administrativas

Status: base implementada. O sistema possui contas individuais, permissões por área, autoria nos
registros principais e trilha de auditoria. Evoluções futuras podem separar leitura de escrita em
cada área e ampliar a auditoria conforme novos fluxos forem criados.

## Objetivo imediato

Cada pessoa que administra o sistema deve usar uma conta Django individual. A primeira entrega
mantém acesso administrativo amplo para não interromper a operação, mas elimina a credencial
compartilhada e registra a autoria das ações. A separação fina de permissões será aplicada na
etapa seguinte.

Os dois endpoints de cadastro público permanecem anônimos e protegidos por throttling.

`Member.role` não deve ser usado para autorização. Ele representa a relação de um integrante com
o almoço coletivo (`AVULSO`, `MENSALISTA` ou `SUSTENTADOR`) e não uma identidade autenticada.

## Gatilhos confirmados

As seguintes condições já ocorreram:

- pessoas diferentes passarem a cuidar de cadastro, operação e financeiro;
- houver necessidade de acesso somente leitura;
- credenciais de superusuário começarem a ser compartilhadas;
- auditoria exigir atribuir ações a operadores específicos.

Cada operador deve ter seu próprio usuário Django antes de qualquer expansão de acesso. Contas
não podem ser compartilhadas, e operadores desligados devem ser desativados sem apagar seu
histórico.

## Plano de implementação

### Fase 0 — compatibilidade visual — concluída

1. Definir `build.cssTarget` no Vite para impedir que o minificador gere sintaxe CSS incompatível
   com navegadores ou WebViews antigos usados no computador e no tablet do almoço.
2. Manter `background-color` como fallback do degradê do cabeçalho.
3. Gerar o build e conferir o CSS final, o cabeçalho em desktop e tablet e a atualização de cache
   após o deploy.

### Fase 1 — identidade individual e autoria — concluída

1. Criar uma conta Django individual para cada operador, inicialmente com o mesmo acesso amplo
   necessário à operação atual.
2. Exibir o nome do usuário autenticado no cabeçalho e retorná-lo em `/api/auth/status/`.
3. Adicionar `created_by` e `updated_by`, com `SET_NULL`, aos registros administrativos que ainda
   não possuem autoria: `Member`, `Duty`, `AgendaEntry`, `Lunch`, `Package` e `FinancialEntry`.
4. Preservar os campos de autoria já existentes em `PackageEntry`, `CreditEntry` e
   `FiscalDocument`, preenchendo também o autor nos fluxos automáticos derivados.
5. Tratar dados anteriores à migration como autoria desconhecida; não atribuir retroativamente
   esses registros ao superusuário atual.
6. Tornar os campos somente leitura na API e preenchê-los exclusivamente a partir de
   `request.user`, nunca a partir do payload enviado pelo frontend.
7. Mostrar “Criado por”, “Atualizado por” e os horários na visualização de detalhes dos registros
   relevantes.

### Fase 2 — trilha de auditoria — concluída para os fluxos atuais

1. Criar um `AuditEvent` append-only para registrar criação, edição, exclusão e ações especiais,
   como pagamento, ajuste manual, aprovação/rejeição de cadastro e emissão/cancelamento fiscal.
2. Registrar usuário, ação, tipo e ID do objeto, data/hora, campos alterados, identificador da
   requisição e origem da ação (`UI`, `WEBHOOK`, `SISTEMA` ou `COMANDO`).
3. Registrar IP e user agent apenas como metadados operacionais protegidos, sem copiar senhas,
   tokens, cookies, payload fiscal integral ou outros segredos.
4. Para exclusões, preservar uma descrição mínima do objeto no evento antes de removê-lo. Para
   alterações, registrar os nomes dos campos e valores anteriores/novos apenas quando não forem
   sensíveis.
5. Gravar o evento na mesma transação da operação sempre que possível. Falha na auditoria de uma
   mutação administrativa sensível deve impedir que a mutação seja confirmada.
6. Criar uma tela de auditoria somente para administradores, com filtros por usuário, período,
   módulo, ação e objeto.

### Fase 3 — perfis e permissões — concluída por área

Foram implementadas capacidades independentes para almoços, pacotes, financeiro, notas fiscais,
trocas/créditos, agenda, integrantes e funções. O dashboard, a gestão de contas e a auditoria são
exclusivos do superusuário. Contas operacionais recebem combinações arbitrárias das demais áreas
e a API continua sendo a autoridade das permissões.

Endpoints auxiliares de leitura expõem somente os campos necessários quando uma área depende de
outra, como opções de integrantes no almoço e opções de funções na agenda. Isso não concede
permissão de escrita no módulo relacionado.

### Fase 4 — gestão de usuários — concluída

A tela `/painel/contas` permite ao superusuário criar, editar, desativar, redefinir senha e
selecionar as áreas de cada operador. Usuários não são excluídos pela API. A tela
`/painel/auditoria` apresenta a trilha de alterações exclusivamente ao superusuário.

## Critérios de aceite

- duas pessoas conectadas com contas distintas geram autores distintos nos registros;
- criação, edição e exclusão podem ser localizadas por operador e horário;
- registros automáticos indicam o operador que iniciou o fluxo ou a origem técnica responsável;
- nenhum endpoint aceita que o cliente escolha `created_by` ou `updated_by`;
- usuários desativados não entram no sistema e continuam aparecendo no histórico;
- permissões são verificadas na API e cobertas por testes positivos e negativos;
- dados históricos sem autor aparecem explicitamente como “Não registrado”.

## Matriz proposta

| Recurso | Administrador | Operação | Financeiro | Cadastro |
| --- | --- | --- | --- | --- |
| Dashboard | total | sem acesso | sem acesso | sem acesso |
| Agenda e funções | total | CRUD | leitura | sem acesso |
| Almoços | total | CRUD | leitura | leitura |
| Pacotes | total | CRUD | leitura | leitura |
| Financeiro | total | leitura | CRUD | sem acesso |
| Trocas/créditos | total | leitura | CRUD | sem acesso |
| Integrantes | total | leitura/edição operacional | leitura | CRUD |
| Cadastros públicos | total | leitura | sem acesso | aprovar/rejeitar |
| Usuários e grupos | total | sem acesso | sem acesso | sem acesso |

A matriz é uma proposta inicial e precisa ser confirmada com os responsáveis pelo coletivo antes
de virar código.

## Restrições de segurança

- A API é sempre a autoridade; esconder botões no frontend não concede nem revoga acesso.
- Exportações devem usar as mesmas permissões das listagens correspondentes.
- Ajustes de pacote, créditos manuais e lançamentos financeiros exigem autorização explícita.
- Aprovação de cadastro envolve dados pessoais e não deve ser liberada para usuários genéricos.
- Mudanças de grupo precisam ser executadas por administrador e registradas.

## Retenção e minimização da auditoria

- A retenção operacional padrão é de 730 dias e pode ser ajustada por
  `AUDIT_RETENTION_DAYS` conforme orientação contábil, jurídica ou contratual.
- A remoção não é automática: deve ser revisada e executada por um responsável com
  `python manage.py prune_audit_events` para simular e, depois da conferência,
  `python manage.py prune_audit_events --confirm` para efetivar.
- Senhas, tokens, segredos, cookies, contatos pessoais, endereços, observações e
  payloads fiscais integrais não entram em `changes`. Webhooks registram apenas o
  resultado operacional e os campos não sensíveis alterados.
- IP e user agent são metadados operacionais protegidos. `X-Forwarded-For` só é
  aceito quando o proxy de origem estiver em `AUDIT_TRUSTED_PROXY_IPS`.
- Exportação ou acesso direto aos eventos é restrito ao superusuário. Eventos não
  devem ser copiados para planilhas ou canais externos sem necessidade aprovada.
