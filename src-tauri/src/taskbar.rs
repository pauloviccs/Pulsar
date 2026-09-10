#[cfg(target_os = "windows")]
pub mod windows_taskbar {
    use std::sync::Mutex;
    use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        DefSubclassProc, SetWindowSubclass, TaskbarList, ITaskbarList3, THBN_CLICKED,
        THB_FLAGS, THB_ICON, THB_TOOLTIP, THBF_DISABLED, THBF_ENABLED, THUMBBUTTON,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateIconFromResourceEx, HICON, LR_DEFAULTCOLOR, WM_COMMAND,
    };

    pub const ID_FAVORITE: u32 = 101;
    pub const ID_PREV: u32 = 102;
    pub const ID_PLAY_PAUSE: u32 = 103;
    pub const ID_NEXT: u32 = 104;

    const SUBCLASS_ID: usize = 41235;

    static ICON_PLAY_PNG: &[u8] = include_bytes!("../icons/taskbar/play.png");
    static ICON_PAUSE_PNG: &[u8] = include_bytes!("../icons/taskbar/pause.png");
    static ICON_PREV_PNG: &[u8] = include_bytes!("../icons/taskbar/prev.png");
    static ICON_NEXT_PNG: &[u8] = include_bytes!("../icons/taskbar/next.png");
    static ICON_FAV_OFF_PNG: &[u8] = include_bytes!("../icons/taskbar/favorite_off.png");
    static ICON_FAV_ON_PNG: &[u8] = include_bytes!("../icons/taskbar/favorite_on.png");

    struct TaskbarState {
        taskbar_list: Option<ITaskbarList3>,
        hwnd: isize,
        is_initialized: bool,
    }

    unsafe impl Send for TaskbarState {}
    unsafe impl Sync for TaskbarState {}

    static TASKBAR_STATE: Mutex<Option<TaskbarState>> = Mutex::new(None);
    static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

    fn create_hicon_from_png(png_bytes: &[u8]) -> Option<HICON> {
        unsafe {
            CreateIconFromResourceEx(
                png_bytes,
                BOOL(1),
                0x00030000,
                24,
                24,
                LR_DEFAULTCOLOR,
            ).ok()
        }
    }

    fn string_to_u16_arr(text: &str) -> [u16; 260] {
        let mut arr = [0u16; 260];
        for (i, c) in text.encode_utf16().take(259).enumerate() {
            arr[i] = c;
        }
        arr
    }

    pub fn init_taskbar(window: &WebviewWindow) -> Result<(), String> {
        let hwnd_raw = window.hwnd().map_err(|e| e.to_string())?;
        let hwnd = HWND(hwnd_raw.0 as _);

        *APP_HANDLE.lock().unwrap() = Some(window.app_handle().clone());

        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let taskbar_list: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| format!("Falha ao instanciar ITaskbarList3: {}", e))?;
            taskbar_list.HrInit().map_err(|e| format!("HrInit falhou: {}", e))?;

            let _ = SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, 0);

            *TASKBAR_STATE.lock().unwrap() = Some(TaskbarState {
                taskbar_list: Some(taskbar_list),
                hwnd: hwnd_raw.0 as isize,
                is_initialized: false,
            });
        }

        update_buttons(false, false, false)?;
        Ok(())
    }

    pub fn update_buttons(is_playing: bool, has_track: bool, is_favorite: bool) -> Result<(), String> {
        let mut state_guard = TASKBAR_STATE.lock().unwrap();
        let state = match state_guard.as_mut() {
            Some(s) => s,
            None => return Ok(()),
        };

        let taskbar = match &state.taskbar_list {
            Some(tb) => tb,
            None => return Ok(()),
        };

        let hwnd = HWND(state.hwnd as _);

        unsafe {
            let hicon_fav = if is_favorite {
                create_hicon_from_png(ICON_FAV_ON_PNG)
            } else {
                create_hicon_from_png(ICON_FAV_OFF_PNG)
            }.unwrap_or_default();

            let hicon_prev = create_hicon_from_png(ICON_PREV_PNG).unwrap_or_default();
            let hicon_play = if is_playing {
                create_hicon_from_png(ICON_PAUSE_PNG)
            } else {
                create_hicon_from_png(ICON_PLAY_PNG)
            }.unwrap_or_default();
            let hicon_next = create_hicon_from_png(ICON_NEXT_PNG).unwrap_or_default();

            let disabled_flag = if has_track { THBF_ENABLED } else { THBF_DISABLED };

            let buttons = [
                THUMBBUTTON {
                    dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                    iId: ID_FAVORITE,
                    iBitmap: 0,
                    hIcon: hicon_fav,
                    szTip: string_to_u16_arr(if is_favorite { "Remover dos Favoritos" } else { "Adicionar aos Favoritos" }),
                    dwFlags: disabled_flag,
                },
                THUMBBUTTON {
                    dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                    iId: ID_PREV,
                    iBitmap: 0,
                    hIcon: hicon_prev,
                    szTip: string_to_u16_arr("Faixa Anterior"),
                    dwFlags: disabled_flag,
                },
                THUMBBUTTON {
                    dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                    iId: ID_PLAY_PAUSE,
                    iBitmap: 0,
                    hIcon: hicon_play,
                    szTip: string_to_u16_arr(if is_playing { "Pausar" } else { "Reproduzir" }),
                    dwFlags: disabled_flag,
                },
                THUMBBUTTON {
                    dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                    iId: ID_NEXT,
                    iBitmap: 0,
                    hIcon: hicon_next,
                    szTip: string_to_u16_arr("Próxima Faixa"),
                    dwFlags: disabled_flag,
                },
            ];

            if !state.is_initialized {
                taskbar.ThumbBarAddButtons(hwnd, &buttons)
                    .map_err(|e| format!("ThumbBarAddButtons falhou: {}", e))?;
                state.is_initialized = true;
            } else {
                taskbar.ThumbBarUpdateButtons(hwnd, &buttons)
                    .map_err(|e| format!("ThumbBarUpdateButtons falhou: {}", e))?;
            }
        }
        Ok(())
    }

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uid_subclass: usize,
        _ref_data: usize,
    ) -> LRESULT {
        if msg == WM_COMMAND {
            let hiword = ((wparam.0 >> 16) & 0xffff) as u32;
            let loword = (wparam.0 & 0xffff) as u32;

            if hiword == THBN_CLICKED {
                if let Some(app) = APP_HANDLE.lock().unwrap().as_ref() {
                    match loword {
                        ID_FAVORITE => {
                            let _ = app.emit("taskbar-action", "toggle_favorite");
                        }
                        ID_PREV => {
                            let _ = app.emit("taskbar-action", "prev");
                        }
                        ID_PLAY_PAUSE => {
                            let _ = app.emit("taskbar-action", "play_pause");
                        }
                        ID_NEXT => {
                            let _ = app.emit("taskbar-action", "next");
                        }
                        _ => {}
                    }
                }
                return LRESULT(0);
            }
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }
}
