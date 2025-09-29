// Vue.js 应用
const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;
const { ElMessage, ElMessageBox } = ElementPlus;

// Element Plus 图标
const {
    VideoPlay,
    VideoPause,
    Upload,
    UploadFilled,
    VideoCamera,
    Close,
    Play,
    Document,
    Sort,
    Plus,
    CopyDocument,
    Download,
    Delete,
    ChatDotSquare,
    Microphone,
    Headphone,
    Volume
} = ElementPlusIconsVue;

const app = createApp({
    setup() {
        // 响应式数据
        const selectedVideos = ref([]);
        const transcriptions = ref([]);
        const translations = ref([]);
        const audioList = ref([]);
        const isProcessing = ref(false);
        const progressText = ref('');
        const progressPercentage = ref(0);
        
        // 翻译相关
        const translateDialogVisible = ref(false);
        const selectedLanguages = ref([]);
        const isTranslating = ref(false);
        
        // 音频相关
        const audioPlayerDialogVisible = ref(false);
        const currentAudioTitle = ref('');
        const currentAudioUrl = ref('');
        const currentPlayingAudio = ref('');
        const currentPlayingIndex = ref(-1);
        const audioProgress = ref(0);
        const currentTime = ref(0);
        const audioDuration = ref(0);
        
        // 语音生成
        const speechDialogVisible = ref(false);
        const isGeneratingSpeech = ref(false);
        const speechSettings = reactive({
            voiceName: ''
        });
        const availableVoices = ref([]);
        
        // 语音试听
        const isPlayingVoiceSample = ref(false);
        const voiceSampleAudio = ref(null);
        
        // 选择相关
        const selectAll = ref(false);
        const pendingTranslations = ref([]);
        
        // 原始文案选择相关
        const selectAllTranscriptions = ref(false);
        
        // 音频选择相关
        const selectAllAudio = ref(false);

        // 可用语言（从后端动态获取）
        const availableLanguages = ref([]);


        // 计算属性
        const selectedTranscriptions = computed(() => {
            return transcriptions.value.filter(item => item.selected);
        });

        const selectedTranslations = computed(() => {
            return translations.value.filter(item => item.selected);
        });

        const selectedAudios = computed(() => {
            return audioList.value.filter(item => item.selected);
        });

        // 工具函数
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const getLanguageName = (code) => {
            // 特殊处理中文
            if (code === 'zh') return '中文';
            return code;
        };

        const getLanguageTagType = (code) => {
            // 特殊处理中文
            if (code === 'zh') return 'primary';
            
            // 根据语言代码生成一致的标签类型
            const tagTypes = ['primary', 'success', 'warning', 'danger', 'info'];
            const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return tagTypes[hash % tagTypes.length];
        };

        const generateId = () => {
            return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        };

        // 视频上传相关方法
        const handleVideoFileChange = (file, fileList) => {
            selectedVideos.value = fileList;
        };

        const beforeVideoUpload = (file) => {
            const isVideo = file.type.startsWith('video/');
            const isLt1G = file.size / 1024 / 1024 < 1024;

            if (!isVideo) {
                ElMessage.error('只能上传视频文件!');
                return false;
            }
            if (!isLt1G) {
                ElMessage.error('视频文件大小不能超过 1GB!');
                return false;
            }
            return false; // 阻止自动上传
        };

        const removeVideoFile = (index) => {
            selectedVideos.value.splice(index, 1);
        };

        // 视频转录处理
        const processVideos = async () => {
            if (selectedVideos.value.length === 0) {
                ElMessage.warning('请先选择视频文件');
                return;
            }

            isProcessing.value = true;
            progressPercentage.value = 0;
            progressText.value = '准备转录...';

            try {
                for (let i = 0; i < selectedVideos.value.length; i++) {
                    const file = selectedVideos.value[i];
                    progressText.value = `正在转录: ${file.name}`;
                    progressPercentage.value = (i / selectedVideos.value.length) * 100;
                    progressPercentage.value = progressPercentage.value.toFixed(2);
                    const formData = new FormData();
                    formData.append('video', file.raw);

                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`转录失败: ${response.statusText}`);
                    }

                    // 处理流式响应
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

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
                                        // 添加转录结果
                                        addTranscription(data.data.transcription, file.name);
                                    }
                                } catch (e) {
                                    console.error('解析数据失败:', e);
                                }
                            }
                        }
                    }
                }

                progressPercentage.value = 100;
                progressText.value = '转录完成！';
                ElMessage.success('所有视频转录完成！');

            } catch (error) {
                console.error('转录失败:', error);
                ElMessage.error(`转录失败: ${error.message}`);
            } finally {
                isProcessing.value = false;
                setTimeout(() => {
                    progressPercentage.value = 0;
                }, 2000);
            }
        };

        // 文案管理方法
        const addTranscription = (text, source) => {
            transcriptions.value.push({
                id: generateId(),
                text: text,
                source: source,
                language: 'zh',
                selected: false
            });
        };

        const addManualText = async () => {
            try {
                const { value: text } = await ElMessageBox.prompt('请输入文案内容:', '新增文案', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    inputType: 'textarea',
                    inputPlaceholder: '请输入要添加的文案内容...',
                    customStyle: {
                        width: '600px',
                        height: '400px',
                        '--el-messagebox-width': '600px',
                        '--el-messagebox-height': '400px',
                    },
                    inputStyle: {
                        height: '400px',
                        minHeight: '200px',
                        resize: 'vertical'
                    },
                    inputValidator: (value) => {
                        if (!value || !value.trim()) {
                            return '文案内容不能为空';
                        }
                        return true;
                    }
                });
                addTranscription(text.trim(), '手动输入');
                ElMessage.success('文案添加成功');
            } catch (error) {
                // 用户取消操作
            }
        };

        const removeTranscription = async (index) => {
            try {
                await ElMessageBox.confirm('确定要删除这个文案吗？', '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });
                transcriptions.value.splice(index, 1);
                ElMessage.success('文案删除成功');
            } catch (error) {
                // 用户取消操作
            }
        };

        // 翻译相关方法
        const showTranslateDialog = () => {
            if (transcriptions.value.length === 0) {
                ElMessage.warning('没有可翻译的文案');
                return;
            }
            translateDialogVisible.value = true;
        };

        const handleTranslateDialogClose = (done) => {
            selectedLanguages.value = [];
            done();
        };

        const executeTranslation = async () => {
            if (selectedLanguages.value.length === 0) {
                ElMessage.warning('请选择至少一种目标语言');
                return;
            }

            isTranslating.value = true;

            try {
                let completed = 0;
                const total = transcriptions.value.length * selectedLanguages.value.length;

                for (const transcription of transcriptions.value) {
                    for (const lang of selectedLanguages.value) {
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
                        addTranslation(result.translatedText, lang, transcription.source);
                        completed++;
                    }
                }

                ElMessage.success(`批量翻译完成！共翻译 ${total} 项内容`);
                translateDialogVisible.value = false;
                selectedLanguages.value = [];

            } catch (error) {
                console.error('翻译失败:', error);
                ElMessage.error(`翻译失败: ${error.message}`);
            } finally {
                isTranslating.value = false;
            }
        };

        const addTranslation = (text, language, source) => {
            translations.value.push({
                id: generateId(),
                text: text,
                language: language,
                source: source + ` (${getLanguageName(language)})`,
                selected: false
            });
        };

        const removeTranslation = async (index) => {
            try {
                await ElMessageBox.confirm('确定要删除这个翻译吗？', '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });
                translations.value.splice(index, 1);
                updateSelectAll();
                ElMessage.success('翻译删除成功');
            } catch (error) {
                // 用户取消操作
            }
        };

        // 批量删除选中的翻译
        const deleteSelectedTranslations = async () => {
            const selected = selectedTranslations.value;
            if (selected.length === 0) {
                ElMessage.warning('请先选择要删除的翻译');
                return;
            }

            try {
                await ElMessageBox.confirm(`确定要删除选中的 ${selected.length} 个翻译吗？`, '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });

                // 从后往前删除，避免索引问题
                for (let i = translations.value.length - 1; i >= 0; i--) {
                    if (translations.value[i].selected) {
                        translations.value.splice(i, 1);
                    }
                }

                updateSelectAll();
                ElMessage.success(`已删除 ${selected.length} 个翻译`);
            } catch (error) {
                // 用户取消操作
            }
        };

        // 选择相关方法
        const handleSelectAll = (value) => {
            translations.value.forEach(item => {
                item.selected = value;
            });
        };

        const updateSelectAll = () => {
            if (translations.value.length === 0) {
                selectAll.value = false;
                return;
            }
            selectAll.value = translations.value.every(item => item.selected);
        };

        // 原始文案选择相关方法
        const handleSelectAllTranscriptions = (value) => {
            transcriptions.value.forEach(item => {
                item.selected = value;
            });
        };

        const updateSelectAllTranscriptions = () => {
            if (transcriptions.value.length === 0) {
                selectAllTranscriptions.value = false;
                return;
            }
            selectAllTranscriptions.value = transcriptions.value.every(item => item.selected);
        };

        // 批量删除选中的原始文案
        const deleteSelectedTranscriptions = async () => {
            const selected = selectedTranscriptions.value;
            if (selected.length === 0) {
                ElMessage.warning('请先选择要删除的文案');
                return;
            }

            try {
                await ElMessageBox.confirm(`确定要删除选中的 ${selected.length} 个文案吗？`, '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });

                // 从后往前删除，避免索引问题
                for (let i = transcriptions.value.length - 1; i >= 0; i--) {
                    if (transcriptions.value[i].selected) {
                        transcriptions.value.splice(i, 1);
                    }
                }

                updateSelectAllTranscriptions();
                ElMessage.success(`已删除 ${selected.length} 个文案`);
            } catch (error) {
                // 用户取消操作
            }
        };

        // 音频选择相关方法
        const handleSelectAllAudio = (value) => {
            audioList.value.forEach(item => {
                item.selected = value;
            });
        };

        const updateSelectAllAudio = () => {
            if (audioList.value.length === 0) {
                selectAllAudio.value = false;
                return;
            }
            selectAllAudio.value = audioList.value.every(item => item.selected);
        };

        // 批量下载选中的音频
        const downloadSelectedAudios = () => {
            const selected = selectedAudios.value;
            if (selected.length === 0) {
                ElMessage.warning('请先选择要下载的音频文件');
                return;
            }

            ElMessage.success(`开始下载 ${selected.length} 个音频文件`);
            
            selected.forEach(audio => {
                downloadAudio(audio.fileName);
            });
        };

        // 语音生成相关方法
        const generateSelectedSpeech = () => {
            const selected = selectedTranslations.value;
            if (selected.length === 0) {
                ElMessage.warning('请选择要生成语音的翻译文本');
                return;
            }
            pendingTranslations.value = [...selected];
            speechDialogVisible.value = true;
        };

        const generateSingleSpeech = (translation) => {
            pendingTranslations.value = [translation];
            speechDialogVisible.value = true;
        };

        const confirmGenerateSpeech = async () => {
            if (pendingTranslations.value.length === 0) {
                ElMessage.warning('没有要生成的语音');
                return;
            }

            isGeneratingSpeech.value = true;

            try {
                for (const translation of pendingTranslations.value) {
                    const response = await fetch('/api/generate-speech', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: translation.text,
                            targetLanguage: translation.language,
                            voiceName: speechSettings.voiceName,
                            transcriptionId: translation.id
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`语音生成失败: ${response.statusText}`);
                    }

                    const result = await response.json();
                    addAudio(result.audioFileName, translation.source, translation.language);
                }

                ElMessage.success(`语音生成完成！共生成 ${pendingTranslations.value.length} 个语音文件`);
                speechDialogVisible.value = false;
                pendingTranslations.value = [];

            } catch (error) {
                console.error('语音生成失败:', error);
                ElMessage.error(`语音生成失败: ${error.message}`);
            } finally {
                isGeneratingSpeech.value = false;
            }
        };

        // 音频管理方法
        const addAudio = (fileName, source, language) => {
            audioList.value.push({
                id: generateId(),
                fileName: fileName,
                source: source,
                language: language,
                selected: false
            });
        };

        const toggleAudioPlayback = (fileName, index) => {
            if (currentPlayingAudio.value === fileName) {
                // 暂停当前音频
                const audioElement = getAudioElement(currentPlayingIndex.value);
                if (audioElement) {
                    audioElement.pause();
                }
                currentPlayingAudio.value = '';
                currentPlayingIndex.value = -1;
            } else {
                // 停止其他音频
                if (currentPlayingAudio.value) {
                    const prevAudioElement = getAudioElement(currentPlayingIndex.value);
                    if (prevAudioElement) {
                        prevAudioElement.pause();
                    }
                }
                
                // 播放新音频
                currentPlayingAudio.value = fileName;
                currentPlayingIndex.value = index;
                
                nextTick(() => {
                    const audioElement = getAudioElement(index);
                    if (audioElement) {
                        audioElement.volume = 0.7; // 设置默认音量
                        audioElement.play().catch(error => {
                            console.error('音频播放失败:', error);
                            ElMessage.error('音频播放失败，请检查文件是否存在');
                        });
                    }
                });
            }
        };

        const onAudioLoaded = () => {
            const audioElement = getAudioElement(currentPlayingIndex.value);
            if (audioElement) {
                audioDuration.value = audioElement.duration;
            }
        };

        const onTimeUpdate = () => {
            const audioElement = getAudioElement(currentPlayingIndex.value);
            if (audioElement) {
                currentTime.value = audioElement.currentTime;
                audioProgress.value = (audioElement.currentTime / audioElement.duration) * 100;
            }
        };

        const onAudioEnded = () => {
            currentPlayingAudio.value = '';
            currentPlayingIndex.value = -1;
            audioProgress.value = 0;
            currentTime.value = 0;
        };

        const seekAudio = (event) => {
            const audioElement = getAudioElement(currentPlayingIndex.value);
            if (audioElement && audioDuration.value > 0) {
                const rect = event.currentTarget.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const percentage = clickX / rect.width;
                const newTime = percentage * audioDuration.value;
                audioElement.currentTime = newTime;
            }
        };

        // 存储音频元素refs的对象
        const audioRefs = ref({});
        
        // 获取音频元素的帮助函数
        const getAudioElement = (index) => {
            if (index >= 0) {
                const refName = 'audioPlayer' + index;
                return audioRefs.value[refName];
            }
            return null;
        };

        const formatTime = (seconds) => {
            if (!seconds || isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const formatDuration = (seconds) => {
            return formatTime(seconds);
        };

        const downloadAudio = async (fileName) => {
            try {                
                // 使用fetch API下载文件，适合HTTPS环境
                const response = await fetch(`/api/download-audio/${encodeURIComponent(fileName)}`, {
                    method: 'GET',
                    credentials: 'same-origin', // 包含同源凭证
                    headers: {
                        'Accept': 'audio/*,*/*'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
                }
                
                // 获取文件blob
                const blob = await response.blob();
                
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.style.display = 'none';
                
                // 添加到DOM并触发下载
                document.body.appendChild(link);
                link.click();
                
                // 清理
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                ElMessage.success('下载成功！');
            } catch (error) {
                console.error('音频下载失败:', error);
                ElMessage.error(`音频下载失败: ${error.message}`);
                
                // 如果新方法失败，尝试传统方法作为备用
                try {
                    const link = document.createElement('a');
                    link.href = `/api/download-audio/${encodeURIComponent(fileName)}`;
                    link.download = fileName;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (fallbackError) {
                    console.error('备用下载方法也失败:', fallbackError);
                    ElMessage.error('下载失败，请检查网络连接状况');
                }
            }
        };

        const removeAudio = async (index) => {
            try {
                await ElMessageBox.confirm('确定要删除这个音频文件吗？', '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });
                audioList.value.splice(index, 1);
                updateSelectAllAudio();
                ElMessage.success('音频删除成功');
            } catch (error) {
                // 用户取消操作
            }
        };

        // 批量删除选中的音频
        const deleteSelectedAudios = async () => {
            const selected = selectedAudios.value;
            if (selected.length === 0) {
                ElMessage.warning('请先选择要删除的音频文件');
                return;
            }

            try {
                await ElMessageBox.confirm(`确定要删除选中的 ${selected.length} 个音频文件吗？`, '确认删除', {
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    type: 'warning'
                });

                // 从后往前删除，避免索引问题
                for (let i = audioList.value.length - 1; i >= 0; i--) {
                    if (audioList.value[i].selected) {
                        audioList.value.splice(i, 1);
                    }
                }

                updateSelectAllAudio();
                ElMessage.success(`已删除 ${selected.length} 个音频文件`);
            } catch (error) {
                // 用户取消操作
            }
        };

        // 通用方法
        const copyText = async (text) => {
            try {
                await navigator.clipboard.writeText(text);
                ElMessage.success('内容已复制到剪贴板');
            } catch (error) {
                ElMessage.error(error + '复制失败');
            }
        };

        const downloadText = (text, filename) => {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}_${Date.now()}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        };

        const clearAllData = async () => {
            try {
                await ElMessageBox.confirm('确定要清空所有数据吗？这将删除所有视频、文案、翻译和音频数据。', '确认清空', {
                    confirmButtonText: '清空',
                    cancelButtonText: '取消',
                    type: 'warning'
                });
                
                selectedVideos.value = [];
                transcriptions.value = [];
                translations.value = [];
                audioList.value = [];
                selectAll.value = false;
                selectAllTranscriptions.value = false;
                selectAllAudio.value = false;
                currentPlayingAudio.value = '';
                
                ElMessage.success('所有数据已清空');
            } catch (error) {
                // 用户取消操作
            }
        };

        // 生命周期
        onMounted(() => {
            console.log('视频转录智能处理平台已启动');
            
            // 检查服务器健康状态
            checkServerHealth();
            
            // 获取语言配置
            fetchSupportedLanguages();
            
            // 获取语音选项
            fetchVoiceOptions();
        });

        const checkServerHealth = async () => {
            try {
                const response = await fetch('/api/health');
                if (response.ok) {
                    console.log('服务器连接正常');
                } else {
                    ElMessage.warning('服务器连接异常');
                }
            } catch (error) {
                console.error('服务器连接失败:', error);
                ElMessage.error('无法连接到服务器，请检查服务器是否正常运行');
            }
        };

        // 获取支持的语言列表
        const fetchSupportedLanguages = async () => {
            try {
                const response = await fetch('/api/supported-languages');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // 将语言代码数组转换为前端需要的格式
                        availableLanguages.value = result.languages.map(code => ({
                            code: code,
                            name: code,
                        }));
                        console.log('语言配置获取成功:', availableLanguages.value);
                    } else {
                        console.error('获取语言配置失败:', result.error);
                        ElMessage.error('获取语言配置失败');
                    }
                } else {
                    throw new Error('服务器响应错误');
                }
            } catch (error) {
                console.error('获取语言配置失败:', error);
                ElMessage.error('获取语言配置失败');
            }
        };

        // 获取可用的语音选项
        const fetchVoiceOptions = async () => {
            try {
                const response = await fetch('/api/voice-options');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        availableVoices.value = result.voices;
                        // 设置默认语音
                        if (availableVoices.value.length > 0 && !speechSettings.voiceName) {
                            speechSettings.voiceName = availableVoices.value[0].name;
                        }
                        console.log('语音选项获取成功:', availableVoices.value);
                    } else {
                        console.error('获取语音选项失败:', result.error);
                        ElMessage.error('获取语音选项失败');
                    }
                } else {
                    throw new Error('服务器响应错误');
                }
            } catch (error) {
                console.error('获取语音选项失败:', error);
                ElMessage.error('获取语音选项失败，将使用默认选项');
                // 设置后备语音选项
                availableVoices.value = [
                    { name: 'Kore', description: '坚定', displayName: 'Kore - 坚定' },
                    { name: 'Puck', description: '欢快', displayName: 'Puck - 欢快' },
                    { name: 'Zephyr', description: '明亮', displayName: 'Zephyr - 明亮' },
                    { name: 'Charon', description: '信息丰富', displayName: 'Charon - 信息丰富' },
                    { name: 'Leda', description: '青春', displayName: 'Leda - 青春' },
                    { name: 'Aoede', description: 'Breezy', displayName: 'Aoede - Breezy' }
                ];
                speechSettings.voiceName = 'Kore';
            }
        };

        // 语音试听功能
        const playVoiceSample = async () => {
            if (!speechSettings.voiceName) {
                ElMessage.warning('请先选择语音类型');
                return;
            }

            if (isPlayingVoiceSample.value) {
                // 如果正在播放，则停止
                stopVoiceSample();
                return;
            }

            isPlayingVoiceSample.value = true;

            try {
                // 停止当前播放的音频
                if (voiceSampleAudio.value) {
                    voiceSampleAudio.value.pause();
                    voiceSampleAudio.value = null;
                }

                // 创建音频元素
                const audio = new Audio();
                audio.src = `/api/voice-sample/${speechSettings.voiceName}`;
                audio.volume = 0.7;
                
                // 设置事件监听器
                audio.onloadeddata = () => {
                    console.log('语音样本加载完成');
                };
                
                audio.onplay = () => {
                    console.log('开始播放语音样本');
                };
                
                audio.onended = () => {
                    console.log('语音样本播放结束');
                    isPlayingVoiceSample.value = false;
                    voiceSampleAudio.value = null;
                };
                
                audio.onerror = (error) => {
                    console.error('语音样本播放失败:', error);
                    ElMessage.error('语音样本播放失败，请检查网络连接');
                    isPlayingVoiceSample.value = false;
                    voiceSampleAudio.value = null;
                };

                voiceSampleAudio.value = audio;
                
                // 开始播放
                await audio.play();
                ElMessage.success(`正在播放 ${speechSettings.voiceName} 语音样本`);

            } catch (error) {
                console.error('播放语音样本失败:', error);
                ElMessage.error('播放语音样本失败，请稍后重试');
                isPlayingVoiceSample.value = false;
                voiceSampleAudio.value = null;
            }
        };

        // 停止语音试听
        const stopVoiceSample = () => {
            if (voiceSampleAudio.value) {
                voiceSampleAudio.value.pause();
                voiceSampleAudio.value = null;
            }
            isPlayingVoiceSample.value = false;
        };

        return {
            // 响应式数据
            selectedVideos,
            transcriptions,
            translations,
            audioList,
            isProcessing,
            progressText,
            progressPercentage,
            translateDialogVisible,
            selectedLanguages,
            isTranslating,
            audioPlayerDialogVisible,
            currentAudioTitle,
            currentAudioUrl,
            currentPlayingAudio,
            currentPlayingIndex,
            audioProgress,
            currentTime,
            audioDuration,
            speechDialogVisible,
            isGeneratingSpeech,
            speechSettings,
            availableVoices,
            isPlayingVoiceSample,
            voiceSampleAudio,
            selectAll,
            selectAllTranscriptions,
            selectAllAudio,
            availableLanguages,
            
            // 计算属性
            selectedTranscriptions,
            selectedTranslations,
            selectedAudios,
            
            // 方法
            formatFileSize,
            getLanguageName,
            getLanguageTagType,
            handleVideoFileChange,
            beforeVideoUpload,
            removeVideoFile,
            processVideos,
            addManualText,
            removeTranscription,
            showTranslateDialog,
            handleTranslateDialogClose,
            executeTranslation,
            removeTranslation,
            handleSelectAll,
            updateSelectAll,
            handleSelectAllTranscriptions,
            updateSelectAllTranscriptions,
            deleteSelectedTranscriptions,
            deleteSelectedTranslations,
            handleSelectAllAudio,
            updateSelectAllAudio,
            deleteSelectedAudios,
            downloadSelectedAudios,
            generateSelectedSpeech,
            generateSingleSpeech,
            confirmGenerateSpeech,
            toggleAudioPlayback,
            onAudioLoaded,
            onTimeUpdate,
            onAudioEnded,
            seekAudio,
            getAudioElement,
            audioRefs,
            formatTime,
            formatDuration,
            downloadAudio,
            removeAudio,
            copyText,
            downloadText,
            clearAllData,
            playVoiceSample,
            stopVoiceSample,
            fetchSupportedLanguages
        };
    }
});

// 注册 Element Plus 图标
app.component('VideoPlay', VideoPlay);
app.component('VideoPause', VideoPause);
app.component('Upload', Upload);
app.component('UploadFilled', UploadFilled);
app.component('VideoCamera', VideoCamera);
app.component('Close', Close);
app.component('Play', Play);
app.component('Document', Document);
app.component('Sort', Sort);
app.component('Plus', Plus);
app.component('CopyDocument', CopyDocument);
app.component('Download', Download);
app.component('Delete', Delete);
app.component('ChatDotSquare', ChatDotSquare);
app.component('Microphone', Microphone);
app.component('Headphone', Headphone);
app.component('Volume', Volume);

// 使用 Element Plus
app.use(ElementPlus, {
    locale: ElementPlusLocaleZhCn
});

// 挂载应用
app.mount('#app');