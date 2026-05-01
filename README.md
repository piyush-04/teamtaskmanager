# Team Task Manager

A full-stack team task management app with JWT authentication, project membership, role-based access, task assignment, status tracking, and dashboard metrics.

## Tech Stack

- Frontend: React, Vite, Lucide icons
- Backend: Node.js, Express
- Database: PostgreSQL
- Auth: JWT with bcrypt password hashing
- Deployment target: Railway

## Features

- Signup and login with secure password hashing
- Create projects; the creator becomes the project Admin
- Admins can add/remove members by email
- Admins can create, assign, update, and delete tasks
- Members can view their projects and update only their assigned tasks
- Dashboard shows total tasks, tasks by status, tasks per user, and overdue tasks
- REST APIs with validation and centralized error handling

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database and copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Update `.env`:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/team_task_manager
   JWT_SECRET=your-long-random-secret
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.

The backend automatically creates the required tables on startup.

## API Overview

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`

### Tasks

- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/projects/:projectId/tasks/:taskId/status`
- `PUT /api/projects/:projectId/tasks/:taskId`
- `DELETE /api/projects/:projectId/tasks/:taskId`

### Dashboard

- `GET /api/projects/:projectId/dashboard`

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project from the GitHub repository.
3. Add a PostgreSQL database in Railway.
4. Set environment variables:

   ```env
   DATABASE_URL=${{ Postgres.DATABASE_URL }}
   JWT_SECRET=your-production-secret
   NODE_ENV=production
   FRONTEND_URL=https://your-railway-app-url.up.railway.app
   ```

5. Railway can use these commands:

   ```bash
   npm install
   npm run build
   npm start
   ```

6. After deployment, open `/api/health` to verify the backend and then test the app URL.

## Free Public Deployment on Render

Render supports free web services and free Postgres databases for previews and hobby apps. Note that free Render Postgres databases expire after 30 days.

1. Push this repository to GitHub.
2. Open [Render Blueprints](https://dashboard.render.com/blueprints).
3. Click **New Blueprint Instance** and connect `https://github.com/piyush-04/teamtaskmanager`.
4. Render will read `render.yaml` and create:
   - `teamtaskmanager` web service
   - `teamtaskmanager-db` Postgres database
5. Choose the free plan when prompted and deploy the blueprint.
6. After deployment, open:

   ```text
   https://teamtaskmanager.onrender.com/api/health
   ```

   If the response is `{"ok":true}`, open the root app URL:

   ```text
   https://teamtaskmanager.onrender.com
   ```

## Demo Video Checklist

- Show signup and login
- Create a project as Admin
- Add another registered user as a Member
- Create and assign tasks
- Update task statuses as Admin and Member
- Explain the dashboard metrics and role-based restrictions
- Briefly show the Railway environment variables and deployed URL
