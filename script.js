const STORAGE_KEY = 'backgroundRemoverConfig';
const HISTORY_KEY = 'backgroundRemoverHistory';

const DEFAULT_CONFIG = {
    general: {
        includeSubfolders: false,
        concurrency: 1,
        outputFormat: 'png',
        fileNameStrategy: 'suffix',
        autoStart: false
    },
    providers: {
        removeBg: { enabled: false, apiKey: '', size: 'auto', channel: 'foreground' },
        tongyi: { enabled: false, apiKey: '', model: 'wanx-image-editing-v1' },
        photoroom: { enabled: false, apiKey: '', background: 'ffffff' },
        openai: { enabled: false, apiKey: '', model: 'gpt-image-1' },
        gemini: { enabled: false, apiKey: '', model: 'imageinpainting-001' }
    }
};

const PROVIDERS = {
    removeBg: {
        id: 'removeBg',
        name: 'Remove.bg',
        description: '经典的背景去除服务，支持 PNG/JPG 输入，输出透明背景，可设置背景颜色。',
        docs: 'https://www.remove.bg/api',
        meta: ['原生白底参数', '支持 25MB 以下图片'],
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '输入 remove.bg API Key' },
            { key: 'size', label: '输出尺寸', type: 'select', options: [
                { label: '自动 (auto)', value: 'auto' },
                { label: '4K (4k)', value: '4k' },
                { label: '普通 (regular)', value: 'regular' }
            ] },
            { key: 'channel', label: '保留通道', type: 'select', options: [
                { label: '仅前景 (foreground)', value: 'foreground' },
                { label: '抠出主体 (alpha)', value: 'alpha' }
            ] }
        ],
        async process(file, config, context) {
            if (!config.apiKey) {
                throw new Error('未配置 Remove.bg API Key');
            }
            const formData = new FormData();
            formData.append('image_file', file, file.name);
            formData.append('size', config.size || 'auto');
            formData.append('type', 'auto');
            formData.append('bg_color', context.outputFormat === 'jpg' ? 'ffffff' : 'ffffff00');
            formData.append('channels', config.channel || 'foreground');

            const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: {
                    'X-Api-Key': config.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await safeReadText(response);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const blob = await response.blob();
            return ensureOutputFormat(blob, context.outputFormat);
        }
    },
    tongyi: {
        id: 'tongyi',
        name: '通义千问 Image-Edit',
        description: '阿里通义千问图像编辑接口，可对图片进行抠图、换底等操作。',
        docs: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details-for-image-editing',
        meta: ['需开通 DashScope', '建议 10MB 以下'],
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '输入 DashScope API Key' },
            { key: 'model', label: '模型', type: 'text', placeholder: '默认 wanx-image-editing-v1' }
        ],
        async process(file, config, context) {
            if (!config.apiKey) {
                throw new Error('未配置通义千问 API Key');
            }
            const formData = new FormData();
            formData.append('model', config.model || 'wanx-image-editing-v1');
            formData.append('image', file, file.name);
            formData.append('prompt', 'Remove the background and replace it with a solid pure white background.');

            const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/images/edits', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await safeReadText(response);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const base64 = data?.data?.[0]?.b64_json;
            if (!base64) {
                throw new Error('通义接口未返回图像数据');
            }
            const blob = base64ToBlob(base64, 'image/png');
            return ensureOutputFormat(blob, context.outputFormat);
        }
    },
    photoroom: {
        id: 'photoroom',
        name: 'PhotoRoom API',
        description: 'PhotoRoom 背景分割接口，可直接返回纯色背景图。',
        docs: 'https://docs.photoroom.com/reference/remove-background',
        meta: ['支持 URL 与文件', '最高 10MB'],
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '输入 PhotoRoom API Key' },
            { key: 'background', label: '背景颜色', type: 'text', placeholder: '默认 ffffff' }
        ],
        async process(file, config, context) {
            if (!config.apiKey) {
                throw new Error('未配置 PhotoRoom API Key');
            }
            const formData = new FormData();
            formData.append('image_file', file, file.name);
            formData.append('background', context.outputFormat === 'png' ? 'ffffff' : (config.background || 'ffffff'));
            formData.append('format', context.outputFormat === 'png' ? 'png' : 'jpeg');

            const response = await fetch('https://sdk.photoroom.com/v1/segment', {
                method: 'POST',
                headers: {
                    'X-Api-Key': config.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await safeReadText(response);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const blob = await response.blob();
            return ensureOutputFormat(blob, context.outputFormat);
        }
    },
    openai: {
        id: 'openai',
        name: 'OpenAI 图像编辑 (GPT)',
        description: '调用 OpenAI 图像生成/编辑接口，根据提示生成白色背景版本。',
        docs: 'https://platform.openai.com/docs/guides/images',
        meta: ['需 GPT-Image 权限', '自动生成 PNG'],
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '输入 OpenAI API Key' },
            { key: 'model', label: '模型', type: 'text', placeholder: '默认 gpt-image-1' }
        ],
        async process(file, config, context) {
            if (!config.apiKey) {
                throw new Error('未配置 OpenAI API Key');
            }
            const base64Image = await blobToBase64(file);
            const payload = {
                model: config.model || 'gpt-image-1',
                input: [
                    {
                        role: 'user',
                        content: [
                            { type: 'input_text', text: 'Remove the background of this product photo and replace it with a pure white studio background.' },
                            { type: 'input_image', image_base64: base64Image }
                        ]
                    }
                ],
                response_format: { type: 'base64_image', detail: 'high' }
            };

            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await safeReadText(response);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const base64 = data?.output?.[0]?.content?.find?.(item => item.type === 'output_image')?.image_base64
                || data?.output?.[0]?.content?.[0]?.image_base64;
            if (!base64) {
                throw new Error('OpenAI 未返回图像数据');
            }
            const blob = base64ToBlob(base64, 'image/png');
            return ensureOutputFormat(blob, context.outputFormat);
        }
    },
    gemini: {
        id: 'gemini',
        name: 'Google Gemini Image Edit',
        description: '使用 Google Gemini 图像修复/抠图接口，为商品图生成白底版本。',
        docs: 'https://ai.google.dev/api/rest/v1beta/models',
        meta: ['需启用生成式 AI', '支持 4K 以内'],
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '输入 Google API Key' },
            { key: 'model', label: '模型', type: 'text', placeholder: '默认 imageinpainting-001' }
        ],
        async process(file, config, context) {
            if (!config.apiKey) {
                throw new Error('未配置 Google API Key');
            }
            const base64Image = await blobToBase64(file, 'data_url');
            const payload = {
                prompt: {
                    text: 'Remove the background of this image and ensure the subject is on a pure white background.'
                },
                image: base64Image
            };
            const model = config.model || 'imageinpainting-001';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage?key=${config.apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await safeReadText(response);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const base64 = data?.images?.[0]?.base64 || data?.candidates?.[0]?.content?.parts?.find?.(p => p.inline_data)?.inline_data?.data;
            if (!base64) {
                throw new Error('Gemini 接口未返回图像数据');
            }
            const blob = base64ToBlob(base64, 'image/png');
            return ensureOutputFormat(blob, context.outputFormat);
        }
    }
};

