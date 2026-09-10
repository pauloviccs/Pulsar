<script lang="ts">
  import { 
    X, 
    Sparkles, 
    LogIn, 
    UserPlus, 
    KeyRound, 
    AlertCircle, 
    Check, 
    Radio, 
    ArrowRight,
    AtSign,
    Hash
  } from '@lucide/svelte';
  import { 
    isAuthModalOpen, 
    authMode, 
    isAuthLoading, 
    authError, 
    authActions 
  } from '../stores/authStore';
  import PulsarCaptcha from './PulsarCaptcha.svelte';

  let email = $state('');
  let password = $state('');
  let username = $state('');
  let displayName = $state('');
  let successMessage = $state<string | null>(null);
  let isCaptchaVerified = $state(false);
  let captchaToken = $state<string | null>(null);

  $effect(() => {
    if ($isAuthModalOpen) {
      authError.set(null);
      successMessage = null;
      isCaptchaVerified = false;
      captchaToken = null;
    }
  });

  $effect(() => {
    // Reseta verificação se alternar de aba
    const mode = $authMode;
    isCaptchaVerified = false;
    captchaToken = null;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    authError.set(null);
    successMessage = null;

    try {
      if ($authMode === 'login') {
        if (!email.trim() || !password) {
          authError.set('Preencha seu e-mail e sua senha.');
          return;
        }
        await authActions.login(email, password);
      } else if ($authMode === 'register') {
        if (!email.trim() || !password || !username.trim()) {
          authError.set('Preencha e-mail, senha e nome de usuário.');
          return;
        }
        if (password.length < 6) {
          authError.set('A senha deve conter no mínimo 6 caracteres.');
          return;
        }
        if (!isCaptchaVerified) {
          authError.set('Complete a verificação de segurança antes de criar a conta.');
          return;
        }
        await authActions.register(email, password, username, displayName || username);
      } else if ($authMode === 'forgot') {
        if (!email.trim()) {
          authError.set('Informe o e-mail cadastrado para redefinir a senha.');
          return;
        }
        // Simulação / Feedback amigável de recuperação
        successMessage = 'Se o e-mail estiver cadastrado, um link de recuperação foi enviado!';
      }
    } catch (err: any) {
      // Erro tratado pelo store
    }
  }

  function close() {
    isAuthModalOpen.set(false);
  }
</script>

{#if $isAuthModalOpen}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl animate-[fade-in_0.25s_ease-out]"
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="liquid-modal w-full max-w-md max-h-[90vh] rounded-3xl p-6 sm:p-7 flex flex-col gap-4 border border-white/[0.16] shadow-2xl text-[#F2EFEA] animate-apple-spring relative overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') authActions.continueAsGuest(); }}
    >
      <!-- Glow Decorativo visionOS -->
      <div class="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#FC7753]/25 blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-[#66D7D1]/25 blur-3xl pointer-events-none"></div>

      <!-- Botão Fechar / Modo Convidado -->
      <button 
        onclick={() => authActions.continueAsGuest()}
        class="absolute top-5 right-5 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        title="Fechar e Continuar Offline"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Topo: Logo & Título -->
      <div class="flex flex-col items-center text-center gap-1.5 pt-1 shrink-0">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FC7753] to-[#66D7D1] p-0.5 shadow-xl shadow-[#FC7753]/20 flex items-center justify-center">
          <div class="w-full h-full bg-[#09090d] rounded-[14px] flex items-center justify-center">
            <Radio class="w-6 h-6 text-[#66D7D1]" />
          </div>
        </div>
        <h2 class="text-lg font-extrabold tracking-tight text-[#F2EFEA]">Pulsar Social</h2>
        <p class="text-[11px] text-[#F2EFEA]/60 max-w-xs">
          Música sem limites, perfis compartilhados e presença em tempo real.
        </p>
      </div>

      <!-- Mensagens de Alerta ou Sucesso -->
      {#if $authError}
        <div class="p-3 rounded-2xl bg-[#FC7753]/15 border border-[#FC7753]/30 flex flex-col gap-2 text-xs text-[#FC7753] animate-shake shrink-0">
          <div class="flex items-start gap-2.5">
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span class="leading-relaxed">{$authError}</span>
          </div>
          {#if email.trim() && $authError.includes('não foi confirmado')}
            <button
              type="button"
              onclick={async () => {
                const res = await authActions.resendConfirmation(email);
                if (res.success) {
                  successMessage = `Novo e-mail de confirmação enviado para ${email}!`;
                  authError.set(null);
                } else {
                  authError.set(res.error || 'Erro ao reenviar confirmação.');
                }
              }}
              class="self-end px-3 py-1 rounded-xl bg-[#FC7753]/20 hover:bg-[#FC7753]/30 border border-[#FC7753]/40 text-[11px] font-bold text-white transition cursor-pointer"
            >
              Reenviar E-mail de Confirmação
            </button>
          {/if}
        </div>
      {/if}

      {#if successMessage}
        <div class="p-3 rounded-2xl bg-[#66D7D1]/15 border border-[#66D7D1]/30 flex items-center gap-2.5 text-xs text-[#66D7D1] shrink-0">
          <Check class="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      {/if}

      <!-- Abas de Navegação (Entrar / Criar Conta / Config) -->
      <div class="flex items-center p-1 rounded-2xl bg-white/[0.05] border border-white/[0.08] shrink-0">
        <button
          type="button"
          onclick={() => { authMode.set('login'); authError.set(null); }}
          class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 {$authMode === 'login' ? 'bg-white/[0.15] text-white shadow-sm' : 'text-white/50 hover:text-white'}"
        >
          <LogIn class="w-3.5 h-3.5" />
          <span>Entrar</span>
        </button>

        <button
          type="button"
          onclick={() => { authMode.set('register'); authError.set(null); }}
          class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 {$authMode === 'register' ? 'bg-white/[0.15] text-white shadow-sm' : 'text-white/50 hover:text-white'}"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>Criar Conta</span>
        </button>
      </div>

      <!-- Formulário de Login / Cadastro com Scroll Interno -->
      <form onsubmit={handleSubmit} class="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
          {#if $authMode === 'register'}
            <!-- Nome de Exibição & Nome de Usuário -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label for="reg-display" class="text-[11px] font-semibold text-white/70">Nome</label>
                <input
                  id="reg-display"
                  type="text"
                  bind:value={displayName}
                  placeholder="Seu Nome"
                  maxlength="30"
                  class="w-full py-2 px-3 rounded-xl liquid-input text-xs text-[#F2EFEA] focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label for="reg-user" class="text-[11px] font-semibold text-white/70">Username</label>
                <div class="relative flex items-center">
                  <span class="absolute left-2.5 text-white/40 text-xs">@</span>
                  <input
                    id="reg-user"
                    type="text"
                    bind:value={username}
                    placeholder="usuario"
                    maxlength="20"
                    class="w-full py-2 pl-6 pr-3 rounded-xl liquid-input text-xs text-[#F2EFEA] font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <p class="text-[10px] text-[#66D7D1]/80 flex items-center gap-1">
              <Sparkles class="w-3 h-3" />
              <span>Sua tag alfanumérica única (ex: #{username ? '7X9A' : '0000'}) será gerada automaticamente.</span>
            </p>
          {/if}

          <!-- E-mail -->
          <div class="flex flex-col gap-1">
            <label for="auth-email" class="text-[11px] font-semibold text-white/70">E-mail</label>
            <input
              id="auth-email"
              type="email"
              bind:value={email}
              placeholder="voce@exemplo.com"
              required
              class="w-full py-2.5 px-3.5 rounded-2xl liquid-input text-xs text-[#F2EFEA] focus:outline-none"
            />
          </div>

          <!-- Senha -->
          {#if $authMode !== 'forgot'}
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label for="auth-pass" class="text-[11px] font-semibold text-white/70">Senha</label>
                {#if $authMode === 'login'}
                  <button
                    type="button"
                    onclick={() => authMode.set('forgot')}
                    class="text-[10px] text-[#66D7D1] hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                {/if}
              </div>
              <input
                id="auth-pass"
                type="password"
                bind:value={password}
                placeholder="••••••••"
                required
                class="w-full py-2.5 px-3.5 rounded-2xl liquid-input text-xs text-[#F2EFEA] focus:outline-none"
              />
            </div>
          {/if}

          <!-- Verificação Anti-Bot Captcha (Exclusivo para Cadastro) -->
          {#if $authMode === 'register'}
            <div class="pt-1">
              <PulsarCaptcha 
                onverify={(token) => {
                  isCaptchaVerified = true;
                  captchaToken = token;
                  authError.set(null);
                }}
                onreset={() => {
                  isCaptchaVerified = false;
                  captchaToken = null;
                }}
              />
            </div>
          {/if}

          <!-- Botão de Ação Primária -->
          <button
            type="submit"
            disabled={$isAuthLoading || ($authMode === 'register' && !isCaptchaVerified)}
            class="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white font-bold text-xs shadow-lg shadow-[#FC7753]/25 active:scale-95 transition cursor-pointer mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {#if $isAuthLoading}
              <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processando...</span>
            {:else if $authMode === 'login'}
              <LogIn class="w-4 h-4" />
              <span>Entrar no Pulsar</span>
            {:else if $authMode === 'register'}
              <UserPlus class="w-4 h-4" />
              <span>Criar Conta e Obter TAG</span>
            {:else}
              <KeyRound class="w-4 h-4" />
              <span>Redefinir Senha</span>
            {/if}
          </button>
        </form>

      <!-- Opção de Continuar como Convidado (Local-First Offline) -->
      <div class="flex items-center justify-center pt-2 border-t border-white/[0.08] shrink-0">
        <button
          type="button"
          onclick={() => authActions.continueAsGuest()}
          class="flex items-center gap-1.5 text-xs text-white/50 hover:text-[#F2EFEA] transition cursor-pointer"
        >
          <span>Continuar como Convidado (Modo Offline)</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
{/if}
