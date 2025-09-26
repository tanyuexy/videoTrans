import {
  GoogleGenAI,
} from "@google/genai";
import fs from "fs-extra";
import path from "path";
import wav from "wav";

let apiKey =
  process.env.GEMINI_API_KEY || "AIzaSyChLKS2TbigTTYsEP7i_-AHy8I4J6gkxM8";

// 初始化Gemini客户端
const genAI = new GoogleGenAI({ apiKey: apiKey });

// 支持的语音选项
const VOICE_OPTIONS = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda',
  'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
];

// 语音特点描述映射表
const VOICE_DESCRIPTIONS = {
  'Zephyr': '明亮',
  'Puck': '欢快',
  'Charon': '信息丰富',
  'Kore': '坚定',
  'Fenrir': 'Excitable',
  'Leda': '青春',
  'Orus': '公司',
  'Aoede': 'Breezy',
  'Callirrhoe': '轻松',
  'Autonoe': '明亮',
  'Enceladus': '气势',
  'Iapetus': '清晰',
  'Umbriel': '随和',
  'Algieba': '平滑',
  'Despina': '平滑',
  'Erinome': '清除',
  'Algenib': 'Gravelly',
  'Rasalgethi': '信息丰富',
  'Laomedeia': '欢快',
  'Achernar': '软',
  'Alnilam': 'Firm',
  'Schedar': 'Even',
  'Gacrux': '成人',
  'Pulcherrima': '直率',
  'Achird': '友好',
  'Zubenelgenubi': '随意',
  'Vindemiatrix': '温柔',
  'Sadachbia': '活泼',
  'Sadaltager': '知识渊博',
  'Sulafat': '编高'
};


/**
 * 保存WAV文件
 * @param {string} filename - 文件路径
 * @param {Buffer} pcmData - PCM音频数据
 * @param {number} channels - 声道数，默认1
 * @param {number} rate - 采样率，默认24000
 * @param {number} sampleWidth - 采样位深，默认2 (16位)
 * @returns {Promise<void>}
 */
