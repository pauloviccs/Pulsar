<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    X, 
    Upload, 
    Image as ImageIcon, 
    Check, 
    AlertCircle, 
    Sparkles, 
    ZoomIn, 
    ZoomOut, 
    RotateCcw,
    Crop,
    Move,
    Globe,
    Share2,
    Lock
  } from '@lucide/svelte';
  import { playlistToEdit, libraryActions } from '../stores/libraryStore';
  import type { PlaylistVisibility } from '../types';
  import { t } from '../i18n';

  let name = $state('');
  let description = $state('');
  let visibility = $state<PlaylistVisibility>('public');
  let coverPreview = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let isSaving = $state(false);
  let errorMessage = $state<string | null>(null);

  // Estados do Modo de Recorte Interativo 1:1
  let isCroppingMode = $state(false);
  let sourceImage = $state<HTMLImageElement | null>(null);
  let cropCanvas = $state<HTMLCanvasElement>();
  let zoomLevel = $state(1.0);
  let panX = $state(0);
  let panY = $state(0);
  let isDraggingCrop = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);

  $effect(() => {
    if ($playlistToEdit) {
      name = $playlistToEdit.name;
      description = $playlistToEdit.description || '';
      visibility = $playlistToEdit.visibility || 'public';
      coverPreview = $playlistToEdit.cover_image;
      errorMessage = null;
      isCroppingMode = false;
      sourceImage = null;
    }
  });

  function close() {
    playlistToEdit.set(null);
    coverPreview = null;
    errorMessage = null;
    isCroppingMode = false;
    sourceImage = null;
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
      errorMessage = $t('editPlaylistModal.invalidFormat');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        const img = new window.Image();
        img.onload = () => {
          sourceImage = img;
          zoomLevel = 1.0;
          panX = 0;
          panY = 0;
          isCroppingMode = true;
          errorMessage = null;
          drawCropPreview();
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    // Limpar o input para permitir selecionar o mesmo arquivo se quiser
    target.value = '';
  }

  function drawCropPreview() {
    if (!cropCanvas || !sourceImage) return;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    const size = cropCanvas.width;
    ctx.clearRect(0, 0, size, size);

    // Calcular proporções e enquadramento 1:1
    const imgAspect = sourceImage.width / sourceImage.height;
    let baseW = size;
    let baseH = size;

    if (imgAspect > 1) {
      // Imagem mais larga que alta
      baseW = size * imgAspect;
      baseH = size;
    } else {
      // Imagem mais alta que larga
      baseW = size;
      baseH = size / imgAspect;
    }

    const drawW = baseW * zoomLevel;
    const drawH = baseH * zoomLevel;

    // Centralizar + Pan
    const drawX = (size - drawW) / 2 + panX;
    const drawY = (size - drawH) / 2 + panY;

    ctx.save();
    // Desenhar a imagem com suavização de alta qualidade
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);

    // Desenhar grade suave de orientação (terços)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Verticais
    ctx.moveTo(size / 3, 0);
    ctx.lineTo(size / 3, size);
    ctx.moveTo((size / 3) * 2, 0);
    ctx.lineTo((size / 3) * 2, size);
    // Horizontais
    ctx.moveTo(0, size / 3);
    ctx.lineTo(size, size / 3);
    ctx.moveTo(0, (size / 3) * 2);
    ctx.lineTo(size, (size / 3) * 2);
    ctx.stroke();

    ctx.restore();
  }

  $effect(() => {
    if (isCroppingMode && sourceImage && cropCanvas) {
      // Rastrear dependências de reatividade
      const _z = zoomLevel;
      const _x = panX;
      const _y = panY;
      drawCropPreview();
    }
  });

  function handleCropPointerDown(e: PointerEvent) {
    isDraggingCrop = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleCropPointerMove(e: PointerEvent) {
    if (!isDraggingCrop) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    drawCropPreview();
  }

  function handleCropPointerUp(e: PointerEvent) {
    isDraggingCrop = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function handleCropWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    zoomLevel = Math.max(1.0, Math.min(3.5, zoomLevel + delta));
    drawCropPreview();
  }

  function resetCrop() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    drawCropPreview();
  }

  function applyCrop() {
    if (!sourceImage) return;

    // Renderizar em alta resolução (500x500px) para qualidade máxima e sem bordas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 500;
    exportCanvas.height = 500;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const size = 500;
    const imgAspect = sourceImage.width / sourceImage.height;
    let baseW = size;
    let baseH = size;

    if (imgAspect > 1) {
      baseW = size * imgAspect;
      baseH = size;
    } else {
      baseW = size;
      baseH = size / imgAspect;
    }

    const drawW = baseW * zoomLevel;
    const drawH = baseH * zoomLevel;

    // Converter pan proporcionalmente para a escala de 500px
    const scaleFactor = 500 / (cropCanvas?.width || 280);
    const drawX = (size - drawW) / 2 + (panX * scaleFactor);
    const drawY = (size - drawH) / 2 + (panY * scaleFactor);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);

    // Gerar imagem recortada em formato JPEG otimizado
    const croppedDataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);
    coverPreview = croppedDataUrl;
    isCroppingMode = false;
  }

  function cancelCrop() {
    isCroppingMode = false;
    sourceImage = null;
  }

  async function handleSave() {
    if (!name.trim() || !$playlistToEdit) return;
    isSaving = true;
    errorMessage = null;

    try {
      await libraryActions.updatePlaylist(
        $playlistToEdit.id,
        name.trim(),
        description.trim(),
        coverPreview || undefined,
        visibility
      );
      close();
    } catch (e) {
      console.error('[EditPlaylistModal] Erro ao salvar:', e);
      errorMessage = $t('editPlaylistModal.saveError');
    } finally {
      isSaving = false;
    }
  }
