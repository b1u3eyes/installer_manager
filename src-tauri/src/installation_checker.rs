use winreg::RegKey;
use winreg::enums::*;
use std::collections::HashSet;

pub fn check_installed_programs() -> HashSet<String> {
    let mut installed_apps = HashSet::new();
    
    let paths = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (root, subkey) in paths {
        if let Ok(registry) = RegKey::predef(root).open_subkey_with_flags(subkey, KEY_READ) {
            for name in registry.enum_keys().map(|res| res.unwrap_or_default()) {
                if let Ok(app_key) = registry.open_subkey_with_flags(&name, KEY_READ) {
                    if let Ok(display_name) = app_key.get_value::<String, &str>("DisplayName") {
                        installed_apps.insert(display_name.to_lowercase());
                    }
                }
            }
        }
    }
    installed_apps
}
