use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemAudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_bluetooth: bool,
    pub is_connected: bool,
    pub device_type: String, // "speaker", "headphones", "bluetooth", "tv", "generic"
}

#[cfg(target_os = "windows")]
pub fn get_system_audio_devices() -> Result<Vec<SystemAudioDevice>, String> {
    use windows::core::GUID;
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
        COINIT_MULTITHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

    // Passo 0: Ler nomes dos dispositivos BT pareados do Registro do Windows para auxílio na identificação
    let bt_paired_names = read_bluetooth_paired_names();

    let mut raw_list = Vec::new();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator =
            match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                Ok(e) => e,
                Err(err) => {
                    CoUninitialize();
                    let msg = format!("Falha ao instanciar IMMDeviceEnumerator: {:?}", err);
                    crate::logger::log_error(&msg);
                    return Err(msg);
                }
            };

        let default_id = match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
            Ok(dev) => dev
                .GetId()
                .ok()
                .and_then(|pwstr| pwstr.to_string().ok())
                .unwrap_or_default(),
            Err(_) => String::new(),
        };

        // ENUMERAÇÃO LIMPA: Apenas dispositivos com estado ATIVO (DEVICE_STATE_ACTIVE = 1).
        // Isso impede que fones desligados ou fantasmas do registro poluam a lista com opções quebradas.
        let collection = match enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
            Ok(c) => c,
            Err(err) => {
                CoUninitialize();
                let msg = format!("Falha ao enumerar Audio Endpoints ativos: {:?}", err);
                crate::logger::log_error(&msg);
                return Err(msg);
            }
        };

        let count = collection.GetCount().unwrap_or(0);

        let pkey_friendly_name = PROPERTYKEY {
            fmtid: GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
            pid: 14,
        };
        let pkey_interface_name = PROPERTYKEY {
            fmtid: GUID::from_u128(0x026e516e_b814_414b_83cd_856d6fef4822),
            pid: 2,
        };

        let pkey_enumerator_name = PROPERTYKEY {
            fmtid: GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
            pid: 24,
        };

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                let id = device
                    .GetId()
                    .ok()
                    .and_then(|pwstr| pwstr.to_string().ok())
                    .unwrap_or_default();

                if id.is_empty() {
                    continue;
                }

                let is_default = !default_id.is_empty() && id == default_id;

                let mut name = String::new();
                let mut interface_name = String::new();
                let mut enumerator_name = String::new();

                if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
                    if let Ok(prop) = store.GetValue(&pkey_friendly_name) {
                        if let Ok(pwstr) = PropVariantToStringAlloc(&prop) {
                            if let Ok(s) = pwstr.to_string() {
                                name = s;
                            }
                            CoTaskMemFree(Some(pwstr.as_ptr().cast()));
                        }
                    }

                    if let Ok(prop) = store.GetValue(&pkey_interface_name) {
                        if let Ok(pwstr) = PropVariantToStringAlloc(&prop) {
                            if let Ok(s) = pwstr.to_string() {
                                interface_name = s.clone();
                                if name.is_empty() {
                                    name = s;
                                }
                            }
                            CoTaskMemFree(Some(pwstr.as_ptr().cast()));
                        }
                    }

                    if let Ok(prop) = store.GetValue(&pkey_enumerator_name) {
                        if let Ok(pwstr) = PropVariantToStringAlloc(&prop) {
                            if let Ok(s) = pwstr.to_string() {
                                enumerator_name = s;
                            }
                            CoTaskMemFree(Some(pwstr.as_ptr().cast()));
                        }
                    }
                }

                if name.is_empty() {
                    continue;
                }

                let name_lower = name.to_lowercase();
                let id_lower = id.to_lowercase();
                let interface_lower = interface_name.to_lowercase();
                let enum_lower = enumerator_name.to_lowercase();

                // ── Filtro de Drivers Virtuais ──
                let is_virtual_driver = name_lower.contains("voicemod")
                    || name_lower.contains("nvidia broadcast")
                    || name_lower.contains("steam streaming")
                    || name_lower.contains("iriun")
                    || name_lower.contains("virtual audio");

                if is_virtual_driver {
                    continue;
                }

                // ── Identificação Universal de Bluetooth via Driver & Hardware ──
                let id_has_bth = id_lower.contains("bth") || id_lower.contains("bluetooth");
                let enum_has_bth = enum_lower.contains("bth") || enum_lower.contains("bluetooth");
                let interface_has_bth = interface_lower.contains("bth") || interface_lower.contains("bluetooth");

                let matches_bt_registry = bt_paired_names.iter().any(|bt_name| {
                    let bt_low = bt_name.to_lowercase();
                    name_lower.contains(&bt_low)
                        || bt_low.contains(&extract_model_name(&name_lower))
                });
                let has_bt_keywords = name_lower.contains("haylou")
                    || name_lower.contains("hi-lo")
                    || name_lower.contains("s30")
                    || name_lower.contains("airpods")
                    || name_lower.contains("galaxy buds")
                    || name_lower.contains("edifier")
                    || name_lower.contains("jbl")
                    || (name_lower.contains("pro") && !name_lower.contains("realtek"));

                let is_bluetooth = id_has_bth 
                    || enum_has_bth 
                    || interface_has_bth 
                    || matches_bt_registry 
                    || (has_bt_keywords && !name_lower.contains("nvidia"));

                // ── Identificação de TVs / Monitores HDMI ──
                let is_tv = name_lower.contains("nvidia")
                    || name_lower.contains("amd high definition")
                    || name_lower.contains("hdmi")
                    || name_lower.contains("tv")
                    || name_lower.contains("philco")
                    || name_lower.contains("lg tv")
                    || name_lower.contains("samsung");

                let is_headphones = name_lower.contains("fone")
                    || name_lower.contains("headset")
                    || name_lower.contains("headphone")
                    || name_lower.contains("earphone");

                let device_type = if is_bluetooth {
                    "bluetooth".to_string()
                } else if is_tv {
                    "tv".to_string()
                } else if is_headphones {
                    "headphones".to_string()
                } else {
                    "speaker".to_string()
                };

                raw_list.push(SystemAudioDevice {
                    id,
                    name,
                    is_default,
                    is_bluetooth,
                    is_connected: true, // Dispositivos ativos estão conectados
                    device_type,
                });
            }
        }

        CoUninitialize();
    }

    // ── Deduplicação inteligente por NOME DO MODELO ──
    let mut dedup_map: std::collections::HashMap<String, SystemAudioDevice> =
        std::collections::HashMap::new();
    for dev in raw_list {
        let model_key = extract_model_name(&dev.name.to_lowercase());

        if let Some(existing) = dedup_map.get_mut(&model_key) {
            // Prioridade: dispositivo padrão > "Fones de ouvido" (A2DP stereo) sobre "Headset" (HFP mono)
            if dev.is_default {
                *existing = dev;
            } else if !dev.name.to_lowercase().contains("hands-free")
                && existing.name.to_lowercase().contains("hands-free")
            {
                *existing = dev;
            }
        } else {
            dedup_map.insert(model_key, dev);
        }
    }

    let mut result: Vec<SystemAudioDevice> = dedup_map.into_values().collect();
    result.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then_with(|| (a.device_type == "bluetooth").cmp(&(b.device_type == "bluetooth")).reverse())
            .then_with(|| a.name.cmp(&b.name))
    });

    crate::logger::log_info(&format!(
        "[AudioDevices] Endpoints de áudio ativos detectados: {}",
        result.len()
    ));
    for d in &result {
        crate::logger::log_info(&format!(
            "  - [{}] {} (Default: {}, BT: {})",
            d.device_type, d.name, d.is_default, d.is_bluetooth
        ));
    }

    Ok(result)
}

