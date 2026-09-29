# AI Business Automation

A full-stack AI business automation platform: React frontend → FastAPI backend →
PostgreSQL + an existing n8n workflow (Groq AI Agent, Gmail tool, PostgreSQL tool).

> **Status: Phase 7 of 13 — Dashboard.** Auth, leads CRUD, n8n automation,
> automation history, and now a live dashboard (real stat cards, recent
> leads, recent activity, automation status) are all working end to end.
> This README will be completed in Phase 13.

## Architecture (target, built up over the phases)

```
React Frontend  →  FastAPI Backend  →  PostgreSQL
                         │
                         ▼
                        n8n
                         │
                         ▼
                     AI Agent (Groq)
                 ┌───────┼───────┐
                 ▼       ▼       ▼
              Gmail   PostgreSQL  Chat
              Tool      Tool     Memory
```

The frontend never calls n8n directly — it only talks to FastAPI, which in
turn calls the existing n8n webhook.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, SQLAlchemy, PostgreSQL (psycopg),
  Pydantic, JWT auth, httpx
- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios, Lucide React
- **Automation:** n8n (existing workflow, not modified by this project)

## Phase 1 setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # then edit values
uvicorn app.main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## Roadmap

| Phase | Scope |
|---|---|
| 1 | Project setup (this phase) |
| 2 | PostgreSQL + SQLAlchemy models |
| 3 | Authentication (JWT) |
| 4 | Leads CRUD |
| 5 | n8n integration |
| 6 | Automation history |
| 7 | Dashboard |
| 8 | Conversations |
| 9 | Profile & settings |
| 10 | UI polish |
| 11 | Security review |
| 12 | Final testing |
| 13 | Final README |

## Project structure

```
AI-bussiness-automation/
├── backend/
│   └── app/
│       ├── main.py
│       ├── core/config.py
│       ├── database/        (Phase 2)
│       ├── schemas/         (Phase 2+)
│       ├── routers/         (Phase 3+)
│       ├── services/        (Phase 5)
│       └── dependencies/    (Phase 3)
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── index.css
└── README.md
```
