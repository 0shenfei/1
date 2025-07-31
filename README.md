# 📅 我的日历 - 图片视频分享应用

一个现代化的日历应用，支持上传图片和视频到云端，实现跨设备同步查看。

## ✨ 功能特点

- 📅 **美观的日历界面** - 现代化设计，支持月份导航
- 📸 **媒体上传** - 支持拖拽上传图片和视频文件
- ☁️ **云端存储** - 使用 Supabase 实现跨设备同步
- 🖼️ **媒体画廊** - 优雅展示所有上传的内容
- 📱 **响应式设计** - 完美适配手机、平板和桌面设备
- 🔍 **媒体预览** - 点击查看大图/播放视频
- 💾 **本地缓存** - 支持离线浏览已加载的内容

## 🚀 快速开始

### 方法一：本地运行

1. 克隆或下载项目文件
2. 在项目目录中运行本地服务器：
   ```bash
   # 使用 Python
   python3 -m http.server 8000
   
   # 或使用 Node.js
   npx serve .
   ```
3. 打开浏览器访问 `http://localhost:8000`

### 方法二：直接打开

直接双击 `index.html` 文件在浏览器中打开（部分功能可能受限）

## ⚙️ Supabase 云端配置

为了实现跨设备同步，需要配置 Supabase：

1. 查看 `supabase-setup.md` 获取详细配置指南
2. 在 `script.js` 中更新您的 Supabase 配置：
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

**注意：** 如果不配置 Supabase，应用将使用本地存储模式，数据仅保存在当前浏览器中。

## 📱 使用方法

### 上传文件
1. 点击上传区域或直接拖拽文件
2. 支持的格式：JPG, PNG, GIF, MP4, MOV
3. 文件将自动上传到云端（如已配置）

### 查看内容
1. 日历中有内容的日期会显示特殊标记
2. 在媒体画廊中浏览所有上传的内容
3. 点击任意媒体项目查看大图或播放视频

### 导航日历
- 使用左右箭头切换月份
- 今天的日期会高亮显示
- 有媒体内容的日期会有特殊样式

## 🌐 部署到云端

### Vercel 部署
1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 自动部署完成

### Netlify 部署
1. 将代码推送到 GitHub 仓库
2. 在 [Netlify](https://netlify.com) 中连接仓库
3. 自动部署完成

### GitHub Pages
1. 将代码推送到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择主分支作为部署源

## 🛠️ 技术栈

- **前端：** HTML5, CSS3, JavaScript (ES6+)
- **云端存储：** Supabase
- **样式：** 现代 CSS Grid 和 Flexbox
- **图标：** SVG 图标
- **响应式：** 移动优先设计

## 📂 项目结构

```
calendar-app/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # 主要逻辑
├── package.json        # 项目配置
├── supabase-setup.md   # Supabase 配置指南
└── README.md           # 项目说明
```

## 🔧 自定义配置

### 修改样式
编辑 `styles.css` 文件来自定义：
- 颜色主题
- 字体样式
- 布局尺寸
- 动画效果

### 扩展功能
在 `script.js` 中可以添加：
- 文件分类功能
- 搜索和筛选
- 批量操作
- 分享功能

## 🐛 故障排除

### 文件上传失败
1. 检查网络连接
2. 确认 Supabase 配置正确
3. 查看浏览器控制台错误信息
4. 验证文件格式是否支持

### 跨设备同步问题
1. 确认使用相同的 Supabase 项目
2. 检查存储桶权限设置
3. 验证 RLS 策略配置

### 界面显示异常
1. 清除浏览器缓存
2. 检查 CSS 文件是否正确加载
3. 确认 JavaScript 没有错误

## 📄 许可证

MIT License - 可自由使用和修改

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

**享受记录美好时光的乐趣！** 📸✨