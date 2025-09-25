# 视频人声转文本工具

基于Google Gemini AI的视频人声提取和转文本工具，能够快速准确地将视频中的语音对话转换为文本。

## 功能特点

- 🎥 **多格式支持**: 支持MP4、AVI、MOV、WMV、FLV、WebM、MKV等主流视频格式
- 📦 **批量处理**: 支持同时上传和处理多个视频文件，自动队列处理
- 🤖 **AI驱动**: 使用Google Gemini 2.5 Flash模型进行高精度语音识别
- 🎵 **语音生成**: 支持将文案翻译并生成多语言语音 (TTS功能)
- 🌐 **现代界面**: 响应式Web界面，支持拖拽上传和实时进度显示
- 🎯 **人声分离**: 自动识别并提取人声，过滤背景音乐和噪音
- 📝 **多语言**: 支持中文、英文等多种语言的语音转录和语音生成
- ⚡ **快速处理**: 高效的音视频处理和转录速度
- 📊 **进度跟踪**: 批量处理时显示总体进度和当前文件状态
- 🔊 **高质量语音**: 30种语音选项，支持英语、西班牙语、葡萄牙语、法语、德语

## 系统要求

- Node.js 18+
- FFmpeg (用于音视频处理)
- Google Gemini API密钥

## 安装说明

### 1. 克隆项目
```bash
git clone <repository-url>
cd videoTrans
```

### 2. 安装依赖
```bash
npm install
```

### 3. 安装FFmpeg

**Windows:**
- 下载FFmpeg: https://ffmpeg.org/download.html
- 解压到目录(如: C:\\ffmpeg)
- 将bin目录添加到系统PATH环境变量

**Linux:**
```bash
apt update
apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

### 4. 配置环境变量

复制环境变量模板：
```bash
cp env.example .env
```

编辑`.env`文件，添加你的Gemini API密钥：
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
UPLOAD_DIR=uploads
OUTPUT_DIR=output
```

### 5. 获取Gemini API密钥

1. 访问 [Google AI Studio](https://ai.google.dev/)
2. 注册/登录Google账号
3. 创建新的API密钥
4. 将密钥添加到`.env`文件中

## 使用方法

### 启动服务器
```bash
# 生产模式
npm start

# 开发模式 (自动重启)
npm run dev
```

### 访问应用
打开浏览器访问: http://localhost:3000

### 使用步骤

**视频转录:**
1. 在网页中选择或拖拽视频文件
2. 点击"开始转录"按钮
3. 等待系统处理完成
4. 查看转录结果
5. 可以复制文本或下载为txt文件

**批量处理多个文件:**
1. 选择多个视频文件（可以一次选择多个，或分批添加）
2. 系统会显示所有已选择的文件列表
3. 点击"批量转录"按钮开始处理
4. 系统会按顺序逐个处理，显示总体进度和当前文件状态
5. 处理完成后，每个文件都有独立的结果卡片
6. 可以单独复制/下载每个文件的结果，或批量下载所有结果

**语音生成 (TTS):**
1. 完成文案转录，或手动创建新文案
2. 在右侧"语音生成"面板中选择目标语言 (英语/西班牙语/葡萄牙语/法语/德语)
3. 选择语音类型 (系统提供30种不同风格的语音选项)
4. 选择要转换的文案
5. 点击"生成语音"按钮
6. 系统会自动翻译文案并生成高质量语音
7. 生成的音频文件会出现在音频列表中，可播放、下载或删除

## API接口

### POST /api/transcribe
上传视频文件并进行转录

**请求:**
- Content-Type: multipart/form-data
- 字段: video (视频文件)

**响应:**
```json
{
  "success": true,
  "transcription": "转录的文本内容",
  "message": "转录完成"
}
```

### POST /api/generate-speech
生成语音文件

**请求:**
```json
{
  "text": "要转换的文本",
  "targetLanguage": "US|ES|PT|FR|DE",
  "voiceName": "语音名称",
  "transcriptionId": "文案ID（可选）"
}
```

**响应:**
```json
{
  "success": true,
  "audioFileName": "生成的音频文件名",
  "originalText": "原始文本",
  "translatedText": "翻译后的文本",
  "targetLanguage": "目标语言",
  "voiceName": "使用的语音",
  "fileSize": "文件大小(MB)",
  "message": "语音生成成功"
}
```

### GET /api/supported-languages
获取支持的语言列表

### POST /api/translate-text
单独的翻译接口

### GET /api/health
服务器健康检查

**响应:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 项目结构

```
videoTrans/
├── app.js                 # 主应用服务器
├── package.json           # 项目配置和依赖
├── env.example           # 环境变量模板
├── README.md             # 项目说明文档
├── TTS_功能说明.md        # 语音生成功能详细说明
├── utils/
│   ├── audioExtractor.js  # 音频提取工具
│   ├── geminiTranscriber.js # Gemini转录工具
│   ├── geminiTranslator.js  # Gemini翻译工具
│   └── geminiTTS.js      # Gemini语音生成工具
├── public/
│   ├── index.html        # 前端页面
│   └── script.js         # 前端JavaScript
├── uploads/              # 临时上传目录
└── output/               # 音频输出目录 (包含提取的音频和生成的语音)
```

## 配置说明

### 环境变量
- `GEMINI_API_KEY`: Google Gemini API密钥 (必需)
- `PORT`: 服务器端口 (默认: 3000)
- `UPLOAD_DIR`: 上传文件目录 (默认: uploads)
- `OUTPUT_DIR`: 输出文件目录 (默认: output)

### 文件限制
- 最大文件大小: 100MB
- 支持格式: MP4, AVI, MOV, WMV, FLV, WebM, MKV
- 音频要求: 包含清晰的人声对话

## 故障排除

### 常见问题

**1. FFmpeg未找到**
```
Error: ffmpeg not found
```
解决方案: 确保FFmpeg已正确安装并添加到系统PATH

**2. Gemini API错误**
```
Error: Gemini API密钥无效或未设置
```
解决方案: 检查`.env`文件中的API密钥是否正确

**3. 文件上传失败**
```
Error: 只支持视频文件格式
```
解决方案: 确保上传的是支持的视频格式

**4. 内存不足**
```
Error: 处理大文件时内存不足
```
解决方案: 
- 压缩视频文件
- 增加服务器内存
- 分段处理长视频

### 性能优化

1. **视频预处理**: 上传前压缩视频可以提高处理速度
2. **音频质量**: 确保视频中人声清晰，减少背景噪音
3. **文件大小**: 控制文件大小在合理范围内
4. **服务器配置**: 根据使用量调整服务器资源

## 开发说明

### 技术栈
- **后端**: Node.js + Express (ES6模块)
- **前端**: HTML5 + Bootstrap 5 + Vanilla JavaScript
- **AI服务**: Google Gemini API
- **音视频处理**: FFmpeg + fluent-ffmpeg
- **文件处理**: Multer + fs-extra

### 扩展功能
已实现的功能：
- ✅ 批量处理多个视频
- ✅ 多语言语音生成 (TTS)
- ✅ 文本翻译 (中文→英语/西班牙语/葡萄牙语/法语/德语)
- ✅ 30种语音选项

可以考虑添加的功能：
- 支持更多音频格式输入
- 说话人识别和分离
- 实时语音转录
- 多说话者语音生成
- 文本后处理和格式化
- 多语言界面支持
- 并发处理控制和优化
- 语音合成参数调节 (语速、音调等)

## 许可证

本项目采用 ISC 许可证。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件至项目维护者

---

**注意**: 使用本工具需要有效的Google Gemini API密钥。请确保遵守相关服务条款和使用限制。
