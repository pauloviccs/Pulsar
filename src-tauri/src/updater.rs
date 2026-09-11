/**
 * Pulsar Sound & Sync
 * Módulo Nativo de Auto-Atualização em Streaming (Tauri v2 + Rust)
 */

use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
pub struct UpdateProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f32,
}

/// Normaliza URLs de instaladores para garantir download binário direto (.exe / .msi)
pub fn normalize_installer_url(url: &str) -> String {
    let mut clean = url.trim().to_string();

    // Dropbox: forçar download direto com dl=1
    if clean.contains("dropbox.com") {
        if clean.contains("dl=0") {
            clean = clean.replace("dl=0", "dl=1");
        } else if !clean.contains("dl=1") {
            if clean.contains('?') {
                clean.push_str("&dl=1");
            } else {
                clean.push_str("?dl=1");
            }
        }
    }

    // Google Drive: converter link de visualização (/file/d/ID/view) para download direto
    if clean.contains("drive.google.com") && clean.contains("/file/d/") {
        if let Some(start) = clean.find("/file/d/") {
            let sub = &clean[start + 8..];
            if let Some(end) = sub.find('/') {
                let id = &sub[..end];
                clean = format!("https://drive.google.com/uc?export=download&id={}", id);
            }
        }
    }

    // OneDrive: converter para download direto se aplicável
    if clean.contains("1drv.ms") || clean.contains("onedrive.live.com") {
        if !clean.contains("download=1") {
            if clean.contains('?') {
                clean.push_str("&download=1");
            } else {
                clean.push_str("?download=1");
            }
        }
    }

    clean
}

/// Normaliza URLs de manifesto para links RAW diretos
pub fn normalize_manifest_url(url: &str) -> String {
    let mut clean = url.trim().to_string();

    // GitHub: Converte links do blob para raw.githubusercontent.com
    if clean.contains("github.com/") && clean.contains("/blob/") {
        clean = clean
            .replace("github.com/", "raw.githubusercontent.com/")
            .replace("/blob/", "/");
    }

    // Pastebin: Converte para formato raw
    if clean.contains("pastebin.com/") && !clean.contains("pastebin.com/raw/") {
        clean = clean.replace("pastebin.com/", "pastebin.com/raw/");
    }

    clean
}

