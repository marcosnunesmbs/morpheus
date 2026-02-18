FROM node:20-slim

# Instalar dependências do sistema necessárias
# Instalar dependências do sistema necessárias incluindo OpenSSL e ca-certificates para requisições HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    wget \
    ca-certificates \
    openssl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
    
# Criar diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências com resolução de conflitos
RUN npm install --legacy-peer-deps 

# Copiar o restante do código
COPY . .

# Compilar o projeto
RUN npm run build

# Criar diretório para configuração e dados persistentes
RUN mkdir -p /root/.morpheus /app/data

# Expor porta padrão da UI
EXPOSE 3333

# Comando de entrada usando dumb-init para melhor gerenciamento de processos
ENTRYPOINT ["dumb-init", "--"]

# Comando padrão
# Remove stale PID file left from a previous container run before starting.
# Without this, a container restart can find a leftover PID that coincidentally
# matches a new process (PID reuse), causing an infinite kill → restart loop.
CMD ["sh", "-c", "rm -f /root/.morpheus/morpheus.pid && npx morpheus start -y"]

# Health check para o Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3333/health || exit 1