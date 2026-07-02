use std::path::Path;

pub fn get_file_version(_path: &Path) -> String {
    "1.0.0".to_string()
}

pub fn get_file_publisher(_path: &Path) -> String {
    "Unknown Publisher".to_string()
}

pub fn extract_icon_base64(_path: &Path) -> String {
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXN0fGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTl9pY2QAAAA".to_string()
}
