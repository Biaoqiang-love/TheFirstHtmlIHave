# MolWeave 后端 API 契约 v1

状态：Phase 1 已完成  
版本：`1.0.0`  
更新日期：2026-08-20  
配套机器可读规范：[`openapi-v1.yaml`](./openapi-v1.yaml)

## 1. 范围与设计结论

本契约只定义 GitHub Pages 前端与独立 Python 后端之间的边界，不实现后端，也不修改 `pb_3`。

- 前端继续作为静态站点部署在 `https://biaoqiang-love.github.io/TheFirstHtmlIHave/`。
- API 部署在可运行 MolScribe、RDKit、Stage A 和 Stage B 的独立服务器上，本文用 `https://api.example.com` 代指其 origin。
- PNG/JPG 直接进入 Stage A；PDF 先经 Stage B 裁成分子 PNG，再逐张进入 Stage A。
- JSON 字段统一使用 `camelCase`，以贴近当前 `src/mockPipeline.js` 的数据形状。
- `QWEN_API_KEY`、模型路径、服务器文件路径和内部日志绝不出现在浏览器请求、API 响应或 SSE 数据中。
- v1 只定义创建与读取，不包含取消、重试、人工批准和导出接口。

四个端点如下：

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/jobs` | 上传一个批次并创建异步任务 |
| `GET` | `/api/jobs/{jobId}` | 获取批次状态和汇总进度 |
| `GET` | `/api/jobs/{jobId}/events` | 通过 SSE 接收任务与逐样本更新 |
| `GET` | `/api/jobs/{jobId}/samples` | 获取当前全部样本结果 |

## 2. 通用规则

### 2.1 标识、时间与空值

- `jobId`、`sampleId` 和事件 `id` 都是不透明、全局唯一、不可猜测的字符串；客户端不得解析其内容。
- 时间使用 UTC RFC 3339，例如 `2026-08-20T08:12:31.482Z`。
- 尚未生成的结果使用 JSON `null`，不使用空字符串或占位文本。
- 所有响应使用 UTF-8。
- JSON 响应的 `Content-Type` 为 `application/json`；错误响应为 `application/problem+json`。
- API 版本通过 URL 外的契约版本管理；v1 内只做向后兼容的字段新增，不改变已有字段含义。

### 2.2 任务状态

`Job.status`：

| 值 | 含义 | 终态 |
|---|---|---|
| `QUEUED` | 已接收，等待工作进程 | 否 |
| `PROCESSING` | 至少一个输入或样本正在处理 | 否 |
| `COMPLETED` | 所有样本都到达样本终态，且没有 `FAILED` | 是 |
| `COMPLETED_WITH_ERRORS` | 所有样本都到达终态，但至少一个样本为 `FAILED` | 是 |
| `FAILED` | 任务级错误导致批次无法继续或没有形成任何样本 | 是 |

`REVIEW` 不是失败；只要没有样本 `FAILED`，包含 `REVIEW` 的批次仍是 `COMPLETED`。

### 2.3 样本状态

`Sample.status`：

| 值 | 含义 | 终态 | 可直接用于下游 |
|---|---|---|---|
| `PROCESSING` | 等待或正在运行某个阶段 | 否 | 否 |
| `PASS` | 完整自动校验通过 | 是 | 是 |
| `PROVISIONAL_PASS` | 结构可用，但不是完全验证的 PASS | 是 | 是，需保留标记 |
| `REVIEW` | 存在未解决风险，需要人工复核 | 是 | 否 |
| `FAILED` | 该样本未能形成可展示的完整结果 | 是 | 否 |

后端适配 `pb_3` 时必须做以下归一化：

- `PROVISIONAL` → `PROVISIONAL_PASS`
- `NOT_ASSESSED` → `REVIEW`；表示已有候选结构，但未取得可确认的视觉校验结论
- `pb_3` 异常或缺少必要产物 → `FAILED`

### 2.4 处理阶段

`currentStage` 和事件 `stage` 复用当前 mock 的五个 key：

| key | 前端标签 | 后端含义 |
|---|---|---|
| `input` | 输入已解析 | 文件校验、任务隔离；PDF 的 Stage B 页面渲染、检测和裁剪也在此阶段 |
| `recognition` | MolScribe 识别完成 | Stage A 初始结构识别与 RDKit parse/sanitize |
| `render` | RDKit 渲染完成 | 生成当前候选的 SVG/PNG 和 Molfile |
| `compare` | 视觉差异检查完成 | Qwen 盲审、图检查、Graph Patch/修正循环与复验 |
| `final` | 结果已生成 | 收集最终或复核产物并归一化状态与原因 |

`progress` 是 `0` 到 `100` 的整数，仅用于 UI 展示，不承诺线性反映耗时。样本到达任何终态时必须为 `100`。任务进度由后端汇总，不能由前端按已完成样本自行猜测。

## 3. 核心数据模型

### 3.1 Job

```json
{
  "id": "job_01K33EXAMPLE",
  "processingMode": "DIRECT",
  "status": "PROCESSING",
  "progress": 42,
  "currentStage": "compare",
  "totalInputs": 2,
  "totalSamples": 5,
  "completedSamples": 2,
  "statusCounts": {
    "processing": 3,
    "pass": 1,
    "provisionalPass": 0,
    "review": 1,
    "failed": 0
  },
  "createdAt": "2026-08-20T08:10:00.000Z",
  "startedAt": "2026-08-20T08:10:01.120Z",
  "finishedAt": null,
  "updatedAt": "2026-08-20T08:12:31.482Z",
  "expiresAt": "2026-08-21T08:10:00.000Z",
  "error": null,
  "eventsUrl": "/api/jobs/job_01K33EXAMPLE/events",
  "samplesUrl": "/api/jobs/job_01K33EXAMPLE/samples"
}
```

说明：

- PDF 裁剪结束前，`totalSamples` 可以为 `null`；PNG/JPG 输入可在创建时确定。
- `processingMode` 为 `DIRECT` 或 `AI`，表示本任务是否使用临时大模型配置。
- `completedSamples` 等于样本终态数量。
- `statusCounts` 的五个值之和在 `totalSamples` 已知时必须等于 `totalSamples`。
- `startedAt`、`finishedAt`、`currentStage` 和 `error` 可为 `null`。
- `error` 只用于任务级失败，结构见 3.4。
- `expiresAt` 表示上传文件和产物的最早清理时间；到期后服务端可返回 `410 Gone`。
- URL 可以是后端相对 URL，也可以是后端绝对 URL；相对 URL 必须以 `API_BASE_URL`（而不是 GitHub Pages 的 `window.location`）为基准解析。客户端不自行拼接资源文件路径。

### 3.2 Sample

```json
{
  "id": "sample_01K33EXAMPLE",
  "jobId": "job_01K33EXAMPLE",
  "index": 0,
  "name": "paper/page-0003-molecule-02.png",
  "type": "PDF",
  "status": "REVIEW",
  "progress": 100,
  "currentStage": "final",
  "smiles": "O=[N+]([O-])c1ccc(Cl)cc1",
  "molfile": "MolWeave\n  RDKit          2D\n...\nM  END\n",
  "previewUrl": "https://api.example.com/api/artifacts/.../source.png",
  "renderSvgUrl": "https://api.example.com/api/artifacts/.../rendered.svg",
  "renderPngUrl": "https://api.example.com/api/artifacts/.../rendered.png",
  "reason": "进入 REVIEW：涉及拓扑变化或高风险操作，必须人工确认。",
  "reasonCodes": ["high_risk_operations_pending_manual_review"],
  "safeForDownstream": false,
  "requiresHumanReview": true,
  "fullyVerified": false,
  "confidence": 0.88,
  "changed": true,
  "source": {
    "inputName": "paper.pdf",
    "relativePath": "papers/paper.pdf",
    "pageNumber": 3,
    "moleculeIndex": 2,
    "detectionConfidence": 0.96,
    "imageBbox": [118, 204, 892, 731],
    "pdfBbox": [59.0, 102.0, 446.0, 365.5]
  },
  "events": [
    {
      "id": "evt_01K33EXAMPLE",
      "type": "sample.updated",
      "jobId": "job_01K33EXAMPLE",
      "sampleId": "sample_01K33EXAMPLE",
      "stage": "final",
      "label": "结果已生成",
      "time": "2026-08-20T08:12:31.482Z"
    }
  ],
  "createdAt": "2026-08-20T08:10:03.000Z",
  "updatedAt": "2026-08-20T08:12:31.482Z"
}
```

字段约束：

- `index` 从 `0` 开始，在一个 job 内稳定，用于保持侧栏顺序。
- `name` 是 UI 展示名。直接图片沿用上传相对路径；PDF 样本使用稳定合成名。
- `type` 为 `PNG` 或 `PDF`。上传 JPG 时后端解码并规范为 PNG 样本，所以返回 `PNG`。
- `smiles`、`molfile`、`previewUrl`、`renderSvgUrl`、`renderPngUrl`、`reason`、`confidence` 在处理中或失败时允许为 `null`。
- `previewUrl` 对直接图片指向安全解码后的源图，对 PDF 指向 Stage B 裁剪图；不返回本地文件路径。
- SVG 通过 URL 返回，不把未经处理的 SVG XML 内嵌进 JSON。资源响应必须使用正确的 `Content-Type`，并防止脚本执行。
- `previewUrl`、`renderSvgUrl` 和 `renderPngUrl` 是不透明资源地址，可由后端或对象存储提供；它们不是新增的 JSON/SSE 业务接口。
- `reason` 是可直接展示的人类可读结论；`reasonCodes` 保留 `pb_3` 的稳定机器代码。
- `events` 按 `time` 升序，是该样本的审计事件。每个元素保留当前 mock 已使用的 `label` 和 `time`，并增加稳定字段。
- 直接图片的 `source.pageNumber`、`moleculeIndex`、检测置信度与 bbox 均为 `null`。

终态布尔值必须满足：

| status | safeForDownstream | requiresHumanReview | fullyVerified |
|---|---:|---:|---:|
| `PASS` | `true` | `false` | `true` |
| `PROVISIONAL_PASS` | `true` | `false` | `false` |
| `REVIEW` | `false` | `true` | `false` |
| `FAILED` | `false` | `false` | `false` |

`PROCESSING` 的三个布尔值均为 `false`。

### 3.3 AuditEvent

```json
{
  "id": "evt_01K33EXAMPLE",
  "type": "sample.updated",
  "jobId": "job_01K33EXAMPLE",
  "sampleId": "sample_01K33EXAMPLE",
  "stage": "render",
  "label": "RDKit 渲染完成",
  "time": "2026-08-20T08:11:19.004Z"
}
```

`sampleId` 和 `stage` 对任务级事件可为 `null`。`label` 是后端生成的可展示文本，不包含绝对路径、prompt、API key 或完整终端日志。

### 3.4 ApiError

任务内部记录和 HTTP Problem Details 都复用稳定错误码：

```json
{
  "code": "PIPELINE_FAILED",
  "message": "任务未能完成。",
  "retryable": true
}
```

`message` 可展示但不得泄露服务器内部信息。详细 traceback 只写后端日志，并用 `jobId`/`sampleId` 关联。

## 4. POST /api/jobs

上传文件并创建异步任务。

### 4.1 请求

```http
POST /api/jobs HTTP/1.1
Content-Type: multipart/form-data; boundary=...
Accept: application/json
```

multipart 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `files` | file[] | 是 | 重复同名 part；允许 PNG、JPEG、PDF，至少一个 |
| `relativePaths` | string[] | 否 | 重复同名文本 part，与 `files` 按顺序一一对应；来自 `webkitRelativePath` 或文件名 |
| `processingMode` | `DIRECT` / `AI` | 否 | 默认 `DIRECT`；直接识别渲染或启用大模型视觉校验与纠正 |
| `aiBaseUrl` | string | AI 时是 | OpenAI 兼容 API 根地址 |
| `aiApiKey` | string | AI 时是 | 仅用于本次任务的临时 Key，不得落盘或返回 |
| `aiModel` | string | AI 时是 | 本次任务使用的视觉模型名称 |

浏览器构造示例：

```js
const body = new FormData();
uploads.forEach(({ file, name }) => {
  body.append('files', file, file.name);
  body.append('relativePaths', name);
});
body.append('processingMode', 'DIRECT');

