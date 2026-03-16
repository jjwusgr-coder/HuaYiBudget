# AI 智能记账本 (AI Smart Ledger)

一款基于 React + Tailwind CSS + Firebase + Gemini AI 的智能多店铺记账应用。

## ✨ 特性 (Features)

- 🏪 **多店铺管理**: 支持创建和管理多个店铺的账单。
- 🤖 **AI 智能识别**: 上传小票/账单截图，Gemini AI 自动提取金额、分类和备注。
- 💡 **AI 财务建议**: 基于本月收支数据，生成智能财务分析和省钱建议。
- 🎙️ **语音记账**: 支持语音输入，自动解析金额和分类。
- 📊 **数据统计**: 直观的收支排行和结余统计。
- ☁️ **云端同步**: 基于 Firebase 的实时数据同步和离线支持。
- 📤 **数据导入导出**: 支持 JSON 和 CSV 格式的数据备份与恢复。

## 🚀 快速开始 (Getting Started)

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/ai-smart-ledger.git
cd ai-smart-ledger
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
复制 `.env.example` 为 `.env.local`，并填入你的配置信息：
```bash
cp .env.example .env.local
```

### 4. 运行项目
```bash
npm run dev
```

## 🛠️ 技术栈 (Tech Stack)
- **前端**: React 19, Vite, Tailwind CSS, Lucide React
- **后端/数据库**: Firebase (Auth, Firestore)
- **AI 接口**: Google Gemini API (gemini-2.5-flash)
