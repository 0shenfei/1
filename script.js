// Supabase配置 - 请替换为您的实际配置
const SUPABASE_URL = 'https://afbdzfnmomhfnoivqedx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmR6Zm5tb21oZm5vaXZxZWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODMxNDUsImV4cCI6MjA2OTU1OTE0NX0.dwRHSAKUqQTCWCpgchi28vbB5v8uqpWlx43Q1YbXwI0';

// 初始化Supabase客户端
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase客户端初始化成功');
    console.log('📍 Supabase URL:', SUPABASE_URL);
    console.log('🔑 API Key前缀:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
    
    // 测试连接
    testSupabaseConnection();
} catch (error) {
    console.log('❌ Supabase未配置，使用本地存储模式');
    console.error('错误详情:', error);
}

// 测试Supabase连接
async function testSupabaseConnection() {
    try {
        console.log('🔍 正在测试Supabase连接...');
        
        // 测试数据库连接
        const { data, error } = await supabase
            .from('media_items')
            .select('count')
            .limit(1);
            
        if (error) {
            console.log('⚠️ 数据库连接测试失败:', error.message);
            console.log('💡 可能的原因: 表不存在或RLS策略未正确配置');
        } else {
            console.log('✅ 数据库连接测试成功');
        }
        
        // 测试存储连接
        const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
        if (storageError) {
            console.log('⚠️ 存储连接测试失败:', storageError.message);
        } else {
            console.log('✅ 存储连接测试成功');
            console.log('📦 可用存储桶:', buckets.map(b => b.name));
        }
        
    } catch (error) {
        console.log('❌ Supabase连接测试失败:', error.message);
    }
}

// 全局变量
let currentDate = new Date();
let mediaData = JSON.parse(localStorage.getItem('calendarMedia')) || [];

// DOM元素
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthElement = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const galleryGrid = document.getElementById('galleryGrid');
const mediaModal = document.getElementById('mediaModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');
const loading = document.getElementById('loading');

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    renderCalendar();
    loadMediaFromStorage();
    
    // 如果配置了Supabase，从云端加载数据
    if (supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        loadMediaFromSupabase();
    }
}

function setupEventListeners() {
    
    // 日历导航
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // 模态框
    closeModal.addEventListener('click', () => {
        mediaModal.style.display = 'none';
    });
    
    mediaModal.addEventListener('click', (e) => {
        if (e.target === mediaModal) {
            mediaModal.style.display = 'none';
        }
    });
}



// 文件处理
function handleFiles(files) {
    const validFiles = files.filter(file => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        return isImage || isVideo;
    });
    
    if (validFiles.length === 0) {
        alert('请选择有效的图片或视频文件！');
        return;
    }
    
    // 检查文件大小限制
    const maxSize = supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL' ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 云端50MB，本地5MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
        const sizeLimit = maxSize / (1024 * 1024);
        const fileNames = oversizedFiles.map(f => f.name).join(', ');
        alert(`以下文件超过${sizeLimit}MB限制，无法上传：\n${fileNames}\n\n建议：\n1. 压缩图片后重试\n2. 配置Supabase云存储以支持更大文件`);
        return;
    }
    
    validFiles.forEach(file => uploadFile(file));
}

// 处理日历格子的文件上传
function handleCalendarUpload(targetDate) {
    // 创建隐藏的文件输入框
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    // 添加文件选择事件监听
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;
        
        showLoading(true);
        
        // 处理每个选中的文件
        for (const file of files) {
            try {
                await uploadFileForDate(file, targetDate);
            } catch (error) {
                console.error('上传失败:', error);
                showNotification('上传失败: ' + error.message, 'error');
            }
        }
        
        // 清理临时文件输入框
        document.body.removeChild(fileInput);
    });
    
    // 将文件输入框添加到页面并触发点击
    document.body.appendChild(fileInput);
    fileInput.click();
}

