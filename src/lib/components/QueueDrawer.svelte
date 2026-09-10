<script lang="ts">
  import { X, Trash2, Music, Play, ListOrdered } from '@lucide/svelte';
  import { queue, queueIndex, currentTrack, playerActions, isQueueOpen, formatTime } from '../stores/playerStore';

  function close() {
    isQueueOpen.set(false);
  }

  function clearQueue() {
    queue.set($currentTrack ? [$currentTrack] : []);
    queueIndex.set(0);
  }
</script>

{#if $isQueueOpen}
  <aside 
    aria-label="Fila de reprodução"
    class="fixed top-0 right-0 bottom-20 w-80 z-40 p-4 bg-[#16161d]/90 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl flex flex-col justify-between text-[#F2EFEA] select-none animate-[slide-left_0.2s_ease-out]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
      <div class="flex items-center gap-2">
        <ListOrdered class="w-4 h-4 text-[#66D7D1]" />
        <h3 class="text-xs font-bold tracking-tight uppercase text-[#F2EFEA]/80">Fila de Reprodução</h3>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#66D7D1]">{$queue.length}</span>
      </div>

      <div class="flex items-center gap-1">
        {#if $queue.length > 1}
          <button
            onclick={clearQueue}
            class="p-1.5 rounded-lg text-white/40 hover:text-[#FC7753] hover:bg-white/[0.04] transition cursor-pointer"
            title="Limpar Fila"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        {/if}

        <button
          onclick={close}
          class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Lista -->
    <div class="flex-1 overflow-y-auto py-3 flex flex-col gap-3">
      <!-- Tocando Agora -->
      {#if $currentTrack}
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-[#66D7D1]">Tocando Agora</span>
          <div class="glass-card rounded-xl p-2.5 flex items-center gap-2.5 border border-[#66D7D1]/20">
            <img src={$currentTrack.thumbnail_url} alt="" class="w-9 h-9 rounded-lg object-cover" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-[#66D7D1] truncate">{$currentTrack.title}</p>
              <p class="text-[10px] text-[#F2EFEA]/50 truncate">{$currentTrack.artist_guess || $currentTrack.channel_name}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- A Seguir -->
      <div class="flex flex-col gap-1.5 pt-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-[#F2EFEA]/40">A Seguir</span>

        {#if $queue.length === 0}
          <div class="py-12 flex flex-col items-center justify-center gap-2 text-center text-[#F2EFEA]/30">
            <Music class="w-6 h-6" />
            <p class="text-xs">Fila vazia</p>
          </div>
        {:else}
          <div class="flex flex-col gap-1">
            {#each $queue as track, idx (track.id + idx)}
              {#if track.id !== $currentTrack?.id}
                <div 
                  role="button"
                  tabindex="0"
                  onclick={() => playerActions.playTrack(track, $queue)}
                  onkeydown={(e) => { if (e.key === 'Enter') playerActions.playTrack(track, $queue); }}
                  class="group flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <img src={track.thumbnail_url} alt="" class="w-8 h-8 rounded-md object-cover" />
                    <div class="flex flex-col min-w-0">
                      <p class="text-xs font-medium text-[#F2EFEA] group-hover:text-[#66D7D1] transition truncate">{track.title}</p>
                      <p class="text-[10px] text-[#F2EFEA]/40 truncate">{track.artist_guess || track.channel_name}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[10px] font-mono text-[#F2EFEA]/40">{formatTime(track.duration_seconds)}</span>
                    <button
                      type="button"
                      onclick={(e) => { e.stopPropagation(); playerActions.removeFromQueue(idx); }}
                      class="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-[#FC7753] text-[#F2EFEA]/40 transition cursor-pointer"
                      title="Remover"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </aside>
{/if}
