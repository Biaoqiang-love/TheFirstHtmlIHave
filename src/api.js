const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredBaseUrl
  ? configuredBaseUrl.replace(/\/$/, '')
  : null;

export const TERMINAL_JOB_STATUSES = new Set([
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
]);

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR' } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new ApiRequestError(
      '当前构建没有配置后端地址，请使用演示模式或设置 VITE_API_BASE_URL。',
      { code: 'API_NOT_CONFIGURED' },
    );
  }
  return API_BASE_URL;
}

export function resolveApiUrl(pathOrUrl) {
  if (!pathOrUrl) throw new ApiRequestError('后端没有返回可用的接口地址。');
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${requireApiBaseUrl()}/`).toString();
}

export function resolveArtifactUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^(https?:|blob:|data:)/i.test(pathOrUrl)) return pathOrUrl;
  return resolveApiUrl(pathOrUrl);
}

async function fetchJson(pathOrUrl, options = {}) {
  let response;
  try {
    response = await fetch(resolveApiUrl(pathOrUrl), {
      credentials: 'omit',
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    throw new ApiRequestError(
      `无法连接本地后端（${requireApiBaseUrl()}），请先运行 web_backend\\run_local.bat。`,
      { code: 'NETWORK_ERROR' },
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiRequestError(
      body?.detail || body?.message || `后端请求失败（HTTP ${response.status}）。`,
      { status: response.status, code: body?.code || 'HTTP_ERROR' },
    );
  }
  return body;
}

export async function createJob(uploads, runtimeConfig = { processingMode: 'DIRECT' }) {
  const body = new FormData();
  uploads.forEach(({ file, name }) => {
    body.append('files', file, file.name);
    body.append('relativePaths', name);
  });
  body.append('processingMode', runtimeConfig.processingMode || 'DIRECT');
  if (runtimeConfig.processingMode === 'AI') {
    body.append('aiBaseUrl', runtimeConfig.aiBaseUrl);
    body.append('aiApiKey', runtimeConfig.aiApiKey);
    body.append('aiModel', runtimeConfig.aiModel);
  }
  return fetchJson('/api/jobs', { method: 'POST', body });
}

export function getJob(jobOrId) {
  const path = typeof jobOrId === 'object'
    ? `/api/jobs/${jobOrId.id}`
    : `/api/jobs/${jobOrId}`;
  return fetchJson(path);
}

export function getSamples(job) {
  return fetchJson(job.samplesUrl || `/api/jobs/${job.id}/samples`);
}

export function isTerminalJob(job) {
  return Boolean(job && TERMINAL_JOB_STATUSES.has(job.status));
}

export function openJobEvents(job, handlers = {}) {
  const source = new EventSource(resolveApiUrl(job.eventsUrl || `/api/jobs/${job.id}/events`));
  const eventNames = [
    'job.snapshot',
    'job.updated',
    'sample.updated',
    'job.completed',
    'job.failed',
    'stream.reset',
  ];

  eventNames.forEach((eventName) => {
    source.addEventListener(eventName, (event) => {
      try {
        handlers.onEvent?.(eventName, JSON.parse(event.data));
      } catch {
        handlers.onMalformedEvent?.(eventName);
      }
    });
  });
  source.onopen = () => handlers.onOpen?.();
  source.onerror = () => handlers.onError?.();
  return source;
}
