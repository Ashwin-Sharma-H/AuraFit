# AuraFit - AI Pantry & Fitness Tracker

AuraFit is a premium, mobile-responsive Progressive Web App (PWA) that allows users to manage their kitchen pantry, generate AI-powered meal plans matching their nutritional targets, and track their fitness goals. 

## 🚀 Production Deployment Architecture

AuraFit is deployed using a modern, cost-free, and high-performance hybrid hosting stack:

```mermaid
graph TD
    User([User App / PWA]) -->|1. Loads Web Shell| Vercel[Vercel Frontend]
    User -->|2. Requests /api or /media| Vercel
    Vercel -->|3. Edge Rewrite Proxy| Render[Render Django Backend]
    Render -->|4. Database Queries| Neon[(Neon Postgres Database)]
    Render -->|5. AI API Queries| Google[Google AI Studio free tier]
```

1.  **Frontend (React/Vite)**: Hosted on **Vercel**. 
    *   Configured as a Progressive Web App (PWA) so users can download it to their mobile home screens.
    *   Uses `vercel.json` edge rewrites to proxy `/api/` and `/media/` requests directly to the backend URL, bypassing CORS issues entirely.
2.  **Backend (Django REST Framework)**: Hosted on **Render** (free Python Web Service).
    *   Runs on a production-grade `gunicorn` WSGI server.
    *   Static files are served directly via `whitenoise`.
    *   Build command is configured to automatically run database migrations on every deployment (`python manage.py migrate`).
3.  **Database (PostgreSQL)**: Hosted on **Neon** (Serverless PostgreSQL free tier).
4.  **AI & Image Services**: Connected to **Google AI Studio** (standard developer keys for Gemini 2.5 Flash and Imagen 3), utilising their generous free tiers.

---

## 🛠️ Local Development Setup

To run this project on your local machine:

### 1. Backend (Django)
Ensure you have Python 3 installed.

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key
# Optional: Provide DATABASE_URL to connect to Neon Postgres. 
# If left blank, it will automatically fall back to local sqlite3.
# DATABASE_URL=postgres://user:pass@host/dbname
```

Run migrations and start the server:
```bash
python manage.py migrate
python manage.py runserver
```
The backend will run at `http://127.0.0.1:8000/`.

### 2. Frontend (Vite + React)
Ensure you have Node.js installed.

```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Run the dev server
npm run dev
```
The dev server will run at `http://localhost:5173/` and automatically proxy backend calls to the local Django server.

---

## ⚙️ Production Environment Variables

When deploying the backend (Render/Koyeb), set the following environment variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon Postgres Connection String | `postgres://user:pass@ep-xxx.neon.tech/neondb` |
| `GEMINI_API_KEY` | Google AI Studio Key | `AIzaSy...` |
| `DJANGO_SECRET_KEY` | Django Cryptographic Key | `any_secure_random_string` |
| `DJANGO_DEBUG` | Django Debug Mode | `False` |

---

## 📱 Progressive Web App (PWA) Features
AuraFit is installable as a native app on iOS, Android, and desktop:
- **Manifest**: Details background colors, theme colors, standalone display mode, and custom icons.
- **Service Worker (`sw.js`)**: Caches essential shell resources offline, implementing a Stale-While-Revalidate caching pattern for fast loads while ignoring backend API routes to ensure real-time communication.
