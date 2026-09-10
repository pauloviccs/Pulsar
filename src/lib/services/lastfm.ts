import { writable } from 'svelte/store';
import { lastFmEnabled, lastFmUsername } from '../stores/playerStore';

// Implementação pura de MD5 em TypeScript (sem dependências externas) para cálculo do api_sig da Last.fm
function md5(string: string): string {
  function rotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX: number, lY: number) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    } else {
      return lResult ^ lX8 ^ lY8;
    }
  }
  function F(x: number, y: number, z: number) { return (x & y) | ((~x) & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & (~z)); }
  function H(x: number, y: number, z: number) { return x ^ y ^ z; }
  function I(x: number, y: number, z: number) { return y ^ (x | (~z)); }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(string: string) {
    let lWordCount;
    const lMessageLength = string.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }

  function wordToHex(lValue: number) {
    let WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }

  const x = convertToWordArray(unescape(encodeURIComponent(string)));
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k + 0] || 0, 7, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1] || 0, 12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2] || 0, 17, 0x242070db);
    b = FF(b, c, d, a, x[k + 3] || 0, 22, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4] || 0, 7, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5] || 0, 12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6] || 0, 17, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7] || 0, 22, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8] || 0, 7, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9] || 0, 12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10] || 0, 17, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11] || 0, 22, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12] || 0, 7, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13] || 0, 12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14] || 0, 17, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15] || 0, 22, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1] || 0, 5, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6] || 0, 9, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11] || 0, 14, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0] || 0, 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5] || 0, 5, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10] || 0, 9, 0x2441453);
    c = GG(c, d, a, b, x[k + 15] || 0, 14, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4] || 0, 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9] || 0, 5, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14] || 0, 9, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3] || 0, 14, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8] || 0, 20, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13] || 0, 5, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2] || 0, 9, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7] || 0, 14, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12] || 0, 20, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5] || 0, 4, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8] || 0, 11, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11] || 0, 16, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14] || 0, 23, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1] || 0, 4, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4] || 0, 11, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7] || 0, 16, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10] || 0, 23, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13] || 0, 4, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0] || 0, 11, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3] || 0, 16, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6] || 0, 23, 0x4881d05);
    a = HH(a, b, c, d, x[k + 9] || 0, 4, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12] || 0, 11, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15] || 0, 16, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2] || 0, 23, 0xc4ac5665);

    a = II(a, b, c, d, x[k + 0] || 0, 6, 0xf4292244);
    d = II(d, a, b, c, x[k + 7] || 0, 10, 0x432aff97);
    c = II(c, d, a, b, x[k + 14] || 0, 15, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5] || 0, 21, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12] || 0, 6, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3] || 0, 10, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10] || 0, 15, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1] || 0, 21, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8] || 0, 6, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15] || 0, 10, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6] || 0, 15, 0xa3014314);
    b = II(b, c, d, a, x[k + 13] || 0, 21, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4] || 0, 6, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11] || 0, 10, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2] || 0, 15, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9] || 0, 21, 0xeb86d391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// Configurações e Chaves Oficiais do App Pulsar para Last.fm (VICCS_PulsarPlayer)
const DEFAULT_API_KEY = '94b31a524883e32f92eb88142d3e3546';
const DEFAULT_API_SECRET = 'e594d227fd58d24ddbafeb25c0bbcfe9';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

export const lastFmConnected = writable<boolean>(false);
export const lastFmSessionKey = writable<string>('');
export const lastFmAccountName = writable<string>('');

if (typeof window !== 'undefined') {
  const sk = localStorage.getItem('pulsar_lastfm_sk') || '';
  const user = localStorage.getItem('pulsar_lastfm_user') || '';
  if (sk) {
    lastFmConnected.set(true);
    lastFmSessionKey.set(sk);
    lastFmAccountName.set(user);
  }
}

class LastFmService {
  private getApiKey(): string {
    if (typeof window === 'undefined') return DEFAULT_API_KEY;
    return localStorage.getItem('pulsar_lastfm_custom_key') || DEFAULT_API_KEY;
  }

  private getApiSecret(): string {
    if (typeof window === 'undefined') return DEFAULT_API_SECRET;
    return localStorage.getItem('pulsar_lastfm_custom_secret') || DEFAULT_API_SECRET;
  }

