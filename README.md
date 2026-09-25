# CareLab · 具身护工训练室

独立 Web Demo。左侧 37% 是多轮教学对话，右侧 63% 是动作模拟、示范参数和教练反馈。

## 训练案例

虚构的周阿姨，76 岁，观看并模仿护工的“坐姿上肢前伸—停留—回收”。她的跟随延迟、耸肩、前倾和酸累反应随示范幅度、节奏、连贯性、教学准备及累积疲劳变化。

训练对象是护工：解释动作、姿势准备、发现偏差、调整示范、确认感受。教学完成度由五项行为证据组成，不以长者的动作匹配分替代护工教学能力。

## 启动

需要 Node.js 20 或更新版本，无 npm 依赖，无外部 CDN。

```sh
node server.mjs
```

访问 http://localhost:4173 。不要直接通过 file:// 打开，因为浏览器 ES Modules 需要 HTTP。

## 静态部署

`npm run build` 生成 `dist/`，仅包含七个浏览器运行文件，不包含测试、截图、服务器或本地配置。所有资源使用相对路径，支持 GitHub Pages 仓库子路径。

GitHub Actions 配置位于 `.github/workflows/pages.yml`：推送到 `main` 后先运行单元测试，再构建和部署 GitHub Pages。仓库须先在 Settings → Pages 中将 Source 设置为 GitHub Actions。建仓库与首次部署仍需 GitHub 授权。

## 功能列表

- 自由中文输入和建议话术，多轮本地规则分支。
- 解释、准备、慢速引导、休息、询问感受和催促会产生不同反馈。
- 两名 SVG 人物的关节动画、长者延迟模仿、躯干代偿、手部轻颤。
- 参数化示范，或拖动护工手腕录制前伸、停留与回收。
- 拖动支持鼠标/触摸；选中护工手腕也可用方向键、Home、End。
- 低质量示范后的观察题、两轮前后对比、五项教学能力记录。
- 自动演示“先尝试—发现问题—休息—调整—验证感受”；自动演示与个人记录隔离，结束或停止后恢复个人成绩。
- 教学参考动画不计入成绩，暂停不记录未完成示范。
- 本次训练复盘及 JSON 导出；刷新后不保留会话。
- 可选浏览器 TTS，音色取决于系统。

## 数据来源和边界

这是本地确定性规则引擎与程序化动画，不调用 LLM，也不采集真人视频、摄像头姿态或麦克风。受训护工人物是操作代理，长者人物是虚拟案例。0–100 指标和动作参数仅用于本案例演示，不是临床量表、真实姿态测量、康复处方或能力认证。

## 文件

- `index.html` / `styles.css`：训练界面与响应式布局。
- `app.js`：教学交互、动画调度、手动轨迹、复盘。
- `scene.js` / `scene.css`：虚拟活动室和双人关节插画。
- `engine.js`：状态演化、多轮反馈和动作模型。
- `engine.test.js`：引擎单元测试。
- `motion.js` / `motion.test.js`：手动轨迹分段、时间归一化平滑度与测试。
- `browser-check.mjs`：浏览器端到端交互检查；需另行安装 Playwright。
- `server.mjs`：仅绑定本机的静态服务器。

## 测试

```sh
node --test engine.test.js motion.test.js
node --check app.js
node --check scene.js
```

浏览器测试使用环境变量 `PLAYWRIGHT_MODULE`（可选，Playwright 模块入口绝对路径）和 `BROWSER_EXECUTABLE`（可选，Chrome/Edge 可执行文件路径）；不指定则使用常规 Playwright 安装与浏览器。测试会生成 `preview-desktop.png`、`preview-trained.png`、`preview-motion.png` 和 `preview-mobile.png`。
