'use strict';
// 可配置模型适配器：OpenAI 兼容 Chat Completions。
// 视觉模型：图片→结构化现象；本地检索条款（模型只给候选 ID，程序补入真实条文）。
// 纯文本模型：仅基于用户文字描述辅助，明确不声称看过照片。
// 无接口：由前端走带标签的演示案例或人工记录，本模块不伪装识别结果。
const config = require('./config');
const reference = require('./reference');

function status() {
  return {
    mode: config.model.mode, // vision | text | demo
    configured: config.model.configured,
    model: config.model.configured ? config.model.name : '',
    vision: config.model.supportsVision,
    note: config.model.configured
      ? (config.model.supportsVision
        ? `已接入视觉模型 ${config.model.name}`
        : `已接入文本模型 ${config.model.name}（未确认图片能力，按“基于文字描述”处理）`)
      : '未配置模型接口：使用演示案例与人工记录，所有模拟结果均有标注。'
  };
}

function buildCatalogText() {
  return reference.compactCatalog().map((c) =>
    `- issueId=${c.issueId}｜${c.category}｜${c.title}：${c.description}｜候选条款ID: ${c.clauseIds.join('、') || '无'}`
  ).join('\n');
}

const SYSTEM_PROMPT = `你是无障碍督导辅助助手。根据用户提供的照片或文字，输出严格的 JSON（不要输出 JSON 以外的内容，不要用代码块包裹）。
字段要求：
{
  "issueId": "最匹配的一个常见问题 ID（必须来自目录，没有把握时给空字符串）",
  "title": "12-30字的记录标题",
  "observations": ["照片中直接可见的现象，2-4条，只写看得到的事实，不写推测数值"],
  "impacts": "可能影响谁、为什么影响通行，80-160字",
  "boundary": "信息边界：仅凭这张照片无法确认的内容，40-100字",
  "candidateClauseIds": ["与现象最相关的条款ID，只能从目录给出的候选ID中挑选，1-3个"],
  "evidenceNeeded": ["具体的补拍/测量/确认动作，3-5条，每条可执行"]
}
规则：
1. 精确宽度、坡度、开门力、防滑性能、画面外是否有替代入口，禁止凭照片断言，写入 boundary 并在 evidenceNeeded 中给出测量动作。
2. 不得编造目录之外的条款 ID；不确定就给空数组。
3. 不输出置信度百分比，不给出是否合规的最终结论。
常见问题目录：
${buildCatalogText()}`;

function extractJson(text) {
  if (!text) throw new Error('模型返回为空');
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('模型未返回 JSON 结构');
  return JSON.parse(t.slice(start, end + 1));
}

function capStr(v, n) {
  return String(v == null ? '' : v).slice(0, n);
}

function normObservations(v) {
  const arr = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
  return arr.map((x) => capStr(x, 200)).filter(Boolean).slice(0, 6);
}

function normEvidence(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => capStr(x, 200)).filter(Boolean).slice(0, 6);
}

function normClauseIds(v) {
  const arr = Array.isArray(v) ? v : [];
  const valid = [];
  const seen = new Set();
  for (const raw of arr) {
    const id = capStr(raw, 40);
    const m = id.match(/^(gb55019|gb50763|sjg103)-(.+)$/);
    if (!m || seen.has(id)) continue;
    seen.add(id);
    if (reference.resolveClause(m[1], m[2])) valid.push(id);
  }
  return valid.slice(0, 3);
}

