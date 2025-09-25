// 全局变量
let selectedVideos = [];
let audioFiles = [];
let transcriptions = [];
let translations = [];
let speeches = [];
let isProcessing = false;
let selectedLanguages = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupLanguageSelector();
    updateStepCards();
    checkServerHealth();
});

// 设置事件监听器
function setupEventListeners() {
    // 工作流程步骤选择
    ['enableStep1', 'enableStep2', 'enableStep3', 'enableStep4'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', updateStepCards);
        }
    });

    // 视频文件上传
    const videoInput = document.getElementById('videoFileInput');
    if (videoInput) {
        videoInput.addEventListener('change', handleVideoFileSelect);
    }
    
    // 视频拖拽
    const videoUpload = document.getElementById('videoUploadArea');
    if (videoUpload) {
        videoUpload.addEventListener('dragover', handleDragOver);
        videoUpload.addEventListener('dragleave', handleDragLeave);
        videoUpload.addEventListener('drop', handleVideoDrop);
        videoUpload.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
                videoInput.click();
            }
        });
    }

    // 音频文件上传
    const audioInput = document.getElementById('audioFileInput');
    if (audioInput) {
        audioInput.addEventListener('change', handleAudioFileSelect);
    }
    
    // 音频拖拽
    const audioUpload = document.getElementById('audioUploadArea');
    if (audioUpload) {
        audioUpload.addEventListener('dragover', handleDragOver);
        audioUpload.addEventListener('dragleave', handleDragLeave);
        audioUpload.addEventListener('drop', handleAudioDrop);
        audioUpload.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
                audioInput.click();
            }
        });
    }
}

// 设置语言选择器
function setupLanguageSelector() {
    const languageGrid = document.getElementById('languageGrid');
    if (!languageGrid) return;
    
    const languageOptions = languageGrid.querySelectorAll('.language-option');
    languageOptions.forEach(option => {
        option.addEventListener('click', function() {
            const lang = this.dataset.lang;
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedLanguages = selectedLanguages.filter(l => l !== lang);
            } else {
                this.classList.add('selected');
                selectedLanguages.push(lang);
            }
            updateTranslateButton();
        });
    });
}

// 更新步骤卡片样式
function updateStepCards() {
    ['step1Card', 'step2Card', 'step3Card', 'step4Card'].forEach((cardId, index) => {
        const card = document.getElementById(cardId);
        const checkbox = document.getElementById(`enableStep${index + 1}`);
        if (card && checkbox) {
            if (checkbox.checked) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        }
    });
}

// 拖拽处理
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleVideoDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(isVideoFile);
    if (files.length > 0) {
        addVideoFiles(files);
    }
}

function handleAudioDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(isAudioFile);
    if (files.length > 0) {
        addAudioFiles(files);
    }
}

// 文件类型检查
function isVideoFile(file) {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/mkv'];
    return allowedTypes.includes(file.type);
}

function isAudioFile(file) {
    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mpeg', 'audio/mp4'];
    return allowedTypes.includes(file.type);
}

// 视频文件处理
function handleVideoFileSelect(e) {
    const files = Array.from(e.target.files).filter(isVideoFile);
    if (files.length > 0) {
        addVideoFiles(files);
    }
    e.target.value = '';
}

function addVideoFiles(files) {
    files.forEach(file => {
        const exists = selectedVideos.some(v => v.name === file.name && v.size === file.size);
        if (!exists) {
            selectedVideos.push(file);
        }
    });
    updateVideoFilesList();
}

function updateVideoFilesList() {
    const filesList = document.getElementById('videoFilesList');
    const selectedFiles = document.getElementById('selectedVideoFiles');
    const fileCount = document.getElementById('videoFileCount');
    const extractBtn = document.getElementById('extractAudioBtn');
    
    if (!filesList) return;
    
    filesList.innerHTML = '';
    
    selectedVideos.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <i class="bi bi-camera-video file-icon"></i>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div class="file-actions">
                <button class="btn btn-outline-danger btn-sm" onclick="removeVideoFile(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        filesList.appendChild(fileItem);
    });

    // 更新UI状态
    const hasFiles = selectedVideos.length > 0;
    if (selectedFiles) {
        selectedFiles.style.display = hasFiles ? 'block' : 'none';
    }
    if (fileCount) {
        fileCount.textContent = selectedVideos.length;
    }
    if (extractBtn) {
        extractBtn.disabled = !hasFiles || isProcessing;
    }
}

