<script lang="ts">
  import { 
    User, 
    Settings, 
    LogOut, 
    Edit3, 
    Users, 
    Sparkles, 
    ChevronDown, 
    Check, 
    Copy,
    Circle
  } from '@lucide/svelte';
  import { 
    currentProfile, 
    isAuthModalOpen, 
    isEditProfileModalOpen, 
    authActions 
  } from '../stores/authStore';
  import { isSocialDrawerOpen, socialState } from '../stores/socialStore';
  import { libraryActions } from '../stores/libraryStore';
  import { t } from '../i18n';
  import type { PresenceStatus } from '../types';

  let isOpen = $state(false);
  let copiedTag = $state(false);

  let pendingCount = $derived(
    $socialState.pendingRequests.filter(
      (f) => f.friend_id === $currentProfile?.id
    ).length
  );

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function closeMenu() {
    isOpen = false;
  }

  async function copyTag(e: MouseEvent) {
    e.stopPropagation();
    if (!$currentProfile) return;
    try {
      await navigator.clipboard.writeText(`@${$currentProfile.username}#${$currentProfile.tag}`);
      copiedTag = true;
      setTimeout(() => { copiedTag = false; }, 2000);
    } catch (err) {
      console.error('Erro ao copiar tag:', err);
    }
  }

  function handleNavigate(view: 'profile' | 'settings') {
    closeMenu();
    libraryActions.setActiveView(view);
  }

  function handleOpenEditProfile() {
    closeMenu();
    isEditProfileModalOpen.set(true);
  }

  function handleOpenSocial() {
    closeMenu();
    isSocialDrawerOpen.set(true);
  }

  function handleLogout() {
    closeMenu();
    authActions.logout();
  }

  function handleSetStatus(status: PresenceStatus) {
    authActions.updatePresence(status);
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case 'online': return 'bg-[#3093AA] shadow-[0_0_8px_#3093AA]';
      case 'away': return 'bg-[#F3B044] shadow-[0_0_8px_#F3B044]';
      case 'busy': return 'bg-[#EF7D4B] shadow-[0_0_8px_#EF7D4B]';
      default: return 'bg-white/30';
    }
  }
</script>

