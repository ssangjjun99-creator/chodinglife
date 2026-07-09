import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const translateWordFn = httpsCallable(functions, 'translateWord');

/**
 * 영어 단어를 한국어로 번역합니다.
 * @param {string} text - 번역할 영어 단어
 * @returns {Promise<string>} 번역된 한국어
 */
export async function translateWord(text) {
  const result = await translateWordFn({ text });
  return result.data.translated;
}