// 显示文字输入对话框
function showTextDialog(targetDate) {
    // 创建对话框背景
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'text-dialog-overlay';
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'text-dialog';
    
    // 获取已有的文字记录和平台选择
    const existingText = getTextForDate(targetDate);
    const existingPlatforms = getPlatformsForDate(targetDate);
    
    dialog.innerHTML = `
        <div class="text-dialog-header">
            <h3>添加文字记录</h3>
            <button class="text-dialog-close">&times;</button>
        </div>
        <div class="text-dialog-body">
            <textarea class="text-input" placeholder="在这里输入您的文字记录..." rows="6">${existingText}</textarea>
        </div>
        <div class="social-platforms">
            <h4>选择发布平台</h4>
            <div class="platform-buttons">
                <button class="platform-btn" data-platform="tiktok" title="TikTok">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V7.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.26z"/>
                    </svg>
                </button>
                <button class="platform-btn" data-platform="instagram" title="Instagram">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                </button>
                <button class="platform-btn" data-platform="facebook" title="Facebook">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                </button>
                <button class="platform-btn" data-platform="xiaohongshu" title="小红书">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="12" fill="#FF2442"/>
                        <path d="M8.5 6.5h2.5c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H8.5c-1.1 0-2-.9-2-2v-7c0-1.1.9-2 2-2zm.5 2v7h1.5V8.5H9zm4.5 0v7H15V8.5h-1.5z" fill="white"/>
                    </svg>
                </button>
                <button class="platform-btn" data-platform="wechat" title="微信">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18 0 .659-.52 1.188-1.162 1.188-.642 0-1.162-.529-1.162-1.188 0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18 0 .659-.52 1.188-1.162 1.188-.642 0-1.162-.529-1.162-1.188 0-.651.52-1.18 1.162-1.18zm4.721 2.471c-1.793-.213-3.637.229-4.979 1.322-1.341 1.094-2.009 2.625-1.69 4.237.319 1.612 1.394 3.035 2.932 3.892a.424.424 0 0 1 .161.508l-.295 1.126a.718.718 0 0 0-.037.161.223.223 0 0 0 .218.218.25.25 0 0 0 .125-.041l1.445-.849a.659.659 0 0 1 .544-.074c.543.161 1.126.242 1.723.242 2.948 0 5.336-2.278 5.336-5.092 0-2.815-2.388-5.093-5.336-5.093-.185 0-.364.016-.543.043z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="text-dialog-footer">
            <button class="text-dialog-copy" title="复制文字内容">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                复制
            </button>
            <div class="text-dialog-actions">
                <button class="text-dialog-cancel">取消</button>
                <button class="text-dialog-save">保存</button>
            </div>
        </div>
    `;
    
    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);
    
    // 聚焦到文本框
    const textarea = dialog.querySelector('.text-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // 绑定事件
    const closeBtn = dialog.querySelector('.text-dialog-close');
    const cancelBtn = dialog.querySelector('.text-dialog-cancel');
    const saveBtn = dialog.querySelector('.text-dialog-save');
    const copyBtn = dialog.querySelector('.text-dialog-copy');
    
    const closeDialog = () => {
        document.body.removeChild(dialogOverlay);
    };
    
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    
    // 复制文字内容
    copyBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (text) {
            try {
                await navigator.clipboard.writeText(text);
                showNotification('文字内容已复制到剪贴板', 'success');
            } catch (err) {
                // 降级方案：使用传统的复制方法
                textarea.select();
                document.execCommand('copy');
                showNotification('文字内容已复制到剪贴板', 'success');
            }
        } else {
            showNotification('没有可复制的内容', 'info');
        }
    });
    
    // 平台按钮选择功能
    const platformBtns = dialog.querySelectorAll('.platform-btn');
    let selectedPlatforms = new Set(existingPlatforms);
    
    // 初始化按钮状态
    platformBtns.forEach(btn => {
        const platform = btn.dataset.platform;
        if (selectedPlatforms.has(platform)) {
            btn.classList.add('selected');
        }
        
        btn.addEventListener('click', () => {
            if (selectedPlatforms.has(platform)) {
                selectedPlatforms.delete(platform);
                btn.classList.remove('selected');
            } else {
                selectedPlatforms.add(platform);
                btn.classList.add('selected');
            }
            
            // 显示选择的平台
            if (selectedPlatforms.size > 0) {
                const platformNames = {
                    'tiktok': 'TikTok',
                    'instagram': 'Instagram', 
                    'facebook': 'Facebook',
                    'xiaohongshu': '小红书',
                    'wechat': '微信'
                };
                const selectedNames = Array.from(selectedPlatforms).map(p => platformNames[p]).join('、');
                console.log(`已选择平台: ${selectedNames}`);
            }
        });
    });
    
    // 点击背景关闭
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) {
            closeDialog();
        }
    });
    
    // 保存文字
    saveBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        const platforms = Array.from(selectedPlatforms);
        saveTextForDate(targetDate, text, platforms);
        closeDialog();
        renderCalendar(); // 重新渲染日历以显示文字指示器
    });
    
    // ESC键关闭
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// 获取指定日期的文字记录
function getTextForDate(date) {
    const textData = JSON.parse(localStorage.getItem('calendarTexts')) || {};
    const dateKey = date.toISOString().split('T')[0];
    const record = textData[dateKey];
    return record ? (typeof record === 'string' ? record : record.text || '') : '';
}

