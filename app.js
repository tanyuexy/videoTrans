import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config'
import { dirname } from 'path';
import https from 'https';
import { extractAudioFromVideoAdaptive, checkFFmpegAvailability } from './utils/audioExtractor.js';
import { transcribeWithGemini, validateGeminiConfig } from './utils/geminiTranscriber.js';
import { translateText, getSupportedLanguages } from './utils/geminiTranslator.js';
import { generateSpeech, validateTTSConfig, getVoiceOptions, getVoiceOptionsWithDescriptions } from './utils/geminiTTS.js';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3005;  

// 中间件
app.use(cors({
  origin: true, // 允许所有来源，或者指定具体域名
  credentials: true, // 允许携带凭证
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  exposedHeaders: ['Content-Disposition', 'Content-Length']
}));
app.use(express.json());
app.use(express.static('public'));

// 确保上传和输出目录存在
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const outputDir = process.env.OUTPUT_DIR || 'output';
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(outputDir);

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许的视频/音频扩展名
    const allowedExts = new Set([
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',
      '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.wav'
    ]);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extnameOk = allowedExts.has(ext);
    // 允许的MIME前缀（避免把扩展名正则去匹配 mimetype 导致 mp3 的 audio/mpeg 被误拒）
    const mime = file.mimetype || '';
    const mimetypeOk = mime.startsWith('audio/') || mime.startsWith('video/');

    if (mimetypeOk && extnameOk) {
      return cb(null, true);
    }
    cb(new Error('只支持视频/音频文件格式: mp4, avi, mov, wmv, flv, webm, mkv, mp3, m4a, aac, ogg, flac, wav'));
  }
});

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理视频上传和转录
app.post('/api/transcribe', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传视频文件' });
    }

    const videoPath = req.file.path;
    const videoFileName = req.file.originalname;
    const audioFileName = videoFileName.replace(/\.[^/.]+$/, "") + ".mp3";
    const audioPath = path.join(outputDir, audioFileName);

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送状态更新函数
    const sendUpdate = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    try {
      // 1. 从视频中提取高质量音频
      sendUpdate('status', '正在从视频中提取高质量音频...');
      console.log('正在从视频中智能提取高质量音频...');
      await extractAudioFromVideoAdaptive(videoPath, audioPath);
      sendUpdate('status', '高质量音频提取完成，开始转录...');

      // 2. 使用Gemini API转录音频
      console.log('正在使用Gemini API转录音频...');
      const transcription = await transcribeWithGemini(audioPath);

      // 3. 发送完成信息
      sendUpdate('complete', {
        transcription: transcription,
        audioFileName: audioFileName,
        videoFileName: videoFileName,
        message: '转录完成'
      });

      // 4. 清理临时文件
      await fs.remove(videoPath);
      // 保留音频文件以便后续转录，不删除 audioPath
      console.log(`音频文件已保存到: ${audioPath}`);

    } catch (error) {
      console.error('转录过程中出错:', error);
      sendUpdate('error', error.message || '转录过程中发生错误');
      
      // 清理临时文件
      try {
        await fs.remove(videoPath);
        // 保留音频文件，不删除 audioPath
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
    }

    res.end();

  } catch (error) {
    console.error('转录初始化失败:', error);
    
    // 清理可能存在的临时文件
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || '转录初始化失败'
      });
    }
  }
});


// 音频文件直接转录端点
app.post('/api/transcribe-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const audioPath = req.file.path;
    const audioFileName = req.file.filename;

    console.log(`正在转录音频文件: ${req.file.originalname}`);

    // 使用Gemini API转录音频
    const transcription = await transcribeWithGemini(audioPath);

    // 清理临时文件
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    console.log('音频转录完成');
    res.json({
      success: true,
      transcription: transcription,
      message: '音频转录完成'
    });

  } catch (error) {
    console.error('音频转录失败:', error);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || '音频转录失败'
    });
  }
});

// 转录已提取的音频文件端点
app.post('/api/transcribe-extracted-audio', async (req, res) => {
  try {
    const { audioName, videoName } = req.body;
    
    if (!audioName) {
      return res.status(400).json({ error: '音频文件名不能为空' });
    }

    const audioPath = path.join(outputDir, audioName);
    
    // 检查音频文件是否存在
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ 
        error: '音频文件不存在，可能已被清理',
        requestedFile: audioName
      });
    }

    console.log(`正在转录已提取的音频文件: ${audioName}`);

    // 使用Gemini API转录音频
    const transcription = await transcribeWithGemini(audioPath);

    console.log('音频转录完成');
    res.json({
      success: true,
      transcription: transcription,
      message: '音频转录完成'
    });

  } catch (error) {
    console.error('音频转录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '音频转录失败'
    });
  }
});

// 音频文件下载端点
app.get('/api/download-audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(outputDir, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: '音频文件不存在' });
  }
  
  // 获取文件统计信息
  const stats = fs.statSync(audioPath);
  const fileSize = stats.size;
  
  // 设置HTTPS兼容的响应头
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // HTTPS特定的安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 发送文件 - 使用绝对路径并添加错误处理
  res.sendFile(path.resolve(audioPath), (err) => {
    if (err) {
      console.error('音频文件发送失败:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '音频文件下载失败' });
      }
    }
  });
});

