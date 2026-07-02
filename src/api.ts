import { invoke } from "@tauri-apps/api/core";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SoftwareItem {
  path: string;
  name: string;
  description: string;
  file_name: string;
  file_size: number;
  category_id: string | null;
  is_installed: boolean;
  version: string;
  publisher: string;
  icon_base64: string;
  is_favorite: boolean;
}

export interface HistoryEntry {
  timestamp: string;
  program_name: string;
  file_name: string;
  action: string;
}

export interface SystemCommand {
  id: string;
  name: string;
  description: string;
  command: string;
  category: string;
  tags: string[];
  favorite: boolean;
  requires_admin: boolean;
  danger_level: string;
  last_run: string | null;
  last_status: string | null;
  created_at: string;
}

export interface CommandHistoryEntry {
  command_id: string;
  command_name: string;
  timestamp: string;
  success: boolean;
  output: string;
}

export const api = {
  getSoftware: () => invoke<SoftwareItem[]>("get_software_list"),
  getCategories: () => invoke<Category[]>("get_categories"),
  createCategory: (name: string, icon: string, color: string) => invoke<string>("create_category", { name, icon, color }),
  updateCategory: (id: string, name: string, icon: string, color: string) => invoke<boolean>("update_category", { id, name, icon, color }),
  deleteCategory: (id: string) => invoke<boolean>("delete_category", { id }),
  assignCategory: (path: string, categoryId: string) => invoke<void>("assign_category", { path, categoryId }),
  toggleFavorite: (path: string) => invoke<boolean>("toggle_favorite", { path }),
  getSoftwarePath: () => invoke<string>("get_software_path"),
  updateSoftwarePath: (path: string) => invoke<boolean>("update_software_path", { path }),
  updateSoftwareMetadata: (path: string, name?: string | null, description?: string | null) => invoke<void>("update_software_metadata", { path, name: name ?? null, description: description ?? null }),
  deleteSoftware: (path: string, keepFile: boolean) => invoke<void>("delete_software", { path, keepFile }),
  getHiddenSoftware: () => invoke<string[]>("get_hidden_software"),
  unhideSoftware: (path: string) => invoke<boolean>("unhide_software", { path }),
  launchExe: (path: string) => invoke<void>("run_exe", { path }),
  openFolder: (path: string) => invoke<void>("run_open_folder", { path }),
  openTxt: (path: string) => invoke<void>("run_open_txt", { path }),
  getHistory: () => invoke<HistoryEntry[]>("get_history"),
  clearHistory: () => invoke<void>("clear_history"),
  exportCsv: (path: string) => invoke<void>("export_csv", { path }),
  exportConfig: (path: string) => invoke<void>("export_config", { path }),
  importConfig: (path: string) => invoke<void>("import_config", { path }),
  getSystemCommands: () => invoke<SystemCommand[]>("get_system_commands"),
  createSystemCommand: (name: string, description: string, command: string, category: string, tags: string[], requiresAdmin: boolean, dangerLevel: string) => invoke<string>("create_system_command", { name, description, command, category, tags, requiresAdmin, dangerLevel }),
  updateSystemCommand: (id: string, name: string, description: string, command: string, category: string, tags: string[], requiresAdmin: boolean, dangerLevel: string) => invoke<void>("update_system_command", { id, name, description, command, category, tags, requiresAdmin, dangerLevel }),
  deleteSystemCommand: (id: string) => invoke<void>("delete_system_command", { id }),
  toggleCommandFavorite: (id: string) => invoke<boolean>("toggle_command_favorite", { id }),
  executeSystemCommand: (id: string) => invoke<CommandHistoryEntry>("execute_system_command", { id }),
  getCommandExecutionHistory: () => invoke<CommandHistoryEntry[]>("get_command_execution_history"),
  clearCommandExecutionHistory: () => invoke<void>("clear_command_execution_history"),
};