// 获取指定日期的平台选择
function getPlatformsForDate(date) {
    const textData = JSON.parse(localStorage.getItem('calendarTexts')) || {};
    const dateKey = date.toISOString().split('T')[0];
    const record = textData[dateKey];
    return record && typeof record === 'object' ? (record.platforms || []) : [];
}

// 保存指定日期的文字记录和平台选择
function saveTextForDate(date, text, platforms = []) {
    const textData = JSON.parse(localStorage.getItem('calendarTexts')) || {};
    const dateKey = date.toISOString().split('T')[0];
    
    if (text || platforms.length > 0) {
        textData[dateKey] = {
            text: text,
            platforms: platforms,
            updatedAt: new Date().toISOString()
        };
    } else {
        delete textData[dateKey];
    }
    
    localStorage.setItem('calendarTexts', JSON.stringify(textData));
    showNotification(text ? '文字记录保存成功' : '文字记录已删除', 'success');
}

// 显示通知消息
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 触发动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 3秒后自动消失
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

async function uploadFile(file) {
    return await uploadFileForDate(file, new Date());
}

// 为指定日期上传文件
async function uploadFileForDate(file, targetDate) {
    showLoading(true);
    
    try {
        // 显示处理进度
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
            showNotification('正在压缩大图片，请稍候...', 'info');
        }
        
        const mediaItem = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: targetDate.toISOString(),
            url: null
        };
        
        // 如果配置了Supabase，上传到云端
        if (supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            const fileExt = file.name.split('.').pop();
            const fileName = `${mediaItem.id}.${fileExt}`;
            
            // 上传文件到Supabase Storage
            const { data, error } = await supabase.storage
                .from('calendar-media')
                .upload(fileName, file);
            
            if (error) {
                throw error;
            }
            
            // 获取公共URL
            const { data: urlData } = supabase.storage
                .from('calendar-media')
                .getPublicUrl(fileName);
            
            mediaItem.url = urlData.publicUrl;
            
            // 保存到数据库
            const { error: dbError } = await supabase
                .from('media_items')
                .insert([mediaItem]);
            
            if (dbError) {
                throw dbError;
            }
        } else {
            // 本地存储模式 - 检查并压缩大图片
            let processedFile = file;
            if (file.type.startsWith('image/') && file.size > 1024 * 1024) { // 大于1MB的图片进行压缩
                processedFile = await compressImage(file);
                const compressionRatio = ((file.size - processedFile.size) / file.size * 100).toFixed(1);
                showNotification(`图片压缩完成，大小减少了${compressionRatio}%`, 'success');
                // 更新媒体项的大小信息
                mediaItem.size = processedFile.size;
            }
            mediaItem.url = await fileToBase64(processedFile);
            
            // 检查localStorage空间
            try {
                const testData = JSON.stringify([...mediaData, mediaItem]);
                localStorage.setItem('calendarMediaTest', testData);
                localStorage.removeItem('calendarMediaTest');
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    throw new Error('本地存储空间不足，请删除一些旧文件或配置云存储');
                }
                throw e;
            }
        }
        
        // 添加到本地数组并保存
        mediaData.push(mediaItem);
        saveMediaToStorage();
        
        // 更新界面
        renderCalendar();
        renderGallery();
        
        showNotification('文件上传成功！', 'success');
        
    } catch (error) {
        console.error('上传失败:', error);
        showNotification('上传失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 文件转base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 压缩图片
function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // 计算压缩后的尺寸
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 绘制压缩后的图片
            ctx.drawImage(img, 0, 0, width, height);
            
            // 转换为blob
            canvas.toBlob((blob) => {
                // 创建新的File对象
                const compressedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now()
                });
                resolve(compressedFile);
            }, file.type, quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// 从Supabase加载媒体数据
async function loadMediaFromSupabase() {
    if (!supabase || SUPABASE_URL === 'YOUR_SUPABASE_URL') return;
    
    try {
        const { data, error } = await supabase
            .from('media_items')
            .select('*')
            .order('uploadDate', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        mediaData = data || [];
        saveMediaToStorage();
        renderCalendar();
        renderGallery();
        
    } catch (error) {
        console.error('从云端加载数据失败:', error);
    }
}

// 本地存储操作
function saveMediaToStorage() {
    localStorage.setItem('calendarMedia', JSON.stringify(mediaData));
}

function loadMediaFromStorage() {
    const stored = localStorage.getItem('calendarMedia');
    if (stored) {
        mediaData = JSON.parse(stored);
        renderGallery();
    }
}

// 渲染日历
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 更新月份标题
    const monthNames = [
        'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
    ];
    currentMonthElement.textContent = `${monthNames[month]} ${year}`;
    
    // 清除现有日期和定时器
    const existingDays = calendarGrid.querySelectorAll('.calendar-day');
    existingDays.forEach(day => {
        // 清除可能存在的轮播定时器
        const mediaContainer = day.querySelector('.media-container');
        if (mediaContainer && mediaContainer._carouselInterval) {
            clearInterval(mediaContainer._carouselInterval);
        }
        day.remove();
    });
    
    // 获取月份信息
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // 添加上个月的日期
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonth.getDate() - i;
        const dayElement = createDayElement(day, true);
        calendarGrid.appendChild(dayElement);
    }
    
    // 添加当前月份的日期
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const dayElement = createDayElement(day, false, dayDate);
        
        // 检查是否是今天
        if (year === today.getFullYear() && 
            month === today.getMonth() && 
            day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        // 检查是否有媒体文件
        const dayMediaItems = mediaData.filter(item => {
            const itemDate = new Date(item.uploadDate);
            return itemDate.toDateString() === dayDate.toDateString();
        });
        
        if (dayMediaItems.length > 0) {
            dayElement.classList.add('has-media');
            addMediaThumbnail(dayElement, dayMediaItems);
        }
        
        calendarGrid.appendChild(dayElement);
    }
    
    // 添加下个月的日期
    const totalCells = calendarGrid.children.length - 7; // 减去表头
    const remainingCells = 42 - totalCells; // 6行 x 7列 = 42
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createDayElement(day, true);
        calendarGrid.appendChild(dayElement);
    }
}

