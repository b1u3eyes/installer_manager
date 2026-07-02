// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod categories;
mod scanner;
mod launcher;
mod installation_checker;
mod metadata_extractor;
mod history;
mod system_tools;

use crate::models::{SoftwareItem, Category, AppConfig};
use crate::categories::CategoryManager;
use crate::scanner::scan_software;
use crate::launcher::{launch_exe_with_event, open_folder, open_txt};
use crate::history::{HistoryManager, HistoryEntry};
use crate::system_tools::{SystemToolsManager, SystemCommand, CommandHistoryEntry};
use std::path::PathBuf;
use std::fs;
use tauri::{State, Manager, AppHandle, Emitter};
use notify::{Watcher, RecursiveMode};

struct AppState {
    category_manager: CategoryManager,
    history_manager: HistoryManager,
    system_tools_manager: SystemToolsManager,
}

#[tauri::command]
fn get_software_list(state: State<'_, AppState>) -> Vec<SoftwareItem> {
    let config = state.category_manager.config.lock().unwrap();
    let software_root = PathBuf::from(&config.software_path);
    scan_software(&software_root, &config.assignments, &config.favorites, &config.hidden, &config.custom_names, &config.custom_descriptions)
}

#[tauri::command]
fn get_categories(state: State<'_, AppState>) -> Vec<Category> {
    state.category_manager.config.lock().unwrap().categories.clone()
}

#[tauri::command]
fn create_category(state: State<'_, AppState>, name: String, icon: String, color: String) -> String {
    state.category_manager.create_category(name, icon, color)
}

#[tauri::command]
fn update_category(state: State<'_, AppState>, id: String, name: String, icon: String, color: String) -> bool {
    state.category_manager.update_category(id, name, icon, color)
}

#[tauri::command]
fn delete_category(state: State<'_, AppState>, id: String) -> bool {
    state.category_manager.delete_category(id)
}

#[tauri::command]
fn assign_category(state: State<'_, AppState>, path: String, category_id: String) {
    state.category_manager.assign_software(path, category_id);
}

#[tauri::command]
fn toggle_favorite(state: State<'_, AppState>, path: String) -> bool {
    state.category_manager.toggle_favorite(path)
}

#[tauri::command]
fn update_software_path(state: State<'_, AppState>, path: String) -> bool {
    state.category_manager.update_software_path(path)
}

#[tauri::command]
fn get_software_path(state: State<'_, AppState>) -> String {
    state.category_manager.config.lock().unwrap().software_path.clone()
}

#[tauri::command]
fn update_software_metadata(state: State<'_, AppState>, path: String, name: Option<String>, description: Option<String>) {
    state.category_manager.update_software_metadata(path, name, description);
}

#[tauri::command]
fn delete_software(state: State<'_, AppState>, path: String, keep_file: bool) -> Result<(), String> {
    if keep_file {
        state.category_manager.hide_software(path);
        Ok(())
    } else {
        state.category_manager.hide_software(path.clone());
        state.category_manager.delete_software_files(&path)
    }
}

#[tauri::command]
fn get_hidden_software(state: State<'_, AppState>) -> Vec<String> {
    state.category_manager.config.lock().unwrap().hidden.clone()
}

#[tauri::command]
fn unhide_software(state: State<'_, AppState>, path: String) -> bool {
    state.category_manager.unhide_software(path)
}

#[tauri::command]
fn run_exe(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    let file_name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let program_name = std::path::Path::new(&path)
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    state.history_manager.add_entry(HistoryEntry {
        timestamp: chrono_now(),
        program_name,
        file_name: file_name.clone(),
        action: "launched".to_string(),
    });

    launch_exe_with_event(&app, path)
}

#[tauri::command]
fn run_open_folder(path: String) -> Result<(), String> {
    open_folder(path)
}

