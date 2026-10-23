# adol_plan

随手改的华硕 a豆 随身 WiFi（中兴微 ZX297520V3，固件 `M2FW1.0_RBC_ZY_HTTP_SL_V01.01.02P42U28_01`）后台和配套工具。

原厂后台太慢且很多实用功能没暴露，重写了前端并补了常用后台常驻脚本。

## 做了什么

- 用 Vue 3 + Vite 重写了整个 Web 后台，构建后单文件 600K 左右，比原版 2MB 加载快得多
- 锁频段（LTE B1/B3/B5/B8/B34/B38/B39/B40/B41）与锁小区（PCI / EARFCN）
- 实时工模参数与信号监视（RSRP、SINR、母线电压、电量、NTC 换算的模组温度）
- 双频 WiFi 切换（2.4GHz / 5GHz）、短信读写收发、按键物理切卡守护
- 网页内集成简易 AT 控制台（基于 2048 端口 daemon）
- 采用内存阴影覆盖挂载（shadow mount），不修改只读 rootfs，重启或一键卸载即可完全还原原厂

## 目录

- `web/`: 前端 Vue 3 + TypeScript 源码
- `resources/`: 设备端二进制与脚本（`at_cond`、`collect.sh` 等），以及预编译的 web 静态文件
- `beta/`: 安装、持久化及卸载的脚本模板与设备端主控 `beta.sh`
- `build/`: 打包脚本 `pack_beta.py`
- `src/`: 设备端后台小工具源码（`at_cond.c`）

## 构建与打包

前端构建：

```bash
cd web
npm install
npm run build
```

产物会自动输出至 `resources/web/`。

打包安装包：

```bash
python build/pack_beta.py --zip
```

打包完成后会在上一级的 `release/` 目录下生成 `adol_plan_beta_<时间戳>_<版本号>.zip`。

## 刷入设备

设备开机并通过 USB 或 WiFi 连接电脑：

1. 双击运行 `install.bat`，脚本会自动通过 adb 推送文件并启动挂载；
2. 浏览器访问 `192.168.0.1` 即可进入新后台（默认密码 `admin`）；
3. 需要开机自启运行 `persist.bat`；
4. 恢复原厂运行 `uninstall.bat`。
