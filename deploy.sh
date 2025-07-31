#!/bin/bash

# 日历应用部署脚本

echo "📅 日历应用部署助手"
echo "==================="

# 检查是否安装了必要工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 未安装"
        return 1
    else
        echo "✅ $1 已安装"
        return 0
    fi
}

echo "\n🔍 检查环境..."
check_command "git"
check_command "node" || check_command "python3"

echo "\n🚀 选择部署方式:"
echo "1. 本地运行 (推荐用于测试)"
echo "2. 准备 GitHub 部署"
echo "3. 创建 Vercel 配置"
echo "4. 创建 Netlify 配置"

read -p "请选择 (1-4): " choice

case $choice in
    1)
        echo "\n🏃 启动本地服务器..."
        if command -v python3 &> /dev/null; then
            echo "使用 Python 服务器在 http://localhost:8000"
            python3 -m http.server 8000
        elif command -v node &> /dev/null; then
            echo "使用 Node.js 服务器在 http://localhost:3000"
            npx serve . -p 3000
        else
            echo "❌ 需要安装 Python3 或 Node.js"
        fi
        ;;
    2)
        echo "\n📦 准备 GitHub 部署..."
        if [ ! -d ".git" ]; then
            git init
            echo "✅ Git 仓库已初始化"
        fi
        
        # 创建 .gitignore
        cat > .gitignore << EOF
# 系统文件
.DS_Store
Thumbs.db

# 编辑器文件
.vscode/
.idea/
*.swp
*.swo

# 临时文件
*.tmp
*.log
EOF
        
        git add .
        git commit -m "初始化日历应用"
        
        echo "✅ 代码已提交到本地仓库"
        echo "📝 下一步:"
        echo "   1. 在 GitHub 创建新仓库"
        echo "   2. 运行: git remote add origin <你的仓库URL>"
        echo "   3. 运行: git push -u origin main"
        echo "   4. 在 GitHub Pages 设置中启用部署"
        ;;
    3)
        echo "\n⚡ 创建 Vercel 配置..."
        cat > vercel.json << EOF
{
  "version": 2,
  "name": "calendar-app",
  "builds": [
    {
      "src": "index.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/\$1"
    }
  ]
}
EOF
        echo "✅ vercel.json 已创建"
        echo "📝 下一步:"
        echo "   1. 将代码推送到 GitHub"
        echo "   2. 在 vercel.com 导入项目"
        echo "   3. 自动部署完成"
        ;;
    4)
        echo "\n🌐 创建 Netlify 配置..."
        cat > netlify.toml << EOF
[build]
  publish = "."
  command = "echo 'Static site ready'"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOF
        echo "✅ netlify.toml 已创建"
        echo "📝 下一步:"
        echo "   1. 将代码推送到 GitHub"
        echo "   2. 在 netlify.com 连接仓库"
        echo "   3. 自动部署完成"
        ;;
    *)
        echo "❌ 无效选择"
        ;;
esac

echo "\n🎉 部署准备完成！"
echo "💡 提示: 记得在 script.js 中配置 Supabase 以启用云端同步功能"