// 删除音频文件端点
app.delete('/api/delete-audio', async (req, res) => {
  try {
    const { audioFileName } = req.body;
    
    if (!audioFileName) {
      return res.status(400).json({ error: '音频文件名不能为空' });
    }
    
    const audioPath = path.join(outputDir, audioFileName);
    
    // 检查文件是否存在
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ 
        error: '音频文件不存在',
        message: '文件可能已被删除或移动'
      });
    }
    
    // 删除文件
    await fs.remove(audioPath);
    console.log(`音频文件已删除: ${audioPath}`);
    
    res.json({
      success: true,
      message: `音频文件 ${audioFileName} 已成功删除`
    });
    
  } catch (error) {
    console.error('删除音频文件失败:', error);
    res.status(500).json({
      success: false,
      error: '删除音频文件失败',
      details: error.message
    });
  }
});

// 获取支持的语言列表
app.get('/api/supported-languages', (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.json({
      success: true,
      languages: languages
    });
  } catch (error) {
    console.error('获取支持语言失败:', error);
    res.status(500).json({
      success: false,
      error: '获取支持语言失败',
      details: error.message
    });
  }
});

// 获取支持的语音选项列表
app.get('/api/voice-options', (req, res) => {
  try {
    const voicesWithDescriptions = getVoiceOptionsWithDescriptions();
    res.json({
      success: true,
      voices: voicesWithDescriptions
    });
  } catch (error) {
    console.error('获取语音选项失败:', error);
    res.status(500).json({
      success: false,
      error: '获取语音选项失败',
      details: error.message
    });
  }
});

