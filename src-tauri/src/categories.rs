use crate::models::{AppConfig, Category};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;
use serde_json;

pub struct CategoryManager {
    pub config: Mutex<AppConfig>,
    pub config_path: PathBuf,
}

impl CategoryManager {
    pub fn new(config_path: PathBuf) -> Self {
        let config = if config_path.exists() {
            let content = fs::read_to_string(&config_path).expect("Failed to read config");
            serde_json::from_str(&content).unwrap_or_else(|_| AppConfig::new())
        } else {
            AppConfig::new()
        };

        Self {
            config: Mutex::new(config),
            config_path,
        }
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let config = self.config.lock().unwrap();
        let content = serde_json::to_string_pretty(&*config).expect("Failed to serialize config");
        fs::write(&self.config_path, content)
    }

    pub fn create_category(&self, name: String, icon: String, color: String) -> String {
        let mut config = self.config.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let icon = if icon.is_empty() { "📁".to_string() } else { icon };
        config.categories.push(Category {
            id: id.clone(),
            name,
            icon,
            color,
        });
        drop(config);
        let _ = self.save();
        id
    }

    pub fn update_category(&self, id: String, name: String, icon: String, color: String) -> bool {
        let mut config = self.config.lock().unwrap();
        if let Some(cat) = config.categories.iter_mut().find(|c| c.id == id) {
            cat.name = name;
            cat.icon = icon;
            cat.color = color;
            drop(config);
            let _ = self.save();
            return true;
        }
        false
    }

    pub fn delete_category(&self, id: String) -> bool {
        if id == "default" { return false; }
        let mut config = self.config.lock().unwrap();
        config.categories.retain(|c| c.id != id);
        
        config.assignments.retain(|_, cat_id| *cat_id != id);
        
        drop(config);
        let _ = self.save();
        true
    }

    pub fn assign_software(&self, path: String, category_id: String) {
        let mut config = self.config.lock().unwrap();
        config.assignments.insert(path, category_id);
        drop(config);
        let _ = self.save();
    }

    pub fn toggle_favorite(&self, path: String) -> bool {
        let mut config = self.config.lock().unwrap();
        if let Some(pos) = config.favorites.iter().position(|p| p == &path) {
            config.favorites.remove(pos);
            drop(config);
            let _ = self.save();
            false
        } else {
            config.favorites.push(path);
            drop(config);
            let _ = self.save();
            true
        }
    }

    pub fn update_software_path(&self, new_path: String) -> bool {
        let mut config = self.config.lock().unwrap();
        config.software_path = new_path;
        drop(config);
        let _ = self.save();
        true
    }

    pub fn hide_software(&self, path: String) -> bool {
        let mut config = self.config.lock().unwrap();
        if !config.hidden.contains(&path) {
            config.hidden.push(path);
            drop(config);
            let _ = self.save();
            return true;
        }
        false
    }

    pub fn unhide_software(&self, path: String) -> bool {
        let mut config = self.config.lock().unwrap();
        let len = config.hidden.len();
        config.hidden.retain(|p| p != &path);
        let removed = config.hidden.len() < len;
        drop(config);
        let _ = self.save();
        removed
    }

    pub fn update_software_metadata(&self, path: String, name: Option<String>, description: Option<String>) {
        let mut config = self.config.lock().unwrap();
        if let Some(n) = name {
            if n.trim().is_empty() {
                config.custom_names.remove(&path);
            } else {
                config.custom_names.insert(path.clone(), n.trim().to_string());
            }
        }
        if let Some(d) = description {
            if d.trim().is_empty() {
                config.custom_descriptions.remove(&path);
            } else {
                config.custom_descriptions.insert(path.clone(), d.trim().to_string());
            }
        }
        drop(config);
        let _ = self.save();
    }

    pub fn delete_software_files(&self, path: &str) -> Result<(), String> {
        let exe = std::path::Path::new(path);
        let txt = exe.with_extension("txt");
        if exe.exists() {
            std::fs::remove_file(exe).map_err(|e| format!("Eroare la ștergere .exe: {}", e))?;
        }
        if txt.exists() {
            std::fs::remove_file(&txt).map_err(|e| format!("Eroare la ștergere .txt: {}", e))?;
        }
        Ok(())
    }
}