const response = await fetch(`${API_BASE_URL}/api/jobs`, {
  method: 'POST',
  body,
  credentials: 'omit',
});
```

规则：

- 不允许客户端传服务器路径或输出目录。
- `AI` 模式允许提交任务级临时模型配置。Key 只能短暂存在于后端内存和该任务子进程环境中，禁止写入 Job、Sample、事件、任务文件或日志；任务启动后从等待队列删除，结束后清理。后端重启导致临时 Key 丢失时必须安全失败，不能偷偷改用其他 Key。
- `DIRECT` 模式必须从任务子进程环境移除 `QWEN_API_KEY`，即使服务器自身配置了统一 Key 也不能调用大模型。
- 前端不得把临时 Key 写入源码、URL、localStorage、sessionStorage 或错误信息；提交成功后清空输入框。线上传输必须使用 HTTPS。
- 允许自定义 `aiBaseUrl` 的公开部署必须增加地址白名单或等价的 SSRF 防护；当前任意地址输入只适用于本地开发模式。
- 后端按文件内容和受支持 MIME 类型共同校验，不能只信扩展名或浏览器 MIME。
- 若传 `relativePaths`，数量必须和 `files` 相同。路径只用于展示和来源追踪，后端必须去除盘符、根路径和 `..`，不能直接作为落盘路径。
- 上传大小、单批文件数和并发限制由部署配置决定；超限使用下方稳定错误码。

### 4.2 成功响应

`202 Accepted`，响应体是完整 `Job`：

```http
HTTP/1.1 202 Accepted
Location: /api/jobs/job_01K33EXAMPLE
Content-Type: application/json
```

```json
{
  "id": "job_01K33EXAMPLE",
  "processingMode": "DIRECT",
  "status": "QUEUED",
  "progress": 0,
  "currentStage": null,
  "totalInputs": 2,
  "totalSamples": null,
  "completedSamples": 0,
  "statusCounts": {
    "processing": 0,
    "pass": 0,
    "provisionalPass": 0,
    "review": 0,
    "failed": 0
  },
  "createdAt": "2026-08-20T08:10:00.000Z",
  "startedAt": null,
  "finishedAt": null,
  "updatedAt": "2026-08-20T08:10:00.000Z",
  "expiresAt": "2026-08-21T08:10:00.000Z",
  "error": null,
  "eventsUrl": "/api/jobs/job_01K33EXAMPLE/events",
  "samplesUrl": "/api/jobs/job_01K33EXAMPLE/samples"
}
```

### 4.3 错误

| HTTP | code | 场景 |
|---:|---|---|
| 400 | `NO_FILES` | 没有文件 |
| 400 | `INVALID_RELATIVE_PATHS` | 路径数量不匹配或包含非法值 |
| 400 | `INVALID_AI_CONFIG` | AI 模式缺少地址、Key 或模型名称 |
| 400 | `INVALID_AI_ENDPOINT` | AI 地址格式不安全或不是 HTTP(S) 根地址 |
| 413 | `FILE_TOO_LARGE` | 单文件超限 |
| 413 | `JOB_TOO_LARGE` | 整批大小或文件数超限 |
| 415 | `UNSUPPORTED_FILE_TYPE` | 文件内容不是受支持的 PNG/JPEG/PDF |
| 429 | `SERVER_BUSY` | 并发队列已满；应带 `Retry-After` |
| 500 | `INTERNAL_ERROR` | 创建隔离任务失败 |

Problem Details 示例：

```json
{
  "type": "https://api.example.com/problems/unsupported-file-type",
  "title": "Unsupported file type",
  "status": 415,
  "detail": "只支持 PNG、JPG 和 PDF。",
  "code": "UNSUPPORTED_FILE_TYPE",
  "instance": "/api/jobs",
  "errors": [
    { "field": "files[1]", "message": "文件内容不是受支持的格式。" }
  ]
}
```

## 5. GET /api/jobs/{jobId}

返回任务的最新快照。

```http
GET /api/jobs/job_01K33EXAMPLE HTTP/1.1
Accept: application/json
```

### 成功响应

`200 OK`，响应体是完整 `Job`，不使用局部 patch。

建议后端返回 `ETag` 并支持 `If-None-Match`；未变化可返回 `304 Not Modified`。SSE 不可用时，前端可每 2 至 5 秒轮询此端点。

### 错误

| HTTP | code | 场景 |
|---:|---|---|
| 404 | `JOB_NOT_FOUND` | ID 不存在 |
| 410 | `JOB_EXPIRED` | 任务和产物已按保留策略清理 |

## 6. GET /api/jobs/{jobId}/samples

返回当前已发现的全部样本。处理中允许返回空数组或部分样本。

```http
GET /api/jobs/job_01K33EXAMPLE/samples HTTP/1.1
Accept: application/json
```

### 成功响应

```json
{
  "jobId": "job_01K33EXAMPLE",
  "samples": [
    { "id": "sample_01K33EXAMPLE", "jobId": "job_01K33EXAMPLE", "index": 0 }
  ],
  "count": 1,
  "updatedAt": "2026-08-20T08:12:31.482Z"
}
```

示例中的样本被截短；实际每项必须是 3.2 的完整 `Sample`。

规则：

- `samples` 始终按 `index` 升序。
- `count` 等于本响应 `samples.length`；它不一定等于任务最终 `totalSamples`。
- v1 不分页，以便前端可直接 `setSamples(data.samples)`。如果未来引入分页，必须作为新契约版本，不能悄悄改变此响应。
- 建议支持 `ETag` / `If-None-Match`，错误与任务查询相同。

## 7. GET /api/jobs/{jobId}/events（SSE）

### 7.1 建立连接

```http
GET /api/jobs/job_01K33EXAMPLE/events HTTP/1.1
Accept: text/event-stream
Cache-Control: no-cache
Last-Event-ID: evt_01K33PREVIOUS
```

成功响应：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

服务端和反向代理必须禁用缓冲与压缩聚合，及时 flush 每个事件。无业务事件时每 15 秒发送注释心跳：

```text
: heartbeat 2026-08-20T08:12:45.000Z