function removeVideoFile(index) {
    selectedVideos.splice(index, 1);
    updateVideoFilesList();
}

function clearVideoFiles() {
    selectedVideos = [];
    updateVideoFilesList();
}

// 音频文件处理
function handleAudioFileSelect(e) {
    const files = Array.from(e.target.files).filter(isAudioFile);
    if (files.length > 0) {
        addAudioFiles(files);
    }
    e.target.value = '';
}

function addAudioFiles(files) {
    files.forEach(file => {
        const audioId = 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        audioFiles.push({
            id: audioId,
            name: file.name,
            file: file,
            type: 'uploaded',
            transcribed: false
        });
    });
    updateAudioFilesList();
}

function updateAudioFilesList() {
    const audioList = document.getElementById('audioFilesList');
    if (!audioList) return;
    
    if (audioFiles.length === 0) {
        audioList.innerHTML = `
            <div class="text-center text-muted" id="audioEmptyState">
                <i class="bi bi-music-note-list" style="font-size: 32px; opacity: 0.5;"></i>
                <p class="mt-2">暂无音频文件</p>
                <small>上传音频文件或从视频提取音频</small>
            </div>
        `;
        return;
    }

    audioList.innerHTML = '';
    
    audioFiles.forEach((audio) => {
        const audioItem = document.createElement('div');
        audioItem.className = 'content-item';
        audioItem.innerHTML = `
            <div class="content-header">
                <h6 class="content-title">${audio.name}</h6>
                <span class="badge ${audio.transcribed ? 'bg-success' : 'bg-secondary'} content-badge">
                    ${audio.transcribed ? '已转录' : '未转录'}
                </span>
            </div>
            <div class="content-actions">
                <button class="btn btn-outline-primary btn-sm" onclick="playAudio('${audio.id}')">
                    <i class="bi bi-play me-1"></i>播放
                </button>
                <button class="btn btn-outline-success btn-sm" onclick="transcribeAudio('${audio.id}')" 
                        ${audio.transcribed ? 'disabled' : ''}>
                    <i class="bi bi-file-text me-1"></i>转录
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="removeAudio('${audio.id}')">
                    <i class="bi bi-trash me-1"></i>删除
                </button>
            </div>
        `;
        audioList.appendChild(audioItem);
    });
}

// 转录列表更新
function updateTranscriptionsList() {
    const transcriptList = document.getElementById('transcriptionsList');
    if (!transcriptList) return;
    
    if (transcriptions.length === 0) {
        transcriptList.innerHTML = `
            <div class="text-center text-muted" id="transcriptionsEmptyState">
                <i class="bi bi-file-text" style="font-size: 32px; opacity: 0.5;"></i>
                <p class="mt-2">暂无文案内容</p>
                <small>转录音频文件或手动添加文案</small>
            </div>
        `;
        updateTranslateButton();
        return;
    }

    transcriptList.innerHTML = '';
    
    transcriptions.forEach((transcription, index) => {
        const transcriptionItem = document.createElement('div');
        transcriptionItem.className = 'content-item';
        transcriptionItem.innerHTML = `
            <div class="content-header">
                <h6 class="content-title">文案 ${index + 1}</h6>
                <span class="badge bg-info content-badge">中文</span>
            </div>
            <div class="content-text">
                <textarea placeholder="编辑文案内容..." oninput="updateTranscription('${transcription.id}', this.value)">${transcription.text}</textarea>
            </div>
            <div class="content-actions">
                <button class="btn btn-outline-primary btn-sm" onclick="copyText('${transcription.id}')">
                    <i class="bi bi-copy me-1"></i>复制
                </button>
                <button class="btn btn-outline-success btn-sm" onclick="downloadText('${transcription.id}', '${transcription.source || 'transcription'}')">
                    <i class="bi bi-download me-1"></i>下载
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="removeTranscription('${transcription.id}')">
                    <i class="bi bi-trash me-1"></i>删除
                </button>
            </div>
        `;
        transcriptList.appendChild(transcriptionItem);
    });
    
    updateTranslateButton();
}

