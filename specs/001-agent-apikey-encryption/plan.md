# Planejamento: Criptografia de API Keys dos Agentes

**Status**: ✅ Implementado em 2026-02-25

## Resumo

Implementação de criptografia AES-256-GCM para todas as API keys dos agentes (Oracle, Sati, Neo, Apoc, Trinity), seguindo o mesmo padrão das senhas de banco de dados do Trinity.

## Arquivos Modificados

### Backend
- `src/runtime/trinity-crypto.ts` - Adicionado `looksLikeEncrypted()` e `safeDecrypt()`
- `src/config/manager.ts` - Adicionado `decryptAgentApiKeys()`, `encryptAgentApiKeys()`, `getEncryptionStatus()`
- `src/http/api.ts` - Adicionado endpoint `GET /api/config/encryption-status`

### Frontend
- `src/ui/src/pages/Settings.tsx` - Adicionado hook `useSWR` para status e componente `renderEncryptionBadge()`

### Documentação
- `README.md` - Atualizada descrição do `MORPHEUS_SECRET`
- `DOCUMENTATION.md` - Adicionado endpoint `/api/config/encryption-status`
- `CHANGELOG.md` - Adicionado entry em [Unreleased]

## Como Funciona

### Criptografia (save)
1. Usuário salva configuração via UI ou API
2. `ConfigManager.save()` verifica se `MORPHEUS_SECRET` está definido
3. Se sim, criptografa todas as API keys com `encrypt()`
4. Se não, salva em plaintext + log warning
5. Config validada e escrita no YAML

### Descriptografia (load)
1. `ConfigManager.load()` lê YAML
2. `decryptAgentApiKeys()` verifica cada API key
3. Se parecer criptografada (formato `base64:base64:base64`), tenta `safeDecrypt()`
4. Se falhar, mantém valor original (fail-open)
5. Aplica precedence de environment variables

### UI Status Badges
- 🔒 **Encrypted** - Key criptografada
- ⚠️ **Plaintext** - `MORPHEUS_SECRET` não definido
- ⚠️ **Re-save to encrypt** - Secret definido, mas key ainda é plaintext
- **No API key** - Nenhuma key configurada

## Migração

Para criptografar keys existentes:
1. Definir `MORPHEUS_SECRET` no ambiente
2. Re-salvar cada agente na UI (Oracle, Sati, Neo, Apoc, Trinity)
3. Keys são automaticamente criptografadas no save

## API Response Exemplo

```json
GET /api/config/encryption-status
{
  "morpheusSecretSet": true,
  "apiKeysEncrypted": {
    "oracle": true,
    "sati": true,
    "neo": true,
    "apoc": true,
    "trinity": true
  },
  "hasPlaintextKeys": false
}
```
