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

    let mut result = Vec::new();

    unsafe {
        // Inicializa COM para a thread atual
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
            Ok(e) => e,
            Err(err) => {
                CoUninitialize();
                return Err(format!("Falha ao instanciar IMMDeviceEnumerator: {:?}", err));
            }
        };

        // Obter o ID do dispositivo padrão atual
        let default_id = match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
            Ok(dev) => dev
                .GetId()
                .ok()
                .and_then(|pwstr| pwstr.to_string().ok())
                .unwrap_or_default(),
            Err(_) => String::new(),
        };

        // Enumera dispositivos de renderização (saída de som) ativos
        let collection = match enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
            Ok(c) => c,
            Err(err) => {
                CoUninitialize();
                return Err(format!("Falha ao enumerar Audio Endpoints: {:?}", err));
            }
        };

        let count = collection.GetCount().unwrap_or(0);

        // Chaves de propriedade para obter nomes amigáveis
        // PKEY_Device_FriendlyName = {a45c254e-df1c-4efd-8020-67d146a850e0}, 14
        let pkey_friendly_name = PROPERTYKEY {
            fmtid: GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
            pid: 14,
        };
        // PKEY_DeviceInterface_FriendlyName = {026e516e-b814-414b-83cd-856d6fef4822}, 2
        let pkey_interface_name = PROPERTYKEY {
            fmtid: GUID::from_u128(0x026e516e_b814_414b_83cd_856d6fef4822),
            pid: 2,
        };

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                let id = device
                    .GetId()
                    .ok()
                    .and_then(|pwstr| pwstr.to_string().ok())
                    .unwrap_or_default();

                let is_default = !default_id.is_empty() && id == default_id;

                let mut name = String::new();
                if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
                    if let Ok(prop) = store.GetValue(&pkey_friendly_name) {
                        if let Ok(pwstr) = PropVariantToStringAlloc(&prop) {
                            if let Ok(s) = pwstr.to_string() {
                                name = s;
                            }
                            CoTaskMemFree(Some(pwstr.as_ptr().cast()));
                        }
                    }

                    if name.is_empty() {
                        if let Ok(prop) = store.GetValue(&pkey_interface_name) {
                            if let Ok(pwstr) = PropVariantToStringAlloc(&prop) {
                                if let Ok(s) = pwstr.to_string() {
                                    name = s;
                                }
                                CoTaskMemFree(Some(pwstr.as_ptr().cast()));
                            }
                        }
                    }
                }

                if name.is_empty() {
                    name = format!("Dispositivo de Áudio ({})", i + 1);
                }

                let name_lower = name.to_lowercase();
                let id_lower = id.to_lowercase();

                // Identifica se é dispositivo Bluetooth (JBL, fones, fones Haylou, etc.)
                let is_bluetooth = name_lower.contains("bluetooth")
                    || name_lower.contains("bth")
                    || name_lower.contains("jbl")
                    || name_lower.contains("haylou")
                    || name_lower.contains("airpods")
                    || name_lower.contains("buds")
                    || name_lower.contains("wireless")
                    || id_lower.contains("bth")
                    || id_lower.contains("bluetooth");

                let is_tv = name_lower.contains("tv")
                    || name_lower.contains("hdmi")
                    || name_lower.contains("philco")
                    || name_lower.contains("lg")
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

                result.push(SystemAudioDevice {
                    id,
                    name,
                    is_default,
                    is_bluetooth,
                    is_connected: true,
                    device_type,
                });
            }
        }

        CoUninitialize();
    }

    Ok(result)
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