const state = {
    config: loadConfig(),
    files: [],
    sourceDirHandle: null,
    outputDirHandle: null,
    isProcessing: false,
    stopRequested: false,
    completed: 0,
    totalTasks: 0,
    resultPreviews: [],
    history: loadHistory()
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheElements();
    updateSupportWarning();
    renderProviders();
    renderHistorySummary();
    bindEvents();
    applyGeneralConfig();
    updateSelectedProvidersSummary();
}

function cacheElements() {
    elements.supportWarning = document.getElementById('supportWarning');
    elements.providerList = document.getElementById('providerList');
    elements.selectedProvidersSummary = document.getElementById('selectedProvidersSummary');
    elements.pickSourceBtn = document.getElementById('pickSourceBtn');
    elements.pickOutputBtn = document.getElementById('pickOutputBtn');
    elements.includeSubfolders = document.getElementById('includeSubfolders');
    elements.fileCountLabel = document.getElementById('fileCountLabel');
    elements.pathInfo = document.getElementById('pathInfo');
    elements.startBtn = document.getElementById('startBtn');
    elements.stopBtn = document.getElementById('stopBtn');
    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.progressLabel = document.getElementById('progressLabel');
    elements.processingWarning = document.getElementById('processingWarning');
    elements.fileTableBody = document.getElementById('fileTableBody');
    elements.resultGrid = document.getElementById('resultGrid');
    elements.resultSummary = document.getElementById('resultSummary');
    elements.clearResultsBtn = document.getElementById('clearResultsBtn');
    elements.logOutput = document.getElementById('logOutput');
    elements.copyLogBtn = document.getElementById('copyLogBtn');
    elements.saveConfigBtn = document.getElementById('saveConfigBtn');
    elements.resetConfigBtn = document.getElementById('resetConfigBtn');
    elements.concurrencyInput = document.getElementById('concurrencyInput');
    elements.outputFormat = document.getElementById('outputFormat');
    elements.fileNameStrategy = document.getElementById('fileNameStrategy');
    elements.autoStartToggle = document.getElementById('autoStartToggle');
    elements.progressLabel = document.getElementById('progressLabel');
}