// 翻译列表更新
function updateTextsList() {
    const textsList = document.getElementById('textsList');
    if (!textsList) return;
    
    const allTexts = [...transcriptions, ...translations];
    
    if (allTexts.length === 0) {
        textsList.innerHTML = `
            <div class="text-center text-muted" id="textsEmptyState">
                <i class="bi bi-chat-text" style="font-size: 32px; opacity: 0.5;"></i>
                <p class="mt-2">暂无文本内容</p>
                <small>翻译文案或手动添加文本</small>
            </div>
        `;
        updateGenerateSpeechButton();
        return;
    }

    textsList.innerHTML = '';
    
    allTexts.forEach((text, index) => {
        const langName = getLanguageName(text.language || 'zh');
        const textItem = document.createElement('div');
        textItem.className = 'content-item';
        textItem.innerHTML = `
            <div class="content-header">
                <h6 class="content-title">${text.source || '文本'} ${index + 1}</h6>
                <span class="badge bg-info content-badge">${langName}</span>
            </div>
            <div class="content-text">
                <textarea placeholder="编辑文本内容..." readonly>${text.text}</textarea>
            </div>
            <div class="content-actions">
                <button class="btn btn-outline-success btn-sm" onclick="generateSpeechForText('${text.id}')">
                    <i class="bi bi-mic me-1"></i>生成语音
                </button>
                <button class="btn btn-outline-primary btn-sm" onclick="copyText('${text.id}')">
                    <i class="bi bi-copy me-1"></i>复制
                </button>
            </div>
        `;
        textsList.appendChild(textItem);
    });
    
    updateGenerateSpeechButton();
}

// 按钮状态更新
function updateTranslateButton() {
    const btn = document.getElementById('batchTranslateBtn');
    if (btn) {
        btn.disabled = transcriptions.length === 0 || selectedLanguages.length === 0;
    }
}

function updateGenerateSpeechButton() {
    const btn = document.getElementById('batchGenerateSpeechBtn');
    if (btn) {
        const allTexts = [...transcriptions, ...translations];
        btn.disabled = allTexts.length === 0;
    }
}

// 核心功能实现

// 1. 视频提取音频
async function extractAudioFromVideos() {
    if (selectedVideos.length === 0 || isProcessing) return;
    
    isProcessing = true;
    showProgress('video', true);
    updateProgress('video', 0, '准备提取音频...');
    
    try {
        for (let i = 0; i < selectedVideos.length; i++) {
            const video = selectedVideos[i];
            updateProgress('video', (i / selectedVideos.length) * 100, `正在处理: ${video.name}`);
            
            const formData = new FormData();
            formData.append('video', video);
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`提取音频失败: ${response.statusText}`);
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = null;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'complete') {
                                result = data.data;
                                // 添加提取的音频到列表
                                addExtractedAudio(result.audioFileName, video.name);
                            }
                        } catch (e) {
                            console.error('解析数据失败:', e);
                        }
                    }
                }
            }
        }
        
        updateProgress('video', 100, '音频提取完成！');
        showSuccess('所有视频的音频提取完成！');
        
    } catch (error) {
        console.error('提取音频失败:', error);
        showError(`音频提取失败: ${error.message}`);
    } finally {
        isProcessing = false;
        setTimeout(() => showProgress('video', false), 2000);
    }
}