function createDayElement(day, isOtherMonth, fullDate) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    if (isOtherMonth) {
        dayElement.classList.add('other-month');
    }
    
    // 存储完整日期信息
    if (fullDate) {
        dayElement.dataset.date = fullDate.toISOString().split('T')[0];
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);
    
    // 检查是否有文字记录并添加指示器
    if (fullDate && getTextForDate(fullDate)) {
        const textIndicator = document.createElement('div');
        textIndicator.className = 'text-indicator';
        textIndicator.title = '有文字记录';
        dayElement.appendChild(textIndicator);
    }
    
    // 添加上传按钮（仅对当前月份的日期）
    if (!isOtherMonth && fullDate) {
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'calendar-upload-btn';
        uploadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,5 17,10"></polyline>
                <line x1="12" y1="5" x2="12" y2="15"></line>
            </svg>
        `;
        uploadBtn.title = '上传图片或视频';
        
        // 添加点击事件
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCalendarUpload(fullDate);
        });
        
        dayElement.appendChild(uploadBtn);
        
        // 添加文案按钮
        const textBtn = document.createElement('button');
        textBtn.className = 'calendar-text-btn';
        textBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
        `;
        textBtn.title = '添加文字记录';
        
        // 添加点击事件
        textBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTextDialog(fullDate);
        });
        
        dayElement.appendChild(textBtn);
    }
    
    return dayElement;
}

