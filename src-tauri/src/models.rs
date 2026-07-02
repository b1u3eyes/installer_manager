use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoftwareItem {
    pub path: String,
    pub name: String,
    pub description: String,
    pub file_name: String,
    pub file_size: u64,
    pub category_id: Option<String>,
    pub is_installed: bool,
    pub version: String,
    pub publisher: String,
    pub icon_base64: String,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub software_path: String,
    pub favorites: Vec<String>,
    pub hidden: Vec<String>,
    pub custom_names: HashMap<String, String>,
    pub custom_descriptions: HashMap<String, String>,
    pub categories: Vec<Category>,
    pub assignments: HashMap<String, String>,
}

impl AppConfig {
    pub fn new() -> Self {
        Self {
            software_path: r"C:\Users\b1u3eyes\Desktop\AI App\Software".to_string(),
            favorites: Vec::new(),
            hidden: Vec::new(),
            custom_names: HashMap::new(),
            custom_descriptions: HashMap::new(),
            categories: vec![
                Category { id: Uuid::new_v4().to_string(), name: "Browsere".to_string(), icon: "🌐".to_string(), color: "#3b82f6".to_string() },
                Category { id: Uuid::new_v4().to_string(), name: "Utilitare".to_string(), icon: "🛠".to_string(), color: "#f59e0b".to_string() },
                Category { id: Uuid::new_v4().to_string(), name: "Multimedia".to_string(), icon: "🎬".to_string(), color: "#ef4444".to_string() },
                Category { id: Uuid::new_v4().to_string(), name: "Jocuri".to_string(), icon: "🎮".to_string(), color: "#8b5cf6".to_string() },
                Category { id: Uuid::new_v4().to_string(), name: "Diverse".to_string(), icon: "📦".to_string(), color: "#10b981".to_string() },
            ],
            assignments: HashMap::new(),
        }
    }
}