```

建议事件后发送 `retry: 3000`。浏览器自动重连时会携带最近的 `Last-Event-ID`；后端必须从该事件之后重放仍在保留窗口内的事件，确保至少一次投递。客户端按事件 `id` 去重。

### 7.2 事件类型

| SSE `event` | 用途 | 必带数据 |
|---|---|---|
| `job.snapshot` | 新连接的当前任务快照 | `job` |
| `job.updated` | 任务进度或状态变化 | `job` |
| `sample.updated` | 样本被发现、阶段变化或进入终态 | 完整 `sample` |
| `job.completed` | 任务到达 `COMPLETED` 或 `COMPLETED_WITH_ERRORS` | `job` |
| `job.failed` | 任务到达 `FAILED` | `job` |
| `stream.reset` | `Last-Event-ID` 太旧，无法重放 | 无；客户端重新 GET job 和 samples |

每个 `data` 都是一个完整 JSON 对象：

```json
{
  "id": "evt_01K33EXAMPLE",
  "type": "sample.updated",
  "jobId": "job_01K33EXAMPLE",
  "sampleId": "sample_01K33EXAMPLE",
  "stage": "render",
  "label": "RDKit 渲染完成",
  "time": "2026-08-20T08:11:19.004Z",
  "job": null,
  "sample": {
    "id": "sample_01K33EXAMPLE",
    "jobId": "job_01K33EXAMPLE",
    "index": 0,
    "status": "PROCESSING",
    "progress": 60,
    "currentStage": "render"
  }
}
```

示例中的 `sample` 被截短；实际 `sample.updated` 必须携带完整 `Sample`。这样事件是幂等的，前端按 `sample.id` 整项 upsert，无需解释 JSON Patch。

线上帧示例：

```text
id: evt_01K33EXAMPLE
event: sample.updated
retry: 3000
data: {"id":"evt_01K33EXAMPLE","type":"sample.updated","jobId":"job_01K33EXAMPLE","sampleId":"sample_01K33EXAMPLE","stage":"render","label":"RDKit 渲染完成","time":"2026-08-20T08:11:19.004Z","job":null,"sample":{...}}