// 2. 音频转录
async function transcribeAudio(audioId) {
    const audio = audioFiles.find(a => a.id === audioId);
    if (!audio || audio.transcribed) return;
    
    try {
        let response;
        if (audio.type === 'uploaded') {
            // 上传的音频文件
            const formData = new FormData();
            formData.append('audio', audio.file);
            
            response = await fetch('/api/transcribe-audio', {
                method: 'POST',
                body: formData
            });
        } else {
            // 提取的音频文件
            response = await fetch('/api/transcribe-extracted-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audioName: audio.name,
                    videoName: audio.source || 'unknown'
                })
            });
        }
        
        if (!response.ok) {
            throw new Error(`转录失败: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // 添加转录结果
        addTranscription(result.transcription, audio.name);
        
        // 更新音频状态
        audio.transcribed = true;
        updateAudioFilesList();
        
        showSuccess(`音频 "${audio.name}" 转录完成！`);
        
    } catch (error) {
        console.error('转录失败:', error);
        showError(`转录失败: ${error.message}`);
    }
}

// 3. 批量翻译
async function batchTranslateTexts() {
    if (transcriptions.length === 0 || selectedLanguages.length === 0) return;
    
    try {
        let completed = 0;
        const total = transcriptions.length * selectedLanguages.length;
        
        for (const transcription of transcriptions) {
            for (const lang of selectedLanguages) {
                const response = await fetch('/api/translate-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: transcription.text,
                        targetLanguage: lang
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`翻译失败: ${response.statusText}`);
                }
                
                const result = await response.json();
                
                // 添加翻译结果
                addTranslation(result.translatedText, lang, transcription.source);
                
                completed++;
            }
        }
        
        showSuccess(`批量翻译完成！共翻译 ${total} 项内容`);
        
    } catch (error) {
        console.error('批量翻译失败:', error);
        showError(`批量翻译失败: ${error.message}`);
    }
}

// 4. 批量生成语音
async function batchGenerateSpeech() {
    const allTexts = [...transcriptions, ...translations];
    if (allTexts.length === 0) return;
    
    try {
        const voiceTypeSelect = document.getElementById('voiceTypeSelect');
        const voiceType = voiceTypeSelect ? voiceTypeSelect.value : 'Kore';
        let completed = 0;
        
        for (const text of allTexts) {
            const targetLang = text.language || 'US';
            
            const response = await fetch('/api/generate-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text.text,
                    targetLanguage: targetLang,
                    voiceName: voiceType,
                    transcriptionId: text.id
                })
            });
            
            if (!response.ok) {
                throw new Error(`语音生成失败: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // 添加生成的语音
            addGeneratedSpeech(result.audioFileName, text.source, targetLang);
            
            completed++;
        }
        
        showSuccess(`批量语音生成完成！共生成 ${allTexts.length} 个语音文件`);
        
    } catch (error) {
        console.error('批量语音生成失败:', error);
        showError(`批量语音生成失败: ${error.message}`);
    }
}

// 工作流程执行
async function startWorkflow() {
    if (selectedVideos.length === 0) {
        showError('请先选择视频文件');
        return;
    }
    
    const step1 = document.getElementById('enableStep1').checked;
    const step2 = document.getElementById('enableStep2').checked;
    const step3 = document.getElementById('enableStep3').checked;
    const step4 = document.getElementById('enableStep4').checked;
    
    try {
        if (step1) {
            await extractAudioFromVideos();
        }
        
        if (step2 && audioFiles.length > 0) {
            for (const audio of audioFiles) {
                if (!audio.transcribed) {
                    await transcribeAudio(audio.id);
                }
            }
        }
        
        if (step3 && transcriptions.length > 0 && selectedLanguages.length > 0) {
            await batchTranslateTexts();
        }
        
        if (step4) {
            await batchGenerateSpeech();
        }
        
        showSuccess('工作流程执行完成！');
        
    } catch (error) {
        console.error('工作流程执行失败:', error);
        showError(`工作流程执行失败: ${error.message}`);
    }
}

// 辅助函数
function addExtractedAudio(audioFileName, sourceName) {
    const audioId = 'audio_extracted_' + Date.now();
    audioFiles.push({
        id: audioId,
        name: audioFileName,
        source: sourceName,
        type: 'extracted',
        transcribed: false
    });
    updateAudioFilesList();
    updateResultsDisplay();
}

function addTranscription(text, source) {
    const transcriptionId = 'transcription_' + Date.now();
    transcriptions.push({
        id: transcriptionId,
        text: text,
        source: source,
        language: 'zh'
    });
    updateTranscriptionsList();
    updateTextsList();
    updateResultsDisplay();
}

