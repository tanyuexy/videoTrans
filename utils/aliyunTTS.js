const apiKey = process.env.ALIYUN_API_KEY.trim();

// API 端点（阿里云百炼 TTS）
// 参考文档：
// https://help.aliyun.com/zh/model-studio/qwen-tts-api
// https://help.aliyun.com/zh/model-studio/qwen-tts
const DASH_SCOPE_TTS_URL = `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`;

/**
 * 语言代码到语言全称的映射
 * 根据 geminiTranslator.js 中的语言代码映射到阿里云 TTS 支持的语言类型
 */
const LANGUAGE_CODE_TO_FULL_NAME = {
  'US': 'English',
  'DE': 'German',
  'IT': 'Italian',
  'PT': 'Portuguese',
  'ES': 'Spanish',
  'JP': 'Japanese',
  'KR': 'Korean',
  'FR': 'French',
  'RU': 'Russian',
  'TW': 'Chinese',
};

/**
 * 将语言代码转换为语言全称
 * @param {string} languageCode - 语言代码 (如 'US', 'DE', 'IT' 等)
 * @returns {string|null} 语言全称 (如 'English', 'German', 'Italian' 等)，如果未找到则返回 null
 */
function getLanguageFullName(languageCode) {
  if (!languageCode) return null;
  const code = String(languageCode).toUpperCase();
  return LANGUAGE_CODE_TO_FULL_NAME[code] || null;
}

/**
 * 检查阿里云是否支持指定语言代码
 * @param {string} languageCode
 * @returns {boolean}
 */
function isAliyunLanguageSupported(languageCode) {
  return !!getLanguageFullName(languageCode);
}

/**
 * 校验阿里云 TTS 配置
 * @returns {Promise<boolean>}
 */
async function validateAliyunTTSConfig() {
  try {
    if (!apiKey) {
      console.log("未找到 DASHSCOPE_API_KEY/ALIYUN_TTS_API_KEY/ALIYUN_API_KEY 环境变量");
      return false;
    }
    if (!apiKey.startsWith("sk-")) {
      console.log("阿里云 DashScope API Key 格式可能不正确");
    }
    return true;
  } catch (e) {
    console.error("Aliyun TTS 配置验证失败:", e);
    return false;
  }
}

/**
 * 内部方法：调用阿里云 TTS 生成单段音频
 * @param {string} text
 * @param {string} voiceName
 * @param {('wav'|'mp3')} format
 * @returns {Promise<Buffer>} 返回音频二进制 Buffer（WAV）
 */
