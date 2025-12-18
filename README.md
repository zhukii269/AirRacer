# 空中飞车 - 体感竞速

基于 WebGL 的未来风格 3D 竞速游戏，使用摄像头手势控制。

## 游戏特点

- 🎮 **体感控制**：使用摄像头识别手势，无需手柄或键盘
- 🚀 **未来风格**：科幻赛道和飞行器设计
- 🌐 **网页运行**：基于 WebGL，无需安装

## 操作说明

| 手势 | 动作 |
|------|------|
| 双手握虚拟方向盘，左手低 | 左转 |
| 双手握虚拟方向盘，右手低 | 右转 |
| 右手握拳 | 加速 |
| 右手张开 | 刹车 |

## 运行方法

```bash
cd 项目目录
npx http-server . -p 3000
```

然后在浏览器访问：http://localhost:3000

## 技术栈

- Three.js (WebGL)
- MediaPipe (手势识别)
- JavaScript

## 致谢

本项目基于 [HexGL](https://github.com/BKcore/HexGL) 改造，原作者 Thibaut Despoulain (BKcore)。