function bindEvents() {
    elements.pickSourceBtn.addEventListener('click', selectSourceDirectory);
    elements.pickOutputBtn.addEventListener('click', selectOutputDirectory);
    elements.includeSubfolders.addEventListener('change', () => {
        state.config.general.includeSubfolders = elements.includeSubfolders.checked;
        saveConfig();
    });
    elements.concurrencyInput.addEventListener('change', () => {
        const value = clamp(parseInt(elements.concurrencyInput.value, 10) || 1, 1, 5);
        elements.concurrencyInput.value = value;
        state.config.general.concurrency = value;
        saveConfig();
    });
    elements.outputFormat.addEventListener('change', () => {
        state.config.general.outputFormat = elements.outputFormat.value;
        saveConfig();
    });
    elements.fileNameStrategy.addEventListener('change', () => {
        state.config.general.fileNameStrategy = elements.fileNameStrategy.value;
        saveConfig();
    });
    elements.autoStartToggle.addEventListener('change', () => {
        state.config.general.autoStart = elements.autoStartToggle.checked;
        saveConfig();
    });
    elements.refreshBtn.addEventListener('click', rescanFiles);
    elements.startBtn.addEventListener('click', startProcessing);
    elements.stopBtn.addEventListener('click', stopProcessing);
    elements.clearResultsBtn.addEventListener('click', clearResults);
    elements.copyLogBtn.addEventListener('click', copyLogToClipboard);
    elements.saveConfigBtn.addEventListener('click', () => {
        saveConfig(true);
        appendLog('配置已保存。', 'success');
    });
    elements.resetConfigBtn.addEventListener('click', resetConfig);
}

function applyGeneralConfig() {
    elements.includeSubfolders.checked = !!state.config.general.includeSubfolders;
    elements.concurrencyInput.value = state.config.general.concurrency;
    elements.outputFormat.value = state.config.general.outputFormat;
    elements.fileNameStrategy.value = state.config.general.fileNameStrategy;
    elements.autoStartToggle.checked = !!state.config.general.autoStart;
}

