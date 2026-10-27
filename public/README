# PrêmioJá Store — versão 2

Loja virtual responsiva com catálogo, carrinho, criação de pedidos, painel administrativo e integração de cobrança Pix preparada para Asaas.

## O que está pronto
- Frontend responsivo inspirado no design anterior.
- Catálogo de produtos de exemplo.
- Carrinho e checkout.
- Backend Express com validação de dados.
- Cobrança Pix pelo Asaas quando as variáveis de ambiente estão configuradas.
- Endpoint de webhook para atualizar status de pagamento.
- Painel com login por senha configurada no servidor e cadastro de produtos.
- Sem chave secreta embutida no HTML.

## Requisitos
Node.js 18+ (recomendado Node.js 20+).

## Rodar localmente
1. Extraia o ZIP.
2. Abra o terminal dentro da pasta `premioja_v2`.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Defina `ADMIN_PASSWORD` com uma senha forte.
6. Para testar cobrança Pix, crie uma conta Sandbox do Asaas e configure `ASAAS_API_KEY` com a chave do Sandbox.
7. Execute `npm start`.
8. Abra http://localhost:3000.

Sem `ASAAS_API_KEY`, você consegue testar catálogo, carrinho, pedidos e painel, mas o checkout não gera QR Pix.

## Configurar Asaas em Sandbox
- Documentação: https://docs.asaas.com/
- Sandbox: https://sandbox.asaas.com
- Defina `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`.
- Copie a chave API do Sandbox para `ASAAS_API_KEY`.
- Defina um segredo longo e aleatório em `ASAAS_WEBHOOK_TOKEN`.
- No painel do Asaas, configure o webhook para `https://SEU-DOMINIO/api/webhooks/asaas` e envie o token no cabeçalho `asaas-access-token`.
- Habilite eventos de cobrança relevantes, especialmente `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED` e `PAYMENT_DELETED`.
- Teste todos os estados antes de produção.

## Produção — antes de ativar dinheiro real
- Troque para a URL e credenciais de produção somente após homologar.
- Hospede em serviço Node.js com HTTPS.
- Não compartilhe a chave API nem o arquivo `.env`.
- Use banco de dados gerenciado persistente. O arquivo `data.json` é apenas para protótipo e pode não ser adequado para produção ou instâncias múltiplas.
- Implemente rate limiting, proteção contra abuso, autenticação mais robusta (hash de senha, cookies seguros/CSRF ou provedor de identidade), recuperação de conta, auditoria, backups e monitoramento.
- A busca de pedidos por e-mail é apenas protótipo: produção deve exigir conta autenticada ou link assinado; não armazene CPF além do necessário e defina retenção/privacidade.
- Configure políticas de privacidade, termos de compra, atendimento, devoluções, dados fiscais e segurança.
- Nunca marque pedido como pago com base no retorno do navegador; use status confirmado pelo provedor via webhook e/ou consulta autenticada.
- O sistema não envia Pix de saída. Isso exige um fluxo separado de transferência, autorização explícita, validação de beneficiário, limites, idempotência e logs.

## Variáveis
Veja `.env.example`.

## Limitações conhecidas do protótipo
- O armazenamento usa `data.json` para facilitar teste. Não é banco de dados de produção.
- A sessão administrativa usa token em memória; ao reiniciar, sessões são invalidadas.
- O fluxo de pedido não inclui envio de e-mail nem nota fiscal.
- O frontend recolhe CPF para criar cobrança no Asaas; trate esse dado como sensível e restrinja acesso.
