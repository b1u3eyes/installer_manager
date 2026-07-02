# Software Installer Suite

> **Tauri v2 Desktop App** — Software Installer Manager + Windows System Tools Center

O aplicație desktop modernă, construită cu **Tauri v2**, **React 19** și **TypeScript**, care combină un manager de instalare software cu un centru de comenzi Windows. Interfață dark mode cu efect glassmorphism și accente neon green.

---

## ✨ Features

### 📦 Software Installer Manager
- **Scanare automată** a folderului pentru fișiere `.exe` și `.txt`
- **Detecție instalare** prin registry Windows (HKLM + HKCU)
- **Categorii** cu iconițe emoji + culori — creare, editare, ștergere, asignare
- **Favorite** — marcare rapidă cu ★
- **Filtre**: Toate / Instalate / Neinstalate
- **Sortare**: Nume, Mărime, Instalate prima, Favorite prima
- **Vizualizare**: Grid (carduri) sau Listă (compact)
- **Editare inline** nume și descriere în panoul de detalii
- **Lansare program** cu dialog de confirmare
- **Ștergere program** — ascunde din listă sau șterge complet `.exe` + `.txt`
- **Drag & drop** suport pentru fișiere
- **Monitorizare** folder Software în timp real (watchdog)
- **Export CSV** + **Import/Export Config**
- **Statistics dashboard** — instalări per categorie cu bare grafice

### ⚡ System Tools Center
- **10 comenzi Windows pre-definite**: Flush DNS, Restart Explorer, Clear Temp Files, Check Disk, SFC Scan, IP Release, IP Renew, System Info, Power Efficiency, Disk Cleanup
- **Comenzi custom** — adaugă, editează, șterge propriile comenzi Windows
- **Execuție** cu captură stdout/stderr
- **Suport UAC** — comenzile care necesită admin se execută cu prompt Windows de elevație
- **Badge-uri** de pericol: SAFE 🟢 / ADMIN 🟡 / DANGEROUS 🔴
- **Output terminal** colorizat în panoul din dreapta
- **Istoric execuții** — cronologie cu status succes/eroare
- **Filtre**: Toate / Favorite / Necesită Admin
- **Sortare**: Favorite First, Alfabetic, Ultima rulare, Categorie

---

## 🛠️ Tech Stack

| Layer | Tehnologie |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Vite 7 |
| **Backend** | Rust, Tauri v2 |
| **UI State** | clsx, tailwind-merge |
| **Persistence** | JSON files (`categories.json`, `history.json`, `commands.json`, `command_history.json`) |
| **Build** | Vite (frontend) + Cargo (backend Rust) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/) (stable toolchain)
- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/) — Visual Studio Build Tools + WebView2
- Sistem de operare: **Windows 10 / 11** (aplicația folosește API Win32 și registry)

---

## 🚀 Instalare & Build

```bash
# Clonează repository-ul
git clone https://github.com/utilizator/software-installer-suite.git
cd software-installer-suite/installer_manager

# Instalează dependențele frontend
npm install

# Rulează în mod dezvoltare (cu hot-reload)
npm run tauri dev

# Build pentru producție
npm run tauri build
```

După build, vei găsi:
- **Portable .exe**: `src-tauri/target/release/tauri-app.exe`
- **Instalator MSI**: `src-tauri/target/release/bundle/msi/Software Installer Suite_0.1.0_x64_en-US.msi`
- **Instalator NSIS (setup.exe)**: `src-tauri/target/release/bundle/nsis/Software Installer Suite_0.1.0_x64-setup.exe`

---

## 📁 Structura Proiectului

