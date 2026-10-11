# 橙光队无障碍督导路线可视化

<p align="center">
  <img src="image/logo.png" alt="橙光队队徽" width="80" height="80">
</p>

<p align="center">
  <a href="https://wayhhow.github.io/survey-map/" target="_blank">
    <img src="https://img.shields.io/badge/🌍%20访问地图-立即查看-brightgreen" alt="访问地图">
  </a>
  <a href="https://github.com/Wayhhow/survey-map" target="_blank">
    <img src="https://img.shields.io/github/stars/Wayhhow/survey-map?style=social" alt="GitHub Stars">
  </a>
</p>

<p align="center">
  <b>🌐 语言 / Language:</b>
  <a href="./README.md"><b>中文</b></a> |
  <a href="./README.en.md">English</a>
</p>

---

## 📋 目录

1.  [项目简介](#intro)
2.  [核心功能](#features)
3.  [快速访问](#access)
4.  [项目结构](#structure)
5.  [技术栈](#tech)
6.  [部署指南](#deploy)
7.  [使用方法](#usage)
    *   [快速开始](#quickstart)
    *   [KML 转换示例](#kml)
    *   [配置线路类型颜色](#config)
8.  [新手操作指南](#guide)
9.  [本地开发](#dev)
10. [注意事项](#notes)
11. [关于我们](#about)
12. [作者](#author)
13. [Star History](#stars)
14. [许可证](#license)

<a id="intro"></a>
## 📋 项目简介

本项目是**南方科技大学致诚书院"橙光"志愿服务队**无障碍督导活动的路线可视化平台。通过交互式地图展示督导路线，支持已勘测与待勘测线路的区分、长度实时统计、勘测详情展示等功能，为无障碍设施督导工作提供直观的数据管理与展示工具。

项目基于 Leaflet.js 与高德地图瓦片构建，采用 GitHub Pages 托管，并配置 GitHub Actions 实现自动化部署。

<a id="features"></a>
## 🎯 核心功能

- **线路可视化**：基于 Leaflet.js 渲染所有督导路线，支持缩放与平移
- **类型区分**：已勘测与待勘测线路以不同颜色展示，点击统计面板可高亮对应类型
- **长度统计**：利用 Turf.js 实时计算线路总长度及各类型长度
- **交互功能**：点击线路查看详情（名称、类型、长度、勘测日期、不规范点数量）
- **无障碍设施**：叠加显示无障碍卫生间和轮椅可达场所，数据来源 OpenStreetMap、高德地图、深圳地铁
- **回到中心**：一键回到南科大中心区域，快速定位
- **响应式设计**：适配桌面端、平板与移动端，提供一致的用户体验
- **自动化部署**：推送代码至 `main` 分支后，GitHub Actions 自动构建并部署

<a id="access"></a>
## 🌐 快速访问

**在线地图**：[https://wayhhow.github.io/survey-map/](https://wayhhow.github.io/survey-map/)

<a id="structure"></a>
## 📁 项目结构

```
survey-map/
├── index.html              # 主页面
├── css/
│   └── style.css           # 样式定义
├── js/
│   ├── map.js              # 地图初始化与交互
│   └── data.js             # 数据加载与统计计算
├── data/
│   ├── routes.geojson      # 线路地理数据
│   ├── route_details.csv   # 线路勘测详情
│   ├── types.json          # 类型颜色配置
│   └── accessibility/      # 无障碍设施数据
│       ├── wheelchair_toilets.geojson  # 无障碍卫生间
│       ├── wheelchair_poi.geojson      # 轮椅可达场所
│       └── metro_accessibility.geojson # 地铁站无障碍设施
├── image/
│   └── logo.png            # 橙光队队徽
├── convert-kml.js          # KML/GeoJSON 转换工具
├── fetch-accessibility-data.js  # OSM 无障碍数据获取脚本
├── fetch-amap-data.js      # 高德地图 POI 数据获取脚本
├── process-metro-data.js   # 深圳地铁数据处理脚本
├── package.json            # 项目依赖
├── README.md               # 中文文档
├── README.en.md            # 英文文档
├── CONTRIBUTING.md         # 贡献指南
├── FAQ.md                  # 常见问题
├── LICENSE                 # 许可证
└── .github/workflows/
    ├── deploy.yml          # 自动部署工作流
    └── star-history.yml    # 星标历史更新工作流
```

<a id="tech"></a>
## 🛠 技术栈

| 类别 | 技术/库 | 用途 |
|------|---------|------|
| 地图库 | Leaflet 1.9.4 | 地图初始化与路线渲染 |
| 底图 | 高德地图 | 地图瓦片服务 |
| 地理计算 | Turf.js 6.x | 线路长度计算 |
| 数据格式 | GeoJSON / CSV | 线路与详情数据存储 |
| 构建工具 | Node.js | KML 转换脚本运行环境 |
| 部署 | GitHub Pages | 静态网站托管 |
| CI/CD | GitHub Actions | 自动部署与定时任务 |

<a id="deploy"></a>
## 🚀 部署指南

### 1. 创建 GitHub 仓库并启用 Pages

1. 在 GitHub 创建新仓库
2. 进入 **Settings → Pages**
3. 选择 `main` 分支作为发布源，点击 **Save**

### 2. 克隆并推送代码

```bash
git clone https://github.com/your-username/survey-map.git
cd survey-map
git add .
git commit -m "Initial commit"
git push origin main
```

### 3. 等待部署

GitHub Pages 通常在 1–2 分钟内完成构建与部署，随后可通过 `https://your-username.github.io/survey-map` 访问。

<a id="usage"></a>
## 📊 使用方法

<a id="quickstart"></a>
### 快速开始

1. **准备线路数据**：在 [Google My Maps](https://www.google.com/maps/d/) 中绘制线路，按类型分层
2. **转换数据**：使用 `convert-kml.js` 将导出的 KML 文件转换为 GeoJSON
3. **更新项目**：替换 `data/routes.geojson`，转换工具会自动同步 `data/route_details.csv`
4. **提交部署**：推送至 GitHub，`main` 分支变更将触发自动部署

<a id="kml"></a>
### KML 转换示例

```bash
# 安装依赖（首次使用）
npm install

# 基本转换
node convert-kml.js input.kml

# 指定输出路径
node convert-kml.js input.kml data/routes.geojson
```

转换过程会保留 `route_details.csv` 中已有的手动填写数据（勘测日期、不规范点），并自动为新路线添加空记录行。

<a id="config"></a>
### 配置线路类型颜色

编辑 `data/types.json`：

```json
{
  "已勘测": {
    "color": "#4CAF50",
    "weight": 4,
    "opacity": 0.8,
    "description": "已完成现场勘测的线路"
  },
  "待勘测": {
    "color": "#9E9E9E",
    "weight": 4,
    "opacity": 0.8,
    "description": "待勘测的线路"
  }
}
```

<a id="guide"></a>
## 📝 新手操作指南：如何更新线路数据

> 本指南面向零基础人员，手把手教你如何把新的勘测线路数据更新到地图上。只要按步骤操作即可，不需要懂编程。

### 你需要准备的东西

- 一台电脑（Windows 或 Mac 都可以）
- 一个能上网的浏览器（推荐 Chrome）
- 项目负责人给你的 GitHub 账号权限（你需要能访问 [项目仓库](https://github.com/Wayhhow/survey-map)）

---

### 第一步：从 Google My Maps 导出 KML 文件

1. 打开浏览器，访问 [Google My Maps](https://www.google.com/maps/d/)，登录你的 Google 账号
2. 找到并打开橙光队的地图项目
3. 确认地图上有你新添加的线路（如果没有，先在地图上画好线路再继续）
4. 在地图名称旁边，点击 **"文件夹"图标** 或 **三个点的菜单按钮**
5. 选择 **"导出为 KML"**（Export to KML）
6. 在弹出的选项中，**不要勾选** "Export as KML instead of KMZ"（保持默认即可）
7. 点击 **下载**，会得到一个 `.kml` 文件（比如叫 `无障碍督导路线.kml`）
8. 把这个文件保存到一个你能找到的位置（比如桌面）

> 💡 **提示**：如果下载的是 `.kmz` 文件，那说明导出方式不对，请重新按上面的步骤操作，确保选的是 KML 格式。

---

### 第二步：把 KML 文件转换成项目需要的格式

1. 把刚才下载的 `.kml` 文件复制到项目的根目录下（就是 `survey-map` 文件夹里，和 `convert-kml.js` 同一个目录）
2. 打开电脑的 **终端**（Terminal）：
   - **Windows**：按 `Win + R`，输入 `cmd`，回车
   - **Mac**：按 `Cmd + 空格`，输入 `Terminal`，回车
3. 用 `cd` 命令进入项目文件夹，例如：
   ```bash
   cd Desktop/Accessibility_Map_Visualization/survey-map
   ```
   > 💡 如果路径有空格或中文，用引号包起来：`cd "C:\Users\你的用户名\Desktop\survey-map"`
4. **首次使用**需要安装依赖（以后就不需要了）：
   ```bash
   npm install
   ```
   > 💡 如果提示 `npm 不是内部命令`，说明你没装 Node.js，去 [Node.js 官网](https://nodejs.org/) 下载安装 LTS 版本，装完重启终端再试。
5. 运行转换命令（把 `你的文件名.kml` 换成你实际的文件名）：
   ```bash
   node convert-kml.js 你的文件名.kml data/routes.geojson
   ```
6. 看到类似下面的输出就说明成功了：
   ```
   转换成功！输出文件: data/routes.geojson
   成功更新路线详情 CSV 文件！新增了 3 条路线记录。输出文件: data/route_details.csv
   ```
   > 💡 如果显示 `CSV 文件无需更新，没有发现新的路线`，说明 KML 里没有新线路，不需要更新。

---

### 第三步：手动填写勘测信息

转换完成后，`data/route_details.csv` 文件会自动更新——新线路会被添加到表格最下面。但它们的"勘测日期"和"无障碍不规范点"两列是空的，需要你手动填写。

1. 不要用 **Excel** （可能会乱码），用 **记事本或者代码编译器** 打开 `data/route_details.csv`
2. 你会看到类似这样的表格：

   | 名称 | 勘测日期 | 无障碍不规范点 |
   |------|----------|----------------|
   | 一号门-三号门 | 2025-12-7 | 10 spots |
   | ... | ... | ... |
   | **新线路A** | **（空）** | **（空）** |
   | **新线路B** | **（空）** | **（空）** |

3. 在新线路对应的行里，填写：
   - **勘测日期**：格式为 `年-月-日`，例如 `2026-5-7`
   - **无障碍不规范点**：格式为 `数字 + spots`，例如 `5 spots`（表示发现了 5 个不规范点）
4. 如果这条线路还没去勘测，两列可以暂时留空
5. **保存文件**

> ⚠️ **重要**：不要修改已有线路的名称，不要调换行的顺序，只填写空的日期和不规范点即可。

---

### 第四步：把更新上传到 GitHub

1. 打开终端，确保你还在 `survey-map` 目录下
2. 依次输入以下三条命令：

   ```bash
   git add data/routes.geojson data/route_details.csv
   ```

   这条命令告诉 Git："我要把这两个文件的修改加进来。"

   ```bash
   git commit -m "更新线路数据：添加新勘测路线"
   ```

   这条命令确认修改，引号里的文字是本次更新的说明，你可以改成更具体的描述，比如 `"更新线路数据：添加学苑大道新路段"`。

   ```bash
   git push origin main
   ```

   这条命令把修改推送到 GitHub 服务器。

3. 等待 1–2 分钟，访问 [在线地图](https://wayhhow.github.io/survey-map/) 就能看到更新后的数据了！

> 💡 **如果 `git push` 报错**：可能是别人在你之前更新了代码，先运行 `git pull origin main` 拉取最新代码，再重新 `git push origin main`。

---

### 完整流程一图流

```
Google My Maps 画线路 → 导出 KML 文件 → 运行转换脚本 → CSV 自动新增空行 → 手动填写日期和不规范点 → git 推送到 GitHub → 地图自动更新
```

### 常见问题

| 问题 | 解决办法 |
|------|----------|
| `npm install` 报错 | 确认已安装 [Node.js](https://nodejs.org/)，装完重启终端 |
| `node convert-kml.js` 报错 | 确认 KML 文件放在了 `survey-map` 目录下，文件名没有中文或空格 |
| `git push` 被拒绝 | 先运行 `git pull origin main`，再重新 `git push origin main` |
| 地图上没显示新线路 | 等 1–2 分钟让 GitHub Pages 重新部署，然后刷新页面（Ctrl+F5 强制刷新） |
| CSV 文件用 Excel 打开乱码 | 用记事本打开确认内容正确，Excel 乱码不影响网站显示 |

<a id="accessibility-maintenance"></a>
## 🔄 无障碍设施数据维护

### 数据来源

| 来源 | 数据类型 | 坐标系 | 更新方式 |
|------|----------|--------|----------|
| OpenStreetMap | 无障碍卫生间、轮椅可达场所 | WGS84 | `npm run fetch-accessibility` |
| 高德地图 POI | 无障碍卫生间、母婴室等 | GCJ-02 | `AMAP_KEY=你的key npm run fetch-amap` |
| 深圳地铁 | 地铁站无障碍设施 | WGS84 | `npm run process-metro` |

### 更新 OSM 无障碍设施数据

```bash
npm run fetch-accessibility
```

脚本会从 Overpass API 获取深圳市范围内的无障碍设施数据，自动保存到 `data/accessibility/` 目录。

### 更新高德地图 POI 数据

1. 在 [高德开放平台](https://lbs.amap.com/) 注册账号，创建应用获取 Web 服务 API Key（免费）
2. 运行脚本：

```bash
# Windows PowerShell
$env:AMAP_KEY="你的key"; npm run fetch-amap

# Linux/Mac
AMAP_KEY=你的key npm run fetch-amap
```

脚本会搜索深圳区域的无障碍卫生间、母婴室、无障碍电梯等 POI，自动与 OSM 数据合并去重。

### 更新深圳地铁无障碍设施数据

1. 从 [深圳政府数据开放平台](https://opendata.sz.gov.cn) 下载以下数据（CSV 格式）：
   - "深圳地铁站点信息" → 保存为 `data/metro_stations.csv`
   - "深圳地铁站点无障碍设施位置清单" → 保存为 `data/metro_accessibility.csv`
   - "深圳地铁站点洗手间位置清单" → 保存为 `data/metro_toilets.csv`
2. 运行脚本：

```bash
npm run process-metro
```

脚本会自动关联站点名称与坐标，生成 GeoJSON 并合并到现有数据中。

### 坐标系说明

本项目使用高德地图瓦片（GCJ-02 坐标系）。不同数据源的坐标处理方式：

- **路线数据**（routes.geojson）：来自 Google My Maps 中国区，坐标已是 GCJ-02，无需转换
- **OSM 数据**：WGS84 坐标，前端自动转换为 GCJ-02 显示
- **高德 POI 数据**：已是 GCJ-02 坐标，无需转换
- **地铁数据**：坐标来自 OSM（WGS84），前端自动转换

<a id="dev"></a>
## 👨‍💻 本地开发

启动本地静态服务器预览：

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

浏览器访问 `http://localhost:8000`。

<a id="notes"></a>
## ⚠️ 注意事项

- 确保 Google My Maps 导出的 KML 包含线路数据
- 转换后的 GeoJSON 应置于 `data/routes.geojson`
- 线路 `properties.type` 字段用于区分类型，未指定时默认为"待勘测"
- 星标历史图表由 GitHub Actions 每 6 小时自动更新
- 无障碍设施数据来自 OpenStreetMap（ODbL 许可证）、高德地图和深圳地铁，需标注数据来源
- 高德 API Key 通过环境变量 `AMAP_KEY` 传入，不要写入源码
- 无障碍设施点位默认隐藏，用户可通过面板开关控制显示，设置保存在浏览器 localStorage

<a id="about"></a>
## 👥 关于我们

**南方科技大学致诚书院"橙光"志愿服务队**

我们致力于无障碍公益行动，通过实地勘测推动城市无障碍环境改善。本项目为系列督导活动提供数据可视化支持。

<a id="author"></a>
## 👤 作者

**Wayhhow**
- GitHub: [@Wayhhow](https://github.com/Wayhhow)

<a id="stars"></a>
## 🌟 Star History

<a href="https://www.star-history.com/?repos=Wayhhow%2Fsurvey-map&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Wayhhow/survey-map&type=date&theme=dark&legend=top-left&sealed_token=VBZFny5P0iUdeBVI8OwdZMrguZ5G76agpzY7BDMwJ3HfexeHy1xK5L-VQyjl23WVhvZZ2zUaJOPh4kVCL2ef77bm1nHPTYA4qXztMgz9HfB8yxILqREdPQ" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Wayhhow/survey-map&type=date&legend=top-left&sealed_token=VBZFny5P0iUdeBVI8OwdZMrguZ5G76agpzY7BDMwJ3HfexeHy1xK5L-VQyjl23WVhvZZ2zUaJOPh4kVCL2ef77bm1nHPTYA4qXztMgz9HfB8yxILqREdPQ" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Wayhhow/survey-map&type=date&legend=top-left&sealed_token=VBZFny5P0iUdeBVI8OwdZMrguZ5G76agpzY7BDMwJ3HfexeHy1xK5L-VQyjl23WVhvZZ2zUaJOPh4kVCL2ef77bm1nHPTYA4qXztMgz9HfB8yxILqREdPQ" />
 </picture>
</a>

<a id="license"></a>
## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

<p align="center">
  🌟 如果你觉得这个项目有用，请给它点个星吧！
</p>
