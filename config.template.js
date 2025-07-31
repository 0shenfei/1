// Supabase 配置模板
// 复制此文件为 config.js 并填入您的实际配置信息

// 🔧 Supabase 项目配置
const SUPABASE_CONFIG = {
    // 您的 Supabase 项目 URL
    // 格式: https://your-project-id.supabase.co
    url: 'YOUR_SUPABASE_URL',
    
    // 您的 Supabase 匿名密钥 (anon key)
    // 在 Supabase 控制台的 Settings > API 中找到
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
};

// 📦 存储配置
const STORAGE_CONFIG = {
    // 存储桶名称 (建议保持默认)
    bucketName: 'calendar-media',
    
    // 支持的文件类型
    allowedTypes: {
        images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        videos: ['video/mp4', 'video/mov', 'video/avi', 'video/webm']
    },
    
    // 文件大小限制 (字节)
    maxFileSize: 50 * 1024 * 1024, // 50MB
    
    // 文件名前缀 (可选)
    filePrefix: 'calendar_'
};

// 🎨 界面配置
const UI_CONFIG = {
    // 应用标题
    appTitle: '我的日历',
    
    // 应用描述
    appDescription: '上传图片和视频，与所有设备同步',
    
    // 主题颜色
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    
    // 每页显示的媒体数量
    mediaPerPage: 20,
    
    // 是否显示上传进度
    showUploadProgress: true,
    
    // 是否启用拖拽上传
    enableDragDrop: true
};

// 🔒 安全配置
const SECURITY_CONFIG = {
    // 是否启用文件类型检查
    enableFileTypeCheck: true,
    
    // 是否启用文件大小检查
    enableFileSizeCheck: true,
    
    // 是否启用恶意文件检查
    enableMalwareCheck: false,
    
    // 允许的文件扩展名
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.webm']
};

// 📊 分析配置 (可选)
const ANALYTICS_CONFIG = {
    // 是否启用使用统计
    enableAnalytics: false,
    
    // Google Analytics ID (如果启用)
    googleAnalyticsId: '',
    
    // 是否记录上传统计
    trackUploads: true,
    
    // 是否记录查看统计
    trackViews: true
};

// 🌐 部署配置
const DEPLOYMENT_CONFIG = {
    // 生产环境域名
    productionDomain: '',
    
    // 是否启用 PWA
    enablePWA: false,
    
    // 是否启用离线缓存
    enableOfflineCache: true,
    
    // 缓存策略
    cacheStrategy: 'cache-first' // 'cache-first' | 'network-first' | 'stale-while-revalidate'
};

// 导出配置 (如果使用模块系统)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUPABASE_CONFIG,
        STORAGE_CONFIG,
        UI_CONFIG,
        SECURITY_CONFIG,
        ANALYTICS_CONFIG,
        DEPLOYMENT_CONFIG
    };
}

// 使用说明:
// 1. 将此文件复制为 config.js
// 2. 填入您的 Supabase 项目信息
// 3. 根据需要调整其他配置
// 4. 在 script.js 中引用配置文件

/* 示例配置:
const SUPABASE_CONFIG = {
    url: 'https://abcdefgh.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
*/