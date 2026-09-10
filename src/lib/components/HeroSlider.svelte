<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    Sparkles, 
    Flame, 
    Headphones, 
    Play, 
    Plus, 
    ChevronLeft, 
    ChevronRight, 
    Link2,
    Disc3,
    TrendingUp
  } from '@lucide/svelte';
  import { isAddLinkModalOpen, allTracks } from '../stores/libraryStore';
  import { playerActions, currentTrack, isPlaying } from '../stores/playerStore';
  import { t } from '../i18n';
  import type { Track } from '../types';

  interface Slide {
    id: string;
    type: 'action' | 'track';
    badge: string;
    badgeIcon: any;
    badgeColor: string;
    title: string;
    subtitle: string;
    image: string;
    track?: Track;
    buttonText: string;
    buttonColor: string;
  }

  // Obter faixas do store para compor os slides dinâmicos
  let tracks = $derived($allTracks);

  let slides = $derived<Slide[]>([
    {
      id: 'slide-add',
      type: 'action',
      badge: $t('hero.badge'),
      badgeIcon: Sparkles,
      badgeColor: '#FC7753',
      title: $t('hero.title'),
      subtitle: $t('hero.desc'),
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1000&auto=format&fit=crop&q=80',
      buttonText: $t('hero.pasteBtn'),
      buttonColor: '#FC7753'
    },
    {
      id: 'slide-trending-1',
      type: 'track',
      badge: $t('hero.trendingBadge'),
      badgeIcon: Flame,
      badgeColor: '#FC7753',
      title: tracks[0]?.title || 'Lofi Hip Hop Radio - Beats to Relax/Study to',
      subtitle: `${tracks[0]?.channel_name || 'Lofi Girl'} • ${$t('hero.trendingSubtitle')}`,
      image: tracks[0]?.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
      track: tracks[0],
      buttonText: $t('hero.listenNow'),
      buttonColor: '#FC7753'
    },
    {
      id: 'slide-trending-2',
      type: 'track',
      badge: 'SYNTHWAVE • RETRO',
      badgeIcon: TrendingUp,
      badgeColor: '#66D7D1',
      title: tracks[1]?.title || 'Midnight City (Synthwave Drive)',
      subtitle: `${tracks[1]?.channel_name || 'RetroWaves FM'}`,
      image: tracks[1]?.thumbnail_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80',
      track: tracks[1],
      buttonText: $t('playlistDetail.play'),
      buttonColor: '#66D7D1'
    },
    {
      id: 'slide-trending-3',
      type: 'track',
      badge: 'DEEP FOCUS • SOUNDSCAPE',
      badgeIcon: Headphones,
      badgeColor: '#DBD56E',
      title: tracks[2]?.title || 'Deep Focus Ambient Sessions',
      subtitle: `${tracks[2]?.channel_name || 'Mind & Code'}`,
      image: tracks[2]?.thumbnail_url || 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1000&auto=format&fit=crop&q=80',
      track: tracks[2],
      buttonText: $t('playlistDetail.play'),
      buttonColor: '#DBD56E'
    }
  ]);

  let currentSlideIndex = $state<number>(0);
  let isHovered = $state<boolean>(false);
  let autoSlideTimer: any = null;

  function nextSlide() {
    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
  }

  function prevSlide() {
    currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
  }

  function goToSlide(index: number) {
    currentSlideIndex = index;
  }

  function handleAction(slide: Slide) {
    if (slide.type === 'action') {
      isAddLinkModalOpen.set(true);
    } else if (slide.track) {
      playerActions.playTrack(slide.track, tracks);
    }
  }

  function handleAddToQueue(track?: Track) {
    if (track) {
      playerActions.addToQueue(track);
    }
  }

  onMount(() => {
    autoSlideTimer = setInterval(() => {
      if (!isHovered) {
        nextSlide();
      }
    }, 6000);
  });

  onDestroy(() => {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
  });
</script>