#[tauri::command]
fn run_open_txt(path: String) -> Result<(), String> {
    open_txt(path)
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Vec<HistoryEntry> {
    state.history_manager.get_history()
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) {
    state.history_manager.clear_history();
}

#[tauri::command]
fn export_csv(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut csv = String::from("Nume,Fișier,Mărime (MB),Versiune,Publisher,Categorie,Instalat,Favorit,Descriere\n");
    let config = state.category_manager.config.lock().unwrap();
    let software_root = PathBuf::from(&config.software_path);
    let items = scan_software(&software_root, &config.assignments, &config.favorites, &config.hidden, &config.custom_names, &config.custom_descriptions);
    drop(config);

    for item in &items {
        let cat_name = state.category_manager.config.lock().unwrap()
            .categories.iter().find(|c| Some(&c.id) == item.category_id.as_ref())
            .map(|c| c.name.clone()).unwrap_or_default();
        let size_mb = format!("{:.1}", item.file_size as f64 / (1024.0 * 1024.0));
        let installed = if item.is_installed { "Da" } else { "Nu" };
        let favorite = if item.is_favorite { "Da" } else { "Nu" };
        let desc = item.description.replace('"', "\"\"");
        csv.push_str(&format!("\"{}\",\"{}\",{},\"{}\",\"{}\",\"{}\",{},{},\"{}\"\n",
            item.name, item.file_name, size_mb, item.version, item.publisher, cat_name, installed, favorite, desc));
    }

    fs::write(&path, csv).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_config(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let config = state.category_manager.config.lock().unwrap();
    let content = serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_config(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let mut current = state.category_manager.config.lock().unwrap();
    current.categories = config.categories;
    current.assignments = config.assignments;
    drop(current);
    state.category_manager.save().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_system_commands(state: State<'_, AppState>) -> Vec<SystemCommand> {
    state.system_tools_manager.get_commands()
}

#[tauri::command]
fn create_system_command(state: State<'_, AppState>, name: String, description: String, command: String, category: String, tags: Vec<String>, requires_admin: bool, danger_level: String) -> Result<String, String> {
    state.system_tools_manager.create_command(name, description, command, category, tags, requires_admin, danger_level)
}

#[tauri::command]
fn update_system_command(state: State<'_, AppState>, id: String, name: String, description: String, command: String, category: String, tags: Vec<String>, requires_admin: bool, danger_level: String) -> Result<(), String> {
    state.system_tools_manager.update_command(id, name, description, command, category, tags, requires_admin, danger_level)
}

#[tauri::command]
fn delete_system_command(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.system_tools_manager.delete_command(id)
}

#[tauri::command]
fn toggle_command_favorite(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    state.system_tools_manager.toggle_favorite(id)
}

#[tauri::command]
fn execute_system_command(state: State<'_, AppState>, id: String) -> Result<CommandHistoryEntry, String> {
    state.system_tools_manager.execute_command(id)
}

#[tauri::command]
fn get_command_execution_history(state: State<'_, AppState>) -> Vec<CommandHistoryEntry> {
    state.system_tools_manager.get_history()
}

#[tauri::command]
fn clear_command_execution_history(state: State<'_, AppState>) -> Result<(), String> {
    state.system_tools_manager.clear_history()
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}

fn main() {
    let base_path = PathBuf::from(r"C:\Users\b1u3eyes\Desktop\AI App\installer_manager");
    let config_path = base_path.join("categories.json");
    let history_path = base_path.join("history.json");
    
    let category_manager = CategoryManager::new(config_path);
    let history_manager = HistoryManager::new(history_path);
    let system_tools_manager = SystemToolsManager::new(base_path.clone());
    let state = AppState { category_manager, history_manager, system_tools_manager };

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            let handle = app.handle().clone();
            let app_state: State<'_, AppState> = app.state();
            let software_path = app_state.category_manager.config.lock().unwrap().software_path.clone();
            drop(app_state);

            let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                if let Ok(_) = res {
                    let _ = handle.emit("software-changed", ());
                }
            }).unwrap();

            let _ = watcher.watch(std::path::Path::new(&software_path), RecursiveMode::Recursive);
            std::mem::forget(watcher);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_software_list,
            get_categories,
            create_category,
            update_category,
            delete_category,
            assign_category,
            toggle_favorite,
            get_software_path,
            update_software_path,
            update_software_metadata,
            delete_software,
            get_hidden_software,
            unhide_software,
            run_exe,
            run_open_folder,
            run_open_txt,
            get_history,
            clear_history,
            export_csv,
            export_config,
            import_config,
            get_system_commands,
            create_system_command,
            update_system_command,
            delete_system_command,
            toggle_command_favorite,
            execute_system_command,
            get_command_execution_history,
            clear_command_execution_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
