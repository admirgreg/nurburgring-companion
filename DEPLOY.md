# Deploy rápido

Este projeto agora pode rodar como um app único:

- `npm run build` gera o frontend em `dist/`
- `npm start` sobe o backend Express e serve o frontend + `/api/*`
- em produção, use Postgres via `DATABASE_URL`
- sem `DATABASE_URL`, o servidor usa `server/data/dev-db.json` só para teste local

## Variáveis de ambiente

Obrigatórias em produção:

```bash
NODE_ENV=production
JWT_SECRET=troque-por-uma-string-grande-e-aleatoria
DATABASE_URL=postgresql://...
```

Opcionais:

```bash
PORT=8080
CORS_ORIGIN=https://seu-frontend.com
PGSSL=false
```

Se frontend e backend forem servidos pelo mesmo domínio, não precisa definir `VITE_API_URL`.

Se o frontend ficar em outro domínio, defina antes do build:

```bash
VITE_API_URL=https://sua-api.com
```

## Local com backend

```powershell
copy .env.example .env
# edite JWT_SECRET no .env
npm run build
npm start
```

Abra:

```text
http://localhost:8080
```

## Local com Vite + API separada

Terminal 1:

```powershell
$env:PORT="8090"
npm run server
```

Terminal 2:

```powershell
$env:VITE_API_URL="http://127.0.0.1:8090"
npm run dev
```

## Deploy em host Node

Use um host que rode Node e permita variáveis de ambiente.

Configuração:

```text
Build command: npm install && npm run build
Start command: npm start
```

Configure:

```text
NODE_ENV=production
JWT_SECRET=<string longa>
DATABASE_URL=<url postgres com ssl>
```

Depois de subir, teste:

```text
https://seu-dominio/api/health
```