function renderProviders() {
    const template = document.getElementById('providerTemplate');
    elements.providerList.innerHTML = '';

    Object.values(PROVIDERS).forEach(provider => {
        const config = state.config.providers[provider.id] || {};
        const node = template.content.cloneNode(true);
        const card = node.querySelector('.provider-card');
        card.dataset.provider = provider.id;
        card.querySelector('h3').textContent = provider.name;
        card.querySelector('.provider-desc').textContent = provider.description;
        card.querySelector('.provider-doc').href = provider.docs;

        const metaList = card.querySelector('.provider-meta');
        metaList.innerHTML = '';
        provider.meta.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            metaList.appendChild(li);
        });

        const toggle = card.querySelector('.provider-toggle');
        toggle.checked = !!config.enabled;
        toggle.addEventListener('change', () => {
            state.config.providers[provider.id] = {
                ...DEFAULT_CONFIG.providers[provider.id],
                ...state.config.providers[provider.id],
                enabled: toggle.checked
            };
            updateProviderStatusForFiles(provider.id, toggle.checked);
            updateSelectedProvidersSummary();
            saveConfig();
            renderFileTable();
        });

        const fieldsContainer = card.querySelector('.provider-fields');
        fieldsContainer.innerHTML = '';
        provider.fields.forEach(field => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-group';
            const label = document.createElement('label');
            label.textContent = field.label;
            wrapper.appendChild(label);

            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    input.appendChild(option);
                });
                input.value = config[field.key] || field.options?.[0]?.value || '';
            } else {
                input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
                input.type = field.type === 'password' ? 'password' : (field.type || 'text');
                input.placeholder = field.placeholder || '';
                input.value = config[field.key] || '';
                if (field.type === 'password') {
                    input.autocomplete = 'off';
                }
            }
            input.dataset.provider = provider.id;
            input.dataset.field = field.key;
            input.addEventListener('change', handleProviderFieldChange);
            wrapper.appendChild(input);
            fieldsContainer.appendChild(wrapper);
        });

        elements.providerList.appendChild(node);
    });
}

function handleProviderFieldChange(event) {
    const input = event.target;
    const providerId = input.dataset.provider;
    const fieldKey = input.dataset.field;
    const providerConfig = {
        ...DEFAULT_CONFIG.providers[providerId],
        ...state.config.providers[providerId]
    };
    providerConfig[fieldKey] = input.value;
    state.config.providers[providerId] = providerConfig;
    saveConfig();
}

function updateSupportWarning() {
    if (!window.showDirectoryPicker) {
        elements.supportWarning.innerHTML = '<h2>浏览器不支持</h2><p>当前浏览器不支持 File System Access API。请使用最新版本的 Chrome、Edge 或其他 Chromium 浏览器。</p>';
        elements.supportWarning.classList.add('card-error');
        disableControls();
    } else {
        elements.supportWarning.innerHTML = '<h2>浏览器兼容性正常</h2><p>可以使用 File System Access API 访问本地文件。首次选择文件夹时需要授权。</p>';
    }
}

function disableControls() {
    [elements.pickSourceBtn, elements.pickOutputBtn, elements.startBtn, elements.refreshBtn].forEach(btn => {
        btn.disabled = true;
    });
}

async function selectSourceDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        if (!await ensurePermission(handle, 'read')) {
            appendLog('未授予读取权限，无法访问该文件夹。', 'error');
            return;
        }
        state.sourceDirHandle = handle;
        appendLog(`已选择源文件夹：${handle.name}`, 'info');
        await loadFilesFromDirectory();
        updatePathInfo();
        if (state.config.general.autoStart && state.outputDirHandle) {
            startProcessing();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            appendLog(`选择源文件夹失败：${error.message}`, 'error');
        }
    }
}

async function selectOutputDirectory() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (!await ensurePermission(handle, 'readwrite')) {
            appendLog('未授予写入权限，无法使用该输出文件夹。', 'error');
            return;
        }
        state.outputDirHandle = handle;
        appendLog(`已选择输出文件夹：${handle.name}`, 'info');
        updatePathInfo();
        if (state.config.general.autoStart && state.sourceDirHandle) {
            startProcessing();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            appendLog(`选择输出文件夹失败：${error.message}`, 'error');
        }
    }
}