/// Extrai o nome do modelo do dispositivo removendo:
/// - Prefixo de tipo: "Fones de ouvido", "Headset", "Alto-falantes", etc.
/// - Parênteses e conteúdo extra como driver name
/// - Sufixos: "Hands-Free", "Stereo"
/// - Numeração do Windows: "5-", "6-", etc.
#[cfg(target_os = "windows")]
fn extract_model_name(full_name: &str) -> String {
    let lower = full_name.to_lowercase();

    if let Some(start) = lower.find('(') {
        if let Some(end) = lower.rfind(')') {
            if end > start {
                let inner = &lower[start + 1..end];
                let cleaned = clean_model_token(inner);
                if !cleaned.is_empty() {
                    if cleaned.contains("nvidia") || cleaned.contains("realtek") || cleaned.contains("high definition") {
                        let prefix = lower[..start].trim();
                        let prefix_cleaned = clean_model_token(prefix);
                        if !prefix_cleaned.is_empty() {
                            return prefix_cleaned;
                        }
                    }
                    return cleaned;
                }
            }
        }
    }

    clean_model_token(&lower)
}

/// Limpa tokens de modelo removendo prefixos numéricos, "hands-free", "stereo", etc.
#[cfg(target_os = "windows")]
fn clean_model_token(s: &str) -> String {
    let cleaned = s
        .replace("hands-free", "")
        .replace("stereo", "")
        .replace("fones de ouvido", "")
        .replace("headset", "")
        .replace("headphones", "")
        .replace("alto-falantes", "")
        .replace("speakers", "");

    let mut result: Vec<&str> = Vec::new();
    for token in cleaned.split_whitespace() {
        let stripped = token.trim_matches(|c: char| c == '-' || c == '(' || c == ')');
        if stripped.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        if !token.is_empty() {
            result.push(stripped);
        }
    }

    result.join(" ").trim().to_string()
}

