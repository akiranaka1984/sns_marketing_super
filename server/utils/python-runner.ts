import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PYTHON_PATH = '/usr/bin/python3.11';
const SCRIPTS_PATH = '/home/ubuntu/sns_marketing_automation/scripts/duoplus';

interface LikeResult {
  success: boolean;
  x?: number;
  y?: number;
  confidence?: number;
  retry_count?: number;
  error?: string;
}

interface CommentResult {
  success: boolean;
  comment?: string;
  x?: number;
  y?: number;
  confidence?: number;
  retry_count?: number;
  error?: string;
}

export async function executeLike(
  apiKey: string,
  deviceId: string,
  postUrl: string
): Promise<LikeResult> {
  const command = `${PYTHON_PATH} ${SCRIPTS_PATH}/like_action.py "${apiKey}" "${deviceId}" "${postUrl}"`;
  
  try {
    // Python 3.11が正しく動作するように環境変数をクリーンアップ
    const cleanEnv = { ...process.env };
    delete cleanEnv.PYTHONHOME;
    delete cleanEnv.PYTHONPATH;
    delete cleanEnv.NUITKA_PYTHONPATH;
    delete cleanEnv.LD_LIBRARY_PATH;
    
    const { stdout } = await execAsync(command, { 
      timeout: 60000,
      env: cleanEnv
    });
    return JSON.parse(stdout);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function executeAiComment(
  apiKey: string,
  deviceId: string,
  postUrl: string,
  openaiApiKey: string,
  persona: string
): Promise<CommentResult> {
  // ペルソナの引用符をエスケープ
  const escapedPersona = persona.replace(/"/g, '\\"');
  const command = `${PYTHON_PATH} ${SCRIPTS_PATH}/ai_comment_action.py "${apiKey}" "${deviceId}" "${postUrl}" "${openaiApiKey}" "${escapedPersona}"`;
  
  try {
    // Python 3.11が正しく動作するように環境変数をクリーンアップ
    const cleanEnv = { ...process.env };
    delete cleanEnv.PYTHONHOME;
    delete cleanEnv.PYTHONPATH;
    delete cleanEnv.NUITKA_PYTHONPATH;
    delete cleanEnv.LD_LIBRARY_PATH;
    
    const { stdout } = await execAsync(command, { 
      timeout: 120000,
      env: cleanEnv
    });
    return JSON.parse(stdout);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
