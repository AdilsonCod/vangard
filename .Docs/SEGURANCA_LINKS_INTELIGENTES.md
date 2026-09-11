# Segurança dos Links Inteligentes

Implementação da Tarefa 21 de [`tasks.md`](./tasks.md), conforme os requisitos do [`prd.md`](./prd.md).

## Gestão autorizada

Criar, editar, pausar, excluir, simular e registrar cliques simulados agora passa pela API autenticada. O servidor valida o Firebase ID Token, o perfil e a unidade do link. Marketing e Recepção operam somente sua unidade; a gerência pode operar todas.

As coleções `smart_links` e `smart_link_clicks` são somente leitura para clientes autorizados. Toda escrita do navegador foi bloqueada nas regras do Firestore e é executada pelo backend com dados protegidos, como proprietário, unidade, contadores e datas.

A função Vercel `api/smart-links/[...path].ts` expõe as operações autenticadas. A rota pública `/r/:code` permanece separada e fornece apenas o comportamento necessário ao visitante.

## Validação dos destinos

- Somente HTTPS.
- Sem usuário ou senha embutidos na URL.
- Bloqueio de `localhost`, domínios `.local`/`.internal`, loopback, link-local, redes privadas, CGNAT, multicast e IPv6 privado ou mapeado para IPv4.
- Cada redirecionamento HTTP recebido durante o cloaking é validado novamente.
- Resposta HTML limitada a 2,5 MB, mesmo sem `Content-Length`.

## Cloaking

O proxy não repassa cabeçalhos do destino. Meta refresh é removido, uma política CSP própria é aplicada e mensagens públicas de falha não incluem erros internos. Se o conteúdo não puder ser carregado com segurança, o sistema mostra uma página neutra em vez de expor o destino por fallback automático.

## Testes

- `npm run test:smart-link-security`: protocolos, credenciais, nomes locais, IPv4 e IPv6 privados.
- `npm run test:api-authorization`: perfis autorizados das APIs.
- `npm run test:firestore:collections`: escrita client-side bloqueada e leitura por escopo; requer Java para o emulador.
- `npm run typecheck`, `npm run lint` e `npm run build`: integração geral.