<div
  role="region"
  aria-label="Destaques do Pulsar"
  class="relative w-full h-60 sm:h-64 md:h-72 rounded-3xl overflow-hidden glass-panel border border-white/[0.08] shadow-2xl select-none group"
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <!-- Slides Container -->
  {#each slides as slide, index (slide.id)}
    {@const isActive = currentSlideIndex === index}
    {@const isTrackPlaying = slide.track && $currentTrack?.id === slide.track.id && $isPlaying}
    {@const BadgeIcon = slide.badgeIcon}

    <div
      class="absolute inset-0 transition-opacity duration-700 ease-in-out {isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}"
    >
      <!-- Capa de Fundo com Blur e Efeito de Vidro Cinematográfico -->
      <div class="absolute inset-0 overflow-hidden">
        <img
          src={slide.image}
          alt=""
          class="w-full h-full object-cover scale-105 transition-transform duration-[6000ms] {isActive ? 'scale-110' : 'scale-100'} filter blur-md opacity-35"
        />
        <!-- Máscara de gradiente suave escurecendo para a esquerda -->
        <div class="absolute inset-0 bg-gradient-to-r from-[#121216] via-[#121216]/85 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-[#121216]/80 via-transparent to-transparent"></div>
      </div>

      <!-- Conteúdo do Slide -->
      <div class="relative h-full px-4 sm:px-8 md:px-12 py-4 sm:py-6 md:py-8 flex items-center justify-between gap-4 sm:gap-8 z-20">
        <!-- Textos e Botões -->
        <div class="flex flex-col gap-2 sm:gap-3 max-w-xl">
          <!-- Badge -->
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase w-fit border shadow-sm backdrop-blur-md"
            style="background-color: {slide.badgeColor}18; color: {slide.badgeColor}; border-color: {slide.badgeColor}35;"
          >
            <BadgeIcon class="w-3.5 h-3.5" />
            <span>{slide.badge}</span>
          </div>

          <!-- Título -->
          <h2 class="text-xl md:text-3xl font-extrabold tracking-tight text-[#F2EFEA] line-clamp-2 leading-tight drop-shadow-md">
            {slide.title}
          </h2>

          <!-- Subtítulo -->
          <p class="text-xs md:text-sm text-[#F2EFEA]/70 line-clamp-2 leading-relaxed">
            {slide.subtitle}
          </p>

          <!-- Ações -->
          <div class="flex items-center gap-3 pt-2">
            <button
              onclick={() => handleAction(slide)}
              class="px-5 py-2.5 rounded-2xl text-[#121216] text-xs font-bold shadow-lg flex items-center gap-2.5 transition active:scale-95 cursor-pointer hover:opacity-95"
              style="background-color: {slide.buttonColor}; box-shadow: 0 10px 25px -5px {slide.buttonColor}40;"
            >
              {#if slide.type === 'action'}
                <Link2 class="w-4 h-4" />
              {:else if isTrackPlaying}
                <Disc3 class="w-4 h-4 animate-spin" />
              {:else}
                <Play class="w-4 h-4 fill-current" />
              {/if}
              <span>{isTrackPlaying ? $t('player.nowPlaying') : slide.buttonText}</span>
            </button>

            {#if slide.type === 'track' && slide.track}
              <button
                onclick={() => handleAddToQueue(slide.track)}
                class="px-3.5 py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.08] text-xs font-medium text-[#F2EFEA] flex items-center gap-2 transition active:scale-95 cursor-pointer"
                title="{$t('player.queue')}"
              >
                <Plus class="w-4 h-4" />
                <span>{$t('player.queue')}</span>
              </button>
            {/if}
          </div>
        </div>

        <!-- Thumbnail Elegante Flutuante à Direita (Para faixas) -->
        {#if slide.type === 'track'}
          <div class="hidden sm:flex relative shrink-0 aspect-square w-36 md:w-44 rounded-2xl overflow-hidden border border-white/[0.12] shadow-2xl shadow-black/80 group/thumb">
            <img
              src={slide.image}
              alt=""
              class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
            />
            <div
              role="button"
              tabindex="0"
              onclick={() => handleAction(slide)}
              onkeydown={(e) => { if (e.key === 'Enter') handleAction(slide); }}
              class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
            >
              <div class="w-11 h-11 rounded-full bg-white text-[#121216] flex items-center justify-center shadow-lg">
                <Play class="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/each}

  <!-- Botões de Navegação Lateral (Aparecem no hover) -->
  <button
    onclick={prevSlide}
    class="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/70 border border-white/[0.1] text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
    title="{$t('player.previous')}"
  >
    <ChevronLeft class="w-4 h-4" />
  </button>

  <button
    onclick={nextSlide}
    class="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/70 border border-white/[0.1] text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
    title="{$t('player.next')}"
  >
    <ChevronRight class="w-4 h-4" />
  </button>

  <!-- Indicadores de Paginação no Rodapé Inferior Direito -->
  <div class="absolute bottom-4 right-8 z-30 flex items-center gap-1.5">
    {#each slides as _, i}
      <button
        onclick={() => goToSlide(i)}
        class="h-1.5 rounded-full transition-all duration-500 cursor-pointer {currentSlideIndex === i ? 'w-6 bg-[#FC7753]' : 'w-2 bg-white/25 hover:bg-white/50'}"
        title="Slide {i + 1}"
      ></button>
    {/each}
  </div>
</div>