```

当任务进入终态，服务端发送对应终态事件后可以关闭连接。客户端收到终态后主动 `close()`，再各 GET 一次 job 和 samples 作为最终一致性校验。

### 7.3 重连与错误

- 建立 SSE 前的 `404` / `410` 使用普通 Problem Details。
- 连接建立后的管线错误通过 `sample.updated`、`job.failed` 表达，不能尝试改写 HTTP 状态码。
- 网络断开不代表任务失败；前端保留当前状态并自动重连。
- 收到 `stream.reset` 后，前端关闭旧连接，重新 GET job/samples，再创建新连接且不传旧事件 ID。
- 因 `EventSource` 不能设置自定义请求头，v1 不依赖浏览器中保存的后端 secret，也不把任何 key 放进查询字符串。

## 8. 与 mockPipeline.js 的对齐

| 当前 mock 字段 | v1 API | Phase 3 接入方式 |
|---|---|---|
| `sample.id` | 同名同义 | 直接使用 |
| `name` | 同名同义 | 直接使用 |
| `type` | 同名；API 只返回 `PNG`/`PDF` | 直接使用 |
| `previewUrl` | 同名；从本地 blob URL 变为后端资源 URL | 直接使用；不再 `URL.revokeObjectURL` API URL |
| `status` | 保留 `PROCESSING/PASS/PROVISIONAL_PASS/REVIEW`，新增 `FAILED` | `StatusBadge` 增加失败标签 |
| `progress` | 同名同义 | 直接使用 |
| `currentStage` | 五个 key 完全一致 | 直接使用 |
| `smiles` | 同名；处理中可为 `null` | 展示空态，不能显示 mock 值 |
| `molfile` | 同名；处理中可为 `null` | 展示空态，不能显示 mock 值 |
| `reason` | 同名；处理中可为 `null` | 直接使用 |
| `events[].label` | 同名 | 直接使用 |
| `events[].time` | 同名，但改为 RFC 3339 | 前端格式化为“刚刚”或本地时间 |
| `sketch` | 不进入 API | 用 `renderSvgUrl` 替代示意 SVG |
| 无 | `source`、质量布尔值、`reasonCodes`、资源 URL | 为来源追踪、审计和真实渲染新增 |

推荐的 Phase 3 最小更新算法：

1. `POST /api/jobs` 后保存返回的 Job。
2. 立即 `GET job.samplesUrl`，执行 `setSamples(data.samples)`。
3. 连接 `job.eventsUrl`。
4. 收到 `sample.updated` 后按 `id` 替换或追加完整样本，并保持按 `index` 排序。
5. 收到 `job.updated` 替换 Job；`running = !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(job.status)`。
6. 终态后做一次 GET job/samples，关闭 SSE。

## 9. CORS、安全与资源交付

后端至少允许：

- 生产：`https://biaoqiang-love.github.io`
- 本地开发：明确配置的 Vite origin，例如 `http://localhost:5173`

