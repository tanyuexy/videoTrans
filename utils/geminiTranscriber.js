import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import fs from "fs-extra";

let apiKey =
  process.env.GEMINI_API_KEY || "AIzaSyDFgPeYemKTYlx5X_iPzJUV7F9QLB1kRgs";
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
 * 使用Gemini API转录音频（使用文件上传方式）
 * @param {string} audioPath - 音频文件路径
 * @returns {Promise<string>} 完整的转录文本
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

    // 准备请求内容
    const prompt = `
分析这个音频文件并提取其中的人声对话内容 将内容翻译为中文并输出一整段纯中文内容。
请注意严格遵守以下规则：
1. 只转录人声部分，忽略背景音乐和噪音
2. 如果有多个说话者，请尽量区分
3. 保持转录的准确性和可读性
4. 如果音频中没有清晰的人声，请说明
5. 除了关键词外要保持单一语言
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
      console.error("API错误信息:", error.message);
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

export { transcribeWithGemini, validateGeminiConfig };
