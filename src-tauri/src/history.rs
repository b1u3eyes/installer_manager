use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub timestamp: String,
    pub program_name: String,
    pub file_name: String,
    pub action: String,
}

pub struct HistoryManager {
    pub history: Mutex<Vec<HistoryEntry>>,
    pub history_path: PathBuf,
}

impl HistoryManager {
    pub fn new(history_path: PathBuf) -> Self {
        let history = if history_path.exists() {
            let content = fs::read_to_string(&history_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        Self {
            history: Mutex::new(history),
            history_path,
        }
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let history = self.history.lock().unwrap();
        let content = serde_json::to_string_pretty(&*history).expect("Failed to serialize history");
        fs::write(&self.history_path, content)
    }

    pub fn add_entry(&self, entry: HistoryEntry) {
        let mut history = self.history.lock().unwrap();
        history.push(entry);
        drop(history);
        let _ = self.save();
    }

    pub fn get_history(&self) -> Vec<HistoryEntry> {
        self.history.lock().unwrap().clone()
    }

    pub fn clear_history(&self) {
        let mut history = self.history.lock().unwrap();
        history.clear();
        drop(history);
        let _ = self.save();
    }
}
