use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemCommand {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub category: String,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub requires_admin: bool,
    pub danger_level: String,
    pub last_run: Option<String>,
    pub last_status: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandHistoryEntry {
    pub command_id: String,
    pub command_name: String,
    pub timestamp: String,
    pub success: bool,
    pub output: String,
}

pub struct SystemToolsManager {
    pub commands: Mutex<Vec<SystemCommand>>,
    pub commands_path: PathBuf,
    pub history: Mutex<Vec<CommandHistoryEntry>>,
    pub history_path: PathBuf,
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}

fn seed_default_commands() -> Vec<SystemCommand> {
    vec![
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Flush DNS".to_string(),
            description: "Curăță cache-ul DNS Windows.".to_string(),
            command: "ipconfig /flushdns".to_string(),
            category: "Network".to_string(),
            tags: vec!["dns".to_string(), "network".to_string(), "internet".to_string()],
            favorite: true,
            requires_admin: true,
            danger_level: "SAFE".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Restart Explorer".to_string(),
            description: "Repornește Windows Explorer (shell-ul desktopului).".to_string(),
            command: "taskkill /f /im explorer.exe && start explorer.exe".to_string(),
            category: "System".to_string(),
            tags: vec!["explorer".to_string(), "shell".to_string(), "restart".to_string()],
            favorite: false,
            requires_admin: false,
            danger_level: "ADMIN".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Clear Temp Files".to_string(),
            description: "Șterge toate fișierele temporare din %TEMP%.".to_string(),
            command: "del /q /s %TEMP%\\* 2>nul && for /d %%i in (%TEMP%\\*) do rmdir /s /q %%i 2>nul".to_string(),
            category: "Cleanup".to_string(),
            tags: vec!["temp".to_string(), "cleanup".to_string(), "disk".to_string()],
            favorite: true,
            requires_admin: false,
            danger_level: "DANGEROUS".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Check Disk".to_string(),
            description: "Verifică integritatea discului C: pentru erori de sistem.".to_string(),
            command: "chkdsk /f C:".to_string(),
            category: "System".to_string(),
            tags: vec!["disk".to_string(), "chkdsk".to_string(), "repair".to_string()],
            favorite: false,
            requires_admin: true,
            danger_level: "DANGEROUS".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "SFC Scan".to_string(),
            description: "Scanează și repară fișierele de sistem Windows.".to_string(),
            command: "sfc /scannow".to_string(),
            category: "System".to_string(),
            tags: vec!["sfc".to_string(), "repair".to_string(), "system".to_string()],
            favorite: false,
            requires_admin: true,
            danger_level: "DANGEROUS".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "IP Release".to_string(),
            description: "Eliberează adresa IP curentă.".to_string(),
            command: "ipconfig /release".to_string(),
            category: "Network".to_string(),
            tags: vec!["ip".to_string(), "network".to_string(), "release".to_string()],
            favorite: false,
            requires_admin: true,
            danger_level: "SAFE".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "IP Renew".to_string(),
            description: "Reînnoiește adresa IP de la serverul DHCP.".to_string(),
            command: "ipconfig /renew".to_string(),
            category: "Network".to_string(),
            tags: vec!["ip".to_string(), "network".to_string(), "renew".to_string()],
            favorite: false,
            requires_admin: true,
            danger_level: "SAFE".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "System Info".to_string(),
            description: "Afișează informații detaliate despre sistemul Windows.".to_string(),
            command: "systeminfo".to_string(),
            category: "System".to_string(),
            tags: vec!["system".to_string(), "info".to_string(), "diagnostic".to_string()],
            favorite: false,
            requires_admin: false,
            danger_level: "SAFE".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Power Efficiency".to_string(),
            description: "Generează raport detaliat despre eficiența energetică.".to_string(),
            command: "powercfg /energy".to_string(),
            category: "System".to_string(),
            tags: vec!["power".to_string(), "energy".to_string(), "report".to_string()],
            favorite: false,
            requires_admin: true,
            danger_level: "ADMIN".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
        SystemCommand {
            id: Uuid::new_v4().to_string(),
            name: "Disk Cleanup".to_string(),
            description: "Lansează instrumentul de curățare a discului.".to_string(),
            command: "cleanmgr /sagerun:1".to_string(),
            category: "Cleanup".to_string(),
            tags: vec!["disk".to_string(), "cleanup".to_string(), "space".to_string()],
            favorite: false,
            requires_admin: false,
            danger_level: "DANGEROUS".to_string(),
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        },
    ]
}

impl SystemToolsManager {
    pub fn new(base_path: PathBuf) -> Self {
        let commands_path = base_path.join("commands.json");
        let history_path = base_path.join("command_history.json");

        let commands = if commands_path.exists() {
            let content = fs::read_to_string(&commands_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_else(|_| seed_default_commands())
        } else {
            let cmds = seed_default_commands();
            if let Ok(content) = serde_json::to_string_pretty(&cmds) {
                let _ = fs::write(&commands_path, content);
            }
            cmds
        };

        let history = if history_path.exists() {
            let content = fs::read_to_string(&history_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        Self {
            commands: Mutex::new(commands),
            commands_path,
            history: Mutex::new(history),
            history_path,
        }
    }

    fn save_commands(&self) -> Result<(), String> {
        let cmds = self.commands.lock().map_err(|e| e.to_string())?;
        let content = serde_json::to_string_pretty(&*cmds).map_err(|e| e.to_string())?;
        fs::write(&self.commands_path, content).map_err(|e| e.to_string())
    }

    fn save_history(&self) -> Result<(), String> {
        let history = self.history.lock().map_err(|e| e.to_string())?;
        let content = serde_json::to_string_pretty(&*history).map_err(|e| e.to_string())?;
        fs::write(&self.history_path, content).map_err(|e| e.to_string())
    }

    pub fn get_commands(&self) -> Vec<SystemCommand> {
        self.commands.lock().map(|c| c.clone()).unwrap_or_default()
    }

    pub fn create_command(&self, name: String, description: String, command: String, category: String, tags: Vec<String>, requires_admin: bool, danger_level: String) -> Result<String, String> {
        let mut cmds = self.commands.lock().map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        cmds.push(SystemCommand {
            id: id.clone(),
            name,
            description,
            command,
            category,
            tags,
            favorite: false,
            requires_admin,
            danger_level,
            last_run: None,
            last_status: None,
            created_at: chrono_now(),
        });
        drop(cmds);
        self.save_commands()?;
        Ok(id)
    }

    pub fn update_command(&self, id: String, name: String, description: String, command: String, category: String, tags: Vec<String>, requires_admin: bool, danger_level: String) -> Result<(), String> {
        let mut cmds = self.commands.lock().map_err(|e| e.to_string())?;
        if let Some(cmd) = cmds.iter_mut().find(|c| c.id == id) {
            cmd.name = name;
            cmd.description = description;
            cmd.command = command;
            cmd.category = category;
            cmd.tags = tags;
            cmd.requires_admin = requires_admin;
            cmd.danger_level = danger_level;
            drop(cmds);
            self.save_commands()?;
            Ok(())
        } else {
            Err("Comandă negăsită".to_string())
        }
    }

    pub fn delete_command(&self, id: String) -> Result<(), String> {
        let mut cmds = self.commands.lock().map_err(|e| e.to_string())?;
        let len = cmds.len();
        cmds.retain(|c| c.id != id);
        if cmds.len() == len {
            return Err("Comandă negăsită".to_string());
        }
        drop(cmds);
        self.save_commands()?;
        Ok(())
    }

    pub fn toggle_favorite(&self, id: String) -> Result<bool, String> {
        let mut cmds = self.commands.lock().map_err(|e| e.to_string())?;
        if let Some(cmd) = cmds.iter_mut().find(|c| c.id == id) {
            cmd.favorite = !cmd.favorite;
            let fav = cmd.favorite;
            drop(cmds);
            self.save_commands()?;
            Ok(fav)
        } else {
            Err("Comandă negăsită".to_string())
        }
    }

    pub fn execute_command(&self, id: String) -> Result<CommandHistoryEntry, String> {
        let cmd = {
            let cmds = self.commands.lock().map_err(|e| e.to_string())?;
            cmds.iter().find(|c| c.id == id).cloned().ok_or("Comandă negăsită".to_string())?
        };

        let now = chrono_now();
        let mut output_text = String::new();
        let success: bool;

        if cmd.requires_admin {
            let temp_output = std::env::temp_dir().join(format!("st_out_{}.tmp", Uuid::new_v4()));
            let ps_cmd = format!(
                "Start-Process cmd -ArgumentList '/c \"{} > {} 2>&1\"' -Verb RunAs -Wait -WindowStyle Hidden",
                cmd.command.replace('"', "\\\""),
                temp_output.display()
            );
            let result = Command::new("powershell")
                .args(["-Command", &ps_cmd])
                .output()
                .map_err(|e| format!("Eroare execuție: {}", e))?;

            success = result.status.success();

            if temp_output.exists() {
                let file = fs::File::open(&temp_output).ok();
                if let Some(f) = file {
                    let reader = BufReader::new(f);
                    for line in reader.lines() {
                        if let Ok(l) = line {
                            if !output_text.is_empty() { output_text.push('\n'); }
                            output_text.push_str(&l);
                        }
                    }
                }
                let _ = fs::remove_file(&temp_output);
            }

            if output_text.is_empty() {
                output_text = if success {
                    "Comanda a fost executată cu privilegii administrative.".to_string()
                } else {
                    "Comanda nu a putut fi executată. Verificați permisiunile.".to_string()
                };
            }
        } else {
            let result = Command::new("cmd")
                .args(["/C", &cmd.command])
                .output()
                .map_err(|e| format!("Eroare execuție: {}", e))?;

            success = result.status.success();
            let stdout = String::from_utf8_lossy(&result.stdout).to_string();
            let stderr = String::from_utf8_lossy(&result.stderr).to_string();
            output_text = if !stdout.is_empty() { stdout } else { stderr };
            if output_text.is_empty() {
                output_text = if success { "Comanda s-a executat cu succes." } else { "Comanda a eșuat." }.to_string();
            }
        }

        let entry = CommandHistoryEntry {
            command_id: cmd.id.clone(),
            command_name: cmd.name.clone(),
            timestamp: now.clone(),
            success,
            output: output_text.clone(),
        };

        {
            let mut cmds = self.commands.lock().map_err(|e| e.to_string())?;
            if let Some(c) = cmds.iter_mut().find(|c| c.id == id) {
                c.last_run = Some(now);
                c.last_status = Some(if success { "success".to_string() } else { "error".to_string() });
            }
        }
        self.save_commands()?;

        {
            let mut hist = self.history.lock().map_err(|e| e.to_string())?;
            hist.push(entry.clone());
        }
        self.save_history()?;

        Ok(entry)
    }

    pub fn get_history(&self) -> Vec<CommandHistoryEntry> {
        self.history.lock().map(|h| h.clone()).unwrap_or_default()
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let mut hist = self.history.lock().map_err(|e| e.to_string())?;
        hist.clear();
        drop(hist);
        self.save_history()?;
        Ok(())
    }
}