function updatePathInfo() {
    const parts = [];
    if (state.sourceDirHandle) {
        parts.push(`源：<strong>${escapeHtml(state.sourceDirHandle.name)}</strong>`);
    }
    if (state.outputDirHandle) {
        parts.push(`输出：<strong>${escapeHtml(state.outputDirHandle.name)}</strong>`);
    }
    elements.pathInfo.innerHTML = parts.length ? parts.join(' ｜ ') : '';
}

async function loadFilesFromDirectory() {
    if (!state.sourceDirHandle) return;

    elements.fileTableBody.innerHTML = '<tr><td colspan="4">正在扫描文件，请稍候…</td></tr>';
    const includeSubfolders = !!state.config.general.includeSubfolders;
    const files = [];

    async function traverseDirectory(handle, path = '') {
        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                if (!isSupportedImage(entry.name)) continue;
                const file = await entry.getFile();
                files.push({
                    handle: entry,
                    name: entry.name,
                    size: file.size,
                    type: file.type,
                    relativePath: path ? `${path}/${entry.name}` : entry.name,
                    providerStatuses: createProviderStatusMap(),
                    outputs: []
                });
            } else if (entry.kind === 'directory' && includeSubfolders) {
                await traverseDirectory(entry, path ? `${path}/${entry.name}` : entry.name);
            }
        }
    }

    await traverseDirectory(state.sourceDirHandle);
    state.files = files.sort((a, b) => a.name.localeCompare(b.name));
    state.completed = 0;
    updateFileCountLabel();
    renderFileTable();
    elements.progressLabel.textContent = '等待开始';
    appendLog(`扫描完成，共发现 ${files.length} 张图片。`, 'success');
}

function rescanFiles() {
    if (!state.sourceDirHandle) {
        appendLog('请先选择源文件夹。', 'warning');
        return;
    }
    loadFilesFromDirectory();
}

function createProviderStatusMap() {
    const map = {};
    Object.entries(state.config.providers).forEach(([key, value]) => {
        if (value?.enabled) {
            map[key] = { status: 'waiting', message: '' };
        }
    });
    return map;
}

function updateProviderStatusForFiles(providerId, enabled) {
    state.files.forEach(file => {
        if (enabled) {
            file.providerStatuses[providerId] = { status: 'waiting', message: '' };
        } else {
            delete file.providerStatuses[providerId];
        }
    });
}

