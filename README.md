# Save Money Save The Future (SMSF)

> Personal finance platform focused on **daily expense tracking**, **wallet management**, and **saving goal progress**.

![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.12-005571?logo=elasticsearch&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Project Overview

**SMSF** is a full-stack web application that helps users:
- Track income and expense transactions by day/month.
- Manage multiple wallets (bank, cash, e-wallet).
- Monitor savings rate and projected monthly savings.
- Follow a calendar-first money workflow with quick updates.

The project is split into:
- `smsf-be`: REST API (Express + TypeScript + Elasticsearch).
- `smsf-fe`: Frontend UI (Next.js + React + TypeScript).

---

## ✨ Core Features

### Authentication
- Username/password login.
- JWT access token + refresh token flow.
- Auto-refresh access token in frontend interceptor.

### Finance Management
- Wallet summary and balance overview.
- Category-based transaction tracking.
- Bulk transaction creation support.
- Monthly savings goal setup and updates.

### Insights & UX
- Dashboard with expense donut and savings ring.
- Recent transactions and recurring-expense hints.
- Calendar view with daily income/expense summary.
- Mobile-friendly interaction model.

---

## 🧱 Tech Stack

### Backend (`smsf-be`)
- **Runtime**: Node.js 24
- **Framework**: Express 5 + TypeScript
- **Data Store**: Elasticsearch 8
- **Auth**: JSON Web Token (`jsonwebtoken`)
- **Dev tools**: Nodemon, ts-node

### Frontend (`smsf-fe`)
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + custom components
- **Charts**: Recharts
- **Icons**: lucide-react
- **HTTP**: Axios

### Infrastructure
- Docker / Docker Compose
- PostgreSQL + Grafana + Loki + Prometheus

---

## 🗂️ Repository Structure

```text
saving-money-saving-the-feature/
├─ smsf-be/              # Backend API service
│  ├─ src/
│  └─ prisma/
├─ smsf-fe/              # Next.js frontend
│  ├─ app/
│  └─ src/
└─ LICENSE
```

---

## ⚙️ Getting Started (Local Development)

### 1) Prerequisites
- Node.js **>= 24**
- npm
- Docker Desktop (recommended for infra)

### 2) Start infrastructure

```bash
docker compose -f docker-compose.db.yaml up -d
docker compose -f docker-compose.monitor.yaml up -d
```

Default ports:
- PostgreSQL: `5432`
- Grafana: `3030`
- Loki: `3100`
- Prometheus: `9090`
- Pushgateway: `9091`

### 3) Backend setup

```bash
cd smsf-be
npm install
```

Create `.env` in `smsf-be` from `smsf-be/.env.dist`:

```env
PORT=3000
NODE_ENV=development

API_DEFAULT_VERSION=v1
API_V1_ENABLED=true
API_V2_ENABLED=false

JWT_SECRET=replace_me
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=replace_me_too
JWT_REFRESH_EXPIRES_IN=7d

CORS_ALLOWED_ORIGINS=http://localhost:3033
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=

GOOGLE_CLIENT_IDS=your_google_web_client_id.apps.googleusercontent.com

ES_URL=http://localhost:9201
ES_NAME_PREFIX=
```

Run backend:

```bash
npm run dev
```

API base: `http://localhost:3000/api/v1`
Health check: `http://localhost:3000/api/health`

### 4) Seed sample data (optional)

```bash
cd smsf-be
USER_ID=app-default USER_USERNAME=rampo USER_PASSWORD=123456 npx ts-node src/scripts/create-user.ts
SEED_USER_ID=app-default npm run seed:categories
SEED_USER_ID=app-default npm run seed:wallets
```

Sample login after seed:
- Username: `rampo`
- Password: `123123`

### 5) Frontend setup

```bash
cd smsf-fe
npm install
```

Create `.env.local` in `smsf-fe`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
```

Run frontend:

```bash
npm run dev
```

Frontend URL: `http://localhost:3033`

### Google Login Setup

Current implementation uses Google Identity Services on the frontend and verifies the returned ID token on the backend.

Required env values:
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google Web application client ID used by the Next.js login page.
- `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS`: Google Web application client ID(s) accepted by the backend token verifier. Use `GOOGLE_CLIENT_IDS` if you want to allow multiple environments, separated by commas.

You do not need `GOOGLE_CLIENT_SECRET` for the current login flow because the frontend receives an ID token directly from Google and the backend only verifies that token.

Step by step to get the Google client ID:
1. Open Google Cloud Console.
2. Select or create a project for this app.
3. Go to APIs & Services.
4. Open OAuth consent screen.
5. Configure the app name, support email, and required scopes.
6. Add test users if the app is still in testing mode.
7. Go to Credentials.
8. Click Create Credentials.
9. Choose OAuth client ID.
10. Select Web application.
11. Add Authorized JavaScript origins for each frontend origin.
12. Add your local frontend origin, for example `http://localhost:3033`.
13. Add your production frontend origin, for example `https://your-domain.com`.
14. Save and copy the generated Client ID.
15. Put that value into `smsf-fe/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
16. Put the same value into `smsf-be/.env` as `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS`.

Recommended origin checklist:
- Local frontend: `http://localhost:3033`
- Production frontend: your exact HTTPS domain

If you deploy backend and frontend on different origins, also ensure these app settings are correct:
- `CORS_ALLOWED_ORIGINS` includes the frontend origin.
- `AUTH_COOKIE_SAME_SITE` and `AUTH_COOKIE_SECURE` match your deployment mode.
- `AUTH_COOKIE_DOMAIN` is set only when you intentionally share cookies across subdomains.

If the database already exists, run the SQL in `smsf-be/prisma/manual-migrations/20260330_google_auth_identity.sql` before deploying the new Google auth flow.

---

## 🐳 Dockerized App Runtime

Build images:

```bash
docker build -t smsf-be:local ./smsf-be
docker build -t smsf-fe:local ./smsf-fe
```

Run containers:

```bash
docker run -d --name smsf-be --env-file ./smsf-be/.env -p 3000:3000 smsf-be:local
docker run -d --name smsf-fe --env-file ./smsf-fe/.env.local -e NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 -p 3033:3033 smsf-fe:local
```

---

## 🔌 API Overview (v1)

Base URL: `/api/v1`

### Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/profile` (protected)
- `POST /auth/logout` (protected)

### Wallets
- `GET /wallets` (protected)

### Categories
- `GET /categories` (protected)

### Transactions
- `GET /transactions` (protected)
- `GET /transactions/query` (protected)
- `GET /transactions/savings-rate` (protected)
- `POST /transactions` (protected)
- `POST /transactions/bulk` (protected)
- `PUT /transactions/:transactionId` (protected)
- `DELETE /transactions/:transactionId` (protected)

### Budgets
- `GET /budgets/saving-goal` (protected)
- `PUT /budgets/saving-goal` (protected)

---

## 📈 Product Roadmap

- Telegram bot for spending alerts.
- Auto-allocation into saving jars when salary arrives.
- Monthly package manager (rent, subscriptions, utilities, AI tools).

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a Pull Request with clear description and screenshots (if UI related).

---

## 📄 License

This project is released under the terms of the [MIT License](./LICENSE).
