import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
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
import { db, firebaseAuth } from "./firebase";
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
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser(firebaseUser) {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snapshot = await getDoc(userRef);
    const user = snapshot.exists()
      ? { id: firebaseUser.uid, ...snapshot.data() }
      : {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email.toLowerCase(),
        };

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        name: user.name,
        email: user.email,
        created_at: serverTimestamp(),
      });
    }

    setAuth({ user });
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await loadUser(firebaseUser);
        } else {
          setAuth(null);
        }
      } catch (error) {
        console.error(error);
        setAuth(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async ({ email, password }) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  const signup = async ({ name, email, password }) => {
    const credential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );
    await updateProfile(credential.user, { displayName: name });
    await setDoc(doc(db, "users", credential.user.uid), {
      name,
      email: email.toLowerCase(),
      created_at: serverTimestamp(),
    });
    setAuth({
      user: { id: credential.user.uid, name, email: email.toLowerCase() },
    });
  };

  const logout = async () => {
    await firebaseSignOut(firebaseAuth);
    setAuth(null);
  };

  return { auth, loading, login, signup, logout };
}

function AuthScreen({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        await onSignup(form);
      } else {
        await onLogin({ email: form.email, password: form.password });
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
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
    const snapshot = await getDocs(collection(db, "projects"));
    const nextProjects = [];

    for (const projectDoc of snapshot.docs) {
      const project = { id: projectDoc.id, ...projectDoc.data() };
      const role = project.members?.[auth.user.id];
      if (!role) continue;

      const taskSnapshot = await getDocs(
        firestoreQuery(
          collection(db, "tasks"),
          where("project_id", "==", projectDoc.id),
        ),
      );
      const tasksForProject = taskSnapshot.docs.map((taskDoc) => taskDoc.data());

      nextProjects.push({
        ...project,
        role,
        task_count: tasksForProject.length,
        done_count: tasksForProject.filter((task) => task.status === "Done")
          .length,
      });
    }

    setProjects(nextProjects);
    if (!activeProjectId && nextProjects[0]) {
      setActiveProjectId(nextProjects[0].id);
    }
  }

  async function loadWorkspace(projectId = activeProjectId) {
    if (!projectId) return;
    const projectSnapshot = await getDoc(doc(db, "projects", projectId));
    if (!projectSnapshot.exists()) return;

    const project = { id: projectSnapshot.id, ...projectSnapshot.data() };
    const role = project.members?.[auth.user.id];
    if (!role) {
      setNotice("You do not have access to this project");
      return;
    }

    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersById = Object.fromEntries(
      usersSnapshot.docs.map((userDoc) => [
        userDoc.id,
        { id: userDoc.id, ...userDoc.data() },
      ]),
    );
    const members = Object.entries(project.members || {}).map(([userId, memberRole]) => ({
      id: userId,
      name: usersById[userId]?.name || "Unknown user",
      email: usersById[userId]?.email || "",
      role: memberRole,
    }));

    const taskSnapshot = await getDocs(
      firestoreQuery(collection(db, "tasks"), where("project_id", "==", projectId)),
    );
    const allTasks = taskSnapshot.docs.map((taskDoc) => {
      const task = { id: taskDoc.id, ...taskDoc.data() };
      return {
        ...task,
        assignee_name: task.assigned_to
          ? usersById[task.assigned_to]?.name || "Unknown user"
          : null,
        assignee_email: task.assigned_to
          ? usersById[task.assigned_to]?.email || ""
          : null,
      };
    });
    const visibleTasks =
      role === "Admin"
        ? allTasks
        : allTasks.filter((task) => task.assigned_to === auth.user.id);

    const byStatus = statuses.map((status) => ({
      status,
      count: allTasks.filter((task) => task.status === status).length,
    }));
    const perUser = members.map((member) => ({
      name: member.name,
      count: allTasks.filter((task) => task.assigned_to === member.id).length,
    }));
    const today = new Date().toISOString().slice(0, 10);

    setProjectDetail({ project: { ...project, role }, members });
    setTasks(
      visibleTasks.sort((a, b) => {
        const statusDiff = statuses.indexOf(a.status) - statuses.indexOf(b.status);
        return statusDiff || a.due_date.localeCompare(b.due_date);
      }),
    );
    setDashboard({
      totalTasks: allTasks.length,
      byStatus,
      perUser,
      overdueTasks: allTasks.filter(
        (task) => task.due_date < today && task.status !== "Done",
      ).length,
    });
  }

  useEffect(() => {
    loadProjects().catch((err) => setNotice(err.message));
  }, []);

  useEffect(() => {
    loadWorkspace().catch((err) => setNotice(err.message));
  }, [activeProjectId]);

  async function createProject(event) {
    event.preventDefault();
    const projectRef = await addDoc(collection(db, "projects"), {
      name: projectForm.name,
      description: projectForm.description || "",
      created_by: auth.user.id,
      members: { [auth.user.id]: "Admin" },
      created_at: serverTimestamp(),
    });
    setProjectForm({ name: "", description: "" });
    await loadProjects();
    setActiveProjectId(projectRef.id);
  }

  async function addMember(event) {
    event.preventDefault();
    const userSnapshot = await getDocs(
      firestoreQuery(
        collection(db, "users"),
        where("email", "==", memberEmail.toLowerCase()),
      ),
    );
    if (userSnapshot.empty) {
      setNotice("No user found with that email");
      return;
    }
    await updateDoc(doc(db, "projects", activeProjectId), {
      [`members.${userSnapshot.docs[0].id}`]: "Member",
    });
    setMemberEmail("");
    await loadWorkspace();
  }

  async function removeMember(userId) {
    await updateDoc(doc(db, "projects", activeProjectId), {
      [`members.${userId}`]: deleteField(),
    });
    const taskSnapshot = await getDocs(
      firestoreQuery(
        collection(db, "tasks"),
        where("project_id", "==", activeProjectId),
        where("assigned_to", "==", userId),
      ),
    );
    await Promise.all(
      taskSnapshot.docs.map((taskDoc) =>
        updateDoc(doc(db, "tasks", taskDoc.id), { assigned_to: null }),
      ),
    );
    await loadWorkspace();
  }

  async function createTask(event) {
    event.preventDefault();
    await addDoc(collection(db, "tasks"), {
      project_id: activeProjectId,
      title: taskForm.title,
      description: taskForm.description || "",
      due_date: taskForm.due_date,
      priority: taskForm.priority,
      status: "To Do",
      assigned_to: taskForm.assigned_to || null,
      created_by: auth.user.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
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
    await updateDoc(doc(db, "tasks", taskId), {
      status,
      updated_at: serverTimestamp(),
    });
    await loadWorkspace();
  }

  async function deleteTask(taskId) {
    await deleteDoc(doc(db, "tasks", taskId));
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
  const { auth, loading, login, signup, logout } = useAuth();
  if (loading) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Loading workspace</p>
            <h1>Team Task Manager</h1>
            <p className="muted">Checking your Firebase session.</p>
          </div>
        </section>
      </main>
    );
  }

  return auth ? (
    <AppShell auth={auth} onLogout={logout} />
  ) : (
    <AuthScreen onLogin={login} onSignup={signup} />
  );
}

createRoot(document.getElementById("root")).render(<Root />);
