# App fiscal

O app `apps.fiscal` integra o Coletivo System à API v2 da Focus NFe para emissão normal de
NF-e e NFC-e. Regularização de vendas anteriores à implantação não faz parte deste fluxo.

## Regras implementadas

- CPF ou consumidor não identificado gera NFC-e (modelo 65).
- CNPJ gera NF-e (modelo 55) e exige razão social e endereço estruturado em Goiás.
- A primeira versão aceita apenas operações internas (`CFOP 5101`).
- A origem deve ser um almoço avulso pago ou um pacote pago, com valor positivo.
- Almoço consumido de pacote, pagamento por troca e venda em aberto não podem ser emitidos.
- Um documento pendente, processando ou autorizado impede outra emissão para a mesma venda.
- Rejeições são preservadas e permitem uma nova tentativa com outra referência.
- O suporte a pacote fica bloqueado por padrão até a contabilidade confirmar o fato fiscal.
- A API decide automaticamente: CNPJ produz NF-e; CPF ou ausência de documento produz NFC-e.

O documento mantém snapshots do destinatário, itens, pagamentos, requisição e resposta. Os
vínculos com almoço e pacote usam `PROTECT` para preservar o histórico fiscal.

## Endpoints

- `GET /api/fiscal/documents/`: lista documentos e aceita filtros por tipo, ambiente, status e data;
- `GET /api/fiscal/documents/configuration/`: informa ambiente e prontidão sem expor o token;
- `POST /api/fiscal/documents/emit/`: cria e transmite uma emissão;
- `POST /api/fiscal/documents/{id}/refresh/`: consulta novamente documentos em processamento.
- `POST /api/fiscal/webhooks/focus/`: recebe atualizações autenticadas e idempotentes da Focus.

Todos os endpoints exigem superusuário.

## Configuração

As variáveis estão documentadas em `.env.dev.example` e `.env.prod.example`. O desenvolvimento
usa homologação por padrão. Produção exige simultaneamente:

```text
FOCUS_NFE_ENVIRONMENT=production
FOCUS_NFE_ALLOW_PRODUCTION=True
```

A trava deve ser liberada somente depois dos testes de homologação. Use o token específico da
empresa; nunca use o token master na aplicação.

## Webhook e reconciliação

O endpoint valida um segredo em cabeçalho configurável, registra o payload por hash e aceita
reenvios sem reaplicar o mesmo evento. A referência local é criada e confirmada no banco antes da
chamada de emissão, de modo que um webhook pode recuperar uma resposta HTTP perdida.

Configure uma URL HTTPS pública e um segredo forte:

```text
FOCUS_WEBHOOK_URL=https://api.exemplo.com/api/fiscal/webhooks/focus/
FOCUS_WEBHOOK_SECRET=segredo-aleatorio-longo
FOCUS_WEBHOOK_AUTHORIZATION_HEADER=X-Focus-Webhook-Token
```

Depois, registre o evento da NF-e na Focus de forma idempotente:

```bash
python manage.py configure_focus_webhook --event nfe
```

Na API pública atual da Focus, NFC-e normal é síncrona e não possui evento próprio na enumeração
de webhooks; `nfce_contingencia` é destinado à contingência. Para NFC-e normal, o sistema usa a
resposta síncrona, a referência idempotente e a consulta manual como fallback.

O perfil inicialmente validado pela contabilidade é NCM `21069090`, CFOP `5101` e CSOSN `102`.
PIS e COFINS permanecem configuráveis e obrigatórios no backend. Como o emitente pertence ao
Simples Nacional, IBS/CBS não são destacados em 2026 e os campos ficam opcionais, preparados para
quando se tornarem aplicáveis.

## Formas de pagamento

- dinheiro: código `01`;
- Pix registrado no sistema: código `20`, Pix estático.

Cartão fica bloqueado porque o cadastro atual não diferencia crédito e débito. Caso o negócio
passe a diferenciar essas modalidades, Pix dinâmico ou outros meios, o model de pagamento deverá
ser detalhado antes de transmitir esses novos códigos.
