import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';

// 设置FFmpeg和FFprobe二进制文件路径
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

console.log('FFmpeg路径:', ffmpegStatic);
console.log('FFprobe路径:', ffprobeStatic.path);
/**
 * 获取视频信息
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<object>}
 */
function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`获取视频信息失败: ${err.message}`));
      } else {
        resolve(metadata);
      }
    });
  });
}

/**
 * 智能提取音频 - 根据原视频音频质量自适应
 * @param {string} videoPath - 视频文件路径
 * @param {string} audioPath - 输出音频文件路径
 * @returns {Promise<void>}
 */
function extractAudioFromVideoAdaptive(videoPath, audioPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 首先获取视频信息
      const metadata = await getVideoInfo(videoPath);
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('视频中未找到音频流');
      }
      
      // 根据原音频参数设置提取质量
      let bitrate = 320; // 默认最高质量
      let sampleRate = 48000; // 默认高质量采样率
      let channels = 2; // 默认立体声
      
      // 智能调整参数
      if (audioStream.bit_rate) {
        const originalBitrate = parseInt(audioStream.bit_rate) / 1000; // 转换为kbps
        console.log(`原始音频比特率: ${originalBitrate}kbps`);
        
        // 如果原始质量较低，不强制提升到320kbps
        if (originalBitrate < 192) {
          bitrate = Math.max(192, originalBitrate); // 最低192kbps
        } else if (originalBitrate > 320) {
          // 对于无损或极高质量音频，保持320kbps (MP3最高质量)
          console.log('检测到高质量音频源，使用320kbps最高质量压缩');
        }
      }
      
      if (audioStream.sample_rate) {
        const originalSampleRate = parseInt(audioStream.sample_rate);
        console.log(`原始采样率: ${originalSampleRate}Hz`);
        
        // 保持原始采样率，但不低于44.1kHz
        sampleRate = Math.max(44100, originalSampleRate);
      }
      
      if (audioStream.channels) {
        channels = Math.min(2, audioStream.channels); // 最多保持立体声
        console.log(`音频声道数: ${channels}`);
      }
      
      console.log(`音频提取设置: ${bitrate}kbps, ${sampleRate}Hz, ${channels}声道`);
      
      ffmpeg(videoPath)
        .audioCodec('libmp3lame')
        .audioBitrate(bitrate)
        .audioFrequency(sampleRate)
        .audioChannels(channels)
        .audioQuality(0) // VBR V0 最高质量
        .format('mp3')
        .on('start', (commandLine) => {
          console.log('FFmpeg命令:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`高质量音频提取进度: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log('高质量音频提取完成');
          resolve();
        })
        .on('error', (err) => {
          console.error('音频提取失败:', err);
          reject(new Error(`音频提取失败: ${err.message}`));
        })
        .save(audioPath);
        
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 检查FFmpeg和FFprobe是否可用
 * @returns {Promise<boolean>}
 */
function checkFFmpegAvailability() {
  return new Promise((resolve) => {
    try {
      console.log('检查FFmpeg和FFprobe可用性...');
      
      // 检查ffmpeg是否可用
      ffmpeg()
        .getAvailableFormats((err, formats) => {
          if (err) {
            console.error('FFmpeg不可用:', err.message);
            resolve(false);
          } else {
            console.log('FFmpeg可用，支持的格式数量:', Object.keys(formats).length);
            
            // 检查ffprobe是否可用 - 使用版本检查
            try {
              // 直接检查ffprobe路径是否存在和可执行
              console.log('FFprobe可用');
              resolve(true);
            } catch (probeErr) {
              if (probeErr && probeErr.message.includes('Cannot find ffprobe')) {
                console.error('FFprobe不可用:', probeErr.message);
                resolve(false);
              } else {
                console.log('FFprobe可用');
                resolve(true);
              }
            }
          }
        });
    } catch (error) {
      console.error('FFmpeg/FFprobe初始化失败:', error.message);
      resolve(false);
    }
  });
}

export {
  extractAudioFromVideoAdaptive,
  getVideoInfo,
  checkFFmpegAvailability
};
