/**
 * 文字数カウンター
 * 全角文字（日本語、中国語、韓国語など）は2文字としてカウント
 * 半角文字は1文字としてカウント
 */
export function calculateCharCount(text: string): number {
  let count = 0;
  for (const char of text) {
    // 全角文字（日本語、中国語、韓国語など）は2文字としてカウント
    count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
  }
  return count;
}

/**
 * 文字数制限チェック
 * @param text チェックするテキスト
 * @param maxLength 最大文字数（デフォルト: 280）
 * @returns 制限内かどうか
 */
export function isWithinCharLimit(text: string, maxLength: number = 280): boolean {
  return calculateCharCount(text) <= maxLength;
}

/**
 * 文字数カウント表示用テキスト生成
 * @param text カウントするテキスト
 * @param maxLength 最大文字数（デフォルト: 280）
 * @returns 表示用テキスト（例: "120 / 280"）
 */
export function getCharCountDisplay(text: string, maxLength: number = 280): string {
  const count = calculateCharCount(text);
  return `${count} / ${maxLength}`;
}

/**
 * 文字数超過チェック
 * @param text チェックするテキスト
 * @param maxLength 最大文字数（デフォルト: 280）
 * @returns 超過している場合true
 */
export function isCharCountExceeded(text: string, maxLength: number = 280): boolean {
  return calculateCharCount(text) > maxLength;
}