function renderFileTable() {
    const tbody = elements.fileTableBody;
    tbody.innerHTML = '';
    if (state.files.length === 0) {
        const row = document.createElement('tr');
        row.className = 'empty-row';
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = '尚未选择文件夹或没有符合要求的图片文件。';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    state.files.forEach(file => {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        nameCell.textContent = file.relativePath || file.name;
        row.appendChild(nameCell);

        const sizeCell = document.createElement('td');
        sizeCell.textContent = formatFileSize(file.size);
        row.appendChild(sizeCell);

        const statusCell = document.createElement('td');
        statusCell.appendChild(renderStatusPills(file));
        row.appendChild(statusCell);

        const outputCell = document.createElement('td');
        outputCell.innerHTML = file.outputs.map(o => `<div>${escapeHtml(o)}</div>`).join('');
        row.appendChild(outputCell);

        tbody.appendChild(row);
    });
}

function renderStatusPills(file) {
    const container = document.createElement('div');
    const providers = Object.keys(file.providerStatuses);
    if (providers.length === 0) {
        const span = document.createElement('span');
        span.className = 'status-pill status-waiting';
        span.textContent = '未选择提供商';
        container.appendChild(span);
        return container;
    }
    providers.forEach(id => {
        const info = file.providerStatuses[id];
        const provider = PROVIDERS[id];
        if (!provider) return;
        const span = document.createElement('span');
        span.className = `status-pill ${statusClass(info.status)}`;
        span.textContent = `${provider.name}：${statusLabel(info.status)}`;
        span.title = info.message || '';
        container.appendChild(span);
    });
    return container;
}

function statusClass(status) {
    switch (status) {
        case 'processing':
            return 'status-processing';
        case 'success':
            return 'status-success';
        case 'error':
            return 'status-error';
        default:
            return 'status-waiting';
    }
}

function statusLabel(status) {
    switch (status) {
        case 'processing':
            return '处理中';
        case 'success':
            return '已完成';
        case 'error':
            return '失败';
        case 'skipped':
            return '已跳过';
        default:
            return '待开始';
    }
}

function updateFileCountLabel() {
    const count = state.files.length;
    elements.fileCountLabel.textContent = count ? `共 ${count} 张图片` : '未加载图片';
}

function getSelectedProviders() {
    return Object.entries(state.config.providers)
        .filter(([, value]) => value?.enabled)
        .map(([key]) => key);
}

function updateSelectedProvidersSummary() {
    const enabledProviders = getSelectedProviders();
    elements.selectedProvidersSummary.textContent = enabledProviders.length
        ? `已启用 ${enabledProviders.length} 个服务`
        : '未启用任何服务';
}

async function startProcessing() {
    if (state.isProcessing) {
        elements.processingWarning.hidden = false;
        return;
    }
    elements.processingWarning.hidden = true;

    if (!state.sourceDirHandle) {
        appendLog('请先选择源文件夹。', 'warning');
        return;
    }
    if (!state.outputDirHandle) {
        appendLog('请先选择输出文件夹。', 'warning');
        return;
    }

    const providers = getSelectedProviders();
    if (providers.length === 0) {
        appendLog('请至少启用一个背景去除服务。', 'warning');
        return;
    }

    if (!await ensurePermission(state.sourceDirHandle, 'read')) {
        appendLog('源文件夹读取权限已失效，请重新授权。', 'error');
        return;
    }
    if (!await ensurePermission(state.outputDirHandle, 'readwrite')) {
        appendLog('输出文件夹写入权限已失效，请重新授权。', 'error');
        return;
    }

    if (state.files.length === 0) {
        appendLog('没有可处理的图片。', 'warning');
        return;
    }

    state.stopRequested = false;
    state.isProcessing = true;
    state.completed = 0;
    toggleProcessingButtons(true);
    appendLog(`开始处理，共 ${state.files.length} 张图片。`, 'info');
    const queue = state.files.filter(file => Object.keys(file.providerStatuses).length > 0);
    const total = queue.length;
    if (total === 0) {
        appendLog('未找到启用服务的图片任务。', 'warning');
        state.isProcessing = false;
        toggleProcessingButtons(false);
        return;
    }

    state.totalTasks = total;
    updateProgress(0, state.totalTasks);

    let index = 0;
    const concurrency = clamp(state.config.general.concurrency, 1, 5);

    const workers = Array.from({ length: concurrency }, (_, workerIndex) => (async () => {
        while (!state.stopRequested) {
            const currentIndex = index;
            if (currentIndex >= total) break;
            index += 1;
            const file = queue[currentIndex];
            await processSingleFile(file, providers);
        }
    })());

    await Promise.all(workers);

    if (state.stopRequested) {
        appendLog('任务已被手动终止。', 'warning');
    } else {
        appendLog('全部任务处理完成。', 'success');
    }

    state.isProcessing = false;
    state.stopRequested = false;
    toggleProcessingButtons(false);
    renderFileTable();
}

function stopProcessing() {
    if (!state.isProcessing) return;
    state.stopRequested = true;
    appendLog('正在停止当前任务，请稍候…', 'warning');
}

async function processSingleFile(file, providers) {
    const fileName = file.relativePath || file.name;
    const context = {
        outputFormat: state.config.general.outputFormat,
        fileNameStrategy: state.config.general.fileNameStrategy
    };
    let hasSuccess = false;
    try {
        const originalFile = await file.handle.getFile();
        for (const providerId of providers) {
            if (state.stopRequested) {
                updateProviderStatus(file, providerId, 'skipped', '任务已停止');
                continue;
            }
            if (!file.providerStatuses[providerId]) {
                continue;
            }
            updateProviderStatus(file, providerId, 'processing');
            const provider = PROVIDERS[providerId];
            try {
                const config = state.config.providers[providerId];
                const blob = await provider.process(originalFile, config, context);
                const savedName = await saveResult(blob, file, providerId);
                if (!file.outputs.includes(savedName)) {
                    file.outputs.push(savedName);
                }
                updateProviderStatus(file, providerId, 'success', `输出文件：${savedName}`);
                appendLog(`[${provider.name}] ${fileName} 处理完成，输出 ${savedName}`, 'success');
                hasSuccess = true;
                addResultPreview(file, providerId, blob, savedName);
                persistHistoryEntry({
                    providerId,
                    providerName: provider.name,
                    original: fileName,
                    output: savedName,
                    timestamp: Date.now()
                });
            } catch (error) {
                updateProviderStatus(file, providerId, 'error', error.message);
                appendLog(`[${provider.name}] ${fileName} 处理失败：${error.message}`, 'error');
            }
            renderFileTable();
        }
    } catch (error) {
        appendLog(`读取文件 ${fileName} 时出错：${error.message}`, 'error');
        providers.forEach(providerId => updateProviderStatus(file, providerId, 'error', '读取失败'));
    } finally {
        state.completed += 1;
        updateProgress(state.completed, state.files.length);
        if (!hasSuccess) {
            // remove outputs appended due to previous runs when rerun? keep existing
        }
    }
}

function updateProviderStatus(file, providerId, status, message = '') {
    if (!file.providerStatuses[providerId]) return;
    file.providerStatuses[providerId].status = status;
    file.providerStatuses[providerId].message = message;
}

function updateProgress(done, totalOverride) {
    const total = totalOverride || state.totalTasks || state.files.length || 1;
    elements.progressLabel.textContent = `进度：${done} / ${total}`;
}

async function saveResult(blob, file, providerId) {
    if (!state.outputDirHandle) {
        throw new Error('未选择输出目录');
    }
    const provider = PROVIDERS[providerId];
    const baseName = file.name.replace(/\.[^.]+$/, '');
    let fileName;
    if (state.config.general.fileNameStrategy === 'folder') {
        const folderHandle = await state.outputDirHandle.getDirectoryHandle(providerId, { create: true });
        fileName = `${baseName}.${state.config.general.outputFormat}`;
        await writeFile(folderHandle, fileName, blob);
        return `${provider.name}/${fileName}`;
    }
    fileName = `${baseName}_${providerId}.${state.config.general.outputFormat}`;
    await writeFile(state.outputDirHandle, fileName, blob);
    return fileName;
}

async function writeFile(directoryHandle, fileName, blob) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

function addResultPreview(file, providerId, blob, savedName) {
    const url = URL.createObjectURL(blob);
    state.resultPreviews.push(url);
    elements.resultGrid.classList.remove('empty');
    const card = document.createElement('div');
    card.className = 'result-card';
    const provider = PROVIDERS[providerId];
    card.innerHTML = `
        <img src="${url}" alt="${escapeHtml(savedName)}" />
        <h4>${escapeHtml(provider.name)}</h4>
        <span>${escapeHtml(savedName)}</span>
    `;
    const link = document.createElement('a');
    link.href = url;
    link.download = savedName;
    link.textContent = '下载';
    link.className = 'download-link';
    card.appendChild(link);
    elements.resultGrid.appendChild(card);
    updateResultSummary();
}

function clearResults() {
    state.resultPreviews.forEach(url => URL.revokeObjectURL(url));
    state.resultPreviews = [];
    elements.resultGrid.innerHTML = '<div class="empty-placeholder">处理完成后将在此展示缩略图。</div>';
    elements.resultGrid.classList.add('empty');
    updateResultSummary();
}

function updateResultSummary() {
    const count = elements.resultGrid.classList.contains('empty') ? 0 : elements.resultGrid.querySelectorAll('.result-card').length;
    const historyCount = state.history.length;
    if (count === 0 && historyCount === 0) {
        elements.resultSummary.textContent = '暂无结果';
    } else if (count === 0) {
        elements.resultSummary.textContent = `历史共 ${historyCount} 条记录`;
    } else {
        elements.resultSummary.textContent = `本次生成 ${count} 张 ｜ 历史累计 ${historyCount} 条`;
    }
}

function renderHistorySummary() {
    updateResultSummary();
}

function appendLog(message, level = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${level}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
    elements.logOutput.appendChild(line);
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
}

async function copyLogToClipboard() {
    const text = Array.from(elements.logOutput.children).map(node => node.textContent).join('\n');
    try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            throw new Error('浏览器不支持 Clipboard API');
        }
        await navigator.clipboard.writeText(text);
        appendLog('日志已复制到剪贴板。', 'success');
    } catch (error) {
        appendLog(`复制日志失败：${error.message}`, 'error');
    }
}