async function callAliyunTTSOnce(text, voiceName ,languageType = "English") {
  if (!apiKey) {
    throw new Error("未设置阿里云 TTS API Key（DASHSCOPE_API_KEY/ALIYUN_TTS_API_KEY/ALIYUN_API_KEY）");
  }
  const model = (process.env.ALIYUN_TTS_MODEL || "qwen3-tts-flash").trim();
  // 按照官方文档/用户示例，将 voice 和 language_type 放在 input 内
  const payload = {
    model,
    input: {
      text,
      voice: voiceName || "Cherry",
      language_type: languageType,
    },
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const resp = await fetch(DASH_SCOPE_TTS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = resp.headers.get("content-type") || "";

  if (!resp.ok) {
    let message = `Aliyun TTS 请求失败: ${resp.status} ${resp.statusText}`;
    try {
      const errJson = await resp.json();
      message += ` - ${JSON.stringify(errJson)}`;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  // 二进制直接返回
  if (!contentType.includes("application/json")) {
    const arrayBuf = await resp.arrayBuffer();
    return Buffer.from(arrayBuf);
  }
  // JSON -> 解析 base64 音频
  const data = await resp.json();
  // 常见形态：data.output.audio 或 data.audio
  const audioUrl = data?.output?.audio?.url; 
  if (!audioUrl) {
    throw new Error("Aliyun TTS 响应中未找到音频数据");
  }
  console.log(audioUrl);
  const audioBuffer = await fetch(audioUrl).then(res => res.arrayBuffer());
  return Buffer.from(audioBuffer);
}

function getAliyunVoiceOptions() {
  return [
    {
      "name": "芊悦",
      "voice": "Cherry",
      "description": "阳光积极、亲切自然小姐姐",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/tixcef/cherry.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "苏瑶",
      "voice": "Serena",
      "description": "温柔小姐姐",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/bxokea/serena.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "晨煦",
      "voice": "Ethan",
      "description": "标准普通话，带部分北方口音。阳光、温暖、活力、朝气",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/emaqdp/ethan.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "千雪",
      "voice": "Chelsie",
      "description": "二次元虚拟女友",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/vnpxgw/chelsie.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "茉兔",
      "voice": "Momo",
      "description": "撒娇搞怪，逗你开心",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/rvzrcx/Momo.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "十三",
      "voice": "Vivian",
      "description": "拽拽的、可爱的小暴躁",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/eetwkj/Vivian.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "月白",
      "voice": "Moon",
      "description": "率性帅气的月白",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/bcaqju/Moon.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "四月",
      "voice": "Maia",
      "description": "知性与温柔的碰撞",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/fewawx/Maia.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "凯",
      "voice": "Kai",
      "description": "耳朵的一场 SPA",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/maiqbf/Kai.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "不吃鱼",
      "voice": "Nofish",
      "description": "不会翘舌音的设计师",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/xurcmx/Nofish.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "萌宝",
      "voice": "Bella",
      "description": "喝酒不打醉拳的小萝莉",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/optibu/Bella.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "詹妮弗",
      "voice": "Jennifer",
      "description": "品牌级、电影质感般美语女声",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/fejjiv/Jennifer.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "甜茶",
      "voice": "Ryan",
      "description": "节奏拉满，戏感炸裂，真实与张力共舞",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/wsytum/Ryan.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "卡捷琳娜",
      "voice": "Katerina",
      "description": "御姐音色，韵律回味十足",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/fschpb/Katerina.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "艾登",
      "voice": "Aiden",
      "description": "精通厨艺的美语大男孩",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/hgxtqi/Aiden.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "沧明子",
      "voice": "Eldric Sage",
      "description": "沉稳睿智的老者，沧桑如松却心明如镜",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/hbvhwj/Eldric+Sage.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "乖小妹",
      "voice": "Mia",
      "description": "温顺如春水，乖巧如初雪",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/gpvlix/Mia.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "沙小弥",
      "voice": "Mochi",
      "description": "聪明伶俐的小大人，童真未泯却早慧如禅",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/zapcpe/Mochi.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "燕铮莺",
      "voice": "Bellona",
      "description": "声音洪亮，吐字清晰，人物鲜活，听得人热血沸腾；金戈铁马入梦来，字正腔圆间尽显千面人声的江湖",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/wztwli/Bellona.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "田叔",
      "voice": "Vincent",
      "description": "一口独特的沙哑烟嗓，一开口便道尽了千军万马与江湖豪情",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/skfrkq/Vincent.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "萌小姬",
      "voice": "Bunny",
      "description": "“萌属性”爆棚的小萝莉",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/aswewm/Bunny.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "阿闻",
      "voice": "Neil",
      "description": "平直的基线语调，字正腔圆的咬字发音，这就是最专业的新闻主持人",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/ucmfkt/Neil.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "墨讲师",
      "voice": "Elias",
      "description": "既保持学科严谨性，又通过叙事技巧将复杂知识转化为可消化的认知模块",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/rhbvqx/Elias.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "徐大爷",
      "voice": "Arthur",
      "description": "被岁月和旱烟浸泡过的质朴嗓音，不疾不徐地摇开了满村的奇闻异事",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/ynqwyu/Arthur.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "邻家妹妹",
      "voice": "Nini",
      "description": "糯米糍一样又软又黏的嗓音，那一声声拉长了的“哥哥”，甜得能把人的骨头都叫酥了",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/lppeba/Nini.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "诡婆婆",
      "voice": "Ebona",
      "description": "她的低语像一把生锈的钥匙，缓慢转动你内心最深处的幽暗角落——那里藏着所有你不敢承认的童年阴影与未知恐惧",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/gocxwf/Ebona.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "小婉",
      "voice": "Seren",
      "description": "温和舒缓的声线，助你更快地进入睡眠，晚安，好梦",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/xlksoe/Seren.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "顽屁小孩",
      "voice": "Pip",
      "description": "调皮捣蛋却充满童真的他来了，这是你记忆中的小新吗",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/gqxoub/Pip.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "少女阿月",
      "voice": "Stella",
      "description": "平时是甜到发腻的迷糊少女音，但在喊出“代表月亮消灭你”时，瞬间充满不容置疑的爱与正义",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/azikxr/Stella.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "博德加",
      "voice": "Bodega",
      "description": "热情的西班牙大叔",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/jxnuap/Bodega.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "索尼莎",
      "voice": "Sonrisa",
      "description": "热情开朗的拉美大姐",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/uywoxb/Sonrisa.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "阿列克",
      "voice": "Alek",
      "description": "一开口，是战斗民族的冷，也是毛呢大衣下的暖",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/wtklus/Alek.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "多尔切",
      "voice": "Dolce",
      "description": "慵懒的意大利大叔",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/pirhim/Dolce.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "素熙",
      "voice": "Sohee",
      "description": "温柔开朗，情绪丰富的韩国欧尼",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/wwphft/Sohee.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "小野杏",
      "voice": "Ono Anna",
      "description": "鬼灵精怪的青梅竹马",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/mvfbxy/Ono+Anna.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "莱恩",
      "voice": "Lenn",
      "description": "理性是底色，叛逆藏在细节里——穿西装也听后朋克的德国青年",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/arnzdt/Lenn.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "埃米尔安",
      "voice": "Emilien",
      "description": "浪漫的法国大哥哥",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/qltlde/Emilien.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "安德雷",
      "voice": "Andre",
      "description": "声音磁性，自然舒服、沉稳男生",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/hhfogy/Andre.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "拉迪奥·戈尔",
      "voice": "Radio Gol",
      "description": "足球诗人 Rádio Gol！今天我要用名字为你们解说足球。",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251120/vnezxq/Radio+Gol.wav",
      "supportedLanguages": "中文、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "上海-阿珍",
      "voice": "Jada",
      "description": "风风火火的沪上阿姐",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/qjfmmi/Jada.wav",
      "supportedLanguages": "中文（上海话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "北京-晓东",
      "voice": "Dylan",
      "description": "北京胡同里长大的少年",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/ultaxm/Dylan.wav",
      "supportedLanguages": "中文（北京话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "南京-老李",
      "voice": "Li",
      "description": "耐心的瑜伽老师",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250916/frgdes/Li.wav",
      "supportedLanguages": "中文（南京话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "陕西-秦川",
      "voice": "Marcus",
      "description": "面宽话短，心实声沉——老陕的味道",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/dwnnrg/Marcus.wav",
      "supportedLanguages": "中文（陕西话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "闽南-阿杰",
      "voice": "Roy",
      "description": "诙谐直爽、市井活泼的台湾哥仔形象",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/stsfsz/Roy.wav",
      "supportedLanguages": "中文（闽南语）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "天津-李彼得",
      "voice": "Peter",
      "description": "天津相声，专业捧哏",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/twvnsp/Peter.wav",
      "supportedLanguages": "中文（天津话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "四川-晴儿",
      "voice": "Sunny",
      "description": "甜到你心里的川妹子",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/jtrktt/Sunny.wav",
      "supportedLanguages": "中文（四川话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "四川-程川",
      "voice": "Eric",
      "description": "一个跳脱市井的四川成都男子",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/qhbznw/Eric.wav",
      "supportedLanguages": "中文（四川话）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "粤语-阿强",
      "voice": "Rocky",
      "description": "幽默风趣的阿强，在线陪聊",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/kfxxgp/Rocky.wav",
      "supportedLanguages": "中文（粤语）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    },
    {
      "name": "粤语-阿清",
      "voice": "Kiki",
      "description": "甜美的港妹闺蜜",
      "auditionAudio": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250910/qwinef/KiKi.wav",
      "supportedLanguages": "中文（粤语）、英语、法语、德语、俄语、意大利语、西班牙语、葡萄牙语、日语、韩语"
    }
  ];
}

export {
  validateAliyunTTSConfig,
  getAliyunVoiceOptions,
  callAliyunTTSOnce,
  getLanguageFullName,
  isAliyunLanguageSupported,
  LANGUAGE_CODE_TO_FULL_NAME
};