```
installer_manager/
├── src/                              # Frontend (React + TypeScript)
│   ├── App.tsx                       # Componenta principală — layout, sidebar, modale, right panel
│   ├── SystemTools.tsx               # Modul System Tools (comenzi, filtre, grid, modale)
│   ├── api.ts                        # API client — toate invoke() către backend Rust
│   ├── main.tsx                      # Entry point React
│   ├── index.css                     # Tailwind CSS v4 import
│   └── assets/                       # Fișiere statice
├── src-tauri/                        # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                   # Entry point + toate #[tauri::command] înregistrate
│   │   ├── lib.rs                    # Tauri plugin setup
│   │   ├── models.rs                 # Structuri de date (SoftwareItem, Category, AppConfig)
│   │   ├── categories.rs             # CRUD categorii, favorite, hidden, metadata
│   │   ├── scanner.rs                # Scanare folder Software (.exe + .txt + registry)
│   │   ├── launcher.rs               # Lansare .exe, open folder, open txt
│   │   ├── installation_checker.rs   # Detecție instalare prin registry Windows
│   │   ├── metadata_extractor.rs     # Extracție versiune, publisher, icon
│   │   ├── history.rs                # Istoric instalări (history.json)
│   │   └── system_tools.rs           # System Tools — comenzi CRUD, execuție, istoric
│   ├── Cargo.toml                    # Dependențe Rust
│   └── tauri.conf.json               # Configurare Tauri (fereastră, securitate, bundle)
├── public/                           # Assets publice (favicon, etc.)
├── package.json                      # Dependențe frontend
├── vite.config.ts                    # Config Vite
├── tsconfig.json                     # Config TypeScript
└── README.md                         # Acest fișier
```

---

## 🎮 Utilizare

### 📦 Software Installer
1. Plasează fișiere `.exe` și `.txt` (instrucțiuni) în folderul **Software**
2. Apasă **🔄 Scanează** sau așteaptă detectarea automată
3. Atribuie o categorie programelor noi (se deschide automat dialogul)
4. Folosește filtrele și sortarea din bara de sus pentru navigare
5. Click **⬇ Instalează** (program neinstalat) sau **▶ Deschide** (deja instalat)
6. Vezi statistici în panoul din dreapta → tab-ul **Stats**

### ⚡ System Tools
1. Click **🖥 System Tools** în sidebar-ul din stânga
2. Selectează o comandă din listă (sunt 10 pre-definite)
3. Click **Execută** → confirmă în dialog
4. Output-ul apare automat în panoul din dreapta → tab-ul **Output**
5. Adaugă comenzi proprii cu **➕ Adaugă comandă**
6. Filtrează: **Toate** / **⭐ Favorite** / **⚙ Necesită Admin**

---

## 🔧 Dezvoltare

### Comenzi utile

```bash
npm run dev              # Pornește Vite dev server (frontend)
npm run build            # Build frontend (tsc + vite)
npm run tauri dev        # Pornește aplicația în mod dezvoltare (cu hot-reload)
npm run tauri build      # Build final: frontend + backend + bundle (msi + nsis)
npx tsc --noEmit         # Verificare tipuri TypeScript
cargo check              # Verificare compilare Rust (fără build final)
```

### Arhitectură modulară — cum adaugi un modul nou

Aplicația este gândită să fie ușor extensibilă. Fiecare modul nou (ex: Security Tools, Network Tools) urmează același pattern:

**Backend (Rust):**
1. Creează `src-tauri/src/noul_modul.rs` (copiază modelul din `system_tools.rs`)
2. În `main.rs`: adaugă `mod noul_modul;` + `use` + comenzi `#[tauri::command]` + înregistrare în `invoke_handler![]`
3. JSON persistence: `noul_modul.json` + `noul_modul_history.json`

**Frontend (React):**
1. Creează `src/NoulModul.tsx` (copiază modelul din `SystemTools.tsx`)
2. În `App.tsx`: adaugă `showNoulModul` state + sidebar entry + right panel content

---

## 🤝 Contribuții

Contribuțiile sunt binevenite! Pași:

1. Fork repository-ul
2. Creează un branch: `git checkout -b feature/amazing-feature`
3. Commitează: `git commit -m 'Adaugă funcționalitate X'`
4. Push: `git push origin feature/amazing-feature`
5. Deschide un Pull Request

---

## 📄 Licență

Distribuit sub **MIT License**. Vezi fișierul `LICENSE` pentru detalii.

---

*Construit cu ❤️ și Rust + React*