function toggleProcessingButtons(isProcessing) {
    elements.startBtn.disabled = isProcessing;
    elements.stopBtn.disabled = !isProcessing;
}

function loadConfig() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (!stored) return cloneDeep(DEFAULT_CONFIG);
        return deepMerge(cloneDeep(DEFAULT_CONFIG), stored);
    } catch (error) {
        console.warn('读取配置失败，使用默认配置。', error);
        return cloneDeep(DEFAULT_CONFIG);
    }
}

function saveConfig(showToast = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    if (showToast) {
        appendLog('配置已保存至本地浏览器。', 'info');
    }
}

function resetConfig() {
    if (!confirm('确定要恢复默认配置吗？该操作不会删除历史任务记录。')) {
        return;
    }
    state.config = cloneDeep(DEFAULT_CONFIG);
    saveConfig();
    state.files.forEach(file => {
        file.providerStatuses = {};
        file.outputs = [];
    });
    renderProviders();
    applyGeneralConfig();
    renderFileTable();
    updateSelectedProvidersSummary();
    appendLog('已恢复默认配置。', 'warning');
}

function deepMerge(target, source) {
    Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            target[key] = source[key];
        }
    });
    return target;
}

function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function formatFileSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isSupportedImage(name) {
    return /\.(png|jpg|jpeg|webp)$/i.test(name);
}

