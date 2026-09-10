<script lang="ts">
  import { X, Check, Upload, Image as ImageIcon, Sparkles, User } from '@lucide/svelte';
  import { currentProfile, authActions } from '../stores/authStore';
  import { isEditProfileModalOpen } from '../stores/socialStore';
  import { t } from '../i18n';

  let displayName = $state('');
  let bio = $state('');
  let avatarUrl = $state('');
  let bannerUrl = $state('');
  let customStatus = $state('');
  let isSaving = $state(false);

  $effect(() => {
    if ($isEditProfileModalOpen && $currentProfile) {
      displayName = $currentProfile.display_name;
      bio = $currentProfile.bio || '';
      avatarUrl = $currentProfile.avatar_url || '';
      bannerUrl = $currentProfile.banner_url || '';
      customStatus = $currentProfile.custom_status || '';
    }
  });

  function close() {
    isEditProfileModalOpen.set(false);
  }

  async function handleSave() {
    if (!displayName.trim()) return;
    isSaving = true;

    try {
      await authActions.updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim(),
        banner_url: bannerUrl.trim(),
        custom_status: customStatus.trim()
      });
      close();
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
    } finally {
      isSaving = false;
    }
  }

  function handleAvatarFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        avatarUrl = ev.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }

  function handleBannerFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        bannerUrl = ev.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }
</script>

{#if $isEditProfileModalOpen && $currentProfile}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-2xl animate-[fade-in_0.2s_ease-out]"
    onclick={close}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="liquid-modal w-full max-w-lg max-h-[88vh] rounded-3xl p-5 sm:p-6 flex flex-col border border-white/[0.16] shadow-2xl text-[#F2EFEA] animate-apple-spring relative overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="p-2 rounded-xl bg-[#66D7D1]/15 text-[#66D7D1] border border-[#66D7D1]/30 shrink-0">
            <User class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-[#F2EFEA] truncate">{$t('editProfileModal.title')}</h2>
            <p class="text-[10px] text-white/50 truncate">{$t('editProfileModal.subtitle')}</p>
          </div>
        </div>

        <button onclick={close} class="p-1.5 rounded-xl text-white/40 hover:text-white transition cursor-pointer shrink-0">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Conteúdo Interno Rolável Defensivo -->
      <div class="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 py-3">

      <!-- Preview do Banner e Avatar Estilo Twitter -->
      <div class="relative w-full rounded-2xl overflow-hidden border border-white/[0.1] bg-black/40">
        <!-- Banner -->
        <div class="relative w-full h-28 bg-gradient-to-r from-[#FC7753]/30 to-[#66D7D1]/30 overflow-hidden group">
          {#if bannerUrl}
            <img src={bannerUrl} alt="Banner" class="w-full h-full object-cover" />
          {/if}
          <label class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white text-xs font-semibold cursor-pointer transition backdrop-blur-[2px]">
            <Upload class="w-4 h-4 text-[#66D7D1]" />
            <span>{$t('editProfileModal.changeBanner')}</span>
            <input type="file" accept="image/*" onchange={handleBannerFile} class="hidden" />
          </label>
        </div>

        <!-- Avatar sobreposto ao banner -->
        <div class="p-4 pt-0 flex items-end justify-between -mt-10">
          <div class="relative w-20 h-20 rounded-full border-4 border-[#09090d] bg-[#16161d] overflow-hidden shadow-xl group">
            {#if avatarUrl}
              <img src={avatarUrl} alt="Avatar" class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-white/40">
                <User class="w-8 h-8" />
              </div>
            {/if}
            <label class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer transition backdrop-blur-[2px]">
              <Upload class="w-3.5 h-3.5 text-[#66D7D1]" />
              <span>{$t('editProfileModal.changePhoto')}</span>
              <input type="file" accept="image/*" onchange={handleAvatarFile} class="hidden" />
            </label>
          </div>

          <span class="text-xs font-mono text-white/50 pb-2">
            @{$currentProfile.username}#{$currentProfile.tag}
          </span>
        </div>
      </div>

      <!-- Campos de Texto -->
      <div class="flex flex-col gap-3.5">
        <div class="flex flex-col gap-1">
          <label for="edit-display-name" class="text-[11px] font-semibold text-white/70">{$t('editProfileModal.displayName')}</label>
          <input
            id="edit-display-name"
            type="text"
            bind:value={displayName}
            placeholder={$t('editProfileModal.displayNamePlaceholder')}
            maxlength="40"
            class="w-full py-2 px-3 rounded-xl liquid-input text-xs text-[#F2EFEA] focus:outline-none"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="edit-bio" class="text-[11px] font-semibold text-white/70">{$t('editProfileModal.bio')}</label>
          <textarea
            id="edit-bio"
            bind:value={bio}
            placeholder={$t('editProfileModal.bioPlaceholder')}
            rows="3"
            maxlength="160"
            class="w-full py-2 px-3 rounded-xl liquid-input text-xs text-[#F2EFEA] focus:outline-none resize-none"
          ></textarea>
        </div>

        <div class="flex flex-col gap-1">
          <label for="edit-status" class="text-[11px] font-semibold text-white/70">{$t('editProfileModal.customStatus')}</label>
          <input
            id="edit-status"
            type="text"
            bind:value={customStatus}
            placeholder={$t('editProfileModal.customStatusPlaceholder')}
            maxlength="60"
            class="w-full py-2 px-3 rounded-xl liquid-input text-xs text-[#F2EFEA] focus:outline-none"
          />
        </div>
      </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] shrink-0">
        <button
          type="button"
          onclick={close}
          class="px-4 py-2 rounded-2xl text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
        >
          {$t('common.cancel')}
        </button>

        <button
          type="button"
          onclick={handleSave}
          disabled={!displayName.trim() || isSaving}
          class="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white font-bold text-xs shadow-lg shadow-[#FC7753]/25 active:scale-95 transition cursor-pointer disabled:opacity-50"
        >
          {#if isSaving}
            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>{$t('editProfileModal.saving')}</span>
          {:else}
            <Check class="w-4 h-4" />
            <span>{$t('editProfileModal.saveBtn')}</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