function addTranslation(text, language, source) {
    const translationId = 'translation_' + Date.now();
    translations.push({
        id: translationId,
        text: text,
        language: language,
        source: source + ` (${getLanguageName(language)})`
    });
    updateTextsList();
    updateResultsDisplay();
}

function addGeneratedSpeech(audioFileName, source, language) {
    speeches.push({
        id: 'speech_' + Date.now(),
        fileName: audioFileName,
        source: source,
        language: language
    });
    updateResultsDisplay();
}

function updateResultsDisplay() {
    // 更新音频结果
    const audioResultsList = document.getElementById('audioResultsList');
    if (audioResultsList) {
        if (audioFiles.length === 0) {
            audioResultsList.innerHTML = `
                <div class="text-center text-muted">
                    <i class="bi bi-file-music" style="font-size: 24px; opacity: 0.5;"></i>
                    <p class="mt-2 mb-0">暂无音频文件</p>
                </div>
            `;
        } else {
            audioResultsList.innerHTML = audioFiles.map(audio => `
                <div class="content-item">
                    <div class="content-header">
                        <h6 class="content-title">${audio.name}</h6>
                        <span class="badge ${audio.transcribed ? 'bg-success' : 'bg-secondary'} content-badge">
                            ${audio.transcribed ? '已转录' : '未转录'}
                        </span>
                    </div>
                    <div class="content-actions">
                        <button class="btn btn-outline-primary btn-sm" onclick="downloadAudio('${audio.name}')">
                            <i class="bi bi-download me-1"></i>下载
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="playAudioFile('${audio.name}')">
                            <i class="bi bi-play me-1"></i>播放
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // 更新转录结果
    const transcriptResultsList = document.getElementById('transcriptResultsList');
    if (transcriptResultsList) {
        const allTranscripts = [...transcriptions, ...translations];
        if (allTranscripts.length === 0) {
            transcriptResultsList.innerHTML = `
                <div class="text-center text-muted">
                    <i class="bi bi-file-text" style="font-size: 24px; opacity: 0.5;"></i>
                    <p class="mt-2 mb-0">暂无转录文案</p>
                </div>
            `;
        } else {
            transcriptResultsList.innerHTML = allTranscripts.map(text => `
                <div class="content-item">
                    <div class="content-header">
                        <h6 class="content-title">${text.source || '文案'}</h6>
                        <span class="badge bg-info content-badge">${getLanguageName(text.language || 'zh')}</span>
                    </div>
                    <div class="content-actions">
                        <button class="btn btn-outline-primary btn-sm" onclick="copyText('${text.id}')">
                            <i class="bi bi-copy me-1"></i>复制
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="downloadText('${text.id}', '${text.source || 'text'}')">
                            <i class="bi bi-download me-1"></i>下载
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // 更新语音结果
    const speechResultsList = document.getElementById('speechResultsList');
    if (speechResultsList) {
        if (speeches.length === 0) {
            speechResultsList.innerHTML = `
                <div class="text-center text-muted">
                    <i class="bi bi-volume-up" style="font-size: 24px; opacity: 0.5;"></i>
                    <p class="mt-2 mb-0">暂无生成语音</p>
                </div>
            `;
        } else {
            speechResultsList.innerHTML = speeches.map(speech => `
                <div class="content-item">
                    <div class="content-header">
                        <h6 class="content-title">${speech.source || '语音'}</h6>
                        <span class="badge bg-success content-badge">${getLanguageName(speech.language)}</span>
                    </div>
                    <div class="content-actions">
                        <button class="btn btn-outline-primary btn-sm" onclick="downloadAudio('${speech.fileName}')">
                            <i class="bi bi-download me-1"></i>下载
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="playAudioFile('${speech.fileName}')">
                            <i class="bi bi-play me-1"></i>播放
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function getLanguageName(code) {
    const names = {
        'zh': '中文',
        'US': '英语',
        'ES': '西班牙语',
        'PT': '葡萄牙语',
        'FR': '法语',
        'DE': '德语'
    };
    return names[code] || code;
}

// 进度显示
function showProgress(type, show) {
    const element = document.getElementById('videoProcessProgress');
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

function updateProgress(type, percentage, text) {
    const bar = document.getElementById('videoProgressBar');
    const textElement = document.getElementById('videoProgressText');
    
    if (bar) {
        bar.style.width = percentage + '%';
    }
    if (textElement) {
        textElement.textContent = text;
    }
}

// 操作函数
function addManualText() {
    const text = prompt('请输入文案内容:');
    if (text && text.trim()) {
        addTranscription(text.trim(), '手动输入');
    }
}

function updateTranscription(id, newText) {
    const transcription = transcriptions.find(t => t.id === id);
    if (transcription) {
        transcription.text = newText;
    }
}

function removeTranscription(id) {
    if (confirm('确定要删除这个文案吗？')) {
        transcriptions = transcriptions.filter(t => t.id !== id);
        updateTranscriptionsList();
        updateTextsList();
        updateResultsDisplay();
    }
}

function removeAudio(id) {
    if (confirm('确定要删除这个音频文件吗？')) {
        audioFiles = audioFiles.filter(a => a.id !== id);
        updateAudioFilesList();
        updateResultsDisplay();
    }
}

function copyText(id) {
    const allTexts = [...transcriptions, ...translations];
    const text = allTexts.find(t => t.id === id);
    if (text) {
        navigator.clipboard.writeText(text.text).then(() => {
            showSuccess('内容已复制到剪贴板');
        }).catch(() => {
            showError('复制失败');
        });
    }
}

function downloadText(id, filename) {
    const allTexts = [...transcriptions, ...translations];
    const text = allTexts.find(t => t.id === id);
    if (text) {
        const blob = new Blob([text.text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${Date.now()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
}

function downloadAudio(fileName) {
    const link = document.createElement('a');
    link.href = `/api/download-audio/${encodeURIComponent(fileName)}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function playAudio(audioId) {
    console.log('播放音频:', audioId);
}

function playAudioFile(fileName) {
    // 创建音频播放器
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">播放音频: ${fileName}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <audio controls class="w-100">
                        <source src="/api/download-audio/${encodeURIComponent(fileName)}" type="audio/mpeg">
                        您的浏览器不支持音频播放。
                    </audio>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

function generateSpeechForText(textId) {
    const allTexts = [...transcriptions, ...translations];
    const text = allTexts.find(t => t.id === textId);
    if (!text) return;
    
    const voiceTypeSelect = document.getElementById('voiceTypeSelect');
    const voiceType = voiceTypeSelect ? voiceTypeSelect.value : 'Kore';
    const targetLang = text.language || 'US';
    
    fetch('/api/generate-speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text.text,
            targetLanguage: targetLang,
            voiceName: voiceType,
            transcriptionId: textId
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            addGeneratedSpeech(result.audioFileName, text.source, targetLang);
            showSuccess(`语音生成完成：${result.audioFileName}`);
        } else {
            throw new Error(result.error);
        }
    })
    .catch(error => {
        console.error('语音生成失败:', error);
        showError(`语音生成失败: ${error.message}`);
    });
}

function clearAllResults() {
    if (confirm('确定要清空所有结果吗？')) {
        audioFiles = [];
        transcriptions = [];
        translations = [];
        speeches = [];
        selectedVideos = [];
        selectedLanguages = [];
        
        updateVideoFilesList();
        updateAudioFilesList();
        updateTranscriptionsList();
        updateTextsList();
        updateResultsDisplay();
        
        // 清除语言选择
        const languageGrid = document.getElementById('languageGrid');
        if (languageGrid) {
            languageGrid.querySelectorAll('.language-option').forEach(option => {
                option.classList.remove('selected');
            });
        }
        
        showSuccess('所有结果已清空');
    }
}

// 消息显示
function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alert.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1050;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// 服务器健康检查
async function checkServerHealth() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            console.log('服务器连接正常');
        }
    } catch (error) {
        console.error('服务器连接失败:', error);
        showError('无法连接到服务器，请检查服务器是否正常运行');
    }
}
