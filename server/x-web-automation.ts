import { executeAdb } from './duoplus';

interface PostResult {
  success: boolean;
  message: string;
  steps: { step: string; success: boolean; details?: string }[];
}

interface ButtonBounds {
  x: number;
  y: number;
}

/**
 * UIAutomatorのXMLからボタンの座標を解析
 */
function parseButtonBounds(xmlContent: string, searchText: string): ButtonBounds | null {
  // content-desc="Compose a post" bounds="[864,1554][1023,1713]" のようなパターンを探す
  const contentDescRegex = new RegExp(
    `content-desc="${searchText}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'i'
  );
  const contentDescMatch = xmlContent.match(contentDescRegex);

  if (contentDescMatch) {
    const [, left, top, right, bottom] = contentDescMatch.map(Number);
    return {
      x: Math.round((left + right) / 2),
      y: Math.round((top + bottom) / 2),
    };
  }

  // text="Post" bounds="[864,1554][1023,1713]" のようなパターンも探す
  const textRegex = new RegExp(
    `text="${searchText}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'i'
  );
  const textMatch = xmlContent.match(textRegex);

  if (textMatch) {
    const [, left, top, right, bottom] = textMatch.map(Number);
    return {
      x: Math.round((left + right) / 2),
      y: Math.round((top + bottom) / 2),
    };
  }

  return null;
}

/**
 * X(Twitter)に投稿する（UIAutomatorベース）
 */
export async function postToXWeb(deviceId: string, content: string): Promise<PostResult> {
  const steps: PostResult['steps'] = [];

  try {
    // Step 1: X.comを開く
    console.log('[X投稿] Step 1: X.comを開く');
    await executeAdb(deviceId, 'am start -a android.intent.action.VIEW -d https://x.com/home');
    steps.push({ step: 'Open X.com', success: true });

    // Step 2: ページ読み込みを待機
    console.log('[X投稿] Step 2: ページ読み込みを待機（5秒）');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    steps.push({ step: 'Wait for page load', success: true });

    // Step 3: UI要素をダンプ
    console.log('[X投稿] Step 3: UI要素をダンプ');
    await executeAdb(deviceId, 'uiautomator dump /sdcard/ui.xml');
    const uiXmlResult = await executeAdb(deviceId, 'cat /sdcard/ui.xml');
    steps.push({ step: 'Dump UI elements', success: true });

    // Step 4: 投稿ボタンの座標を解析
    console.log('[X投稿] Step 4: 投稿ボタンの座標を解析');
    const composeButtonBounds = parseButtonBounds(uiXmlResult.content, 'Compose a post');
    if (!composeButtonBounds) {
      console.error('[X投稿] 投稿ボタンが見つかりません');
      return {
        success: false,
        message: 'Compose button not found. User may not be logged in.',
        steps,
      };
    }
    steps.push({
      step: 'Find compose button',
      success: true,
      details: `x=${composeButtonBounds.x}, y=${composeButtonBounds.y}`,
    });

    // Step 5: 投稿ボタンをタップ
    console.log(`[X投稿] Step 5: 投稿ボタンをタップ (${composeButtonBounds.x}, ${composeButtonBounds.y})`);
    await executeAdb(deviceId, `input tap ${composeButtonBounds.x} ${composeButtonBounds.y}`);
    steps.push({ step: 'Tap compose button', success: true });

    // Step 6: 投稿画面の読み込みを待機
    console.log('[X投稿] Step 6: 投稿画面の読み込みを待機（2秒）');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    steps.push({ step: 'Wait for compose screen', success: true });

    // Step 7: テキスト入力（クリップボード経由）
    console.log('[X投稿] Step 7: テキスト入力（クリップボード経由）');
    const escapedContent = content.replace(/'/g, "'\\''");
    
    // clipperアプリを試す
    try {
      await executeAdb(deviceId, `am broadcast -a clipper.set -e text '${escapedContent}'`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await executeAdb(deviceId, 'input keyevent 279'); // KEYCODE_PASTE
      steps.push({ step: 'Input text via clipper', success: true });
    } catch (error) {
      // clipperが使えない場合はservice callを使用
      console.log('[X投稿] clipperが使えないため、service callを使用');
      await executeAdb(deviceId, `service call clipboard 2 i32 1 i32 1 s16 '${escapedContent}'`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await executeAdb(deviceId, 'input keyevent 279'); // KEYCODE_PASTE
      steps.push({ step: 'Input text via service call', success: true });
    }

    // Step 8: 入力完了を待機
    console.log('[X投稿] Step 8: 入力完了を待機（1秒）');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    steps.push({ step: 'Wait for text input', success: true });

    // Step 9: UI要素を再ダンプ
    console.log('[X投稿] Step 9: UI要素を再ダンプ');
    await executeAdb(deviceId, 'uiautomator dump /sdcard/ui.xml');
    const uiXml2Result = await executeAdb(deviceId, 'cat /sdcard/ui.xml');
    steps.push({ step: 'Dump UI elements again', success: true });

    // Step 10: Postボタンの座標を解析
    console.log('[X投稿] Step 10: Postボタンの座標を解析');
    const postButtonBounds = parseButtonBounds(uiXml2Result.content, 'Post');
    if (!postButtonBounds) {
      console.error('[X投稿] Postボタンが見つかりません');
      return {
        success: false,
        message: 'Post button not found',
        steps,
      };
    }
    steps.push({
      step: 'Find post button',
      success: true,
      details: `x=${postButtonBounds.x}, y=${postButtonBounds.y}`,
    });

    // Step 11: Postボタンをタップ
    console.log(`[X投稿] Step 11: Postボタンをタップ (${postButtonBounds.x}, ${postButtonBounds.y})`);
    await executeAdb(deviceId, `input tap ${postButtonBounds.x} ${postButtonBounds.y}`);
    steps.push({ step: 'Tap post button', success: true });

    // Step 12: 投稿完了を待機
    console.log('[X投稿] Step 12: 投稿完了を待機（3秒）');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    steps.push({ step: 'Wait for post completion', success: true });

    console.log('[X投稿] 投稿が完了しました');
    return {
      success: true,
      message: 'Post successful',
      steps,
    };
  } catch (error: any) {
    console.error('[X投稿] エラーが発生しました:', error.message);
    steps.push({ step: 'Error occurred', success: false, details: error.message });
    return {
      success: false,
      message: error.message,
      steps,
    };
  }
}
