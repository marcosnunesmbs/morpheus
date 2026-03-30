# OAuth 2.0 no Morpheus — Guia Completo

Este documento explica, passo a passo, como funciona a autenticação OAuth 2.0 para MCP servers HTTP no Morpheus. Cobre conceitos, fluxo completo, cada componente, cada rota, o que é salvo e como tudo se conecta.

---

## 1. O que é OAuth 2.0?

OAuth 2.0 é um protocolo de **autorização** (não autenticação). Ele permite que um aplicativo (Morpheus) acesse recursos em nome de um usuário em outro serviço (ex: Linear, Notion) **sem que o usuário compartilhe sua senha**.

### Analogia simples

Imagine que você quer que um manobrista estacione seu carro:
- Você **não dá a chave mestra** (sua senha)
- Você dá uma **chave de manobrista** (token) que só permite dirigir, não abrir o porta-malas
- A chave expira (o manobrista não pode voltar amanhã e usar de novo)
- Você pode revogar a chave a qualquer momento

### Atores do OAuth 2.0

| Ator | No nosso caso | Papel |
|---|---|---|
| **Resource Owner** | Você (o usuário) | Dono dos dados (ex: suas issues no Linear) |
| **Client** | Morpheus | Quer acessar os dados em seu nome |
| **Authorization Server** | Servidor OAuth do provider (ex: linear.app) | Emite tokens após o usuário autorizar |
| **Resource Server** | API/MCP do provider | Aceita requests com token válido |

---

## 2. Tipos de Fluxo (Grant Types)

O Morpheus suporta dois grant types:

### 2.1 Authorization Code + PKCE (padrão)

Usado quando o MCP precisa que o **usuário autorize** no browser. É o fluxo mais comum e seguro.

```
Usuário ──► Morpheus ──► Auth Server ──► Usuário aprova no browser
                                              │
                                              ▼
                              Redirect para Morpheus com "code"
                                              │
                                              ▼
                              Morpheus troca code por token
```

**PKCE** (Proof Key for Code Exchange) é uma extensão de segurança:
- Morpheus gera um segredo aleatório (`code_verifier`)
- Cria um hash dele (`code_challenge`) e envia junto ao pedido de autorização
- Quando troca o `code` pelo token, envia o `code_verifier` original
- O auth server verifica que o hash bate — prova que quem pediu o code é quem está trocando

### 2.2 Client Credentials

Usado para comunicação **máquina-a-máquina**, sem interação do usuário:

```
Morpheus ──► Auth Server (com client_id + client_secret)
         ◄── Token
```

Configurado explicitamente no `mcps.json`:
```json
{
  "meu-mcp": {
    "transport": "http",
    "url": "https://api.exemplo.com/mcp",
    "oauth2": {
      "grant_type": "client_credentials",
      "client_id": "abc123",
      "client_secret": "secret456"
    }
  }
}
```

---

## 3. Fluxo Completo (Authorization Code)

Aqui está cada passo que acontece quando você adiciona um MCP HTTP que precisa de OAuth:

### Passo 1: Usuário adiciona o MCP

No `~/.morpheus/mcps.json`:
```json
{
  "linear": {
    "transport": "http",
    "url": "https://mcp.linear.app/mcp"
  }
}
```

Nenhuma config de OAuth é necessária — o Morpheus descobre tudo automaticamente.

### Passo 2: Morpheus tenta conectar

Quando o daemon inicia (ou após `POST /api/mcp/reload`), o `MCPToolCache` carrega as ferramentas:

```
MCPToolCache._doLoad()
  └─► Para cada server no mcps.json:
        Se transport === 'http':
          └─► loadHttpMcpServer(name, config)
                └─► OAuthManager.connectHttpMcp(name, url, oauth2Config)
```

**Arquivo:** `src/runtime/tools/cache.ts`

### Passo 3: MCP SDK detecta que precisa de auth

Dentro de `connectHttpMcp()`, o Morpheus cria um `StreamableHTTPClientTransport` com um `authProvider`:

```typescript
const transport = new StreamableHTTPClientTransport(url, {
  authProvider: provider,  // ← MorpheusOAuthProvider
});
const client = new Client({ name: 'morpheus-linear', version: '1.0.0' });
await client.connect(transport);
```

