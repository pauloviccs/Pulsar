#[cfg(target_os = "windows")]
pub mod windows_taskbar {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Mutex;
    use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
    use windows::core::w;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THBF_DISABLED,
        THBF_ENABLED, THBN_CLICKED, THB_FLAGS, THB_ICON, THB_TOOLTIP, THUMBBUTTON,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        ChangeWindowMessageFilterEx, CreateIconFromResourceEx, GetAncestor, PostMessageW,
        RegisterWindowMessageW, GA_ROOT, HICON, LR_DEFAULTCOLOR, MSGFLT_ALLOW, WM_APP,
        WM_COMMAND, WM_SHOWWINDOW,
    };

    pub const ID_FAVORITE: u32 = 101;
    pub const ID_PREV: u32 = 102;
    pub const ID_PLAY_PAUSE: u32 = 103;
    pub const ID_NEXT: u32 = 104;

    const SUBCLASS_ID: usize = 41235;
    const WM_APP_UPDATE_TASKBAR: u32 = WM_APP + 42;

    static ICON_PLAY_PNG: &[u8] = include_bytes!("../icons/taskbar/play.png");
    static ICON_PAUSE_PNG: &[u8] = include_bytes!("../icons/taskbar/pause.png");
    static ICON_PREV_PNG: &[u8] = include_bytes!("../icons/taskbar/prev.png");
    static ICON_NEXT_PNG: &[u8] = include_bytes!("../icons/taskbar/next.png");
    static ICON_FAV_OFF_PNG: &[u8] = include_bytes!("../icons/taskbar/favorite_off.png");
    static ICON_FAV_ON_PNG: &[u8] = include_bytes!("../icons/taskbar/favorite_on.png");

    #[derive(Clone)]
    pub struct SendSyncTaskbar(pub ITaskbarList3);
    unsafe impl Send for SendSyncTaskbar {}
    unsafe impl Sync for SendSyncTaskbar {}

    impl std::ops::Deref for SendSyncTaskbar {
        type Target = ITaskbarList3;
        fn deref(&self) -> &Self::Target {
            &self.0
        }
    }

    struct TaskbarState {
        taskbar_list: Option<SendSyncTaskbar>,
        hwnd: isize,
        is_initialized: bool,
    }

    unsafe impl Send for TaskbarState {}
    unsafe impl Sync for TaskbarState {}

    static TASKBAR_STATE: Mutex<Option<TaskbarState>> = Mutex::new(None);
    static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);
    static LAST_STATE: Mutex<(bool, bool, bool)> = Mutex::new((false, false, false));
    static TASKBAR_BUTTON_CREATED_MSG: AtomicU32 = AtomicU32::new(0);

    fn create_hicon_from_png(png_bytes: &[u8]) -> Option<HICON> {
        unsafe {
            match CreateIconFromResourceEx(png_bytes, BOOL(1), 0x00030000, 24, 24, LR_DEFAULTCOLOR) {
                Ok(icon) => {
                    if icon.0.is_null() {
                        eprintln!("[Pulsar Taskbar] CreateIconFromResourceEx retornou HICON nulo!");
                        None
                    } else {
                        Some(icon)
                    }
                }
                Err(e) => {
                    eprintln!("[Pulsar Taskbar] Falha ao criar HICON do PNG (tamanho {} bytes): {}", png_bytes.len(), e);
                    None
                }
            }
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

            let root_hwnd = GetAncestor(hwnd, GA_ROOT);
            let target_hwnd = if root_hwnd.0.is_null() { hwnd } else { root_hwnd };

            // Registra mensagem enviada pelo Windows Explorer quando a miniatura é criada
            let msg_id = RegisterWindowMessageW(w!("TaskbarButtonCreated"));
            if msg_id != 0 {
                TASKBAR_BUTTON_CREATED_MSG.store(msg_id, Ordering::SeqCst);
                let _ = ChangeWindowMessageFilterEx(target_hwnd, msg_id, MSGFLT_ALLOW, None);
                println!("[Pulsar Taskbar] Mensagem TaskbarButtonCreated registrada: {} para HWND {:?}", msg_id, target_hwnd);
            }

            let taskbar_list: Result<ITaskbarList3, _> =
                CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER);

            let taskbar_opt = match taskbar_list {
                Ok(tb) => {
                    let _ = tb.HrInit();
                    Some(SendSyncTaskbar(tb))
                }
                Err(e) => {
                    eprintln!("[Pulsar Taskbar] Aviso: ITaskbarList3 inicial diferido: {}", e);
                    None
                }
            };

            let _ = SetWindowSubclass(target_hwnd, Some(subclass_proc), SUBCLASS_ID, 0);

            *TASKBAR_STATE.lock().unwrap() = Some(TaskbarState {
                taskbar_list: taskbar_opt,
                hwnd: target_hwnd.0 as isize,
                is_initialized: false,
            });
        }

        Ok(())
    }

    pub fn update_buttons(
        is_playing: bool,
        has_track: bool,
        is_favorite: bool,
    ) -> Result<(), String> {
        let hwnd = {
            let state_guard = TASKBAR_STATE.lock().unwrap();
            match state_guard.as_ref() {
                Some(s) => HWND(s.hwnd as _),
                None => return Ok(()),
            }
        };

        // Salva estado recente
        *LAST_STATE.lock().unwrap() = (is_playing, has_track, is_favorite);

        // Empacota estados em WPARAM: bit0 = is_playing, bit1 = has_track, bit2 = is_favorite
        let flags: usize = (if is_playing { 1 } else { 0 })
            | (if has_track { 2 } else { 0 })
            | (if is_favorite { 4 } else { 0 });

        unsafe {
            let _ = PostMessageW(hwnd, WM_APP_UPDATE_TASKBAR, WPARAM(flags), LPARAM(0));
        }

        Ok(())
    }

    /// Executado ESTRITAMENTE na thread UI da janela através da mensagem WM_APP_UPDATE_TASKBAR
    fn apply_buttons_to_taskbar(
        hwnd: HWND,
        is_playing: bool,
        has_track: bool,
        is_favorite: bool,
    ) {
        unsafe {
            let mut state_guard = TASKBAR_STATE.lock().unwrap();
            let state = match state_guard.as_mut() {
                Some(s) => s,
                None => return,
            };

            // Se o ITaskbarList3 ainda não estiver instanciado na thread UI, inicializa
            if state.taskbar_list.is_none() {
                if let Ok(tb) = CoCreateInstance::<_, ITaskbarList3>(&TaskbarList, None, CLSCTX_INPROC_SERVER) {
                    let _ = tb.HrInit();
                    state.taskbar_list = Some(SendSyncTaskbar(tb));
                }
            }

            let taskbar = match &state.taskbar_list {
                Some(tb) => tb,
                None => return,
            };

            let hicon_fav = if is_favorite {
                create_hicon_from_png(ICON_FAV_ON_PNG)
            } else {
                create_hicon_from_png(ICON_FAV_OFF_PNG)
            }
            .unwrap_or_default();

            let hicon_prev = create_hicon_from_png(ICON_PREV_PNG).unwrap_or_default();
            let hicon_play = if is_playing {
                create_hicon_from_png(ICON_PAUSE_PNG)
            } else {
                create_hicon_from_png(ICON_PLAY_PNG)
            }
            .unwrap_or_default();
            let hicon_next = create_hicon_from_png(ICON_NEXT_PNG).unwrap_or_default();

            let disabled_flag = if has_track {
                THBF_ENABLED
            } else {
                THBF_DISABLED
            };

            let buttons = [
                THUMBBUTTON {
                    dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                    iId: ID_FAVORITE,
                    iBitmap: 0,
                    hIcon: hicon_fav,
                    szTip: string_to_u16_arr(if is_favorite {
                        "Remover dos Favoritos"
                    } else {
                        "Adicionar aos Favoritos"
                    }),
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

            let root_hwnd = GetAncestor(hwnd, GA_ROOT);
            let target_hwnd = if root_hwnd.0.is_null() { hwnd } else { root_hwnd };

            if !state.is_initialized {
                match taskbar.ThumbBarAddButtons(target_hwnd, &buttons) {
                    Ok(_) => {
                        state.is_initialized = true;
                        println!("[Pulsar Taskbar] ThumbBarAddButtons adicionado com sucesso para HWND {:?}", target_hwnd);
                    }
                    Err(e) => {
                        let err_code = e.code().0 as u32;
                        // 0x80040103 = TYPE_E_ELEMENTNOTFOUND (Botões já registrados pelo Shell)
                        if err_code == 0x80040103 {
                            let _ = taskbar.ThumbBarUpdateButtons(target_hwnd, &buttons);
                            state.is_initialized = true;
                            println!("[Pulsar Taskbar] ThumbBarAddButtons (botões já existiam, atualizado): {}", e);
                        } else {
                            // Não marca is_initialized para tentar novamente no próximo evento com a janela visível
                            println!("[Pulsar Taskbar] ThumbBarAddButtons aguardando prontidão da janela (0x{:08X}): {}", err_code, e);
                        }
                    }
                }
            } else {
                let _ = taskbar.ThumbBarUpdateButtons(target_hwnd, &buttons);
            }
        }
    }

    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uid_subclass: usize,
        _ref_data: usize,
    ) -> LRESULT {
        // 1. Mensagem enviada pelo Explorer quando o botão da barra de tarefas é criado ou recriado
        let taskbar_created = TASKBAR_BUTTON_CREATED_MSG.load(Ordering::Relaxed);
        if taskbar_created != 0 && msg == taskbar_created {
            println!("[Pulsar Taskbar] Sinal TaskbarButtonCreated recebido.");
            {
                let mut guard = TASKBAR_STATE.lock().unwrap();
                if let Some(s) = guard.as_mut() {
                    s.is_initialized = false;
                }
            }
            let (is_p, has_t, is_f) = *LAST_STATE.lock().unwrap();
            apply_buttons_to_taskbar(hwnd, is_p, has_t, is_f);
            return LRESULT(0);
        }

        // 2. Quando a janela é exibida pela primeira vez na tela
        if msg == WM_SHOWWINDOW && wparam.0 != 0 {
            let (is_p, has_t, is_f) = *LAST_STATE.lock().unwrap();
            apply_buttons_to_taskbar(hwnd, is_p, has_t, is_f);
        }

        // 3. Mensagem customizada despachada com segurança pela thread UI
        if msg == WM_APP_UPDATE_TASKBAR {
            let flags = wparam.0;
            let is_playing = (flags & 1) != 0;
            let has_track = (flags & 2) != 0;
            let is_favorite = (flags & 4) != 0;
            apply_buttons_to_taskbar(hwnd, is_playing, has_track, is_favorite);
            return LRESULT(0);
        }

        // 3. Cliques nos botões da miniatura (THBN_CLICKED)
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