async function saveWaveFile(
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', resolve);
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

/**
 * 获取支持的语音选项
 * @returns {string[]} 语音选项数组
 */
function getVoiceOptions() {
  return VOICE_OPTIONS;
}

/**
 * 获取带描述的语音选项
 * @returns {Object[]} 包含语音名称和描述的对象数组
 */
function getVoiceOptionsWithDescriptions() {
  return VOICE_OPTIONS.map(voice => ({
    name: voice,
    description: VOICE_DESCRIPTIONS[voice] || voice,
    displayName: `${voice} - ${VOICE_DESCRIPTIONS[voice] || voice}`
  }));
}


/**
 * 验证语音选项是否有效
 * @param {string} voiceName - 语音名称
 * @returns {boolean} 是否为有效语音
 */
function isValidVoice(voiceName) {
  return VOICE_OPTIONS.includes(voiceName);
}

/**
 * 使用Gemini TTS API生成语音
 * @param {string} text - 要转换为语音的文本
 * @param {string} voiceName - 语音名称 (可选，默认为Kore)
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 生成的音频文件路径
 */
async function generateSpeech(text, voiceName = 'Kore', outputPath) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("文本内容不能为空");
    }

    if (!isValidVoice(voiceName)) {
      console.warn(`无效的语音选项: ${voiceName}，使用默认语音 Kore`);
      voiceName = 'Kore';
    }

    console.log(`正在生成语音文件: ${voiceName} 语音...`);
    console.log(`文本内容: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    // 调用Gemini TTS API
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            }
          }
        },
      }
    });

    // 检查响应
    if (!response || !response.candidates || response.candidates.length === 0) {
      throw new Error("Gemini TTS API返回空结果");
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error("响应中没有音频数据");
    }

    const audioPart = candidate.content.parts[0];
    if (!audioPart.inlineData || !audioPart.inlineData.data) {
      throw new Error("音频数据为空");
    }

    // 获取音频数据 (Base64编码)
    const audioData = audioPart.inlineData.data;
    
    // 将Base64数据转换为Buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    // 根据文件扩展名选择保存方式
    const fileExtension = path.extname(outputPath).toLowerCase();
    
    if (fileExtension === '.wav') {
      // 使用WAV库保存WAV文件，确保正确的格式
      await saveWaveFile(outputPath, audioBuffer, 1, 24000, 2);
    } else {
      // 对于其他格式（如MP3），直接保存buffer
      await fs.writeFile(outputPath, audioBuffer);
    }

    const fileSizeInMB = audioBuffer.length / (1024 * 1024);
    console.log(`语音生成完成: ${outputPath} (${fileSizeInMB.toFixed(2)}MB)`);

    return outputPath;

  } catch (error) {
    console.error("语音生成错误:", error);

    // 使用新的错误处理方式
    if (error.name === "ApiError") {
      console.error("API错误状态:", error.status);
      console.error("API错误信息:", error.message);
    }

    if (error.message.includes("API key")) {
      throw new Error("Gemini API密钥无效或未设置");
    } else if (error.message.includes("quota")) {
      throw new Error("API配额已用尽，请稍后再试");
    } else if (error.message.includes("rate limit")) {
      throw new Error("API请求频率超限，请稍后再试");
    } else if (error.message.includes("too long")) {
      throw new Error("文本过长，请缩短文本长度");
    } else {
      throw new Error(`语音生成失败: ${error.message}`);
    }
  }
}

/**
 * 生成多说话者语音 (实验性功能)
 * @param {string} text - 包含说话者标记的文本
 * @param {Object[]} speakerConfigs - 说话者配置数组
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 生成的音频文件路径
 */
async function generateMultiSpeakerSpeech(text, speakerConfigs, outputPath) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("文本内容不能为空");
    }

    if (!speakerConfigs || speakerConfigs.length === 0) {
      throw new Error("说话者配置不能为空");
    }

    console.log(`正在生成多说话者语音文件...`);
    console.log(`说话者数量: ${speakerConfigs.length}`);

    // 验证说话者配置
    const validatedConfigs = speakerConfigs.map(config => {
      if (!config.speaker || !config.voiceName) {
        throw new Error("说话者配置缺少必要字段");
      }
      
      if (!isValidVoice(config.voiceName)) {
        console.warn(`说话者 ${config.speaker} 的语音选项无效: ${config.voiceName}，使用默认语音 Kore`);
        config.voiceName = 'Kore';
      }

      return {
        speaker: config.speaker,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: config.voiceName,
          }
        }
      };
    });

    // 调用Gemini多说话者TTS API
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: validatedConfigs
          }
        }
      }
    });

    // 检查响应
    if (!response || !response.candidates || response.candidates.length === 0) {
      throw new Error("Gemini TTS API返回空结果");
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error("响应中没有音频数据");
    }

    const audioPart = candidate.content.parts[0];
    if (!audioPart.inlineData || !audioPart.inlineData.data) {
      throw new Error("音频数据为空");
    }

    // 获取音频数据 (Base64编码)
    const audioData = audioPart.inlineData.data;
    
    // 将Base64数据转换为Buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    // 根据文件扩展名选择保存方式
    const fileExtension = path.extname(outputPath).toLowerCase();
    
    if (fileExtension === '.wav') {
      // 使用WAV库保存WAV文件，确保正确的格式
      await saveWaveFile(outputPath, audioBuffer, 1, 24000, 2);
    } else {
      throw new Error("文件扩展名必须为.wav");
    }

    const fileSizeInMB = audioBuffer.length / (1024 * 1024);
    console.log(`多说话者语音生成完成: ${outputPath} (${fileSizeInMB.toFixed(2)}MB)`);

    return outputPath;

  } catch (error) {
    console.error("多说话者语音生成错误:", error);
    throw new Error(`多说话者语音生成失败: ${error.message}`);
  }
}

/**
 * 验证Gemini TTS配置
 * @returns {Promise<boolean>}
 */
async function validateTTSConfig() {
  try {
    // 检查API密钥是否存在
    if (!apiKey) {
      console.log("未找到GEMINI_API_KEY环境变量");
      return false;
    }

    // 检查API密钥格式
    if (!apiKey.startsWith("AIza")) {
      console.log("API密钥格式可能不正确");
      return false;
    }

    console.log("TTS API密钥格式检查通过");

    // 暂时返回true，避免网络测试延迟
    // 实际API调用会在语音生成时进行
    return true;
  } catch (error) {
    console.error("TTS配置验证失败:", error);
    return false;
  }
}

export { 
  generateSpeech, 
  generateMultiSpeakerSpeech,
  getVoiceOptions,
  getVoiceOptionsWithDescriptions,
  isValidVoice,
  validateTTSConfig,
  saveWaveFile,
  VOICE_OPTIONS,
  VOICE_DESCRIPTIONS
};
