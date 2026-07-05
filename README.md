# 又买啊

> 一个帮助记录物品保质期、提醒临期物品的小程序

[![微信小程序](https://img.shields.io/badge/平台-微信小程序-blue)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![云开发](https://img.shields.io/badge/后端-微信云开发-green)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

## ⚠️ 重要声明

> **这个程序最大的问题是丑得我抓耳挠腮** 用各个免费的coding agent 做一段换一个，因为那个时候在尝试哪个coding tool 好用。 功能差不多了之后，开始觉得审美上实在是看不下眼。
## ✨ 功能特性

- 📦 **空间管理** - 创建冰箱、储物柜等空间分类管理物品
- 📝 **物品记录** - 记录物品名称、数量、保质期、备注
- 🔔 **临期提醒** - 每天自动检查，推送订阅消息提醒
- 📊 **状态标记** - 已过期/临期物品自动标记
- 🎨 **莫兰迪UI** - 高级色系设计，清新优雅风格（虽然还是有点丑）

## 🚀 快速开始

### 前置要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序账号
- 开通微信云开发

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/yourname/buyagain.git
   cd buyagain
   ```

2. **配置项目文件**
   ```bash
   cp project.config.example.json project.config.json
   cp miniprogram/config.example.js miniprogram/config.js
   ```

3. **修改项目配置**
   - 编辑 `project.config.json`，将 `appid` 替换为你的小程序 AppID
   - 编辑 `miniprogram/config.js`，填入你的云环境ID和订阅消息模板ID

4. **导入项目到微信开发者工具**
   - 打开微信开发者工具
   - 选择「导入项目」
   - 选择 `buyagain` 文件夹
   - 填入你的小程序 AppID（与 project.config.json 一致）

5. **部署云函数**
   - 在微信开发者工具左侧，找到「云开发」面板
   - 右键 `cloudfunctions/checkExpiry` →「上传并部署：云端安装依赖」
   - 右键 `cloudfunctions/initUserSettings` →「上传并部署：云端安装依赖」
   - 右键 `cloudfunctions/generateShareToken` →「上传并部署：云端安装依赖」
   - 右键 `cloudfunctions/acceptShare` →「上传并部署：云端安装依赖」

6. **配置数据库安全规则**
   - 点击云开发面板 → 数据库 → 安全规则
   - 选择「仅创建者可读写」

7. **运行**
   - 点击「编译」按钮预览效果

## 📁 项目结构

```
buyagain/
├── miniprogram/              # 小程序前端代码
│   ├── pages/               # 页面文件
│   │   ├── index/          # 首页（空间列表）
│   │   ├── location/       # 空间详情（物品列表）
│   │   ├── create_location/# 创建空间
│   │   ├── create_item/    # 添加/编辑物品
│   │   └── item_detail/    # 物品详情
│   ├── app.js              # 小程序入口
│   ├── app.json            # 全局配置
│   ├── app.wxss            # 全局样式系统（莫兰迪色系设计规范）
│   └── config.example.js   # 配置模板
├── cloudfunctions/          # 云函数
│   ├── checkExpiry/        # 临期检查（定时触发）
│   ├── initUserSettings/   # 用户设置初始化
│   ├── generateShareToken/ # 分享Token生成
│   ├── acceptShare/        # 接受分享
│   └── quickstartFunctions/# 基础功能
├── .gitignore              # Git忽略配置
├── project.config.example.json # 项目配置示例
├── README.md               # 项目说明
├── PRD.md                  # 产品需求文档
└── PROGRESS.md             # 项目进度
```

## ⚙️ 配置说明

### 1. project.config.json
```json
{
  "appid": "你的小程序AppID",
  "projectname": "buyagaina",
  "libVersion": "3.14.1"
}
```

### 2. miniprogram/config.js
```javascript
module.exports = {
  // 云开发环境 ID
  // 在微信开发者工具 → 云开发 → 设置 中获取
  envId: "your-cloud-env-id",
  
  // 订阅消息模板 ID
  // 在微信公众平台 → 功能 → 订阅消息 中申请
  templateId: "your-template-id"
};
```

### 3. 获取配置信息的步骤

#### 获取云环境 ID：
1. 打开微信开发者工具
2. 点击「云开发」按钮
3. 进入云开发控制台后，点击「设置」
4. 在「环境设置」页面可以看到环境 ID

#### 获取订阅消息模板 ID：
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「功能」→「订阅消息」
3. 点击「添加模板」
4. 搜索并选择「物品到期提醒」模板（或类似模板）
5. 添加成功后即可看到模板 ID

## 📱 截图展示

> 待添加：首页、空间详情、添加物品页面截图

## 🎨 UI设计

本项目采用**莫兰迪色系**设计理念，打造高级、清新、统一的视觉体验。

### 核心色彩体系

| 颜色类型 | 色值 | 用途 | 视觉感受 |
|---------|------|------|---------|
| 主色 | `#7C9A92` | 按钮、强调元素 | 柔和蓝绿，沉稳优雅 |
| 辅色 | `#B8C4BB` | 边框、次要元素 | 淡雅灰绿，低调内敛 |
| 背景 | `#F5F5F3` | 页面背景、卡片背景 | 温暖米白，舒适柔和 |
| 文字 | `#2C3E3E` | 主要文字 | 深蓝灰色，清晰易读 |
| 强调 | `#E8B4B8` | 特殊标记 | 淡玫瑰粉，温柔点缀 |
| 警告 | `#D4A574` | 临期提醒 | 柔和杏色，温和提示 |
| 危险 | `#C4786A` | 过期标记 | 豆沙红，优雅警示 |
| 成功 | `#8BA888` | 正常状态 | 清新绿色，生机活力 |

### 设计特点

- **细字体** (weight: 300-400) - 营造轻盈优雅感
- **大圆角** (16rpx-48rpx) - 柔和友好的视觉体验
- **轻微阴影** (rgba透明度6%-20%) - 细腻的层次感
- **宽松间距** (24rpx-32rpx) - 清晰的呼吸感
- **卡片式布局** - 信息层级分明，易于理解

### 全局样式系统

项目建立了完整的全局样式系统 (`app.wxss`)，定义了统一的设计规范：

- CSS变量定义色彩系统
- 统一的字体大小和行高
- 标准化的间距体系
- 圆角和阴影规范
- 状态颜色管理

所有页面都遵循这套设计系统，确保视觉的一致性和高级感。

## 🛠️ 技术栈

- **前端**：微信小程序原生框架
- **后端**：微信云开发（云函数 + 云数据库）
- **消息推送**：微信小程序订阅消息
- **定时任务**：云函数定时触发器

## 📤 上传到 Git 仓库步骤

### 准备工作

1. **安装 Git**
   ```bash
   # macOS
   brew install git
   
   # Windows
   # 下载安装：https://git-scm.com/download/win
   ```

2. **配置 Git**
   ```bash
   git config --global user.name "你的名字"
   git config --global user.email "你的邮箱"
   ```

3. **检查敏感文件**
   - 确保 `project.config.json`、`miniprogram/config.js`、`cloudfunctions/checkExpiry/config.js` 已加入 `.gitignore`
   - 确保 `project.config.example.json` 和 `miniprogram/config.example.js` 存在（不含真实信息）

### 初始化 Git 仓库

```bash
# 进入项目目录
cd buyagain

# 初始化 Git
git init

# 添加所有文件（会自动忽略 .gitignore 中的文件）
git add .

# 查看哪些文件会被提交
git status

# 提交代码
git commit -m "feat: 初始提交 - 物品保质期管理小程序"
```

### 推送到远程仓库（以 GitFarm 为例）

1. **在 GitFarm 创建仓库**
   - 登录 GitFarm
   - 点击「新建仓库」
   - 输入仓库名称（如 buyagain）
   - 选择公开或私有

2. **添加远程仓库**
   ```bash
   # 替换为你的 GitFarm 仓库地址
   git remote add origin https://gitfarm.com/yourname/buyagain.git
   ```

3. **推送代码**
   ```bash
   # 首次推送
   git push -u origin main
   
   # 后续推送
   git push
   ```

### 更新代码流程

```bash
# 修改代码后
git add .
git commit -m "描述你的修改"
git push
```

## 📄 相关文档

- [PRD.md](./PRD.md) - 产品需求文档
- [PROGRESS.md](./PROGRESS.md) - 项目进度追踪
- [SUBSCRIBE_GUIDE.md](./SUBSCRIBE_GUIDE.md) - 订阅消息配置指南

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！特别欢迎 UI 设计方面的贡献！

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交修改：`git commit -m "feat: 你的特性描述"`
4. 推送到分支：`git push origin feature/your-feature`
5. 创建 Pull Request

## 📜 许可证

MIT License