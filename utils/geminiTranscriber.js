import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import fs from "fs-extra";

let apiKey =
  (process.env.GEMINI_API_KEY || "").trim();
// 初始化Gemini客户端
const genAI = new GoogleGenAI({ apiKey: apiKey });
// 注意：现在使用文件上传方式，不再需要Base64转换

/**
 * 验证Gemini API配置
 * @returns {Promise<boolean>}
 */
async function validateGeminiConfig() {
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

    console.log("API密钥格式检查通过");

    // 暂时返回true，避免网络测试延迟
    // 实际API调用会在转录时进行
    return true;
  } catch (error) {
    console.error("Gemini配置验证失败:", error);
    return false;
  }
}

/**
 * 使用Gemini API转录音频（中文翻译版，保留现有行为）
 * @param {string} audioPath - 音频文件路径
 * @returns {Promise<string>} 完整的转录文本（中文）
 */
async function transcribeWithGemini(audioPath) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    // 检查音频文件是否存在
    const exists = await fs.pathExists(audioPath);
    if (!exists) {
      throw new Error("音频文件不存在");
    }

    // 获取文件大小
    const stats = await fs.stat(audioPath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    if (fileSizeInMB > 20) {
      throw new Error("音频文件太大，请确保文件小于20MB");
    }

    console.log(
      `正在转录音频文件: ${audioPath} (${fileSizeInMB.toFixed(2)}MB)`
    );

    // 1. 上传音频文件到Gemini
    console.log("正在上传音频文件到Gemini...");
    const uploadedFile = await genAI.files.upload({
      file: audioPath,
      config: { mimeType: "audio/mp3" },
    });

    console.log(`文件上传完成: ${uploadedFile.uri}`);

    // 准备请求内容（翻译为中文，用于UI展示）
    // 2. 如果有多个说话者，请尽量区分
    // 3. 如果音频中没有清晰的人声，请说明
    const prompt = `
分析这个音频文件并提取其中的人声对话内容 将内容翻译为中文并输出一整段纯中文内容。
请注意严格遵守以下规则：
1. 只转录人声部分，忽略掉背景音乐和噪音
2. 关键词无需翻译 其他内容全部翻译为中文
`;

    // 2. 使用上传的文件进行转录
    console.log("正在生成转录内容...");
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt,
      ]),
    });

    // 3. 提取转录结果
    if (!response || !response.text) {
      throw new Error("Gemini API返回空结果");
    }

    const fullText = response.text;

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("Gemini API返回空文本结果");
    }

    console.log("转录完成");
    
    // // 4. 清理上传的文件（可选）
    // try {
    //   await genAI.files.delete(uploadedFile.name);
    //   console.log("已清理上传的临时文件");
    // } catch (deleteError) {
    //   console.warn("清理上传文件失败:", deleteError.message);
    // }

    return fullText.trim();
  } catch (error) {
    console.error("Gemini转录错误:", error);

    // 使用新的错误处理方式
    if (error.name === "ApiError") {
      console.error("API错误状态:", error.status);
      console.error("API错误信息:", error);
    }

    if (error.message.includes("API key")) {
      throw new Error("Gemini API密钥无效或未设置");
    } else if (error.message.includes("quota")) {
      throw new Error("API配额已用尽，请稍后再试");
    } else if (error.message.includes("rate limit")) {
      throw new Error("API请求频率超限，请稍后再试");
    } else {
      throw new Error(`转录失败: ${error.message}`);
    }
  }
}

/**
 * 仅转写原始语言（不做任何翻译）
 * @param {string} audioPath
 * @returns {Promise<string>} 原始语言转写文本
 */
async function transcribeOriginalWithGemini(audioPath) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    const exists = await fs.pathExists(audioPath);
    if (!exists) {
      throw new Error("音频文件不存在");
    }

    const stats = await fs.stat(audioPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > 20) {
      throw new Error("音频文件太大，请确保文件小于20MB");
    }

    console.log(`正在进行原文转写: ${audioPath} (${fileSizeInMB.toFixed(2)}MB)`);

    // 上传文件
    const uploadedFile = await genAI.files.upload({
      file: audioPath,
      config: { mimeType: "audio/mp3" },
    });

    // 仅转写原文的提示
    const originalPrompt = `
请对提供的音频进行逐字转写，输出为音频中原本的语言。
严格遵守以下要求：
1. 只进行转写，不要进行任何翻译或总结
2. 尽量保留原始语气词、专有名词与标点（若能识别）
3. 若存在多位说话者，可在必要时用简洁方式区分（例如：A:/B:）
4. 如果没有清晰人声，请明确说明
仅输出纯文本，不要添加与任务无关的说明或解释。
`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        originalPrompt,
      ]),
    });

    if (!response || !response.text) {
      throw new Error("Gemini API返回空结果");
    }

    const originalText = (response.text || "").trim();
    if (!originalText) {
      throw new Error("原文转写结果为空");
    }

    return originalText;
  } catch (error) {
    console.error("Gemini原文转写错误:", error);
    if (error.name === "ApiError") {
      console.error("API错误状态:", error.status);
      console.error("API错误信息:", error);
    }
    throw new Error(`原文转写失败: ${error.message}`);
  }
}

/**
 * 同时获取原文转写与中文翻译（单次上传，双请求）
 * @param {string} audioPath
 * @returns {Promise<{ original: string, chinese: string }>}
 */
async function transcribeBothWithGemini(audioPath) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    const exists = await fs.pathExists(audioPath);
    if (!exists) {
      throw new Error("音频文件不存在");
    }

    const stats = await fs.stat(audioPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > 20) {
      throw new Error("音频文件太大，请确保文件小于20MB");
    }

    console.log(`上传用于双路转写: ${audioPath} (${fileSizeInMB.toFixed(2)}MB)`);
    const uploadedFile = await genAI.files.upload({
      file: audioPath,
      config: { mimeType: "audio/mp3" },
    });

    const originalPrompt = `
请对提供的音频进行逐字转写，输出为音频中原本的语言。
要求：仅转写，不要进行任何翻译或总结。仅输出纯文本。
`;

    const chinesePrompt = `
分析这个音频文件并提取其中的人声对话内容，将内容翻译为中文并输出一整段纯中文内容。
要求：只转录人声，尽量区分说话者，无清晰人声则说明。仅输出中文纯文本。
`;

    // 并发请求
    const [originalResp, chineseResp] = await Promise.all([
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          originalPrompt,
        ]),
      }),
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          chinesePrompt,
        ]),
      }),
    ]);

    const original = (originalResp && originalResp.text ? originalResp.text.trim() : "");
    const chinese = (chineseResp && chineseResp.text ? chineseResp.text.trim() : "");

    if (!original) throw new Error("原文结果为空");
    if (!chinese) throw new Error("中文结果为空");

    return { original, chinese };
  } catch (error) {
    console.error("Gemini双路转写错误:", error);
    throw new Error(`双路转写失败: ${error.message}`);
  }
}

export { transcribeWithGemini, transcribeOriginalWithGemini, transcribeBothWithGemini, validateGeminiConfig };