// 添加媒体缩略图到日历日期
function addMediaThumbnail(dayElement, mediaItems) {
    if (mediaItems.length === 0) return;
    
    let currentIndex = 0;
    let carouselInterval = null;
    
    // 创建媒体容器
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-container';
    mediaContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 8px;
    `;
    
    // 创建当前显示的媒体元素
    function createMediaElement(item) {
        const isVideo = item.type.startsWith('video/');
        const element = document.createElement(isVideo ? 'video' : 'img');
        element.className = 'media-thumbnail';
        element.src = item.url;
        element.style.opacity = '1';
        element.style.transition = 'opacity 0.5s ease-in-out';
        
        if (isVideo) {
            element.muted = true;
            element.preload = 'metadata';
        }
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            showMediaModal(item);
        });
        
        return element;
    }
    
    // 初始化第一个媒体元素
    let currentElement = createMediaElement(mediaItems[currentIndex]);
    mediaContainer.appendChild(currentElement);
    
    // 如果有多个媒体项，启动轮播
    if (mediaItems.length > 1) {
        // 显示数量徽章
        const countBadge = document.createElement('div');
        countBadge.className = 'media-count';
        countBadge.textContent = mediaItems.length;
        dayElement.appendChild(countBadge);
        
        // 启动自动轮播
         function startCarousel() {
             carouselInterval = setInterval(() => {
                // 淡出当前元素
                currentElement.style.opacity = '0';
                
                setTimeout(() => {
                    // 切换到下一个媒体项
                    currentIndex = (currentIndex + 1) % mediaItems.length;
                    const nextItem = mediaItems[currentIndex];
                    
                    // 移除当前元素
                    mediaContainer.removeChild(currentElement);
                    
                    // 创建新元素
                    currentElement = createMediaElement(nextItem);
                    currentElement.style.opacity = '0';
                    mediaContainer.appendChild(currentElement);
                    
                    // 淡入新元素
                    setTimeout(() => {
                        currentElement.style.opacity = '1';
                    }, 50);
                }, 250);
            }, 3000); // 每3秒切换一次
             // 将定时器引用存储到容器上，便于清理
             mediaContainer._carouselInterval = carouselInterval;
         }
        
        // 鼠标悬停时暂停轮播
         dayElement.addEventListener('mouseenter', () => {
             if (carouselInterval) {
                 clearInterval(carouselInterval);
                 carouselInterval = null;
                 mediaContainer._carouselInterval = null;
             }
         });
         
         // 鼠标离开时恢复轮播
         dayElement.addEventListener('mouseleave', () => {
             if (!carouselInterval && mediaItems.length > 1) {
                 startCarousel();
             }
         });
        
        // 启动轮播
        startCarousel();
    }
    
    // 添加删除按钮（对所有情况）
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'calendar-delete-btn';
    deleteBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mediaItems.length > 1) {
            showDeleteMenu(mediaItems, e.target);
        } else {
            deleteMedia(mediaItems[0].id);
        }
    });  
    dayElement.appendChild(deleteBtn);
    
    // 将媒体容器添加到日期元素中
    dayElement.appendChild(mediaContainer);
}

// 渲染媒体画廊
function renderGallery() {
    galleryGrid.innerHTML = '';
    
    if (mediaData.length === 0) {
        galleryGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">还没有上传任何文件，快来上传第一个回忆吧！📸</p>';
        return;
    }
    
    // 按日期排序（最新的在前）
    const sortedMedia = [...mediaData].sort((a, b) => 
        new Date(b.uploadDate) - new Date(a.uploadDate)
    );
    
    sortedMedia.forEach(item => {
        const mediaElement = createMediaElement(item);
        galleryGrid.appendChild(mediaElement);
    });
}

function createMediaElement(item) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'media-item';
    
    const isVideo = item.type.startsWith('video/');
    const mediaTag = isVideo ? 'video' : 'img';
    
    const uploadDate = new Date(item.uploadDate);
    const dateStr = uploadDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    mediaDiv.innerHTML = `
        <${mediaTag} src="${item.url}" alt="${item.name}" ${isVideo ? 'muted' : ''}>
        <div class="media-info">
            <div class="media-date">${dateStr}</div>
            <div class="media-name">${item.name}</div>
        </div>
        <button class="media-delete-btn" onclick="event.stopPropagation(); deleteMedia('${item.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
        </button>
    `;
    
    mediaDiv.addEventListener('click', () => showMediaModal(item));
    
    return mediaDiv;
}

// 显示媒体模态框
function showMediaModal(item) {
    const isVideo = item.type.startsWith('video/');
    const mediaTag = isVideo ? 'video' : 'img';
    const controls = isVideo ? 'controls' : '';
    
    modalBody.innerHTML = `
        <${mediaTag} src="${item.url}" alt="${item.name}" ${controls}>
        <div class="modal-actions">
            <button class="delete-btn" onclick="deleteMedia('${item.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                删除
            </button>
        </div>
    `;
    
    mediaModal.style.display = 'block';
}

// 显示/隐藏加载动画
function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 3000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    // 根据类型设置颜色
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 删除媒体文件
async function deleteMedia(mediaId) {
    if (!confirm('确定要删除这个媒体文件吗？')) {
        return;
    }
    
    try {
        showLoading(true);
        
        // 查找要删除的媒体项
        const mediaIndex = mediaData.findIndex(item => item.id == mediaId);
        if (mediaIndex === -1) {
            throw new Error('媒体文件不存在');
        }
        
        const mediaItem = mediaData[mediaIndex];
        
        // 如果使用Supabase，从云存储删除
        if (supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            // 从存储桶删除文件
            const fileName = mediaItem.url.split('/').pop();
            const { error: storageError } = await supabase.storage
                .from('calendar-media')
                .remove([fileName]);
            
            if (storageError) {
                console.error('删除云存储文件失败:', storageError);
            }
            
            // 从数据库删除记录
            const { error: dbError } = await supabase
                .from('media_items')
                .delete()
                .eq('id', mediaId);
            
            if (dbError) {
                console.error('删除数据库记录失败:', dbError);
                throw dbError;
            }
        }
        
        // 从本地数据删除
        mediaData.splice(mediaIndex, 1);
        saveMediaToStorage();
        
        // 重新渲染界面
        renderCalendar();
        renderGallery();
        
        // 关闭模态框
        mediaModal.style.display = 'none';
        
        showNotification('媒体文件删除成功', 'success');
        
    } catch (error) {
        console.error('删除媒体文件失败:', error);
        showNotification('删除失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 显示删除菜单（用于多媒体项的日历格子）
function showDeleteMenu(mediaItems, buttonElement) {
    // 移除现有的删除菜单
    const existingMenu = document.querySelector('.delete-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'delete-menu';
    menu.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 120px;
        padding: 8px 0;
    `;
    
    // 添加"删除全部"选项
    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.textContent = '删除全部';
    deleteAllBtn.style.cssText = `
        width: 100%;
        padding: 8px 16px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        color: #e74c3c;
    `;
    deleteAllBtn.addEventListener('click', () => {
        if (confirm(`确定要删除这${mediaItems.length}个媒体文件吗？`)) {
            mediaItems.forEach(item => deleteMedia(item.id));
        }
        menu.remove();
    });
    
    menu.appendChild(deleteAllBtn);
    
    // 定位菜单
    const rect = buttonElement.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 5) + 'px';
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 配置提示
if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.log('%c📝 配置提示', 'color: #667eea; font-size: 16px; font-weight: bold;');
    console.log('请在 script.js 文件中配置您的 Supabase 项目信息：');
    console.log('1. SUPABASE_URL: 您的 Supabase 项目 URL');
    console.log('2. SUPABASE_ANON_KEY: 您的 Supabase 匿名密钥');
    console.log('3. 在 Supabase 中创建 "calendar-media" 存储桶');
    console.log('4. 创建 "media_items" 数据表');
    console.log('\n当前使用本地存储模式，数据仅保存在浏览器中。');
}