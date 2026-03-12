import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type TodoItem = {
  id: number;
  text: string;
  completed: boolean;
};

function App() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Loading todos from Rust...");
  const [isBusy, setIsBusy] = useState(true);

  useEffect(() => {
    async function loadTodos() {
      try {
        const items = await invoke<TodoItem[]>("list_todos");
        setTodos(items);
        setStatus("React loaded the current todo list from Rust");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setIsBusy(false);
      }
    }

    void loadTodos();
  }, []);

  async function syncTodos(
    command: "add_todo" | "toggle_todo" | "delete_todo",
    payload: Record<string, number | string>,
    nextStatus: string,
  ) {
    setIsBusy(true);

    try {
      const items = await invoke<TodoItem[]>(command, payload);
      setTodos(items);
      setStatus(nextStatus);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();
    if (!text) {
      setStatus("Type a todo before sending it to Rust");
      return;
    }

    setDraft("");
    await syncTodos("add_todo", { text }, `Rust stored "${text}" and returned the new list`);
  }

  async function toggleTodo(id: number) {
    await syncTodos("toggle_todo", { id }, `Rust toggled todo #${id}`);
  }

  async function deleteTodo(id: number) {
    await syncTodos("delete_todo", { id }, `Rust deleted todo #${id}`);
  }

  const completedCount = todos.filter((todo) => todo.completed).length;
  const remainingCount = todos.length - completedCount;

  return (
    <main className="app-shell">
      <section className="todo-panel" aria-label="Todo list">
        <header className="todo-header">
          <div>
            <p className="panel-label">Live state</p>
            <h2>Today&apos;s tasks</h2>
          </div>
          <div className="stats">
            <div>
              <span>Total</span>
              <strong>{todos.length}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{remainingCount}</strong>
            </div>
            <div>
              <span>Done</span>
              <strong>{completedCount}</strong>
            </div>
          </div>
        </header>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Add a task and press Enter..."
            disabled={isBusy}
          />
          <button type="submit" disabled={isBusy}>
            Add todo
          </button>
        </form>

        <div className="status-banner">
          <span>Backend status</span>
          <strong>{status}</strong>
        </div>

        <div className="todo-list">
          {todos.length === 0 ? (
            <div className="empty-state">
              <p>No todos yet.</p>
              <span>Create one above and React will send it to Rust.</span>
            </div>
          ) : (
            todos.map((todo) => (
              <article className={`todo-card ${todo.completed ? "done" : ""}`} key={todo.id}>
                <button
                  className="toggle-button"
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  disabled={isBusy}
                  aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {todo.completed ? "Done" : "Open"}
                </button>

                <div className="todo-copy">
                  <strong>{todo.text}</strong>
                  <span>
                    {todo.completed
                      ? "Completed in Rust state"
                      : "Waiting in Rust state"}
                  </span>
                </div>

                <button
                  className="delete-button"
                  type="button"
                  onClick={() => deleteTodo(todo.id)}
                  disabled={isBusy}
                >
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
