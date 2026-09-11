use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;

static LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
const MAX_LOG_ENTRIES: usize = 500;

/// Obtém o diretório de logs da aplicação em %APPDATA%/com.pulsar.app/logs
pub fn get_logs_dir() -> PathBuf {
    if let Some(mut dir) = dirs::data_dir() {
        dir.push("com.pulsar.app");
        dir.push("logs");
        dir
    } else {
        std::env::temp_dir().join("pulsar_logs")
    }
}

/// Obtém o caminho completo para o arquivo pulsar.log
pub fn get_log_file_path() -> PathBuf {
    get_logs_dir().join("pulsar.log")
}

/// Inicializa o sistema de logs garantindo que o diretório exista
pub fn init_logger() {
    let log_dir = get_logs_dir();
    if let Err(e) = create_dir_all(&log_dir) {
        eprintln!("[Logger] Falha ao criar diretório de logs: {:?}", e);
    }
    log_info("Sistema de Logs do Pulsar inicializado.");
}

/// Registra uma mensagem de nível INFO
pub fn log_info(msg: &str) {
    write_log("INFO", msg);
}

/// Registra uma mensagem de nível WARN
pub fn log_warn(msg: &str) {
    write_log("WARN", msg);
}

/// Registra uma mensagem de nível ERROR
pub fn log_error(msg: &str) {
    write_log("ERROR", msg);
}

/// Registra no arquivo físico e no buffer em memória com timestamp local
pub fn write_log(level: &str, msg: &str) {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let entry = format!("[{}] [{}] {}", now, level, msg);

    // 1. Grava no buffer de memória para consulta imediata na UI
    if let Ok(mut buf) = LOG_BUFFER.lock() {
        if buf.len() >= MAX_LOG_ENTRIES {
            buf.remove(0);
        }
        buf.push(entry.clone());
    }

    // 2. Grava de forma persistente no arquivo pulsar.log
    let log_path = get_log_file_path();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(file, "{}", entry);
    }
}

/// Retorna os logs armazenados na memória (ou do arquivo se a memória estiver vazia)
pub fn get_logs() -> Vec<String> {
    if let Ok(buf) = LOG_BUFFER.lock() {
        if !buf.is_empty() {
            return buf.clone();
        }
    }

    // Fallback: lê as últimas linhas do arquivo físico
    let log_path = get_log_file_path();
    if let Ok(content) = std::fs::read_to_string(log_path) {
        let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        let start = if lines.len() > MAX_LOG_ENTRIES {
            lines.len() - MAX_LOG_ENTRIES
        } else {
            0
        };
        return lines[start..].to_vec();
    }

    Vec::new()
}

/// Abre a pasta de logs no Windows Explorer
pub fn open_logs_directory() -> Result<(), String> {
    let log_dir = get_logs_dir();
    if !log_dir.exists() {
        let _ = create_dir_all(&log_dir);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("explorer")
            .arg(log_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Falha ao abrir Windows Explorer: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}