O MCP SDK internamente:
1. Faz um request ao MCP server
2. Recebe `401 Unauthorized`
3. Descobre o auth server via **RFC 8414** (busca `/.well-known/oauth-authorization-server`)
4. Lê o metadata do auth server (endpoints, scopes, flows suportados)
5. Faz **Dynamic Client Registration** (registra o Morpheus como cliente OAuth)
6. Gera o PKCE `code_verifier` e chama `provider.saveCodeVerifier()`
7. Constrói a URL de autorização e chama `provider.redirectToAuthorization(url)`

**Arquivo:** `src/runtime/oauth/manager.ts` → `connectHttpMcp()`

### Passo 4: Morpheus notifica o usuário

O `MorpheusOAuthProvider.redirectToAuthorization()` é chamado pelo SDK:

```typescript
async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
  await this.notifyUser(authorizationUrl);  // ← callback definido no manager
}
```

O manager chama o `notifyFn` configurado no startup:

```typescript
// Em start.ts:
oauthManager.setNotifyFn(async (serverName, url) => {
  const msg = `🔐 MCP *${serverName}* requires OAuth authorization.\n\nClick to authenticate:\n${url}`;
  ChannelRegistry.broadcast(msg);  // ← Envia para Telegram, Discord, etc.
});
```

O transport é guardado como "pendente":
```typescript
this.pending.set(serverName, { transport, provider, serverUrl });
return { tools: [], authPending: true };  // ← Sem ferramentas ainda
```

**Arquivo:** `src/runtime/oauth/provider.ts`

### Passo 5: Usuário clica no link e autoriza

O usuário recebe no Telegram/Discord uma mensagem como:

> 🔐 MCP *linear* requires OAuth authorization.
>
> Click to authenticate:
> https://linear.app/oauth/authorize?client_id=...&redirect_uri=http://localhost:3333/api/oauth/callback&code_challenge=...&state=abc123

O usuário clica, vê a tela do Linear pedindo permissão, e aprova.

### Passo 6: Provider redireciona para o callback

Após aprovar, o browser do usuário é redirecionado para:

```
http://localhost:3333/api/oauth/callback?code=AUTH_CODE_AQUI&state=abc123
```

**Importante:** Esta rota é montada **antes** do middleware de autenticação da API do Morpheus (no `server.ts`), porque é o browser do usuário que faz o request, sem API key:

```typescript
// server.ts — ANTES do authMiddleware:
this.app.use('/api/oauth', createOAuthRouter());

// DEPOIS do authMiddleware:
this.app.use('/api', authMiddleware, createApiRouter(...));
```

**Arquivo:** `src/http/server.ts`

### Passo 7: Morpheus troca o code por token

O handler do callback em `src/http/routers/oauth.ts`:

```typescript
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const result = await oauthManager.finishAuth(code, state);
  // → Recarrega ferramentas MCP em background
  MCPToolCache.getInstance().reload();
});
```

Dentro de `finishAuth()`:

1. **Resolve o server pelo `state`** — o `state` é um UUID que foi salvo junto ao PKCE verifier
2. **Busca o transport pendente** da `Map<string, PendingAuth>`
3. **Chama `transport.finishAuth(code)`** — o MCP SDK internamente:
   - Busca o `code_verifier` via `provider.codeVerifier()`
   - Faz POST para o `token_endpoint` do auth server com: `code`, `code_verifier`, `redirect_uri`
   - Recebe: `access_token`, `refresh_token`, `expires_in`
   - Chama `provider.saveTokens(tokens)` que persiste no store
4. **Remove o transport dos pendentes**
5. **Limpa o PKCE state**

**Arquivo:** `src/runtime/oauth/manager.ts` → `finishAuth()`

### Passo 8: Token salvo e ferramentas carregadas

O `OAuthStore` persiste o token em `~/.morpheus/oauth-tokens.json`:

```json
{
  "linear": {
    "tokens": {
      "access_token": "lin_api_xxxxxxxxxxxx",
      "refresh_token": "lin_ref_xxxxxxxxxxxx",
      "expires_in": 3600,
      "token_type": "Bearer"
    },
    "clientInfo": {
      "client_id": "dynamically_registered_id",
      "client_secret": "dynamically_registered_secret"
    }
  }
}
```

O `MCPToolCache.reload()` reconecta ao MCP server — desta vez o `MorpheusOAuthProvider.tokens()` retorna o token salvo, o SDK inclui `Authorization: Bearer <token>` nos requests, e as ferramentas são carregadas com sucesso.