async function ensurePermission(handle, mode) {
    if (!handle) return false;
    if (handle.queryPermission) {
        const query = await handle.queryPermission({ mode });
        if (query === 'granted') return true;
    }
    if (handle.requestPermission) {
        const request = await handle.requestPermission({ mode });
        return request === 'granted';
    }
    return true;
}

async function safeReadText(response) {
    try {
        return await response.text();
    } catch (error) {
        return '无法读取错误信息';
    }
}

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"]+/g, s => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    })[s] || s);
}

async function blobToBase64(blob, mode = 'raw') {
    const arrayBuffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);
    return mode === 'data_url' ? `data:${blob.type || 'image/png'};base64,${base64}` : base64;
}

function base64ToBlob(base64, mime = 'image/png') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

async function ensureOutputFormat(blob, format) {
    if (format === 'png') return blob;
    if (format === 'jpg' || format === 'jpeg') {
        return await convertToJpeg(blob);
    }
    return blob;
}

async function convertToJpeg(blob) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('浏览器不支持画布转换');
    }

    if (window.createImageBitmap) {
        const bitmap = await createImageBitmap(blob);
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
    } else {
        const image = await blobToImage(blob);
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
    }

    const newBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
    if (!newBlob) {
        throw new Error('JPG 转换失败');
    }
    return newBlob;
}

function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (error) {
        console.warn('读取历史记录失败：', error);
        return [];
    }
}

function persistHistoryEntry(entry) {
    state.history.push(entry);
    if (state.history.length > 200) {
        state.history.splice(0, state.history.length - 200);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    updateResultSummary();
}

window.addEventListener('beforeunload', () => {
    state.resultPreviews.forEach(url => URL.revokeObjectURL(url));
});
