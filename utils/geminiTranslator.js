import { GoogleGenAI } from "@google/genai";

let apiKey = (process.env.GEMINI_API_KEY || "").trim();

// 初始化Gemini客户端
const genAI = new GoogleGenAI({ apiKey: apiKey });

// 支持的语言配置
const SUPPORTED_LANGUAGES = [
  "US",
  "AR",
  "DE",
  "ES",
  "FR",
  "ID",
  "IT",
  "JP",
  "KR",
  "RO",
  "NL",
  "PL",
  "TH",
  "TR",
  "TW",
  "VN",
  "RU",
  "PT",
  "SV",
  "FI",
  "MS",
  "HI",
  "BN"
];

/**
 * 获取支持的语言列表
 * @returns {Array} 语言代码数组
 */
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

/**
 * 验证语言代码是否支持
 * @param {string} languageCode - 语言代码 (US, AR, DE, ES, FR, ID, IT, JP, KR, NL, PL, TH, TR, TW, VN, RU, PT, SV, FI, MS, IN)
 * @returns {boolean} 是否支持该语言
 */
function isLanguageSupported(languageCode) {
  return SUPPORTED_LANGUAGES.includes(languageCode);
}

/**
 * 使用Gemini API翻译文本
 * @param {string} text - 要翻译的文本
 * @param {string} targetLanguage - 目标语言代码 (US, AR, DE, ES, FR, ID, IT, JP, KR, NL, PL, TH, TR, TW, VN, RU, PT, SV, FI, MS, IN)
 * @returns {Promise<string>} 翻译后的文本
 */
async function translateText(text, targetLanguage) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("翻译文本不能为空");
    }

    if (!isLanguageSupported(targetLanguage)) {
      throw new Error(`不支持的语言代码: ${targetLanguage}`);
    }

    console.log(`正在翻译文本到语言代码: ${targetLanguage}...`);

    // 构建翻译提示词
    const prompt = `
请将以下中文文本翻译为${targetLanguage.toLocaleLowerCase()}语言。
要求：
1. 保持翻译的准确性和自然性
2. 保持原文的语调和情感
3. 如果原文中有专业术语，请保持术语的准确性
4. 输出纯翻译文本，不要添加额外的说明

需要翻译的文本：
${text}
`;

    // 调用Gemini API进行翻译
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("Gemini API返回空结果");
    }

    const translatedText = response.text.trim();

    if (!translatedText || translatedText.length === 0) {
      throw new Error("翻译结果为空");
    }

    console.log(
      `翻译完成: ${text.substring(0, 50)}... → ${translatedText.substring(
        0,
        50
      )}...`
    );

    return translatedText;
  } catch (error) {
    console.error("文本翻译错误:", error);

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
      throw new Error(`翻译失败: ${error.message}`);
    }
  }
}

/**
 * 批量翻译多个文本
 * @param {string[]} texts - 要翻译的文本数组
 * @param {string} targetLanguage - 目标语言代码
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
async function translateTexts(texts, targetLanguage) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error("文本数组不能为空");
    }

    const results = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`正在翻译第 ${i + 1}/${texts.length} 个文本...`);

      const translatedText = await translateText(text, targetLanguage);
      results.push(translatedText);

      // 添加小延迟避免API频率限制
      if (i < texts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  } catch (error) {
    console.error("批量翻译错误:", error);
    throw new Error(`批量翻译失败: ${error.message}`);
  }
}

/**
 * 使用Gemini 2.5生成简短标题（用于文件命名）
 * @param {string} text - 原始内容文本
 * @returns {Promise<string>} 简短标题（不包含扩展名）
 */
async function generateShortTitle(text) {
  try {
    if (!apiKey) {
      throw new Error("未设置GEMINI_API_KEY环境变量");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("标题生成文本不能为空");
    }

    console.log("正在生成文件命名标题...");

    const prompt = `你是一个为音频文件生成简短命名的助手。
请根据下方内容，生成一个【简短的中文标题】用于文件名。
要求：
1. 不要超过12个中文字符。
2. 不要包含标点符号和特殊字符，只能包含中文、英文、数字和空格。
3. 不要带引号，不要带前后说明性文字，只输出标题本身。

内容：
${text}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("Gemini 标题生成返回空结果");
    }

    let title = response.text.trim();

    // 基础清洗：去掉换行和不允许的字符
    title = title.replace(/[\r\n]+/g, " ");
    title = title.replace(/[^0-9A-Za-z\u4e00-\u9fff ]+/g, "");
    title = title.replace(/\s+/g, " ").trim();

    if (!title || title.length === 0) {
      throw new Error("标题生成结果为空");
    }

    console.log("标题生成完成:", title);

    return title;
  } catch (error) {
    console.error("标题生成错误:", error);
    throw error;
  }
}

export {
  translateText,
  translateTexts,
  getSupportedLanguages,
  isLanguageSupported,
  SUPPORTED_LANGUAGES,
  generateShortTitle
};