/** 调用 Chat Completions，超时 + 一次重试 */
async function callChat(messages) {
  const url = config.model.baseUrl + '/chat/completions';
  const body = {
    model: config.model.name,
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };
  const doFetch = async (attempt) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.model.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.model.apiKey}`
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const e = new Error(`接口返回 HTTP ${res.status}：${errText.slice(0, 200)}`);
        e.statusCode = 502;
        e.noRetry = res.status >= 400 && res.status < 500 && res.status !== 429;
        throw e;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('接口返回中没有 choices[0].message.content');
      return content;
    } catch (err) {
      if (err.name === 'AbortError') err.message = `模型请求超时（${config.model.timeoutMs}ms）`;
      err.attempt = attempt;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await doFetch(1);
  } catch (err) {
    if (err.noRetry) throw err;
    await new Promise((r) => setTimeout(r, 800));
    return doFetch(2);
  }
}

function shapeResult(parsed, mode, imageProvided) {
  const observations = normObservations(parsed.observations);
  const evidenceNeeded = normEvidence(parsed.evidenceNeeded);
  if (!observations.length) {
    const e = new Error('模型返回缺少必要字段：observations');
    e.statusCode = 502;
    throw e;
  }
  const candidateClauseIds = normClauseIds(parsed.candidateClauseIds);
  const { clauses, missing } = reference.resolveClauseRefs(
    candidateClauseIds.map((id) => {
      const [standardId, clauseNumber] = id.split(/-(.+)/);
      return { standardId, clauseNumber };
    })
  );
  const issue = reference.getIssue(capStr(parsed.issueId, 40));
  return {
    mode,
    model: config.model.name,
    basedOnTextOnly: mode === 'text',
    imageAnalyzed: imageProvided && mode === 'vision',
    issueId: issue ? issue.id : '',
    category: issue ? issue.category : '',
    title: capStr(parsed.title, 60) || (issue ? issue.title : ''),
    observations,
    impacts: capStr(parsed.impacts, 600),
    boundary: capStr(parsed.boundary, 400),
    clauses,
    unresolvedClauseIds: missing, // 模型给了但资料库中找不到的 ID（透明展示）
    evidenceNeeded: evidenceNeeded.length ? evidenceNeeded : (issue ? issue.checkPoints : []),
    at: new Date().toISOString()
  };
}

/**
 * 分析入口
 * payload: { demoCaseId?, imageDataUrl?, mimeType?, description? }
 */
async function analyze(payload) {
  // 1) 演示案例：返回预设分析（明确标注，不伪装模型识别）
  if (payload.demoCaseId) {
    const demo = reference.getDemoCase(String(payload.demoCaseId));
    if (!demo) {
      const e = new Error('演示案例不存在');
      e.statusCode = 404;
      throw e;
    }
    const { clauses, missing } = reference.resolveClauseRefs(demo.clauseRefs);
    const issue = reference.getIssue(demo.issueId);
    return {
      mode: 'demo',
      model: '',
      demoCaseId: demo.id,
      issueId: demo.issueId,
      category: issue ? issue.category : '',
      title: demo.title,
      observations: demo.observations,
      impacts: demo.impacts,
      boundary: demo.boundary,
      clauses,
      unresolvedClauseIds: missing,
      evidenceNeeded: demo.evidenceNeeded,
      plain: demo.plain,
      at: new Date().toISOString()
    };
  }

  const imageProvided = typeof payload.imageDataUrl === 'string' &&
    payload.imageDataUrl.startsWith('data:image/') &&
    payload.imageDataUrl.length > 100;
  const description = capStr(payload.description, 1000);

  // 2) 视觉模型
  if (imageProvided && config.model.supportsVision) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请分析这张无障碍现场照片。' + (description ? `用户补充描述：${description}` : '') },
          { type: 'image_url', image_url: { url: payload.imageDataUrl, detail: 'high' } }
        ]
      }
    ];
    const content = await callChat(messages);
    return shapeResult(extractJson(content), 'vision', true);
  }

  // 3) 纯文本模型（有文字描述时）
  if (config.model.configured && description) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `注意：你看不到任何照片，只能根据以下用户文字描述提供辅助分析，并在 boundary 中写明“基于文字描述，未查看照片”。\n用户描述：${description}` }
    ];
    const content = await callChat(messages);
    return shapeResult(extractJson(content), 'text', false);
  }

  // 4) 无可用能力：明确告知，前端引导走演示/人工流程
  return {
    mode: 'unavailable',
    model: config.model.configured ? config.model.name : '',
    vision: config.model.supportsVision,
    reason: imageProvided
      ? '当前未配置支持图片的模型，不能对上传图片进行识别。可改用演示案例体验完整流程，或在下方人工填写现象与类型。'
      : '未配置模型接口或未填写现象描述。可选择演示案例，或直接人工填写记录。',
    issueId: '',
    observations: [],
    impacts: '',
    boundary: '',
    clauses: [],
    evidenceNeeded: [],
    at: new Date().toISOString()
  };
}

module.exports = { status, analyze };