// 语音试听API - 返回指定语音的试听样本
app.get('/api/voice-sample/:voiceName', (req, res) => {
  try {
    const { voiceName } = req.params;
    
    // 验证语音名称
    const voiceOptions = getVoiceOptions();
    if (!voiceOptions.includes(voiceName)) {
      return res.status(400).json({
        success: false,
        error: '无效的语音名称'
      });
    }
    
    // 构建试听文件路径
    const sampleFileName = `voice_sample_${voiceName}.wav`;
    const sampleFilePath = path.join(__dirname, 'soundcheck', sampleFileName);
    
    // 检查文件是否存在
    if (!fs.existsSync(sampleFilePath)) {
      return res.status(404).json({
        success: false,
        error: '语音样本文件不存在'
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `inline; filename="${sampleFileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时
    
    // 发送文件
    res.sendFile(sampleFilePath, (err) => {
      if (err) {
        console.error('发送语音样本文件失败:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '发送语音样本文件失败'
          });
        }
      }
    });
    
  } catch (error) {
    console.error('语音试听API错误:', error);
    res.status(500).json({
      success: false,
      error: '语音试听失败',
      details: error.message
    });
  }
});

// 语音生成端点
app.post('/api/generate-speech', async (req, res) => {
  try {
    const { text, targetLanguage, voiceName, transcriptionId, paragraphInterval, skipTranslate } = req.body;
    
    // 验证必需参数
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '文本内容不能为空' });
    }
    
    if (!targetLanguage) {
      return res.status(400).json({ error: '目标语言不能为空' });
    }
    
    if (!voiceName) {
      return res.status(400).json({ error: '语音名称不能为空' });
    }
    
    // 验证段落间隔参数
    const intervalSeconds = paragraphInterval ? parseFloat(paragraphInterval) : 0;
    if (intervalSeconds < 0) {
      return res.status(400).json({ error: '段落间隔时间不能为负数' });
    }
    
    console.log(`开始生成语音: ${targetLanguage} - ${voiceName}`);
    console.log(`原始文本: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    console.log(`段落间隔: ${intervalSeconds}秒`);
    
    // 1. 翻译文本（可跳过）
    let translatedText;
    if (skipTranslate === true) {
      translatedText = text;
      console.log('已跳过翻译，直接使用传入文本进行语音合成');
    } else {
      try {
        translatedText = await translateText(text, targetLanguage);
        console.log(`翻译完成: ${translatedText.substring(0, 100)}${translatedText.length > 100 ? '...' : ''}`);
      } catch (translateError) {
        console.error('翻译失败:', translateError);
        return res.status(500).json({
          success: false,
          error: '文本翻译失败',
          details: translateError.message
        });
      }
    }
    
    // 2. 生成音频文件名 - 格式：月日_语言_序号
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${month}${day}`;
    
    // 获取同语言文件的序号
    const existingFiles = fs.readdirSync(outputDir).filter(file => 
      file.startsWith(`${dateStr}_${targetLanguage}_`) && file.endsWith('.wav')
    );
    const sequenceNumber = existingFiles.length + 1;
    
    const baseFileName = `${dateStr}_${targetLanguage}_${sequenceNumber}`;
    const audioFileName = `${baseFileName}.wav`;
    const audioPath = path.join(outputDir, audioFileName);
    
    // 3. 生成语音（支持段落间隔）
    try {
      await generateSpeech(translatedText, voiceName, audioPath, intervalSeconds);
      console.log(`语音生成完成: ${audioPath}`);
    } catch (speechError) {
      console.error('语音生成失败:', speechError);
      return res.status(500).json({
        success: false,
        error: '语音生成失败',
        details: speechError
      });
    }
    
    // 4. 验证生成的文件
    if (!fs.existsSync(audioPath)) {
      return res.status(500).json({
        success: false,
        error: '语音文件生成失败',
        details: '生成的音频文件不存在'
      });
    }
    
    const fileStats = await fs.stat(audioPath);
    const fileSizeInMB = fileStats.size / (1024 * 1024);
    
    console.log(`语音生成成功: ${audioFileName} (${fileSizeInMB}MB)`);
    
    res.json({
      success: true,
      audioFileName: audioFileName,
      originalText: text,
      translatedText: translatedText,
      targetLanguage: targetLanguage,
      voiceName: voiceName,
      paragraphInterval: intervalSeconds,
      fileSize: fileSizeInMB,
      message: '语音生成成功'
    });
    
  } catch (error) {
    console.error('语音生成端点错误:', error);
    res.status(500).json({
      success: false,
      error: '语音生成失败',
      details: error.message
    });
  }
});

// 翻译文本端点 (可选的单独翻译接口)
app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '文本内容不能为空' });
    }
    
    if (!targetLanguage) {
      return res.status(400).json({ error: '目标语言不能为空' });
    }
    
    console.log(`翻译文本到 ${targetLanguage}: ${text.substring(0, 100)}...`);
    
    const translatedText = await translateText(text, targetLanguage);
    
    res.json({
      success: true,
      originalText: text,
      translatedText: translatedText,
      targetLanguage: targetLanguage,
      message: '翻译完成'
    });
    
  } catch (error) {
    console.error('翻译文本失败:', error);
    res.status(500).json({
      success: false,
      error: '翻译失败',
      details: error.message
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: error.message || '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '未找到请求的资源'
  });
});

// 启动服务器前进行系统检查
async function startServer() {
  console.log('正在进行系统检查...');
  
  // 检查FFmpeg
  const ffmpegAvailable = await checkFFmpegAvailability();
  if (!ffmpegAvailable) {
    console.error('❌ FFmpeg不可用，视频处理功能可能无法正常工作');
  } else {
    console.log('✅ FFmpeg检查通过');
  }
  
  // 检查Gemini API配置
  const geminiValid = await validateGeminiConfig();
  if (!geminiValid) {
    console.log('⚠️  Gemini API配置检查失败，请确保GEMINI_API_KEY已正确设置');
  } else {
    console.log('✅ Gemini API配置检查通过');
  }
  
  // 检查Gemini TTS配置
  const ttsValid = await validateTTSConfig();
  if (!ttsValid) {
    console.log('⚠️  Gemini TTS配置检查失败');
  } else {
    console.log('✅ Gemini TTS配置检查通过');
  }
  
  // 封装服务器启动日志函数
  const logServerStart = (protocol, port, hasSSL = false) => {
    const url = `${protocol}://localhost:${port}`;
    const timestamp = new Date().toLocaleString('zh-CN');
    
    console.log('='.repeat(60));
    console.log(`🚀 视频转录服务器启动成功`);
    console.log(`📅 启动时间: ${timestamp}`);
    console.log(`🌐 访问地址: ${url}`);
    console.log('='.repeat(60));
    console.log('📋 系统状态:');
    console.log(`   - FFmpeg: ${ffmpegAvailable ? '✅ 可用' : '❌ 不可用'}`);
    console.log(`   - Gemini API: ${geminiValid ? '✅ 已配置' : '⚠️  未配置'}`);
    console.log(`   - Gemini TTS: ${ttsValid ? '✅ 已配置' : '⚠️  未配置'}`);
    console.log(`   - SSL证书: ${hasSSL ? '✅ 已配置' : '⚠️  未配置'}`);
    console.log(`   - 协议类型: ${protocol.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log('🌐 请在浏览器中访问上述地址开始使用');
    if (hasSSL) {
      console.log('🔒 使用HTTPS安全连接');
    } else {
      console.log('💡 提示: 要启用HTTPS，请运行 mkcert 生成SSL证书');
    }
    console.log('='.repeat(60));
  };

  // 检查SSL证书是否存在
  const sslDir = path.join(__dirname, 'ssl');
  const certPath = path.join(sslDir, 'localhost+2.pem');
  const keyPath = path.join(sslDir, 'localhost+2-key.pem');
  
  const hasSSLCert = fs.existsSync(certPath) && fs.existsSync(keyPath);
  
  if (hasSSLCert) {
    // 启动HTTPS服务器
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    
    https.createServer(options, app).listen(PORT, () => {
      logServerStart('https', PORT, true);
    });
  } else {
    // 启动HTTP服务器
    app.listen(PORT, () => {
      logServerStart('http', PORT, false);
    });
  }
}

// 启动服务器
startServer().catch(console.error);

export default app;