不要使用同时带凭据的通配符 CORS。v1 浏览器请求采用 `credentials: omit`；生产认证和滥用防护在部署阶段单独确定，`jobId` 本身不是授权机制。

后端还必须遵守：

- `QWEN_API_KEY` 只从后端环境变量读取，不进入构建产物、响应、日志事件或 URL。
- 上传内容和产物放在 job 隔离目录，资源 URL 不暴露真实磁盘路径。
- 对文件名和相对路径做净化；不执行上传内容，不信任 SVG/PDF/图片声明。
- 资源 URL 随 `expiresAt` 失效；响应设置合适的 `Content-Type`、`X-Content-Type-Options: nosniff` 和缓存策略。
- 错误响应只给稳定错误码和安全消息；traceback、prompt、模型服务原始响应只留在受控后端日志。
- SSE 和普通 API 响应均设置 `Cache-Control: no-store` 或契约中指定的更严格策略，避免共享缓存泄露任务数据。

## 10. Phase 1 验收清单

- [x] 四个端点的请求、成功响应和错误响应已定义。
- [x] Job、Sample、事件、状态和阶段枚举已定义。
- [x] SSE 事件名、帧格式、心跳、重连、去重和终态行为已定义。
- [x] PNG/JPG 与 PDF → Stage B → Stage A 的来源字段已定义。
- [x] 与 `mockPipeline.js` 的字段映射已明确。
- [x] Qwen key、服务器路径和内部日志的安全边界已明确。
- [x] OpenAPI 3.1 机器可读规范已提供。

Phase 2 实现若发现 `pb_3` 产物无法满足某个必填字段，应先修改本契约版本或明确适配规则，不能在实现中静默改变响应形状。
