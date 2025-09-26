import { 
  generateSpeech, 
  getVoiceOptions, 
  validateTTSConfig 
} from './utils/geminiTTS.js';
import path from 'path';
import fs from 'fs-extra';

// 试音文本
const TEST_TEXT = "All is well";

// 输出目录
const OUTPUT_DIR = './soundcheck';

/**
 * 批量生成所有语音角色的试音音频
 */
async function generateAllVoiceSamples() {
  try {
    console.log('开始批量生成语音试音音频...');
    console.log(`试音文本: "${TEST_TEXT}"`);
    
    // 验证TTS配置
    const isValid = await validateTTSConfig();
    if (!isValid) {
      throw new Error('TTS配置验证失败');
    }
    
    // 确保输出目录存在
    await fs.ensureDir(OUTPUT_DIR);
    
    // 获取所有语音选项
    const voiceOptions = getVoiceOptions();
    console.log(`找到 ${voiceOptions.length} 个语音选项`);
    
    // 生成每个语音的试音音频
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < voiceOptions.length; i++) {
      const voice = voiceOptions[i];
      const outputPath = path.join(OUTPUT_DIR, `voice_sample_${voice}.wav`);
      
      try {
        console.log(`\n[${i + 1}/${voiceOptions.length}] 正在生成 ${voice} 语音试音...`);
        
        const result = await generateSpeech(TEST_TEXT, voice, outputPath);
        results.push({
          voice,
          status: 'success',
          filePath: result,
          error: null
        });
        successCount++;
        
        console.log(`✅ ${voice} 语音试音生成成功: ${result}`);
        
        // 添加延迟避免API限制
        if (i < voiceOptions.length - 1) {
          console.log('等待2秒避免API限制...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ ${voice} 语音试音生成失败:`, error.message);
        results.push({
          voice,
          status: 'error',
          filePath: null,
          error: error.message
        });
        errorCount++;
      }
    }
    
    // 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('批量生成完成！');
    console.log(`成功: ${successCount} 个`);
    console.log(`失败: ${errorCount} 个`);
    console.log(`总计: ${voiceOptions.length} 个`);
    
    // 保存结果报告
    const reportPath = path.join(OUTPUT_DIR, 'generation_report.json');
    await fs.writeJson(reportPath, {
      testText: TEST_TEXT,
      totalVoices: voiceOptions.length,
      successCount,
      errorCount,
      results,
      generatedAt: new Date().toISOString()
    }, { spaces: 2 });
    
    console.log(`\n结果报告已保存到: ${reportPath}`);
    
    // 列出成功的文件
    if (successCount > 0) {
      console.log('\n成功生成的音频文件:');
      results
        .filter(r => r.status === 'success')
        .forEach(r => console.log(`  - ${r.voice}: ${r.filePath}`));
    }
    
    // 列出失败的文件
    if (errorCount > 0) {
      console.log('\n生成失败的语音:');
      results
        .filter(r => r.status === 'error')
        .forEach(r => console.log(`  - ${r.voice}: ${r.error}`));
    }
    
  } catch (error) {
    console.error('批量生成过程中发生错误:', error);
    process.exit(1);
  }
}

/**
 * 生成指定语音的试音音频
 */
async function generateSingleVoiceSample(voiceName) {
  try {
    console.log(`正在生成 ${voiceName} 语音试音...`);
    
    const outputPath = path.join(OUTPUT_DIR, `voice_sample_${voiceName}.wav`);
    await fs.ensureDir(OUTPUT_DIR);
    
    const result = await generateSpeech(TEST_TEXT, voiceName, outputPath);
    console.log(`✅ 生成成功: ${result}`);
    
    return result;
  } catch (error) {
    console.error(`❌ 生成失败:`, error.message);
    throw error;
  }
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // 生成单个语音
    const voiceName = args[0];
    await generateSingleVoiceSample(voiceName);
  } else {
    // 生成所有语音
    await generateAllVoiceSamples();
  }
}

// 运行主程序
main().catch(console.error);