### Passo 9: Uso subsequente (token refresh automático)

Nas próximas vezes que o MCP é usado:
1. O SDK verifica se o token expirou
2. Se expirou e existe `refresh_token`, o SDK automaticamente faz POST ao `token_endpoint` com `grant_type=refresh_token`
3. O novo token é salvo via `provider.saveTokens()`
4. O request segue normalmente

**O usuário não precisa fazer nada** — o refresh é transparente.

---

## 4. Anatomia dos Componentes

### 4.1 `OAuthStore` — Persistência

**Arquivo:** `src/runtime/oauth/store.ts`
**Dados:** `~/.morpheus/oauth-tokens.json`

| Método | O que faz |
|---|---|
| `getTokens(name)` | Lê tokens OAuth (access + refresh) do server |
| `saveTokens(name, tokens)` | Salva tokens — escrita atômica (temp → rename) |
| `deleteTokens(name)` | Remove tokens (revogação) |
| `getClientInfo(name)` | Lê info do client registrado dinamicamente |
| `saveClientInfo(name, info)` | Salva client_id/secret do dynamic registration |
| `savePkceVerifier(name, state, verifier)` | Salva code_verifier PKCE indexado por state |
| `getLatestPkceVerifier(name)` | Recupera o último verifier (para troca do code) |
| `resolveServerByState(state)` | Mapeia state → nome do server (para o callback) |

**Escrita atômica:** Escreve em arquivo `.tmp` e faz `rename()` — se o processo morrer no meio da escrita, o arquivo original fica intacto.

### 4.2 `MorpheusOAuthProvider` — Interface do SDK

**Arquivo:** `src/runtime/oauth/provider.ts`

Implementa `OAuthClientProvider` do `@modelcontextprotocol/sdk`. É a "ponte" entre o MCP SDK e nosso sistema de persistência/notificação:

| Método | Chamado pelo SDK quando... |
|---|---|
| `clientMetadata` | Precisa registrar o client no auth server |
| `state()` | Gera o parâmetro CSRF `state` |
| `clientInformation()` | Precisa do client_id para fazer requests |
| `saveClientInformation(info)` | Dynamic registration retorna client_id/secret |
| `tokens()` | Precisa de um access_token para autenticar |
| `saveTokens(tokens)` | Token exchange/refresh retorna novos tokens |
| `redirectToAuthorization(url)` | Precisa que o usuário autorize (nossa notificação) |
| `saveCodeVerifier(verifier)` | Gerou o PKCE verifier (salvamos para usar depois) |
| `codeVerifier()` | Precisa do verifier para trocar code por token |
| `invalidateCredentials(scope)` | Tokens/client info são inválidos, limpa tudo |

### 4.3 `OAuthManager` — Orquestrador

**Arquivo:** `src/runtime/oauth/manager.ts`

Singleton que coordena tudo:

| Método | Propósito |
|---|---|
| `getInstance(port)` | Cria singleton com o port do HTTP server (para redirect_uri) |
| `setNotifyFn(fn)` | Define como notificar o usuário (broadcast via ChannelRegistry) |
| `connectHttpMcp(name, url, oauth2, headers)` | Tenta conectar — retorna tools ou `authPending: true` |
| `finishAuth(code, state)` | Completa o flow após callback — troca code por token |
| `getStatus()` | Status de todos os servers OAuth |
| `revokeToken(name)` | Remove tokens e limpa estado pendente |

### 4.4 Rotas HTTP

**Arquivo:** `src/http/routers/oauth.ts`

| Rota | Método | Auth? | Propósito |
|---|---|---|---|
| `/api/oauth/callback` | GET | **Não** (público) | Recebe redirect do provider com `code` e `state` |
| `/api/oauth/status` | GET | **Não** | Status de todos os servers com OAuth |
| `/api/oauth/tokens/:name` | DELETE | **Não** | Revoga token de um server |

> **Por que o callback é público?** Porque é o **browser do usuário** que faz o request após autorizar no provider. O browser não tem a API key do Morpheus. O callback é montado no `server.ts` **antes** do `authMiddleware`.

---

## 5. O que é salvo e onde