/// Lê nomes de dispositivos BT pareados do Registro do Windows para enriquecer a busca.
#[cfg(target_os = "windows")]
fn read_bluetooth_paired_names() -> Vec<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let mut names = Vec::new();

    // 1. Ler chaves de dispositivos conhecidos em BTHPORT
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(bt_key) =
        hklm.open_subkey("SYSTEM\\CurrentControlSet\\Services\\BTHPORT\\Parameters\\Devices")
    {
        for mac_result in bt_key.enum_keys() {
            if let Ok(mac) = mac_result {
                if let Ok(dev_key) = bt_key.open_subkey(&mac) {
                    if let Ok(name_bytes) = dev_key.get_raw_value("Name") {
                        let name_str = String::from_utf8_lossy(&name_bytes.bytes)
                            .trim_end_matches('\0')
                            .to_string();
                        if !name_str.is_empty() && !names.contains(&name_str) {
                            names.push(name_str);
                        }
                    }
                }
            }
        }
    }

    // 2. Busca abrangente em BTHENUM (instâncias de PnP registradas para qualquer fone/speaker)
    if let Ok(bthenum_key) = hklm.open_subkey("SYSTEM\\CurrentControlSet\\Enum\\BTHENUM") {
        for dev_result in bthenum_key.enum_keys() {
            if let Ok(dev_id) = dev_result {
                if let Ok(inst_parent) = bthenum_key.open_subkey(&dev_id) {
                    for inst_result in inst_parent.enum_keys() {
                        if let Ok(inst_id) = inst_result {
                            if let Ok(inst_key) = inst_parent.open_subkey(&inst_id) {
                                if let Ok(friendly) = inst_key.get_value::<String, _>("FriendlyName") {
                                    if !friendly.is_empty() && !names.contains(&friendly) {
                                        names.push(friendly);
                                    }
                                } else if let Ok(desc) = inst_key.get_value::<String, _>("DeviceDesc") {
                                    let clean_desc = if let Some(semicolon) = desc.rfind(';') {
                                        desc[semicolon + 1..].to_string()
                                    } else {
                                        desc
                                    };
                                    if !clean_desc.is_empty() && !names.contains(&clean_desc) {
                                        names.push(clean_desc);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    names
}

/// Abre o painel de configurações nativo de Bluetooth do Windows de forma 100% silenciosa,
/// sem abrir nenhuma janela de console/CMD/PowerShell.
pub fn open_bluetooth_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        crate::logger::log_info("[Bluetooth] Abrindo configurações nativas de Bluetooth do Windows silenciosamente...");

        std::process::Command::new("explorer")
            .arg("ms-settings:bluetooth")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| {
                let err = format!("Falha ao abrir configurações de Bluetooth: {}", e);
                crate::logger::log_error(&err);
                err
            })?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Abertura de configurações de Bluetooth suportada apenas no Windows".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_system_audio_devices() -> Result<Vec<SystemAudioDevice>, String> {
    Ok(vec![SystemAudioDevice {
        id: "default".to_string(),
        name: "Dispositivo Padrão do Sistema".to_string(),
        is_default: true,
        is_bluetooth: false,
        is_connected: true,
        device_type: "speaker".to_string(),
    }])
}
