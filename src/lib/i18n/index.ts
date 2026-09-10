import { writable, derived, get } from 'svelte/store';
import type { SupportedLocale, LocaleInfo, TranslationDictionary } from './types';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import { es } from './locales/es';
import { zhCN } from './locales/zh-CN';
import { ja } from './locales/ja';
import { ko } from './locales/ko';

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'pt-BR', name: 'Português (Brasil)', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'Inglês', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Espanhol', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh-CN', name: 'Chinês (Simplificado)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japonês', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Coreano (Sul-Coreano)', nativeName: '한국어', flag: '🇰🇷' }
];

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  'pt-BR': ptBR,
  'en': en,
  'es': es,
  'zh-CN': zhCN,
  'ja': ja,
  'ko': ko
};

function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'pt-BR';
  const saved = localStorage.getItem('pulsar_locale') as SupportedLocale;
  if (saved && dictionaries[saved]) {
    return saved;
  }
  return 'pt-BR';
}

export const currentLocale = writable<SupportedLocale>(getInitialLocale());

// Store derivado que retorna uma função de tradução reativa: $t('secao.chave')
export const t = derived(currentLocale, ($locale) => {
  const currentDict = dictionaries[$locale] || ptBR;

  return (keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let val: any = currentDict;

    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        // Fallback para pt-BR se não encontrar a chave
        let fallbackVal: any = ptBR;
        for (const fk of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && fk in fallbackVal) {
            fallbackVal = fallbackVal[fk];
          } else {
            fallbackVal = null;
            break;
          }
        }
        val = fallbackVal ?? keyPath;
        break;
      }
    }

    if (typeof val !== 'string') {
      return keyPath;
    }

    // Interpolação de variáveis {nome}
    if (params) {
      return Object.entries(params).reduce((str, [pKey, pVal]) => {
        return str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }, val);
    }

    return val;
  };
});

// Helper para obter tradução fora de componentes Svelte
export function translate(keyPath: string, params?: Record<string, string | number>): string {
  const current = get(t);
  return current(keyPath, params);
}

// Salva e atualiza o idioma
export function setLocale(newLocale: SupportedLocale) {
  if (!dictionaries[newLocale]) return;
  if (typeof window !== 'undefined') {
    localStorage.setItem('pulsar_locale', newLocale);
  }
  currentLocale.set(newLocale);
}

// Reinicia a aplicação para aplicar todas as diretivas de idioma
export function restartApplication() {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
