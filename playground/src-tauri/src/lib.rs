use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

#[derive(Clone, Serialize)]
struct TodoItem {
    id: u32,
    text: String,
    completed: bool,
}

#[derive(Default)]
struct TodoState {
    todos: Mutex<Vec<TodoItem>>,
}

fn with_todos<T>(
    state: &State<TodoState>,
    update: impl FnOnce(&mut Vec<TodoItem>) -> Result<T, String>,
) -> Result<T, String> {
    let mut todos = state
        .todos
        .lock()
        .map_err(|_| "Todo state is unavailable".to_string())?;

    update(&mut todos)
}

#[tauri::command]
fn list_todos(state: State<TodoState>) -> Result<Vec<TodoItem>, String> {
    with_todos(&state, |todos| Ok(todos.clone()))
}

#[tauri::command]
fn add_todo(text: String, state: State<TodoState>) -> Result<Vec<TodoItem>, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Todo text cannot be empty".to_string());
    }

    with_todos(&state, |todos| {
        let next_id = todos.iter().map(|todo| todo.id).max().unwrap_or(0) + 1;

        todos.push(TodoItem {
            id: next_id,
            text: trimmed.to_string(),
            completed: false,
        });

        Ok(todos.clone())
    })
}

#[tauri::command]
fn toggle_todo(id: u32, state: State<TodoState>) -> Result<Vec<TodoItem>, String> {
    with_todos(&state, |todos| {
        let todo = todos
            .iter_mut()
            .find(|todo| todo.id == id)
            .ok_or_else(|| format!("Todo #{id} was not found"))?;

        todo.completed = !todo.completed;
        Ok(todos.clone())
    })
}

#[tauri::command]
fn delete_todo(id: u32, state: State<TodoState>) -> Result<Vec<TodoItem>, String> {
    with_todos(&state, |todos| {
        let original_len = todos.len();
        todos.retain(|todo| todo.id != id);

        if todos.len() == original_len {
            return Err(format!("Todo #{id} was not found"));
        }

        Ok(todos.clone())
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TodoState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_todos,
            add_todo,
            toggle_todo,
            delete_todo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