#[tauri::command]
pub async fn fetch_update_manifest(manifest_url: String) -> Result<serde_json::Value, String> {
    let mut clean_url = normalize_manifest_url(&manifest_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Pulsar-Desktop-Updater/1.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP nativo: {}", e))?;

    let mut res = client.get(&clean_url)
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar no manifesto remoto ({}): {}", clean_url, e))?;

    // Auto-fallback resiliente entre branches main e master se uma retornar 404
    if res.status().as_u16() == 404 {
        let alt_url = if clean_url.contains("/main/") {
            Some(clean_url.replace("/main/", "/master/"))
        } else if clean_url.contains("/master/") {
            Some(clean_url.replace("/master/", "/main/"))
        } else {
            None
        };

        if let Some(ref fallback_url) = alt_url {
            if let Ok(alt_res) = client.get(fallback_url).send().await {
                if alt_res.status().is_success() {
                    res = alt_res;
                    clean_url = fallback_url.clone();
                }
            }
        }
    }

    let status = res.status();
    if !status.is_success() {
        let code = status.as_u16();
        let reason = status.canonical_reason().unwrap_or("Erro de conexão");
        return Err(format!(
            "Servidor retornou erro HTTP {} ({}) ao consultar: {}",
            code, reason, clean_url
        ));
    }

    let text = res.text().await
        .map_err(|e| format!("Falha ao ler dados retornados do servidor: {}", e))?;

    if text.trim().is_empty() {
        return Err(format!("O servidor retornou uma resposta vazia ao consultar: {}", clean_url));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| {
            let snippet: String = text.chars().take(120).collect();
            format!(
                "O manifesto retornado não é um JSON válido: {} (Início: '{}')",
                e, snippet.replace('\n', " ").replace('\r', "")
            )
        })?;

    if json.get("version").and_then(|v| v.as_str()).is_none() {
        return Err("Manifesto de atualização inválido: campo 'version' obrigatório não encontrado.".to_string());
    }

    Ok(json)
}

#[tauri::command]
pub async fn download_and_run_installer(
    app: AppHandle,
    installer_url: String,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let direct_url = normalize_installer_url(&installer_url);
    let is_msi_url = direct_url.to_lowercase().ends_with(".msi");
    let ext = if is_msi_url { "msi" } else { "exe" };
    let mut installer_path: PathBuf = temp_dir.join(format!("Pulsar_Update_Setup_{}.{}", timestamp, ext));

    if installer_path.exists() {
        let _ = std::fs::remove_file(&installer_path);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300)) // 5 minutos de tolerância para conexões oscilantes
        .user_agent("Pulsar-Desktop-Updater/1.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

    let res = client.get(&direct_url)
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar no servidor de download: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Servidor retornou erro HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);

    // Criação do arquivo temporário
    let mut file = File::create(&installer_path)
        .map_err(|e| format!("Erro ao criar arquivo temporário do instalador: {}", e))?;

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emitted_percent = -1;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Falha no streaming do pacote de atualização: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Erro ao gravar dados no disco: {}", e))?;

        downloaded += chunk.len() as u64;

        let percentage = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        let current_int_percent = percentage.floor() as i32;
        if current_int_percent != last_emitted_percent {
            last_emitted_percent = current_int_percent;
            let _ = app.emit("updater-progress", UpdateProgress {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage,
            });
        }
    }

    file.flush().map_err(|e| format!("Erro ao finalizar gravação do arquivo: {}", e))?;
    drop(file); // Fechar o handle do arquivo antes de validar e executar

    // Validação estrita de integridade via Magic Bytes (impede execução de arquivos truncados ou erro de 16-bits)
    {
        let mut magic_buf = [0u8; 8];
        if let Ok(mut check_file) = File::open(&installer_path) {
            let bytes_read = check_file.read(&mut magic_buf).unwrap_or(0);
            if bytes_read >= 2 {
                let is_pe_exe = magic_buf[0] == 0x4D && magic_buf[1] == 0x5A; // Magic 'MZ'
                let is_ole_msi = bytes_read >= 8 && magic_buf == [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]; // OLE Compound File

                if !is_pe_exe && !is_ole_msi {
                    let _ = std::fs::remove_file(&installer_path);
                    return Err("O arquivo baixado não é um instalador executável válido do Windows (arquivo corrompido ou erro retornado pelo servidor).".into());
                }

                // Ajuste dinâmico de extensão se o link apontou para formato trocado
                if is_ole_msi && installer_path.extension().and_then(|e| e.to_str()) != Some("msi") {
                    let msi_path = temp_dir.join(format!("Pulsar_Update_Setup_{}.msi", timestamp));
                    if std::fs::rename(&installer_path, &msi_path).is_ok() {
                        installer_path = msi_path;
                    }
                } else if is_pe_exe && installer_path.extension().and_then(|e| e.to_str()) != Some("exe") {
                    let exe_path = temp_dir.join(format!("Pulsar_Update_Setup_{}.exe", timestamp));
                    if std::fs::rename(&installer_path, &exe_path).is_ok() {
                        installer_path = exe_path;
                    }
                }
            } else {
                let _ = std::fs::remove_file(&installer_path);
                return Err("O arquivo baixado está vazio ou truncado.".into());
            }
        }
    }

    // Execução desacoplada no Windows com suporte à elevação de privilégio UAC
    #[cfg(target_os = "windows")]
    {
        let installer_str = installer_path.to_string_lossy().to_string();

        // Método 1: Disparo via ShellExecute através do 'cmd /C start "" "path"'
        let spawn_res = std::process::Command::new("cmd")
            .args(["/C", "start", "", &installer_str])
            .spawn();

        let launched = match spawn_res {
            Ok(_) => true,
            Err(e) => {
                eprintln!("[Pulsar Updater] Falha no cmd /C start: {}. Tentando fallback PowerShell RunAs...", e);
                // Método 2: Fallback via PowerShell com -Verb RunAs (garante elevação administrativa)
                let ps_res = std::process::Command::new("powershell")
                    .args([
                        "-NoProfile",
                        "-WindowStyle", "Hidden",
                        "-Command",
                        &format!("Start-Process -FilePath '{}' -Verb RunAs", installer_str.replace('\'', "''"))
                    ])
                    .spawn();

                match ps_res {
                    Ok(_) => true,
                    Err(ps_err) => {
                        return Err(format!("Falha ao iniciar o instalador (cmd: {}, ps: {})", e, ps_err));
                    }
                }
            }
        };

        if launched {
            // Aguarda 1 segundo para garantir que o processo do instalador foi criado pela shell do Windows
            tokio::time::sleep(Duration::from_millis(1000)).await;
            // Encerra o Pulsar antigo para liberar os arquivos binários para a instalação
            std::process::exit(0);
        }

        Ok("Instalador disparado com sucesso.".into())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Download concluído. Em plataformas não-Windows, execute o pacote manualmente.".into())
    }
}
