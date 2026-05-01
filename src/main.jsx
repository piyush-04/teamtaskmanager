import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const statuses = ["To Do", "In Progress", "Done"];
const priorities = ["Low", "Medium", "High"];

function apiRequest(path, options = {}, token) {
  return fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (response) => {
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function useAuth() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("ttm_token");
    const user = localStorage.getItem("ttm_user");
    return token && user ? { token, user: JSON.parse(user) } : null;
  });

  const saveAuth = (data) => {
    localStorage.setItem("ttm_token", data.token);
    localStorage.setItem("ttm_user", JSON.stringify(data.user));
    setAuth(data);
  };

  const logout = () => {
    localStorage.removeItem("ttm_token");
    localStorage.removeItem("ttm_user");
    setAuth(null);
  };

  return { auth, saveAuth, logout };
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload =
        mode === "signup"
          ? form
          : { email: form.email, password: form.password };
      const data = await apiRequest(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Collaborative workspace</p>
          <h1>Team Task Manager</h1>
          <p className="muted">
            Create projects, assign work, and track delivery with role-based
            controls for admins and members.
          </p>
        </div>

        <form onSubmit={submit} className="stack">
          <div className="segmented" role="tablist">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          </div>
          {mode === "signup" && (
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function DashboardStats({ dashboard }) {
  const byStatus = Object.fromEntries(
    statuses.map((status) => [
      status,
      dashboard?.byStatus?.find((item) => item.status === status)?.count || 0,
    ]),
  );

  return (
    <section className="stats">
      <Stat icon={<ClipboardList />} label="Total tasks" value={dashboard?.totalTasks || 0} />
      <Stat icon={<CheckCircle2 />} label="Done" value={byStatus.Done} />
      <Stat icon={<BarChart3 />} label="In progress" value={byStatus["In Progress"]} />
      <Stat icon={<Users />} label="Overdue" value={dashboard?.overdueTasks || 0} />
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </article>
  );
}

function AppShell({ auth, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [notice, setNotice] = useState("");
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: new Date().toISOString().slice(0, 10),
    priority: "Medium",
    assigned_to: "",
  });
  const [memberEmail, setMemberEmail] = useState("");

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId],
  );
  const isAdmin = projectDetail?.project?.role === "Admin";

  async function loadProjects() {
    const data = await apiRequest("/projects", {}, auth.token);
    setProjects(data.projects);
    if (!activeProjectId && data.projects[0]) {
      setActiveProjectId(data.projects[0].id);
    }
  }

  async function loadWorkspace(projectId = activeProjectId) {
    if (!projectId) return;
    const [detail, taskData, dash] = await Promise.all([
      apiRequest(`/projects/${projectId}`, {}, auth.token),
      apiRequest(`/projects/${projectId}/tasks`, {}, auth.token),
      apiRequest(`/projects/${projectId}/dashboard`, {}, auth.token),
    ]);
    setProjectDetail(detail);
    setTasks(taskData.tasks);
    setDashboard(dash);
  }

  useEffect(() => {
    loadProjects().catch((err) => setNotice(err.message));
  }, []);

  useEffect(() => {
    loadWorkspace().catch((err) => setNotice(err.message));
  }, [activeProjectId]);

  async function createProject(event) {
    event.preventDefault();
    const data = await apiRequest(
      "/projects",
      { method: "POST", body: JSON.stringify(projectForm) },
      auth.token,
    );
    setProjectForm({ name: "", description: "" });
    await loadProjects();
    setActiveProjectId(data.project.id);
  }

  async function addMember(event) {
    event.preventDefault();
    await apiRequest(
      `/projects/${activeProjectId}/members`,
      { method: "POST", body: JSON.stringify({ email: memberEmail }) },
      auth.token,
    );
    setMemberEmail("");
    await loadWorkspace();
  }

  async function removeMember(userId) {
    await apiRequest(
      `/projects/${activeProjectId}/members/${userId}`,
      { method: "DELETE" },
      auth.token,
    );
    await loadWorkspace();
  }

  async function createTask(event) {
    event.preventDefault();
    await apiRequest(
      `/projects/${activeProjectId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({
          ...taskForm,
          assigned_to: taskForm.assigned_to || null,
        }),
      },
      auth.token,
    );
    setTaskForm({
      title: "",
      description: "",
      due_date: new Date().toISOString().slice(0, 10),
      priority: "Medium",
      assigned_to: "",
    });
    await loadWorkspace();
    await loadProjects();
  }

  async function updateStatus(taskId, status) {
    await apiRequest(
      `/projects/${activeProjectId}/tasks/${taskId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      auth.token,
    );
    await loadWorkspace();
  }

  async function deleteTask(taskId) {
    await apiRequest(
      `/projects/${activeProjectId}/tasks/${taskId}`,
      { method: "DELETE" },
      auth.token,
    );
    await loadWorkspace();
    await loadProjects();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ClipboardList />
          <div>
            <strong>Team Tasks</strong>
            <span>{auth.user.name}</span>
          </div>
        </div>

        <form className="create-project" onSubmit={createProject}>
          <input
            placeholder="New project"
            value={projectForm.name}
            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
            required
          />
          <textarea
            placeholder="Description"
            value={projectForm.description}
            onChange={(e) =>
              setProjectForm({ ...projectForm, description: e.target.value })
            }
          />
          <button className="primary compact">
            <Plus size={16} /> Create
          </button>
        </form>

        <nav className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={project.id === activeProjectId ? "active" : ""}
              onClick={() => setActiveProjectId(project.id)}
            >
              <span>{project.name}</span>
              <small>
                {project.role} · {project.done_count}/{project.task_count}
              </small>
            </button>
          ))}
        </nav>

        <button className="ghost logout" onClick={onLogout}>
          <LogOut size={17} /> Logout
        </button>
      </aside>

      <section className="workspace">
        {!activeProject ? (
          <div className="empty-state">
            <h2>Create your first project</h2>
            <p>Projects appear here once you create one or an admin adds you.</p>
          </div>
        ) : (
          <>
            <header className="workspace-header">
              <div>
                <p className="eyebrow">{projectDetail?.project?.role || activeProject.role}</p>
                <h1>{activeProject.name}</h1>
                <p className="muted">{activeProject.description || "No description yet"}</p>
              </div>
            </header>

            {notice && <p className="notice">{notice}</p>}
            <DashboardStats dashboard={dashboard} />

            <div className="main-grid">
              <section className="panel task-board">
                <div className="panel-title">
                  <h2>Tasks</h2>
                  <span>{tasks.length}</span>
                </div>
                <div className="columns">
                  {statuses.map((status) => (
                    <div className="column" key={status}>
                      <h3>{status}</h3>
                      {tasks
                        .filter((task) => task.status === status)
                        .map((task) => (
                          <article className="task-card" key={task.id}>
                            <div className="task-top">
                              <strong>{task.title}</strong>
                              <span className={`priority ${task.priority.toLowerCase()}`}>
                                {task.priority}
                              </span>
                            </div>
                            <p>{task.description || "No description"}</p>
                            <div className="task-meta">
                              <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                              <span>{task.assignee_name || "Unassigned"}</span>
                            </div>
                            <div className="task-actions">
                              <select
                                value={task.status}
                                onChange={(e) => updateStatus(task.id, e.target.value)}
                              >
                                {statuses.map((item) => (
                                  <option key={item}>{item}</option>
                                ))}
                              </select>
                              {isAdmin && (
                                <button
                                  className="icon danger"
                                  aria-label="Delete task"
                                  title="Delete task"
                                  onClick={() => deleteTask(task.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                    </div>
                  ))}
                </div>
              </section>

              <aside className="right-rail">
                {isAdmin && (
                  <section className="panel">
                    <div className="panel-title">
                      <h2>New task</h2>
                    </div>
                    <form className="stack" onSubmit={createTask}>
                      <input
                        placeholder="Title"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        required
                      />
                      <textarea
                        placeholder="Description"
                        value={taskForm.description}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, description: e.target.value })
                        }
                      />
                      <input
                        type="date"
                        value={taskForm.due_date}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, due_date: e.target.value })
                        }
                        required
                      />
                      <select
                        value={taskForm.priority}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, priority: e.target.value })
                        }
                      >
                        {priorities.map((priority) => (
                          <option key={priority}>{priority}</option>
                        ))}
                      </select>
                      <select
                        value={taskForm.assigned_to}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, assigned_to: e.target.value })
                        }
                      >
                        <option value="">Unassigned</option>
                        {projectDetail?.members?.map((member) => (
                          <option value={member.id} key={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <button className="primary">
                        <Plus size={16} /> Add task
                      </button>
                    </form>
                  </section>
                )}

                <section className="panel">
                  <div className="panel-title">
                    <h2>Members</h2>
                    <Users size={18} />
                  </div>
                  {isAdmin && (
                    <form className="member-form" onSubmit={addMember}>
                      <input
                        type="email"
                        placeholder="user@email.com"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        required
                      />
                      <button className="icon" aria-label="Add member" title="Add member">
                        <UserPlus size={17} />
                      </button>
                    </form>
                  )}
                  <div className="member-list">
                    {projectDetail?.members?.map((member) => (
                      <div className="member" key={member.id}>
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                        <small>{member.role}</small>
                        {isAdmin && member.role !== "Admin" && (
                          <button
                            className="icon danger"
                            aria-label="Remove member"
                            title="Remove member"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-title">
                    <h2>Tasks per user</h2>
                  </div>
                  <div className="bars">
                    {dashboard?.perUser?.map((item) => (
                      <div className="bar-row" key={item.name}>
                        <span>{item.name}</span>
                        <div>
                          <i
                            style={{
                              width: `${Math.max(
                                8,
                                (item.count / Math.max(1, dashboard.totalTasks)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Root() {
  const { auth, saveAuth, logout } = useAuth();
  return auth ? (
    <AppShell auth={auth} onLogout={logout} />
  ) : (
    <AuthScreen onAuth={saveAuth} />
  );
}

createRoot(document.getElementById("root")).render(<Root />);
