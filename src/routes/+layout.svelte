<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { logger } from '$lib/services/logger';

  let { children } = $props();

  onMount(() => {
    logger.init();
    console.log('[Pulsar] Frontend inicializado com sucesso.');
  });
</script>

{@render children()}