</script>

{#if $playlistToEdit}
  <div 
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-2xl animate-[fade-in_0.2s_ease-out]"
    onclick={close}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="liquid-modal w-full max-w-xl max-h-[88vh] rounded-3xl p-6 flex flex-col gap-5 border border-white/[0.16] shadow-2xl text-[#F2EFEA] animate-apple-spring relative overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#66D7D1]/15 border border-[#66D7D1]/30 flex items-center justify-center text-[#66D7D1]">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-sm font-bold tracking-tight text-[#F2EFEA]">{$t('editPlaylistModal.title')}</h2>
            <p class="text-[11px] text-[#F2EFEA]/50">{$t('editPlaylistModal.subtitle')}</p>
          </div>
        </div>

        <button 
          onclick={close}
          class="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Mensagem de Erro -->
      {#if errorMessage}
        <div class="p-3 rounded-2xl bg-[#FC7753]/15 border border-[#FC7753]/30 flex items-center gap-2.5 text-xs text-[#FC7753]">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      {/if}

      {#if isCroppingMode}
        <!-- ================= ESTÚDIO DE RECORTE 1:1 COM ZOOM E PAN ================= -->
        <div class="flex flex-col items-center gap-4 py-1">
          <div class="flex items-center justify-between w-full px-2">
            <span class="text-xs font-semibold text-[#66D7D1] flex items-center gap-1.5">
              <Crop class="w-4 h-4" />
              <span>{$t('editPlaylistModal.cropTitle')}</span>
            </span>
            <span class="text-[10px] text-white/40 flex items-center gap-1">
              <Move class="w-3 h-3" /> {$t('editPlaylistModal.cropHint')}
            </span>
          </div>

          <!-- Viewport do Canvas Quadrado Interativo -->
          <div class="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-[#66D7D1]/50 shadow-2xl bg-black/90 cursor-grab active:cursor-grabbing select-none group">
            <canvas
              bind:this={cropCanvas}
              width="280"
              height="280"
              class="w-full h-full block"
              onpointerdown={handleCropPointerDown}
              onpointermove={handleCropPointerMove}
              onpointerup={handleCropPointerUp}
              onwheel={handleCropWheel}
            ></canvas>

            <!-- Borda Decorativa Apple Liquid Glass -->
            <div class="absolute inset-0 pointer-events-none rounded-2xl border border-white/20 shadow-inner"></div>
          </div>

          <!-- Controles de Zoom e Reset -->
          <div class="w-full max-w-sm flex items-center justify-between gap-4 px-2 pt-1">
            <div class="flex items-center gap-2 flex-1">
              <ZoomOut class="w-3.5 h-3.5 text-white/40" />
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.05"
                bind:value={zoomLevel}
                class="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#66D7D1]"
              />
              <ZoomIn class="w-3.5 h-3.5 text-white/40" />
              <span class="text-[11px] font-mono text-white/60 w-10 text-right">{zoomLevel.toFixed(1)}x</span>
            </div>

            <button
              type="button"
              onclick={resetCrop}
              class="p-1.5 rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition cursor-pointer"
              title={$t('common.restart')}
            >
              <RotateCcw class="w-4 h-4" />
            </button>
          </div>

          <!-- Ações do Recorte -->
          <div class="flex items-center justify-end gap-3 w-full pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onclick={cancelCrop}
              class="px-4 py-2 rounded-2xl text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
            >
              {$t('common.cancel')}
            </button>
            <button
              type="button"
              onclick={applyCrop}
              class="flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#66D7D1] text-[#09090d] font-bold text-xs shadow-lg shadow-[#66D7D1]/20 hover:bg-[#66D7D1]/90 active:scale-95 transition cursor-pointer"
            >
              <Check class="w-4 h-4" />
              <span>{$t('editPlaylistModal.confirmCrop')}</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- ================= FORMULÁRIO PRINCIPAL DE EDIÇÃO ================= -->
        <div class="flex-1 overflow-y-auto pr-1 py-1">
          <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-6 items-start">
            <!-- Upload e Preview de Capa Quadrada -->
            <div class="flex flex-col gap-2 items-center">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/60 text-center">
                {$t('editPlaylistModal.cover11')}
              </span>
              
              <button
                type="button"
                onclick={() => fileInput?.click()}
                class="relative w-32 h-32 rounded-2xl overflow-hidden group cursor-pointer border border-white/[0.15] shadow-xl bg-black/40 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#66D7D1]"
              >
                {#if coverPreview}
                  <img 
                    src={coverPreview} 
                    alt="Preview" 
                    class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                {:else}
                  <ImageIcon class="w-10 h-10 text-white/30" />
                {/if}

                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white transition-opacity backdrop-blur-[2px]">
                  <Upload class="w-5 h-5 text-[#66D7D1]" />
                  <span class="text-[10px] font-semibold">{$t('editPlaylistModal.changePhoto')}</span>
                </div>
              </button>

              <input
                id="edit-cover-upload"
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                bind:this={fileInput}
                onchange={handleFileSelect}
                class="hidden"
              />

              <span class="text-[10px] text-[#F2EFEA]/40 text-center leading-tight">
                {$t('editPlaylistModal.formatHint')}
              </span>
            </div>

            <!-- Campos de Nome e Descrição -->
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="playlist-name-input" class="text-xs font-semibold text-[#F2EFEA]/80">
                  {$t('editPlaylistModal.nameLabel')}
                </label>
                <input
                  id="playlist-name-input"
                  type="text"
                  bind:value={name}
                  placeholder={$t('editPlaylistModal.namePlaceholder')}
                  maxlength="60"
                  class="w-full py-2.5 px-3.5 rounded-2xl liquid-input text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="playlist-desc-input" class="text-xs font-semibold text-[#F2EFEA]/80">
                  {$t('editPlaylistModal.descLabel')}
                </label>
                <textarea
                  id="playlist-desc-input"
                  bind:value={description}
                  placeholder={$t('editPlaylistModal.descPlaceholder')}
                  rows="3"
                  maxlength="200"
                  class="w-full py-2.5 px-3.5 rounded-2xl liquid-input text-xs text-[#F2EFEA] placeholder:text-[#F2EFEA]/30 focus:outline-none resize-none"
                ></textarea>
              </div>

              <!-- Seletor de Visibilidade Social / Nuvem -->
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-[#F2EFEA]/60">{$t('editPlaylistModal.visibilityLabel')}</span>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onclick={() => visibility = 'public'}
                    class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'public' ? 'liquid-glass border-[#66D7D1] text-[#66D7D1]' : 'border-white/[0.08] bg-white/[0.02] text-[#F2EFEA]/50 hover:text-[#F2EFEA]'}"
                  >
                    <Globe class="w-4 h-4" />
                    <span class="text-[11px] font-bold">{$t('common.public')}</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => visibility = 'shared'}
                    class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'shared' ? 'liquid-glass border-[#DBD56E] text-[#DBD56E]' : 'border-white/[0.08] bg-white/[0.02] text-[#F2EFEA]/50 hover:text-[#F2EFEA]'}"
                  >
                    <Share2 class="w-4 h-4" />
                    <span class="text-[11px] font-bold">{$t('common.friends')}</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => visibility = 'private'}
                    class="p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition cursor-pointer {visibility === 'private' ? 'liquid-glass border-[#FC7753] text-[#FC7753]' : 'border-white/[0.08] bg-white/[0.02] text-[#F2EFEA]/50 hover:text-[#F2EFEA]'}"
                  >
                    <Lock class="w-4 h-4" />
                    <span class="text-[11px] font-bold">{$t('common.private')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rodapé com Botões de Ação -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08] shrink-0">
          <button
            type="button"
            onclick={close}
            class="px-5 py-2.5 rounded-2xl text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
          >
            {$t('common.cancel')}
          </button>

          <button
            type="button"
            onclick={handleSave}
            disabled={!name.trim() || isSaving}
            class="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#FC7753] hover:bg-[#FC7753]/90 text-white font-bold text-xs shadow-lg shadow-[#FC7753]/25 active:scale-95 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            {#if isSaving}
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{$t('editPlaylistModal.saving')}</span>
            {:else}
              <Check class="w-4 h-4" />
              <span>{$t('editPlaylistModal.saveBtn')}</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
