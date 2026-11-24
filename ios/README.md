# 择稿 iOS v0.1.0

面向同人文与小说创作的 DSH 写作插件，支持候选稿比较与采用、讨论和续写、手工编辑与局部修改、TXT参考材料、阅读、导出和备份恢复。

## 使用前请先安装 Fish Pocket

**Fish Pocket 是使用择稿 iOS 的必需前置应用。** 请先前往 [App Store 下载 Fish Pocket](https://apps.apple.com/cn/app/fish-pocket/id6830703602)，完成应用基础设置，再将择稿 TGZ 安装包和安装提示词一起交给 Fish Pocket 内部 AI，由它通过正式插件管理机制完成安装。

安装完成后，在目标版本 Fish Pocket 的 **“探索 → 网页版”** 中打开择稿工具。选稿、编辑和阅读页面运行在官方网页版中，原生聊天界面不显示这些自定义页面。

- [Fish Pocket 开源项目](https://github.com/imsai-sh/fish-pocket)
- 适配目标：Fish Pocket **1.2.1（120）**，内置 DSH **0.2.2-rc.4**。
- 当前构建：**0.1.0-txt-fold-r5**。原记录中36项本机自动检查通过，最新构建的完整手机验收仍待完成；不承诺其他宿主或任意引擎版本兼容。

## 下载与安装

1. 下载 [手机安装包 ZIP](release-assets/择稿_iOS_v0.1.0_手机安装包.zip)，解压取得TGZ、攻略和提示词。也可单独下载 [插件 TGZ](release-assets/dsh-zegao-ios-0.1.0.tgz) 与 [安装提示词](release-assets/择稿_iOS_v0.1.0_安装提示词.txt)。
2. 将TGZ作为附件交给Fish Pocket内部AI，同时发送提示词。TGZ本身不解压，不使用解压目录link安装。
3. 按Fish Pocket给出的结果完成检查；需要正常重启前先保存未发送草稿。若要求删除、卸载或迁移数据，先停止并核对。
4. 进入官方网页版打开择稿工具。

iOS安装由Fish Pocket完成，无需另外安装择稿安装助手。GitHub自动生成的Source code压缩包用于查阅源码，不是手机插件安装包。模型任务使用宿主已配置的模型服务，可能产生相应费用。

## 文件导航

| 目录或文件 | 内容 |
| --- | --- |
| [plugin/](plugin/) | 独立工程、源码、锁文件、编译文件、测试和必需项目素材 |
| [release-assets/](release-assets/) | 安装包、安装提示词、攻略、功能介绍、变更说明和校验清单 |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | 拟发布说明、适配范围和验证边界 |
| [安装与验收攻略](release-assets/择稿_iOS_v0.1.0_安装与验收攻略.txt) | 安装、更新及检查步骤 |
| [完整功能介绍](release-assets/择稿_iOS_v0.1.0_功能介绍.txt) | 当前功能与使用方式 |
| [SHA256SUMS.txt](release-assets/SHA256SUMS.txt) | 本次发布附件的校验值 |

正式作品使用宿主独立存储域；请用择稿JSON备份保存完整作品，宿主普通聊天导出不自动包含择稿作品数据。更多限制请阅读发布说明。

代码许可见 [plugin/LICENSE](plugin/LICENSE)，测试第三方夹具保留其自身许可。品牌图像为项目素材，不作为通用品牌授权。

## 欢迎反馈与更新建议

欢迎大家分享使用感受，提出功能需求和更新建议。无论是选稿、改稿、参考材料、阅读导出，还是使用中不够顺手的小细节，都可以在本仓库的 Issues 中告诉我们。

遇到问题时，请尽量附上择稿版本、Fish Pocket 版本、操作步骤和截图，便于复现和改进。请隐去账号信息、API Key 和不希望公开的稿件内容。谢谢每一位愿意试用、反馈的朋友，希望择稿能逐步成为更贴合你写作习惯的工具。