| Dado | Onde | Quando |
|---|---|---|
| Config do MCP (url, oauth2) | `~/.morpheus/mcps.json` | Usuário configura |
| Access Token | `~/.morpheus/oauth-tokens.json` | Após token exchange/refresh |
| Refresh Token | `~/.morpheus/oauth-tokens.json` | Junto ao access token |
| Client Info (dynamic registration) | `~/.morpheus/oauth-tokens.json` | Após register no auth server |
| PKCE Code Verifier | `~/.morpheus/oauth-tokens.json` | Antes do redirect, apagado após callback |
| State (CSRF) | Em memória + como chave no PKCE | Durante o flow, apagado após callback |

### Exemplo de `oauth-tokens.json`

```json
{
  "linear": {
    "tokens": {
      "access_token": "lin_api_xxxxxxxx",
      "refresh_token": "lin_ref_xxxxxxxx",
      "expires_in": 3600,
      "token_type": "Bearer"
    },
    "clientInfo": {
      "client_id": "abc123-from-dynamic-registration",
      "client_secret": "secret-from-dynamic-registration",
      "client_id_issued_at": 1711234567
    },
    "pkce": {}
  }
}
```

---

## 6. Diagrama de Sequência Completo

```
┌─────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────────┐
│  Usuário │     │   Morpheus  │     │ MCP SDK  │     │ Auth Server  │
└────┬─────┘     └──────┬──────┘     └────┬─────┘     └──────┬───────┘
     │                  │                  │                   │
     │  Adiciona MCP    │                  │                   │
     │  no mcps.json    │                  │                   │
     │─────────────────►│                  │                   │
     │                  │                  │                   │
     │                  │  connect(url)    │                   │
     │                  │─────────────────►│                   │
     │                  │                  │                   │
     │                  │                  │  GET /mcp         │
     │                  │                  │──────────────────►│
     │                  │                  │                   │
     │                  │                  │  401 Unauthorized │
     │                  │                  │◄──────────────────│
     │                  │                  │                   │
     │                  │                  │  GET /.well-known/ │
     │                  │                  │  oauth-authz-server│
     │                  │                  │──────────────────►│
     │                  │                  │                   │
     │                  │                  │  Auth metadata    │
     │                  │                  │◄──────────────────│
     │                  │                  │                   │
     │                  │                  │  POST /register   │
     │                  │                  │  (dynamic client) │
     │                  │                  │──────────────────►│
     │                  │                  │                   │
     │                  │                  │  client_id/secret │
     │                  │                  │◄──────────────────│
     │                  │                  │                   │
     │                  │  saveClientInfo  │                   │
     │                  │◄─────────────────│                   │
     │                  │                  │                   │
     │                  │  saveCodeVerifier│                   │
     │                  │◄─────────────────│                   │
     │                  │                  │                   │
     │                  │  redirectToAuth  │                   │
     │                  │◄─────────────────│                   │
     │                  │                  │                   │
     │  🔐 Link via     │                  │                   │
     │  Telegram/Discord│                  │                   │
     │◄─────────────────│                  │                   │
     │                  │                  │                   │
     │  Clica no link   │                  │                   │
     │──────────────────────────────────────────────────────►│
     │                  │                  │                   │
     │  Autoriza        │                  │                   │
     │──────────────────────────────────────────────────────►│
     │                  │                  │                   │
     │  Redirect: /api/oauth/callback?code=XXX&state=YYY     │
     │◄──────────────────────────────────────────────────────│
     │                  │                  │                   │
     │  Browser GET     │                  │                   │
     │  /api/oauth/     │                  │                   │
     │  callback        │                  │                   │
     │─────────────────►│                  │                   │
     │                  │                  │                   │
     │                  │  finishAuth(code)│                   │
     │                  │─────────────────►│                   │
     │                  │                  │                   │
     │                  │                  │  POST /token      │
     │                  │                  │  code + verifier  │
     │                  │                  │──────────────────►│
     │                  │                  │                   │
     │                  │                  │  access_token +   │
     │                  │                  │  refresh_token    │
     │                  │                  │◄──────────────────│
     │                  │                  │                   │
     │                  │  saveTokens      │                   │
     │                  │◄─────────────────│                   │
     │                  │                  │                   │
     │  ✅ Página HTML   │                  │                   │
     │  "Authorized!"   │                  │                   │
     │◄─────────────────│                  │                   │
     │                  │                  │                   │
     │                  │  reload MCP tools│                   │
     │                  │──────────────────►  (com Bearer token)
     │                  │                  │──────────────────►│
     │                  │                  │  200 OK + tools   │
     │                  │◄─────────────────│◄──────────────────│
     │                  │                  │                   │
     │  Neo agora tem   │                  │                   │
     │  as ferramentas  │                  │                   │
     │  do Linear! 🎉   │                  │                   │
```

