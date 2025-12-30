import { GoogleGenAI } from "@google/genai";
import fs from "fs-extra";
import path from "path";
import wav from "wav";

let apiKey = (process.env.GEMINI_API_KEY || "").trim();

// 初始化Gemini客户端
const genAI = new GoogleGenAI({ apiKey: apiKey });

// 支持的语音选项
const VOICE_OPTIONS = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat"
];

// 语音特点描述映射表
const VOICE_DESCRIPTIONS = {
  Zephyr: "明亮",
  Puck: "欢快",
  Charon: "信息丰富",
  Kore: "坚定",
  Fenrir: "Excitable",
  Leda: "青春",
  Orus: "公司",
  Aoede: "Breezy",
  Callirrhoe: "轻松",
  Autonoe: "明亮",
  Enceladus: "气势",
  Iapetus: "清晰",
  Umbriel: "随和",
  Algieba: "平滑",
  Despina: "平滑",
  Erinome: "清除",
  Algenib: "Gravelly",
  Rasalgethi: "信息丰富",
  Laomedeia: "欢快",
  Achernar: "软",
  Alnilam: "Firm",
  Schedar: "Even",
  Gacrux: "成人",
  Pulcherrima: "直率",
  Achird: "友好",
  Zubenelgenubi: "随意",
  Vindemiatrix: "温柔",
  Sadachbia: "活泼",
  Sadaltager: "知识渊博",
  Sulafat: "编高"
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
  sampleWidth = 2
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8
    });

    writer.on("finish", resolve);
    writer.on("error", reject);

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
  return VOICE_OPTIONS.map((voice) => ({
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
 * 检测文本中的段落分隔符
 * @param {string} text - 输入文本
 * @returns {Array} 段落数组
 */
function detectParagraphs(text) {
  if (!text || typeof text !== "string") {
    return [text];
  }

  // 检测各种段落分隔符
  const paragraphSeparators = "\n"; // 单换行符
  let paragraphs = [text];
  // 按优先级检测段落分隔符
  if (text.includes(paragraphSeparators)) {
    paragraphs = text
      .split(paragraphSeparators)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  return paragraphs;
}

/**
 * 从WAV文件中提取PCM数据
 * @param {Buffer} wavBuffer - WAV文件数据
 * @returns {Buffer} PCM数据
 */
function extractPCMFromWAV(wavBuffer) {
  // 检查WAV文件头
  if (wavBuffer.length < 44) {
    throw new Error("WAV文件太小，不是有效的WAV文件");
  }

  const riffHeader = wavBuffer.toString("ascii", 0, 4);
  const waveHeader = wavBuffer.toString("ascii", 8, 12);

  if (riffHeader !== "RIFF" || waveHeader !== "WAVE") {
    throw new Error("不是有效的WAV文件格式");
  }

  // 查找data chunk
  let dataOffset = 12; // 跳过RIFF头(12字节)

  while (dataOffset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString("ascii", dataOffset, dataOffset + 4);
    const chunkSize = wavBuffer.readUInt32LE(dataOffset + 4);

    if (chunkId === "data") {
      const pcmData = wavBuffer.subarray(
        dataOffset + 8,
        dataOffset + 8 + chunkSize
      );
      return pcmData;
    }

    // 移动到下一个chunk
    dataOffset += 8 + chunkSize;

    // 确保chunk大小是偶数（WAV格式要求）
    if (chunkSize % 2 !== 0) {
      dataOffset += 1;
    }

    // 防止无限循环
    if (dataOffset >= wavBuffer.length) {
      break;
    }
  }

  throw new Error("未找到WAV文件中的PCM数据");
}

/**
 * 生成静音PCM数据
 * @param {number} durationSeconds - 静音时长（秒）
 * @param {number} sampleRate - 采样率，默认24000
 * @param {number} channels - 声道数，默认1
 * @param {number} bitDepth - 位深，默认16
 * @returns {Buffer} 静音PCM数据
 */
function generateSilencePCM(
  durationSeconds,
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
) {
  const samplesPerChannel = Math.floor(sampleRate * durationSeconds);
  const totalSamples = samplesPerChannel * channels;
  const bytesPerSample = bitDepth / 8;
  const bufferSize = totalSamples * bytesPerSample;

  // 创建静音数据（全零）
  const silenceBuffer = Buffer.alloc(bufferSize, 0);

  return silenceBuffer;
}

/**
 * 生成单个段落的PCM数据
 * @param {string} text - 段落文本
 * @param {string} voiceName - 语音名称
 * @returns {Promise<Buffer>} PCM数据
 */
async function generateParagraphPCM(text, voiceName) {
  // 调用Gemini TTS API
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  });

  // 检查响应
  if (!response || !response.candidates || response.candidates.length === 0) {
    throw new Error("Gemini TTS API返回空结果");
  }

  const candidate = response.candidates[0];
  if (
    !candidate.content ||
    !candidate.content.parts ||
    candidate.content.parts.length === 0
  ) {
    throw new Error("响应中没有音频数据");
  }

  const audioPart = candidate.content.parts[0];
  if (!audioPart.inlineData || !audioPart.inlineData.data) {
    throw new Error("音频数据为空");
  }

  // 获取音频数据 (Base64编码)
  const audioData = audioPart.inlineData.data;

  // 将Base64数据转换为Buffer
  const audioBuffer = Buffer.from(audioData, "base64");

  return audioBuffer;
}

/**
 * 拼接多个PCM数据
 * @param {Array} pcmBuffers - PCM数据数组
 * @param {Array} silenceDurations - 间隔时长数组（秒）
 * @param {number} sampleRate - 采样率，默认24000
 * @param {number} channels - 声道数，默认1
 * @param {number} bitDepth - 位深，默认16
 * @returns {Buffer} 拼接后的PCM数据
 */
function concatenatePCMWithSilence(
  pcmBuffers,
  silenceDurations = [],
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
) {
  if (!pcmBuffers || pcmBuffers.length === 0) {
    throw new Error("PCM数据不能为空");
  }

  // 计算总PCM数据长度
  let totalPCMLength = 0;
  for (let i = 0; i < pcmBuffers.length; i++) {
    totalPCMLength += pcmBuffers[i].length;
    // 添加静音间隔（除了最后一个音频）
    if (i < pcmBuffers.length - 1) {
      const silenceDuration = silenceDurations[i] || 0;
      if (silenceDuration > 0) {
        const silencePCM = generateSilencePCM(
          silenceDuration,
          sampleRate,
          channels,
          bitDepth
        );
        totalPCMLength += silencePCM.length;
      }
    }
  }

  // 创建拼接后的PCM数据
  const concatenatedPCM = Buffer.alloc(totalPCMLength);
  let offset = 0;

  for (let i = 0; i < pcmBuffers.length; i++) {
    // 添加音频PCM数据
    pcmBuffers[i].copy(concatenatedPCM, offset);
    offset += pcmBuffers[i].length;

    // 添加静音间隔（除了最后一个音频）
    if (i < pcmBuffers.length - 1) {
      const silenceDuration = silenceDurations[i] || 0;
      if (silenceDuration > 0) {
        const silencePCM = generateSilencePCM(
          silenceDuration,
          sampleRate,
          channels,
          bitDepth
        );
        silencePCM.copy(concatenatedPCM, offset);
        offset += silencePCM.length;
      }
    }
  }

  return concatenatedPCM;
}

/**
 * 使用Gemini TTS API生成语音（支持段落间隔）
 * @param {string} text - 要转换为语音的文本
 * @param {string} voiceName - 语音名称 (可选，默认为Kore)
 * @param {string} outputPath - 输出文件路径
 * @param {number} paragraphInterval - 段落间隔时间（秒），默认0
 * @returns {Promise<string>} 生成的音频文件路径
 */
async function generateSpeech(
  text,
  voiceName = "Kore",
  outputPath,
  paragraphInterval = 0
) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("文本内容不能为空");
    }

    if (!isValidVoice(voiceName)) {
      console.warn(`无效的语音选项: ${voiceName}，使用默认语音 Kore`);
      voiceName = "Kore";
    }

    console.log(`正在生成语音文件: ${voiceName} 语音...`);
    console.log(`文本内容: ${text}`);

    // 当未开启段落间隔时，直接整段生成（一次性调用，不做段落识别）
    if (paragraphInterval <= 0) {
      console.log("段落间隔未开启，整段合成语音（不做分段识别）");
      // 去除文本中的换行符（包括 \n 和 \r）
      text = text.replace(/[\r\n]+/g, " ");
      return await generateSingleParagraphSpeech(text, voiceName, outputPath);
    }

    // 已开启段落间隔时才进行段落检测
    const paragraphs = detectParagraphs(text);
    console.log(`已开启段落间隔，检测到 ${paragraphs.length} 个段落`);

    // 若仅一个段落，则直接整段生成
    if (paragraphs.length === 1) {
      return await generateSingleParagraphSpeech(text, voiceName, outputPath);
    }

    // 多段落处理 - 使用简化的拼接方法
    const pcmBuffers = [];
    const silenceDurations = [];

    // 为每个段落生成语音并直接获取PCM数据
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      console.log(`正在处理第 ${i + 1}/${paragraphs.length} 个段落...`);

      // 直接生成PCM数据
      const pcmData = await generateParagraphPCM(paragraph, voiceName);
      pcmBuffers.push(pcmData);

      // 设置间隔时间（除了最后一个段落）
      if (i < paragraphs.length - 1) {
        silenceDurations.push(paragraphInterval);
      }
    }

    // 拼接PCM数据
    console.log("正在拼接音频段落...");
    const concatenatedPCM = concatenatePCMWithSilence(
      pcmBuffers,
      silenceDurations
    );

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    // 使用WAV库保存最终文件
    await saveWaveFile(outputPath, concatenatedPCM, 1, 24000, 2);

    const fileSizeInMB = concatenatedPCM.length / (1024 * 1024);
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
      throw error;
    }
  }
}

