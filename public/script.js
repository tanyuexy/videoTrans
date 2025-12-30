// Vue.js 应用
const { createApp, ref, reactive, computed, onMounted, nextTick, watch } = Vue;
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
    const progressText = ref("");
    const progressPercentage = ref(0);

    // 翻译相关
    const translateDialogVisible = ref(false);
    const selectedLanguages = ref([]);
    const isTranslating = ref(false);

    // 音频相关
    const audioPlayerDialogVisible = ref(false);
    const currentAudioTitle = ref("");
    const currentAudioUrl = ref("");
    const currentPlayingAudio = ref("");
    const currentPlayingIndex = ref(-1);
    const audioProgress = ref(0);
    const currentTime = ref(0);
    const audioDuration = ref(0);

    // 语音生成
    const speechDialogVisible = ref(false);
    const isGeneratingSpeech = ref(false);
    const speechSettings = reactive({
      voiceName: "",
      enableParagraphInterval: false,
      paragraphInterval: 0.3, // 默认0.3秒间隔
      model: "google", // per-dialog 模型选择，'google' 或 'aliyun'
      useContentFileName: false
    });
    const availableVoices = ref([]);

    // 新增翻译弹窗
    const manualTranslationDialogVisible = ref(false);
    const manualTranslationForm = reactive({
      text: "",
      language: ""
    });

    // 语音试听
    const isPlayingVoiceSample = ref(false);
    const voiceSampleAudio = ref(null);
    const voiceSampleLoading = ref(false);

    // 选择相关
    const selectAll = ref(false);
    const pendingTranslations = ref([]);

    // 原始文案选择相关
    const selectAllTranscriptions = ref(false);

    // 音频选择相关
    const selectAllAudio = ref(false);

    // 可用语言（用于翻译，下文始终使用 Google 列表）
    const availableLanguages = ref([]);
    // 可用语言（用于 TTS / 模型校验，随模型变化）
    const availableTTSLanguages = ref([]);

    // 计算属性
    const selectedTranscriptions = computed(() => {
      return transcriptions.value.filter((item) => item.selected);
    });

    const selectedTranslations = computed(() => {
      return translations.value.filter((item) => item.selected);
    });

    const selectedAudios = computed(() => {
      return audioList.value.filter((item) => item.selected);
    });

    // 工具函数
    const formatFileSize = (bytes) => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getLanguageName = (code) => {
      // 特殊处理中文
      if (code === "zh") return "中文";
      return code;
    };

    const getLanguageTagType = (code) => {
      // 特殊处理中文
      if (code === "zh") return "primary";

      // 根据语言代码生成一致的标签类型
      const tagTypes = ["primary", "success", "warning", "danger", "info"];
      const hash = code
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return tagTypes[hash % tagTypes.length];
    };

    // 语言检测（前端启发式，覆盖主要语言）
    const detectLanguageCode = (text) => {
      const t = (text || "").trim();
      if (!t) return "US";
      // 字符集快速判断
      if (/[\u0600-\u06FF]/.test(t)) return "AR"; // 阿拉伯语
      if (/[\u3040-\u30FF]/.test(t)) return "JP"; // 日语（平假名/片假名）
      if (/[\uAC00-\uD7AF]/.test(t)) return "KR"; // 韩语
      if (/[\u0E00-\u0E7F]/.test(t)) return "TH"; // 泰语
      if (/[\u0400-\u04FF]/.test(t)) return "RU"; // 俄语（西里尔）
      if (/[\u0900-\u097F]/.test(t)) return "IN"; // 印地语（天城文）
      if (/[\u4E00-\u9FFF]/.test(t)) return "TW"; // 中文（统一归为TW）
      if (/[ăâêôơưđÀ-ỹ]/i.test(t)) return "VN"; // 越南语
      if (/[ąćęłńóśźż]/i.test(t)) return "PL"; // 波兰语
      if (/[ğüşşıİçö]/i.test(t)) return "TR"; // 土耳其语
      if (/[äöüß]/i.test(t)) return "DE"; // 德语
      if (/[àâæçéèêëîïôœùûüÿ]/i.test(t)) return "FR"; // 法语
      if (/[ãõçáâàéêíóôõúü]/i.test(t)) return "PT"; // 葡萄牙语
      if (/[áéíñóúü¿¡]/i.test(t)) return "ES"; // 西班牙语
      if (/[åäö]/i.test(t)) return "SV"; // 瑞典语（也与FI重叠，优先SV）
      if (/[äö]/i.test(t)) return "FI"; // 芬兰语

      // 常用词启发（小概率误判，尽量简单覆盖）
      const lower = t.toLowerCase();
      if (/\b(el|la|de|que|y|en|los|del)\b/.test(lower)) return "ES";
      if (/\b(le|la|les|des|et|est|pour|avec)\b/.test(lower)) return "FR";
      if (/\bder|die|das|und|ist|mit|nicht\b/.test(lower)) return "DE";
      if (/\bche|gli|del|della|per|non|una|uno\b/.test(lower)) return "IT";
      if (/\bde|het|een|en|niet|voor|met\b/.test(lower)) return "NL";
      if (/\byang|itu|dan|di\b/.test(lower)) return "ID"; // 印度尼西亚语
      if (/\banda|yang|tidak|dengan\b/.test(lower)) return "MS"; // 马来语
      if (/\boch|att|det|som|är|inte\b/.test(lower)) return "SV"; // 瑞典语

      return "US"; // 默认英语
    };

    const generateId = () => {
      return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    };

    // 视频上传相关方法
    const handleVideoFileChange = (file, fileList) => {
      selectedVideos.value = fileList;
    };

    const beforeVideoUpload = (file) => {
      const isVideo = file.type && file.type.startsWith("video/");
      const isAudio = file.type && file.type.startsWith("audio/");
      const isLt1G = file.size / 1024 / 1024 < 1024;

      if (!isVideo && !isAudio) {
        ElMessage.error("只能上传视频或音频文件!");
        return false;
      }
      if (!isLt1G) {
        ElMessage.error("文件大小不能超过 1GB!");
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
        ElMessage.warning("请先选择视频文件");
        return;
      }

      isProcessing.value = true;
      progressPercentage.value = 0;
      progressText.value = "准备转录...";

      try {
        for (let i = 0; i < selectedVideos.value.length; i++) {
          const file = selectedVideos.value[i];
          progressText.value = `正在转录: ${file.name}`;
          progressPercentage.value = (i / selectedVideos.value.length) * 100;
          progressPercentage.value = progressPercentage.value.toFixed(2);

          const isVideo =
            file.raw && file.raw.type && file.raw.type.startsWith("video/");
          const isAudio =
            file.raw && file.raw.type && file.raw.type.startsWith("audio/");

          if (isVideo) {
            const formData = new FormData();
            formData.append("video", file.raw);

            const response = await fetch("/api/transcribe", {
              method: "POST",
              body: formData
            });

            if (!response.ok) {
              throw new Error(`转录失败: ${response.statusText}`);
            }

            // 处理流式响应（视频端点）
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === "complete") {
                      addTranscription(
                        data.data.originalTranscription,
                        data.data.chineseTranscription,
                        file.name
                      );
                    }
                  } catch (e) {
                    console.error("解析数据失败:", e);
                  }
                }
              }
            }
          } else if (isAudio) {
            const formData = new FormData();
            formData.append("audio", file.raw);

            const response = await fetch("/api/transcribe-audio", {
              method: "POST",
              body: formData
            });

            if (!response.ok) {
              throw new Error(`转录失败: ${response.statusText}`);
            }

            const result = await response.json();
            if (
              result &&
              result.success &&
              result.originalTranscription &&
              result.chineseTranscription
            ) {
              addTranscription(
                result.originalTranscription,
                result.chineseTranscription,
                file.name
              );
            } else if (
              result &&
              (result.originalTranscription || result.chineseTranscription)
            ) {
              addTranscription(
                result.originalTranscription || "",
                result.chineseTranscription || "",
                file.name
              );
            } else {
              throw new Error("音频转录返回格式异常");
            }
          } else {
            console.warn("未知文件类型，跳过:", file.name);
          }
        }

        progressPercentage.value = 100;
        progressText.value = "转录完成！";
        ElMessage.success("所有视频转录完成！");
      } catch (error) {
        console.error("转录失败:", error);
        ElMessage.error(`转录失败: ${error.message}`);
      } finally {
        isProcessing.value = false;
        setTimeout(() => {
          progressPercentage.value = 0;
        }, 2000);
      }
    };

    // 文案管理方法
    const addTranscription = (originalText, chineseText, source) => {
      transcriptions.value.push({
        id: generateId(),
        text: chineseText,
        originalText: originalText,
        source: source,
        language: "zh",
        selected: false
      });
    };

    // 在翻译结果列手动新增文本（自动识别语言并打标签）
    const addManualTranslation = () => {
      manualTranslationForm.text = "";
      manualTranslationForm.language = "";
      manualTranslationDialogVisible.value = true;
    };

    const confirmAddManualTranslation = () => {
      const text = (manualTranslationForm.text || "").trim();
      if (!text) {
        ElMessage.warning("内容不能为空");
        return;
      }
      const lang = manualTranslationForm.language || detectLanguageCode(text);
      addTranslation(text, lang, "手动输入");
      manualTranslationDialogVisible.value = false;
      manualTranslationForm.text = "";
      manualTranslationForm.language = "";
      ElMessage.success(`已添加，语言：${getLanguageName(lang)}`);
    };

    const addManualText = async () => {
      try {
        const { value: text } = await ElMessageBox.prompt(
          "请输入文案内容:",
          "新增文案",
          {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            inputType: "textarea",
            inputPlaceholder: "请输入要添加的文案内容...",
            customStyle: {
              width: "600px",
              height: "400px",
              "--el-messagebox-width": "600px",
              "--el-messagebox-height": "400px"
            },
            inputStyle: {
              height: "400px",
              minHeight: "200px",
              resize: "vertical"
            },
            inputValidator: (value) => {
              if (!value || !value.trim()) {
                return "文案内容不能为空";
              }
              return true;
            }
          }
        );
        addTranscription(text.trim(), text.trim(), "手动输入");
        ElMessage.success("文案添加成功");
      } catch (error) {
        // 用户取消操作
      }
    };

    const removeTranscription = async (index) => {
      try {
        await ElMessageBox.confirm("确定要删除这个文案吗？", "确认删除", {
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          type: "warning"
        });
        transcriptions.value.splice(index, 1);
        ElMessage.success("文案删除成功");
      } catch (error) {
        // 用户取消操作
      }
    };

    // 翻译相关方法
    const showTranslateDialog = () => {
      if (transcriptions.value.length === 0) {
        ElMessage.warning("没有可翻译的文案");
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
        ElMessage.warning("请选择至少一种目标语言");
        return;
      }

      isTranslating.value = true;

      try {
        let completed = 0;
        const total =
          transcriptions.value.length * selectedLanguages.value.length;

        for (const transcription of transcriptions.value) {
          for (const lang of selectedLanguages.value) {
            const response = await fetch("/api/translate-text", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
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
            addTranslation(
              result.translatedText,
              lang,
              transcription.source,
              transcription.id
            );
            completed++;
          }
        }

        ElMessage.success(`批量翻译完成！共翻译 ${total} 项内容`);
        translateDialogVisible.value = false;
        selectedLanguages.value = [];
      } catch (error) {
        console.error("翻译失败:", error);
        ElMessage.error(`翻译失败: ${error.message}`);
      } finally {
        isTranslating.value = false;
      }
    };

    const addTranslation = (text, language, source, transcriptionId) => {
      translations.value.push({
        id: generateId(),
        text: text,
        language: language,
        source: source + ` (${getLanguageName(language)})`,
        fromTranscriptionId: transcriptionId || null,
        selected: false
      });
    };

    const removeTranslation = async (index) => {
      try {
        await ElMessageBox.confirm("确定要删除这个翻译吗？", "确认删除", {
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          type: "warning"
        });
        translations.value.splice(index, 1);
        updateSelectAll();
        ElMessage.success("翻译删除成功");
      } catch (error) {
        // 用户取消操作
      }
    };

    // 批量删除选中的翻译
    const deleteSelectedTranslations = async () => {
      const selected = selectedTranslations.value;
      if (selected.length === 0) {
        ElMessage.warning("请先选择要删除的翻译");
        return;
      }

      try {
        await ElMessageBox.confirm(
          `确定要删除选中的 ${selected.length} 个翻译吗？`,
          "确认删除",
          {
            confirmButtonText: "删除",
            cancelButtonText: "取消",
            type: "warning"
          }
        );

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
      translations.value.forEach((item) => {
        item.selected = value;
      });
    };

    const updateSelectAll = () => {
      if (translations.value.length === 0) {
        selectAll.value = false;
        return;
      }
      selectAll.value = translations.value.every((item) => item.selected);
    };

    // 原始文案选择相关方法
    const handleSelectAllTranscriptions = (value) => {
      transcriptions.value.forEach((item) => {
        item.selected = value;
      });
    };

    const updateSelectAllTranscriptions = () => {
      if (transcriptions.value.length === 0) {
        selectAllTranscriptions.value = false;
        return;
      }
      selectAllTranscriptions.value = transcriptions.value.every(
        (item) => item.selected
      );
    };

    // 批量删除选中的原始文案
    const deleteSelectedTranscriptions = async () => {
      const selected = selectedTranscriptions.value;
      if (selected.length === 0) {
        ElMessage.warning("请先选择要删除的文案");
        return;
      }

      try {
        await ElMessageBox.confirm(
          `确定要删除选中的 ${selected.length} 个文案吗？`,
          "确认删除",
          {
            confirmButtonText: "删除",
            cancelButtonText: "取消",
            type: "warning"
          }
        );

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
      audioList.value.forEach((item) => {
        item.selected = value;
      });
    };

    const updateSelectAllAudio = () => {
      if (audioList.value.length === 0) {
        selectAllAudio.value = false;
        return;
      }
      selectAllAudio.value = audioList.value.every((item) => item.selected);
    };

    // 批量下载选中的音频
    const downloadSelectedAudios = () => {
      const selected = selectedAudios.value;
      if (selected.length === 0) {
        ElMessage.warning("请先选择要下载的音频文件");
        return;
      }

      ElMessage.success(`开始下载 ${selected.length} 个音频文件`);

      selected.forEach((audio) => {
        const downloadName = audio.displayName || audio.fileName;
        downloadAudio(audio.fileName, downloadName);
      });
    };

    // 语音生成相关方法
    const generateSelectedSpeech = async () => {
      const selected = selectedTranslations.value;
      if (selected.length === 0) {
        ElMessage.warning("请选择要生成语音的翻译文本");
        return;
      }
      pendingTranslations.value = [...selected];
      // 确保根据当前对话模型加载语音选项与模型语言列表（但翻译下拉仍使用 Google 列表）
      await fetchVoiceOptions(speechSettings.model);
      await fetchModelLanguages(speechSettings.model);
      speechDialogVisible.value = true;
    };

    const generateSingleSpeech = async (translation) => {
      pendingTranslations.value = [translation];
      await fetchVoiceOptions(speechSettings.model);
      await fetchModelLanguages(speechSettings.model);
      speechDialogVisible.value = true;
    };

    const confirmGenerateSpeech = async () => {
      if (pendingTranslations.value.length === 0) {
        ElMessage.warning("没有要生成的语音");
        return;
      }

      isGeneratingSpeech.value = true;

      // 如果使用阿里云模型，先校验目标语言是否在阿里云支持列表中
      if (speechSettings.model === "aliyun") {
        for (const t of pendingTranslations.value) {
          const code = (t.language || "").toString().toUpperCase();
          const found = (availableTTSLanguages.value || []).some(
            (l) => (l.code || "").toString().toUpperCase() === code
          );
          if (!found) {
            ElMessage.error(`阿里云不支持目标语言：${t.language}`);
            isGeneratingSpeech.value = false;
            return;
          }
        }
      }

      try {
        // 确定要发送给后端的 voiceName（对 Aliyun 使用 voiceKey）
        let voiceNameForApi = speechSettings.voiceName;
        if (speechSettings.model === "aliyun") {
          const found = availableVoices.value.find(
            (v) =>
              v.name === speechSettings.voiceName ||
              v.voice === speechSettings.voiceName ||
              v.name === speechSettings.voiceName
          );
          if (!found) {
            ElMessage.error(
              `所选语音 ${speechSettings.voiceName} 在阿里云列表中未找到，无法生成`
            );
            isGeneratingSpeech.value = false;
            return;
          }
          // Aliyun 真实使用的字段是 v.voice（如 "Cherry"），如果没有则fallback到 name
          voiceNameForApi = found.voice || found.name;
        }

        for (const translation of pendingTranslations.value) {
          let namingText = "";
          if (
            speechSettings.useContentFileName &&
            translation.fromTranscriptionId
          ) {
            const origin = transcriptions.value.find(
              (t) => t.id === translation.fromTranscriptionId
            );
            if (origin && origin.text) {
              namingText = origin.text;
            }
          }
          if (
            !namingText &&
            speechSettings.useContentFileName &&
            translation.text
          ) {
            namingText = translation.text;
          }

          const response = await fetch("/api/generate-speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              text: translation.text,
              targetLanguage: translation.language,
              voiceName: voiceNameForApi,
              model: speechSettings.model,
              transcriptionId: translation.id,
              paragraphInterval: speechSettings.enableParagraphInterval
                ? speechSettings.paragraphInterval
                : 0,
              skipTranslate: true,
              useContentFileName: speechSettings.useContentFileName,
              namingText
            })
          });
          if (!response.ok) {
            throw new Error(`语音生成失败: ${response.statusText}`);
          }

          const result = await response.json();

          let displayName = result.audioFileName;
          if (speechSettings.useContentFileName) {
            if (result.displayFileName && result.displayFileName.trim) {
              displayName = result.displayFileName;
            } else if (namingText) {
              let rawName = namingText.replace(/\s+/g, " ").trim();
              if (rawName.length > 50) {
                rawName = rawName.slice(0, 50);
              }
              rawName = rawName.replace(/[\\\/:*?"<>|]/g, "");
              if (rawName) {
                const dotIndex = result.audioFileName.lastIndexOf(".");
                const baseName =
                  dotIndex > 0
                    ? result.audioFileName.slice(0, dotIndex)
                    : result.audioFileName;
                const ext =
                  dotIndex > 0 ? result.audioFileName.slice(dotIndex) : ".wav";
                displayName = `${baseName}_${rawName}${ext}`;
              }
            }
          }

          addAudio(
            result.audioFileName,
            translation.source,
            translation.language,
            displayName
          );
        }

        ElMessage.success(
          `语音生成完成！共生成 ${pendingTranslations.value.length} 个语音文件`
        );
        speechDialogVisible.value = false;
        pendingTranslations.value = [];
      } catch (error) {
        console.error("语音生成失败:", error);
        ElMessage.error(`语音生成失败: ${error.message}`);
      } finally {
        isGeneratingSpeech.value = false;
      }
    };

    // 音频管理方法
    const addAudio = (fileName, source, language, displayName) => {
      audioList.value.push({
        id: generateId(),
        fileName: fileName,
        source: source,
        language: language,
        displayName: displayName || fileName,
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
        currentPlayingAudio.value = "";
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
            audioElement.play().catch((error) => {
              console.error("音频播放失败:", error);
              ElMessage.error("音频播放失败，请检查文件是否存在");
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
        audioProgress.value =
          (audioElement.currentTime / audioElement.duration) * 100;
      }
    };

    const onAudioEnded = () => {
      currentPlayingAudio.value = "";
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
        const refName = "audioPlayer" + index;
        return audioRefs.value[refName];
      }
      return null;
    };

    const formatTime = (seconds) => {
      if (!seconds || isNaN(seconds)) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatDuration = (seconds) => {
      return formatTime(seconds);
    };

    const downloadAudio = async (fileName, downloadName) => {
      try {
        // 使用fetch API下载文件，适合HTTPS环境
        const response = await fetch(
          `/api/download-audio/${encodeURIComponent(fileName)}`,
          {
            method: "GET",
            credentials: "same-origin", // 包含同源凭证
            headers: {
              Accept: "audio/*,*/*"
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            `下载失败: ${response.status} ${response.statusText}`
          );
        }

        // 获取文件blob
        const blob = await response.blob();

        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadName || fileName;
        link.style.display = "none";

        // 添加到DOM并触发下载
        document.body.appendChild(link);
        link.click();

        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        ElMessage.success("下载成功！");
      } catch (error) {
        console.error("音频下载失败:", error);
        ElMessage.error(`音频下载失败: ${error.message}`);

        // 如果新方法失败，尝试传统方法作为备用
        try {
          const link = document.createElement("a");
          link.href = `/api/download-audio/${encodeURIComponent(fileName)}`;
          link.download = downloadName || fileName;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (fallbackError) {
          console.error("备用下载方法也失败:", fallbackError);
          ElMessage.error("下载失败，请检查网络连接状况");
        }
      }
    };

    const removeAudio = async (index) => {
      try {
        await ElMessageBox.confirm("确定要删除这个音频文件吗？", "确认删除", {
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          type: "warning"
        });
        audioList.value.splice(index, 1);
        updateSelectAllAudio();
        ElMessage.success("音频删除成功");
      } catch (error) {
        // 用户取消操作
      }
    };

    // 批量删除选中的音频
    const deleteSelectedAudios = async () => {
      const selected = selectedAudios.value;
      if (selected.length === 0) {
        ElMessage.warning("请先选择要删除的音频文件");
        return;
      }

      try {
        await ElMessageBox.confirm(
          `确定要删除选中的 ${selected.length} 个音频文件吗？`,
          "确认删除",
          {
            confirmButtonText: "删除",
            cancelButtonText: "取消",
            type: "warning"
          }
        );

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
        ElMessage.success("内容已复制到剪贴板");
      } catch (error) {
        ElMessage.error(error + "复制失败");
      }
    };

    const downloadText = (text, filename) => {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    };

    // 批量下载选中的翻译为单一TXT（格式：语言代码一行，文本一行）
    const downloadSelectedTranslationsAsTxt = () => {
      const selected = selectedTranslations.value;
      if (selected.length === 0) {
        ElMessage.warning("请选择要下载的翻译文本");
        return;
      }
      const lines = [];
      selected.forEach((item) => {
        const code = (
          (item.language && String(item.language)) ||
          detectLanguageCode(item.text) ||
          "US"
        ).toLowerCase();
        const text = (item.text || "").trim();
        lines.push(code);
        lines.push(text);
        lines.push(""); // 分隔空行
      });
      const content = lines.join("\n");
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const filename = `${yyyy}${mm}${dd}.txt`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      ElMessage.success("TXT 已生成并开始下载");
    };

    const clearAllData = async () => {
      try {
        await ElMessageBox.confirm(
          "确定要清空所有数据吗？这将删除所有视频、文案、翻译和音频数据。",
          "确认清空",
          {
            confirmButtonText: "清空",
            cancelButtonText: "取消",
            type: "warning"
          }
        );

        selectedVideos.value = [];
        transcriptions.value = [];
        translations.value = [];
        audioList.value = [];
        selectAll.value = false;
        selectAllTranscriptions.value = false;
        selectAllAudio.value = false;
        currentPlayingAudio.value = "";

        ElMessage.success("所有数据已清空");
      } catch (error) {
        // 用户取消操作
      }
    };

    // 生命周期
    onMounted(() => {
      console.log("视频转录智能处理平台已启动");

      // 检查服务器健康状态
      checkServerHealth();

      // 获取语言配置（默认使用 google）
      fetchSupportedLanguages();

      // 仅在挂载时加载所有模型的语音选项缓存（后续切换只在缓存间切换）
      voicesLoadedPromise = loadAllVoiceOptions();
    });

    const checkServerHealth = async () => {
      try {
        const response = await fetch("/api/health");
        if (response.ok) {
          console.log("服务器连接正常");
        } else {
          ElMessage.warning("服务器连接异常");
        }
      } catch (error) {
        console.error("服务器连接失败:", error);
        ElMessage.error("无法连接到服务器，请检查服务器是否正常运行");
      }
    };

    // 获取用于“翻译选择（固定为 Google）”的语言列表
    const fetchSupportedLanguages = async (model = "google") => {
      try {
        // 强制使用 google，确保新增翻译时语言选项始终为谷歌列表
        const response = await fetch(
          `/api/supported-languages?model=${encodeURIComponent("google")}`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // 后端返回的是 { code, name } 数组
            availableLanguages.value = (result.languages || []).map((l) => ({
              code: l.code,
              name: l.name
            }));
            console.log(
              "翻译语言配置（Google）获取成功:",
              availableLanguages.value
            );
          } else {
            console.error("获取语言配置失败:", result.error);
            ElMessage.error("获取语言配置失败");
          }
        } else {
          throw new Error("服务器响应错误");
        }
      } catch (error) {
        console.error("获取语言配置失败:", error);
        ElMessage.error("获取语言配置失败");
      }
    };

    // 获取用于 TTS / 模型校验的语言列表（随模型变化）
    // 增加缓存：挂载时一次性预加载 Google/aliyun 两套语言，后续切换直接从缓存使用
    const availableTTSLanguagesCache = reactive({
      google: [],
      aliyun: []
    });

    const fetchModelLanguages = async (model = "google") => {
      const key = model === "aliyun" || model === "ali" ? "aliyun" : "google";
      // 如果挂载时的加载尚未完成，等待其完成
      if (voicesLoadedPromise) {
        await voicesLoadedPromise;
      }
      // 优先使用缓存
      if (
        availableTTSLanguagesCache[key] &&
        availableTTSLanguagesCache[key].length > 0
      ) {
        availableTTSLanguages.value = availableTTSLanguagesCache[key];
        console.log(
          `模型语言配置（来自缓存 ${key}）:`,
          availableTTSLanguages.value
        );
        return;
      }

      // 缓存不存在时回退到网络请求并写入缓存
      try {
        const response = await fetch(
          `/api/supported-languages?model=${encodeURIComponent(model)}`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const mapped = (result.languages || []).map((l) => ({
              code: l.code,
              name: l.name
            }));
            availableTTSLanguagesCache[key] = mapped;
            availableTTSLanguages.value = mapped;
            console.log("模型语言配置获取成功:", availableTTSLanguages.value);
          } else {
            console.error("获取语言配置失败:", result.error);
            ElMessage.error("获取语言配置失败");
          }
        } else {
          throw new Error("服务器响应错误");
        }
      } catch (error) {
        console.error("获取语言配置失败:", error);
        ElMessage.error("获取语言配置失败");
      }
    };

    // 获取可用的语音选项
    // 语音选项缓存，挂载时一次性加载所有模型的选项，后续切换仅在缓存间切换
    const availableVoicesCache = reactive({
      google: [],
      aliyun: []
    });
    // 挂载时的加载 Promise（用于在加载未完成时等待）
    let voicesLoadedPromise = null;

    const mapVoiceItems = (items) =>
      (items || []).map((v) => {
        return {
          name: v.name,
          description: v.description || "",
          displayName:
            v.displayName ||
            `${v.name || v.voice || v.id}${
              v.description ? " - " + v.description : ""
            }`,
          auditionAudio: v.auditionAudio || v.sampleUrl || null,
          voice: v.voice
        };
      });

    // 从缓存中切换到指定模型的语音列表（不做网络请求）
    const fetchVoiceOptions = async (model = "google") => {
      // 如果挂载时的加载尚未完成，等待其完成
      if (voicesLoadedPromise) {
        await voicesLoadedPromise;
      }
      const key = model === "aliyun" || model === "ali" ? "aliyun" : "google";
      availableVoices.value = availableVoicesCache[key] || [];
      if (availableVoices.value.length > 0 && !speechSettings.voiceName) {
        speechSettings.voiceName = availableVoices.value[0].name;
      }
      return;
    };

    // 在挂载时调用一次，异步并行拉取 google 与 aliyun 的语音选项，填充缓存
    const loadAllVoiceOptions = async () => {
      try {
        const [respGoogle, respAliyun] = await Promise.all([
          fetch(`/api/voice-options?model=${encodeURIComponent("google")}`),
          fetch(`/api/voice-options?model=${encodeURIComponent("aliyun")}`)
        ]);

        if (respGoogle.ok) {
          const result = await respGoogle.json();
          if (result.success) {
            availableVoicesCache.google = mapVoiceItems(result.voices || []);
          } else {
            console.error("获取 Google 语音选项失败:", result.error);
          }
        } else {
          console.error("获取 Google 语音选项服务器响应错误");
        }

        if (respAliyun.ok) {
          const result = await respAliyun.json();
          if (result.success) {
            // 阿里云返回格式可能已包含 name/voice/auditionAudio 等，复用 mapVoiceItems 保持兼容
            availableVoicesCache.aliyun = mapVoiceItems(result.voices || []);
          } else {
            console.error("获取 Aliyun 语音选项失败:", result.error);
          }
        } else {
          console.error("获取 Aliyun 语音选项服务器响应错误");
        }

        // 并行拉取对应模型的语言列表（用于 TTS/校验），写入缓存
        try {
          const [langGoogleResp, langAliyunResp] = await Promise.all([
            fetch(
              `/api/supported-languages?model=${encodeURIComponent("google")}`
            ),
            fetch(
              `/api/supported-languages?model=${encodeURIComponent("aliyun")}`
            )
          ]);

          if (langGoogleResp.ok) {
            const r = await langGoogleResp.json();
            if (r.success) {
              availableTTSLanguagesCache.google = (r.languages || []).map(
                (l) => ({ code: l.code, name: l.name })
              );
            } else {
              console.error("获取 Google 语言列表失败:", r.error);
            }
          } else {
            console.error("获取 Google 语言列表服务器响应错误");
          }

          if (langAliyunResp.ok) {
            const r = await langAliyunResp.json();
            if (r.success) {
              availableTTSLanguagesCache.aliyun = (r.languages || []).map(
                (l) => ({ code: l.code, name: l.name })
              );
            } else {
              console.error("获取 Aliyun 语言列表失败:", r.error);
            }
          } else {
            console.error("获取 Aliyun 语言列表服务器响应错误");
          }
        } catch (langErr) {
          console.error("并行拉取模型语言列表失败:", langErr);
        }

        // 根据当前模型初始化显示列表与模型语言
        const initialKey =
          speechSettings.model === "aliyun" ? "aliyun" : "google";
        availableVoices.value = availableVoicesCache[initialKey] || [];
        availableTTSLanguages.value =
          availableTTSLanguagesCache[initialKey] || [];
        if (availableVoices.value.length > 0 && !speechSettings.voiceName) {
          speechSettings.voiceName = availableVoices.value[0].name;
        }
        console.log("语音选项缓存加载完成", availableVoicesCache);
      } catch (error) {
        console.error("加载语音选项失败:", error);
        ElMessage.error("获取语音选项失败，将使用默认选项");
        availableVoices.value = [];
        speechSettings.voiceName = "Kore";
      }
    };

    // 当对话内模型变更时，刷新语音与语言列表
    watch(
      () => speechSettings.model,
      (newModel) => {
        // 切换模型时只刷新语音与模型语言（翻译下拉保持为 Google 列表）
        fetchVoiceOptions(newModel);
        fetchModelLanguages(newModel);
        // 清空已选择语音，等待新列表加载
        speechSettings.voiceName = "";
      }
    );

    // 语音试听功能
    const playVoiceSample = async () => {
      if (!speechSettings.voiceName) {
        ElMessage.warning("请先选择语音类型");
        return;
      }

      // 如果正在播放，先停止当前播放（但继续执行播放新的试音）
      if (isPlayingVoiceSample.value) {
        stopVoiceSample();
      }

      // 设置加载指示（短时显示），实际播放期间不保持 loading，这样按钮在播放时仍可点击
      voiceSampleLoading.value = true;

      try {
        // 停止并清理当前播放的音频（冗余保护）
        if (voiceSampleAudio.value) {
          try {
            voiceSampleAudio.value.pause();
          } catch (e) {}
          voiceSampleAudio.value = null;
        }

        // 创建音频元素并设置源
        const audio = new Audio();
        audio.src = `/api/voice-sample/${encodeURIComponent(
          speechSettings.voiceName
        )}?model=${encodeURIComponent(speechSettings.model)}`;
        audio.volume = 0.7;

        // 事件监听器
        audio.onloadeddata = () => {
          console.log("语音样本加载完成");
        };

        audio.onplay = () => {
          console.log("开始播放语音样本");
        };

        audio.onended = () => {
          console.log("语音样本播放结束");
          isPlayingVoiceSample.value = false;
          voiceSampleAudio.value = null;
        };

        audio.onerror = (error) => {
          console.error("语音样本播放失败:", error);
          ElMessage.error("语音样本播放失败，请检查网络连接");
          isPlayingVoiceSample.value = false;
          voiceSampleAudio.value = null;
        };

        voiceSampleAudio.value = audio;

        // 尝试播放
        await audio.play();
        // 标记播放中状态，但不作为按钮 loading 的绑定，以允许再次点击覆盖
        isPlayingVoiceSample.value = true;
        ElMessage.success(`正在播放 ${speechSettings.voiceName} 语音样本`);
      } catch (error) {
        console.error("播放语音样本失败:", error);
        ElMessage.error("播放语音样本失败，请稍后重试");
        isPlayingVoiceSample.value = false;
        voiceSampleAudio.value = null;
      } finally {
        // 取消短时加载指示
        voiceSampleLoading.value = false;
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
      voiceSampleLoading,
      selectAll,
      selectAllTranscriptions,
      selectAllAudio,
      availableLanguages,
      manualTranslationDialogVisible,
      manualTranslationForm,
      availableTTSLanguages,
      fetchModelLanguages,
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
      addManualTranslation,
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
      confirmAddManualTranslation,
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
      downloadSelectedTranslationsAsTxt,
      clearAllData,
      playVoiceSample,
      stopVoiceSample,
      fetchSupportedLanguages
    };
  }
});

// 注册 Element Plus 图标
app.component("VideoPlay", VideoPlay);
app.component("VideoPause", VideoPause);
app.component("Upload", Upload);
app.component("UploadFilled", UploadFilled);
app.component("VideoCamera", VideoCamera);
app.component("Close", Close);
app.component("Play", Play);
app.component("Document", Document);
app.component("Sort", Sort);
app.component("Plus", Plus);
app.component("CopyDocument", CopyDocument);
app.component("Download", Download);
app.component("Delete", Delete);
app.component("ChatDotSquare", ChatDotSquare);
app.component("Microphone", Microphone);
app.component("Headphone", Headphone);
app.component("Volume", Volume);

// 使用 Element Plus
app.use(ElementPlus, {
  locale: ElementPlusLocaleZhCn
});

// 挂载应用
app.mount("#app");
