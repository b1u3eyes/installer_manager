use std::fs;
use std::path::Path;
use std::collections::{HashSet, HashMap};
use walkdir::WalkDir;
use crate::models::SoftwareItem;
use crate::installation_checker::check_installed_programs;
use crate::metadata_extractor::{get_file_version, get_file_publisher, extract_icon_base64};

pub fn scan_software(root_path: &Path, assignments: &HashMap<String, String>, favorites: &Vec<String>, hidden: &Vec<String>, custom_names: &HashMap<String, String>, custom_descriptions: &HashMap<String, String>) -> Vec<SoftwareItem> {
    let mut items = Vec::new();
    let mut seen_paths = HashSet::new();
    
    let installed_set = check_installed_programs();

    for entry in WalkDir::new(root_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "exe") {
            let exe_path = path.to_string_lossy().to_string();
            
            if seen_paths.contains(&exe_path) {
                continue;
            }
            seen_paths.insert(exe_path.clone());

            if hidden.contains(&exe_path) {
                continue;
            }

            let file_stem = path.file_stem().unwrap().to_string_lossy().to_string();
            let file_name = path.file_name().unwrap().to_string_lossy().to_string();
            let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            let txt_path = path.with_extension("txt");
            
            let description = if txt_path.exists() {
                fs::read_to_string(&txt_path).unwrap_or_else(|_| "Eroare la citirea descrierii".to_string())
            } else {
                "Fără descriere disponibilă".to_string()
            };

            let category_id = assignments.get(&exe_path).cloned();
            
            let is_installed = installed_set.iter().any(|app| {
                app.contains(&file_stem.to_lowercase())
            });

            let is_favorite = favorites.contains(&exe_path);

            let name = custom_names.get(&exe_path).cloned().unwrap_or(file_stem);
            let description = custom_descriptions.get(&exe_path).cloned().unwrap_or(description);

            items.push(SoftwareItem {
                path: exe_path.clone(),
                name,
                file_name,
                file_size,
                description,
                category_id,
                is_installed,
                version: get_file_version(path),
                publisher: get_file_publisher(path),
                icon_base64: extract_icon_base64(path),
                is_favorite,
            });
        }
    }
    items
}
