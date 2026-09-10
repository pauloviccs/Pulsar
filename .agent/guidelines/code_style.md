# Diretrizes de Estilo de Código (Code Style) - Pulsar

## 1. Princípios Fundamentais
1. **Zero Fluff & Tipagem Estrita:** Toda interface, função ou retorno deve possuir tipo explícito no TypeScript. O modo `check` (`npm run check`) deve sempre passar com 0 erros e 0 warnings.
2. **Defesa em Camadas:** Nunca assumir que o ambiente é puramente desktop nativo sem proteção. Sempre usar `safeInvoke` de `src/lib/api/tauri.ts` para chamadas IPC ao Rust.
3. **Respeito aos Runes do Svelte 5:**
   - Usar `$state` para variáveis reativas locais.
   - Usar `$derived` para computações baseadas em outros estados.
   - Usar `$effect` apenas para sincronizações com o DOM ou APIs externas (como timers, listeners de clique fora e áudio).

## 2. Padrões de Front-end (Svelte 5 & TypeScript)
- **Estrutura de Componentes:**
  ```svelte
  <script lang="ts">
    import { t } from '$lib/i18n';
    import type { Track } from '$lib/types';

    interface Props {
      track: Track;
      isActive?: boolean;
    }

    let { track, isActive = false }: Props = $props();
  </script>

  <div class="liquid-glass p-4 rounded-xl">
    ...
  </div>
  ```
- **Nomenclatura:**
  - Componentes: `PascalCase.svelte` (ex: `TopProfileButton.svelte`, `HeroSlider.svelte`).
  - Stores e utilitários: `camelCase.ts` (ex: `playerStore.ts`, `lastfm.ts`).
  - Tipos e Interfaces: `PascalCase` (ex: `UserProfile`, `PlaybackState`).
- **Tratamento de Strings e i18n:**
  - NUNCA incluir texto bruto hardcoded em componentes. Use sempre `$t('chave.subchave')`.
  - Verifique `src/lib/i18n/types.ts` e atualize os 6 arquivos de dicionário para manter conformidade.

## 3. Padrões de Backend (Rust & Tauri)
- **Crates e Módulos:**
  - Mantenha `lib.rs` como orquestrador limpo de plugins e handlers.
  - Comandos IPC residem em `src-tauri/src/commands/`.
  - Lógica de banco de dados reside estritamente em `src-tauri/src/db/`.
- **Tratamento de Erros:**
  - Retorne `Result<T, String>` em comandos expostos ao Tauri para que o front-end possa capturar erros através de `try/catch` de forma descritiva.
- **Concorrência e Locks:**
  - Conexões de banco SQLite (`rusqlite::Connection`) são envolvidas em `std::sync::Mutex<Connection>` dentro de `Database`.
  - Bloqueios de Mutex devem ter escopo mínimo para evitar travamento da fila do Axum ou de comandos simultâneos.