/**
 * 生成单个段落的语音（内部方法）
 * @param {string} text - 段落文本
 * @param {string} voiceName - 语音名称
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 生成的音频文件路径
 */
async function generateSingleParagraphSpeech(text, voiceName, outputPath) {
  // 调用Gemini TTS API
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    }
  });

  // 检查响应
  if (!response || !response.candidates || response.candidates.length === 0) {
    throw new Error("Gemini TTS API返回空结果");
  }

  const candidate = response.candidates[0];
  if (
    !candidate.content ||
    !candidate.content.parts ||
    candidate.content.parts.length === 0
  ) {
    throw new Error("响应中没有音频数据");
  }

  const audioPart = candidate.content.parts[0];
  if (!audioPart.inlineData || !audioPart.inlineData.data) {
    throw new Error("音频数据为空");
  }

  // 获取音频数据 (Base64编码)
  const audioData = audioPart.inlineData.data;

  // 将Base64数据转换为Buffer
  const audioBuffer = Buffer.from(audioData, "base64");

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  await fs.ensureDir(outputDir);

  // 根据文件扩展名选择保存方式
  const fileExtension = path.extname(outputPath).toLowerCase();

  if (fileExtension === ".wav") {
    // 使用WAV库保存WAV文件，确保正确的格式
    await saveWaveFile(outputPath, audioBuffer, 1, 24000, 2);
  } else {
    // 对于其他格式（如MP3），直接保存buffer
    await fs.writeFile(outputPath, audioBuffer);
  }

  return outputPath;
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
  getVoiceOptions,
  getVoiceOptionsWithDescriptions,
  isValidVoice,
  validateTTSConfig,
  saveWaveFile,
  detectParagraphs,
  generateSilencePCM,
  extractPCMFromWAV,
  generateParagraphPCM,
  concatenatePCMWithSilence,
  VOICE_OPTIONS,
  VOICE_DESCRIPTIONS
};
