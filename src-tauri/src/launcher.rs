use std::process::Command;
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub fn open_folder(path: String) -> Result<(), String> {
    let folder = Path::new(&path).parent().ok_or("Could not find parent folder")?;
    
    Command::new("explorer")
        .arg(folder)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    
    Ok(())
}

pub fn open_txt(path: String) -> Result<(), String> {
    Command::new("notepad") 
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open text file: {}", e))?;
    
    Ok(())
}

pub fn launch_exe_with_event(app: &AppHandle, path: String) -> Result<(), String> {
    let path_clone = path.clone();
    
    // Emit "install-started" event
    app.emit("install-status", format!("started|{}", path_clone)).unwrap();

    let mut child = Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch exe: {}", e))?;

    // In a real production app, we would spawn a thread to wait for child.wait()
    // For this design, we simulate the process completion since installers 
    // are detached processes.
    let app_clone = app.clone();
    std::thread::spawn(move || {
        // We monitor the process roughly or just wait for a brief moment for the setup to launch
        let _ = child.wait();
        app_clone.emit("install-status", format!("finished|{}", path)).unwrap();
    });

    Ok(())
}