  private createSignature(params: Record<string, string>): string {
    const secret = this.getApiSecret();
    const sortedKeys = Object.keys(params)
      .filter(k => k !== 'format' && k !== 'callback')
      .sort();

    let sigString = '';
    for (const key of sortedKeys) {
      sigString += `${key}${params[key]}`;
    }
    sigString += secret;
    return md5(sigString);
  }

  /**
   * Inicia o fluxo de autenticação gerando um token de requisição
   */
  async getAuthToken(): Promise<string> {
    const apiKey = this.getApiKey();
    const res = await fetch(`${LASTFM_API_URL}?method=auth.getToken&api_key=${apiKey}&format=json`);
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.message || 'Falha ao solicitar Token de autenticação da Last.fm');
    }
    return data.token;
  }

  /**
   * Retorna o link que o usuário deve abrir no navegador para autorizar o Pulsar
   */
  getAuthUrl(token: string): string {
    const apiKey = this.getApiKey();
    return `https://www.last.fm/api/auth/?api_key=${apiKey}&token=${token}`;
  }

  /**
   * Troca o token autorizado pela Session Key permanente do usuário
   */
  async createSession(token: string): Promise<{ sessionKey: string; name: string }> {
    const apiKey = this.getApiKey();
    const params: Record<string, string> = {
      api_key: apiKey,
      method: 'auth.getSession',
      token
    };
    params.api_sig = this.createSignature(params);
    params.format = 'json';

    const queryString = new URLSearchParams(params).toString();
    const res = await fetch(`${LASTFM_API_URL}?${queryString}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.message || 'A autorização da Last.fm ainda não foi confirmada no navegador.');
    }

    const sessionKey = data.session.key;
    const name = data.session.name;

    if (typeof window !== 'undefined') {
      localStorage.setItem('pulsar_lastfm_sk', sessionKey);
      localStorage.setItem('pulsar_lastfm_user', name);
      localStorage.setItem('pulsar_lastfm_enabled', 'true');
    }

    lastFmConnected.set(true);
    lastFmSessionKey.set(sessionKey);
    lastFmAccountName.set(name);
    lastFmEnabled.set(true);
    lastFmUsername.set(name);

    return { sessionKey, name };
  }

  /**
   * Desconecta a conta e limpa os dados de sessão
   */
  disconnect() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pulsar_lastfm_sk');
      localStorage.removeItem('pulsar_lastfm_user');
      localStorage.setItem('pulsar_lastfm_enabled', 'false');
    }
    lastFmConnected.set(false);
    lastFmSessionKey.set('');
    lastFmAccountName.set('');
    lastFmEnabled.set(false);
    lastFmUsername.set('');
  }

  /**
   * Atualiza o status "Ouvindo Agora" (Now Playing) na Last.fm
   */
  async updateNowPlaying(artist: string, track: string): Promise<boolean> {
    const sk = typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_sk') : null;
    if (!sk) return false;

    try {
      const apiKey = this.getApiKey();
      const params: Record<string, string> = {
        api_key: apiKey,
        artist,
        method: 'track.updateNowPlaying',
        sk,
        track
      };
      params.api_sig = this.createSignature(params);
      params.format = 'json';

      const formData = new URLSearchParams(params);
      const res = await fetch(LASTFM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      return res.ok;
    } catch (e) {
      console.warn('[Last.fm] Erro ao atualizar Now Playing:', e);
      return false;
    }
  }

  /**
   * Envia o Scrobble oficial de uma faixa ouvida
   */
  async scrobble(artist: string, track: string, timestampSeconds?: number): Promise<boolean> {
    const sk = typeof window !== 'undefined' ? localStorage.getItem('pulsar_lastfm_sk') : null;
    if (!sk) return false;

    try {
      const apiKey = this.getApiKey();
      const timestamp = (timestampSeconds || Math.floor(Date.now() / 1000)).toString();
      const params: Record<string, string> = {
        api_key: apiKey,
        artist,
        method: 'track.scrobble',
        sk,
        timestamp,
        track
      };
      params.api_sig = this.createSignature(params);
      params.format = 'json';

      const formData = new URLSearchParams(params);
      const res = await fetch(LASTFM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        console.log(`[Last.fm] Scrobble registrado com sucesso: ${artist} - ${track}`);
        return true;
      } else {
        console.warn('[Last.fm] Falha no Scrobble:', data);
        return false;
      }
    } catch (e) {
      console.warn('[Last.fm] Erro de rede no scrobble:', e);
      return false;
    }
  }
}

export const lastFmService = new LastFmService();
