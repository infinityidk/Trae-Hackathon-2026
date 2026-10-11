'use strict';
// 极简 .env 加载（零依赖）。密钥只从环境变量/本地 .env 读取，不进前端与 Git。
const fs = require('fs');
const path = require('path');

(function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
})();

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  model: {
    baseUrl: (process.env.MODEL_BASE_URL || '').replace(/\/+$/, ''),
    name: process.env.MODEL_NAME || '',
    apiKey: process.env.MODEL_API_KEY || '',
    // true=视觉模型；false=仅文本；auto/其他=按仅文本处理（未确认不假定支持图片）
    vision: (process.env.MODEL_VISION || 'auto').toLowerCase(),
    timeoutMs: parseInt(process.env.MODEL_TIMEOUT_MS || '20000', 10)
  }
};

config.model.configured = Boolean(config.model.baseUrl && config.model.name && config.model.apiKey);
config.model.supportsVision = config.model.configured && config.model.vision === 'true';
config.model.mode = config.model.configured
  ? (config.model.supportsVision ? 'vision' : 'text')
  : 'demo';

module.exports = config;
