# 常见问题解答

## 📋 项目相关

### Q: 这个项目的主要功能是什么？
**A:** 本项目是无障碍督导路线可视化地图应用，用于展示和管理无障碍设施督导活动的路线数据，支持线路展示、类型区分、长度统计和勘测详情查看。

### Q: 谁开发和维护这个项目？
**A:** 项目由南方科技大学致诚书院"橙光"志愿服务队开发和维护，主要维护者是 [Wayhhow](https://github.com/Wayhhow)。

### Q: 项目的技术栈是什么？
**A:** 前端使用 Leaflet.js 地图库、高德地图瓦片、Turf.js 地理计算；数据采用 GeoJSON 和 CSV 格式；部署在 GitHub Pages，使用 GitHub Actions 实现自动化部署。

## 🛠 技术相关

### Q: 如何在本地运行项目？
**A:** 启动本地静态服务器即可：
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```
然后访问 `http://localhost:8000`。

### Q: 如何添加新的线路数据？
**A:**
1. 在 Google My Maps 中绘制线路
2. 导出为 KML 文件
3. 运行 `node convert-kml.js input.kml` 转换为 GeoJSON
4. 将生成的 `routes.geojson` 放入 `data/` 目录
5. 提交并推送更改

### Q: 如何修改线路类型的颜色？
**A:** 编辑 `data/types.json` 文件，修改对应类型的 `color` 属性即可。

## 📊 数据管理

### Q: CSV 文件中的数据会被自动覆盖吗？
**A:** 不会。`convert-kml.js` 转换过程会保留已有的手动填写数据（勘测日期、无障碍不规范点），只为新路线添加新行。

### Q: 如何添加或修改线路的勘测日期和不规范点？
**A:** 直接编辑 `data/route_details.csv` 文件，填写对应的字段即可。

### Q: 如何删除线路？
**A:** 从 Google My Maps 中删除对应的线路，然后重新导出、转换并更新 GeoJSON 文件。

## 🚀 部署相关

### Q: 如何部署到 GitHub Pages？
**A:**
1. 在 GitHub 上创建仓库
2. 开启 GitHub Pages 功能（Settings → Pages）
3. 选择 `main` 分支作为发布源
4. 推送代码到仓库
5. 等待 1–2 分钟完成部署

### Q: 部署后多久能看到更新？
**A:** GitHub Pages 通常需要 1–2 分钟完成构建和部署。

## 🔧 故障排除

### Q: 地图加载失败怎么办？
**A:**
- 检查网络连接
- 清除浏览器缓存
- 确认 `data/routes.geojson` 文件存在且格式正确
- 检查浏览器控制台是否有错误信息

### Q: 线路显示不正确怎么办？
**A:**
- 检查 GeoJSON 文件格式是否正确
- 确认线路数据包含正确的坐标信息
- 检查 `data/types.json` 类型配置是否正确

### Q: 统计数据显示错误怎么办？
**A:**
- 检查 CSV 文件格式是否正确
- 确认线路名称与 CSV 中的记录匹配
- 检查 `js/data.js` 中的统计逻辑

### Q: 转换 KML 文件失败怎么办？
**A:**
- 确认 KML 文件格式正确
- 检查 Node.js 环境是否正常
- 查看命令行输出的错误信息

## 🤝 贡献相关

### Q: 如何贡献代码？
**A:** 参考 [CONTRIBUTING.md](CONTRIBUTING.md) 文档，按照 Fork → 开发 → 提交 Pull Request 的流程进行贡献。

### Q: 发现 Bug 如何报告？
**A:** 在 GitHub Issues 中创建新 Issue，详细描述问题、复现步骤和预期行为。

## 📞 联系我们

### Q: 如何联系项目维护者？
**A:**
- GitHub Issues: [https://github.com/Wayhhow/survey-map/issues](https://github.com/Wayhhow/survey-map/issues)
- 项目维护者: [Wayhhow](https://github.com/Wayhhow)

---

如有其他问题，欢迎在 GitHub Issues 中提问。
