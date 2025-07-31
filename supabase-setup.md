# Supabase 配置指南

## 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 注册账号并创建新项目
3. 记录项目的 URL 和 API Key

## 2. 配置存储桶 (Storage Bucket)

1. 在 Supabase 控制台中，进入 "Storage" 页面
2. 创建新的存储桶，命名为 `calendar-media`
3. 设置存储桶为公开访问：
   ```sql
   -- 在 SQL Editor 中执行
   INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-media', 'calendar-media', true);
   ```

## 3. 创建数据表

在 SQL Editor 中执行以下 SQL：

```sql
-- 创建媒体项目表
CREATE TABLE media_items (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size BIGINT,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    url TEXT
);

-- 启用行级安全 (RLS)
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- 创建策略允许所有人读取和插入
CREATE POLICY "Allow public read" ON media_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON media_items FOR INSERT WITH CHECK (true);
```

## 4. 配置存储策略

```sql
-- 允许所有人上传文件
CREATE POLICY "Allow public uploads" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'calendar-media');

-- 允许所有人查看文件
CREATE POLICY "Allow public access" ON storage.objects 
FOR SELECT USING (bucket_id = 'calendar-media');
```

## 5. 更新应用配置

在 `script.js` 文件中，替换以下配置：

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

## 6. 部署选项

### 选项 1: Vercel 部署
1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 自动部署

### 选项 2: Netlify 部署
1. 将代码推送到 GitHub
2. 在 Netlify 中连接仓库
3. 自动部署

### 选项 3: GitHub Pages
1. 将代码推送到 GitHub
2. 在仓库设置中启用 GitHub Pages
3. 选择主分支作为源

## 注意事项

- 确保 Supabase 项目的 RLS 策略正确配置
- 存储桶必须设置为公开访问
- API Key 使用匿名密钥即可
- 建议在生产环境中配置更严格的安全策略

## 故障排除

如果遇到上传问题：
1. 检查浏览器控制台的错误信息
2. 确认 Supabase URL 和 API Key 正确
3. 验证存储桶和数据表是否正确创建
4. 检查 RLS 策略是否正确配置