<div class="relative inline-block select-none">
  {#if $currentProfile && !$currentProfile.id.startsWith('guest')}
    <!-- PÍLULA DE PERFIL NO HEADER (PREMIUM LIQUID GLASS) -->
    <button
      type="button"
      onclick={toggleMenu}
      aria-expanded={isOpen}
      aria-haspopup="true"
      class="flex items-center gap-2.5 py-1.5 px-2.5 sm:px-3 rounded-full lq-glass-pill hover:border-[#3093AA]/50 hover:bg-white/[0.1] active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-md group"
    >
      <!-- Avatar com Indicador de Presença embutido -->
      <div class="relative shrink-0">
        <img
          src={$currentProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${$currentProfile.username}`}
          alt={$currentProfile.display_name}
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/[0.15] bg-[#111827]"
        />
        <div 
          class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0B1020] {getStatusColor($currentProfile.presence_status)}"
        ></div>
      </div>

      <!-- Nome e Tag Alfanumérica Twitter/Discord Style -->
      <div class="hidden sm:flex flex-col items-start leading-none text-left">
        <span class="text-xs font-bold text-[#F0F0F5] group-hover:text-[#3093AA] transition-colors max-w-[110px] truncate">
          {$currentProfile.display_name}
        </span>
        <span class="text-[10px] font-mono text-white/50 pt-0.5">
          @{$currentProfile.username}
        </span>
      </div>

      <!-- Tag em Destaque Visível (#TAG) -->
      <span class="px-1.5 py-0.5 rounded-lg bg-[#EF7D4B]/15 border border-[#EF7D4B]/30 text-[#EF7D4B] font-mono text-[10px] sm:text-[11px] font-black tracking-wide">
        #{$currentProfile.tag}
      </span>


      <!-- Chevron Indicativo -->
      <ChevronDown 
        class="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" 
      />
    </button>

    <!-- BACKDROP TRANSPARENTE PARA FECHAR AO CLICAR FORA -->
    {#if isOpen}
      <div 
        role="presentation"
        class="fixed inset-0 z-40 bg-transparent"
        onclick={closeMenu}
        onkeydown={(e) => { if (e.key === 'Escape') closeMenu(); }}
      ></div>

      <!-- DROPDOWN MODAL FLUTUANTE DE PERFIL -->
      <div 
        role="menu"
        tabindex="-1"
        class="absolute right-0 top-full mt-2 w-72 z-50 rounded-3xl lq-glass-elevated shadow-2xl p-4 flex flex-col gap-3.5 animate-apple-spring text-[#F0F0F5]"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => { if (e.key === 'Escape') closeMenu(); }}
      >
        <!-- Header do Menu Dropdown -->
        <div class="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
          <div class="relative shrink-0">
            <img
              src={$currentProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${$currentProfile.username}`}
              alt={$currentProfile.display_name}
              class="w-11 h-11 rounded-2xl object-cover border border-white/[0.15] bg-[#111827]"
            />
            <div 
              class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0B1020] {getStatusColor($currentProfile.presence_status)}"
            ></div>
          </div>

          <div class="flex flex-col min-w-0 flex-1">
            <h4 class="text-xs font-bold text-[#F0F0F5] truncate">{$currentProfile.display_name}</h4>
            <div class="flex items-center gap-1.5 pt-0.5">
              <span class="text-[11px] font-mono text-white/50">@{$currentProfile.username}</span>
              <button
                type="button"
                onclick={copyTag}
                class="px-1.5 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] font-mono font-bold text-[#EF7D4B] transition cursor-pointer flex items-center gap-1"
                title="Copiar @tag"
              >
                <span>#{$currentProfile.tag}</span>
                {#if copiedTag}
                  <Check class="w-2.5 h-2.5 text-[#3093AA]" />
                {:else}
                  <Copy class="w-2.5 h-2.5 text-white/40" />
                {/if}
              </button>
            </div>
          </div>
        </div>



        <!-- Seletor Rápido de Presença (Online, Ausente, Ocupado, Invisível) -->
        <div class="flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <span class="text-[10px] uppercase font-bold text-white/40 px-1">Status</span>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick={() => handleSetStatus('online')}
              class="w-4 h-4 rounded-full bg-[#3093AA] transition cursor-pointer {$currentProfile.presence_status === 'online' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'}"
              title="Online"
            ></button>
            <button
              type="button"
              onclick={() => handleSetStatus('away')}
              class="w-4 h-4 rounded-full bg-[#F3B044] transition cursor-pointer {$currentProfile.presence_status === 'away' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'}"
              title="Ausente"
            ></button>
            <button
              type="button"
              onclick={() => handleSetStatus('busy')}
              class="w-4 h-4 rounded-full bg-[#EF7D4B] transition cursor-pointer {$currentProfile.presence_status === 'busy' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'}"
              title="Ocupado"
            ></button>
            <button
              type="button"
              onclick={() => handleSetStatus('offline')}
              class="w-4 h-4 rounded-full bg-white/30 transition cursor-pointer {$currentProfile.presence_status === 'offline' ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'}"
              title="Invisível"
            ></button>
          </div>
        </div>

        <!-- Ações do Menu -->
        <div class="flex flex-col gap-1">
          <button
            type="button"
            onclick={() => handleNavigate('profile')}
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition cursor-pointer text-left"
          >
            <User class="w-4 h-4 text-[#3093AA]" />
            <span>{$t('nav.profile')}</span>
          </button>

          <button
            type="button"
            onclick={handleOpenEditProfile}
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition cursor-pointer text-left"
          >
            <Edit3 class="w-4 h-4 text-[#F3B044]" />
            <span>{$t('profile.editProfile')}</span>
          </button>

          <button
            type="button"
            onclick={handleOpenSocial}
            class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition cursor-pointer text-left"
          >
            <div class="flex items-center gap-2.5">
              <Users class="w-4 h-4 text-[#3093AA]" />
              <span>{$t('nav.friends')}</span>
            </div>
            {#if pendingCount > 0}
              <span class="px-1.5 py-0.5 rounded-full bg-[#EF7D4B] text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            {/if}
          </button>

          <button
            type="button"
            onclick={() => handleNavigate('settings')}
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition cursor-pointer text-left"
          >
            <Settings class="w-4 h-4 text-white/60" />
            <span>{$t('nav.settings')}</span>
          </button>
        </div>

        <!-- Divisor e Sair -->
        <div class="pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onclick={handleLogout}
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#EF7D4B] hover:bg-[#EF7D4B]/15 transition cursor-pointer text-left"
          >
            <LogOut class="w-4 h-4" />
            <span>{$t('common.logout')}</span>
          </button>
        </div>
      </div>
    {/if}
  {:else}
    <!-- BOTÃO CONVIDADO / ENTRAR -->
    <button
      type="button"
      onclick={() => isAuthModalOpen.set(true)}
      class="flex items-center gap-2 py-2 px-3 sm:px-4 rounded-full lq-glass-pill hover:bg-white/[0.1] text-xs font-semibold text-[#3093AA] transition active:scale-95 cursor-pointer shadow-md"
    >
      <Sparkles class="w-3.5 h-3.5 text-[#3093AA]" />
      <span class="hidden sm:inline">{$t('auth.login')}</span>
    </button>
  {/if}
</div>