---

## 7. Conceitos Importantes

### 7.1 RFC 8414 — OAuth Authorization Server Metadata

Quando o MCP server retorna 401, o SDK busca automaticamente:
```
GET {base_url}/.well-known/oauth-authorization-server
```

Resposta:
```json
{
  "authorization_endpoint": "https://linear.app/oauth/authorize",
  "token_endpoint": "https://linear.app/oauth/token",
  "registration_endpoint": "https://linear.app/oauth/register",
  "scopes_supported": ["read", "write", "issues:read"],
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "refresh_token"]
}
```

### 7.2 Dynamic Client Registration

Se o Morpheus não tem `client_id` pré-configurado, o SDK faz:

```
POST {registration_endpoint}
{
  "client_name": "Morpheus - linear",
  "redirect_uris": ["http://localhost:3333/api/oauth/callback"],
  "grant_types": ["authorization_code", "refresh_token"]
}
```

O auth server responde com `client_id` e `client_secret` que são salvos para uso futuro.

### 7.3 PKCE (Proof Key for Code Exchange)

Previne ataques de interceptação do authorization code:

```
1. Morpheus gera: code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
2. Calcula:       code_challenge = SHA256(code_verifier) = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
3. Envia code_challenge na URL de autorização
4. Quando troca o code, envia code_verifier
5. Auth server verifica: SHA256(code_verifier) === code_challenge salvo
```

### 7.4 State Parameter (CSRF Protection)

O `state` é um UUID aleatório incluído na URL de autorização:
- Morpheus gera `state=abc123` e salva localmente
- O callback retorna `state=abc123`
- Morpheus verifica que bate — garante que o callback é legítimo (não um ataque CSRF)
- Também usado para mapear qual MCP server o callback pertence

### 7.5 Token Refresh

Access tokens expiram (geralmente 1h). O refresh é automático:

```
POST {token_endpoint}
grant_type=refresh_token
refresh_token=lin_ref_xxxxxxxx
client_id=abc123
```

O SDK faz isso transparentemente quando detecta token expirado.

---

## 8. Configuração no mcps.json

### Caso 1: Auto-discovery (mais comum)

```json
{
  "linear": {
    "transport": "http",
    "url": "https://mcp.linear.app/mcp"
  }
}
```

Morpheus descobre tudo automaticamente via RFC 8414.

### Caso 2: Client Credentials (machine-to-machine)

```json
{
  "internal-api": {
    "transport": "http",
    "url": "https://api.interno.com/mcp",
    "oauth2": {
      "grant_type": "client_credentials",
      "client_id": "service-morpheus",
      "client_secret": "super-secret-key",
      "scope": "mcp:read mcp:write"
    }
  }
}
```

### Caso 3: Pre-registered client (skip dynamic registration)

```json
{
  "notion": {
    "transport": "http",
    "url": "https://mcp.notion.so/mcp",
    "oauth2": {
      "client_id": "my-notion-integration-id",
      "client_secret": "my-notion-secret"
    }
  }
}
```

---

## 9. Segurança

| Aspecto | Como é tratado |
|---|---|
| Tokens em trânsito | HTTPS entre Morpheus e auth server |
| Tokens em repouso | `~/.morpheus/oauth-tokens.json` (permissões do filesystem) |
| Interceptação do code | PKCE garante que só quem gerou o challenge pode trocar |
| CSRF no callback | State parameter verificado |
| Callback público | Montado antes do authMiddleware — necessário pois browser não tem API key |
| Client secrets | Salvos no oauth-tokens.json (futuramente criptografados como trinity.db) |

---

## 10. Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| "Unauthorized access to /oauth/callback" | Router OAuth após authMiddleware | Verificar que `createOAuthRouter()` é montado ANTES em `server.ts` |
| "No PKCE code verifier found" | Callback chegou mas PKCE expirou/limpou | Refazer o flow (reload MCP) |
| "Could not resolve OAuth callback" | State não encontrado no store | Verificar `oauth-tokens.json` — pode ter sido limpo |
| Token expira e não renova | Servidor não suporta refresh_token | Refazer autorização manualmente |
| "$required is not iterable" | Schema Zod v4 incompatível com LangChain | Usar JSON Schema raw (não Zod) nos DynamicStructuredTool |
