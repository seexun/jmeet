# AI 降噪交付说明

会议客户端使用 DeepFilterNet3 WebAssembly 在浏览器本地处理麦克风音频，处理后的轨道再发布至 LiveKit。模型及 WASM 位于 `src/assets/ai-noise`，运行时不访问公网。

## 运行策略

- 用户主动开启，偏好保存在浏览器本地；默认仍使用 WebRTC AEC、自动增益与基础降噪。
- 不支持 AudioWorklet/WASM、模型加载失败或轨道不可用时，立即回退基础降噪，不阻断麦克风。
- 切换麦克风时重新挂载处理器；关闭时销毁处理器并释放 AudioContext。
- 首次开启需要加载约 24 MB 本地模型资产，建议反向代理开启缓存和 gzip/brotli（模型压缩包无需二次压缩）。

## 资产完整性

- `df_bg.wasm`: SHA-256 `440B5D12B6EA7D95008736F844221D7874EE15DE5CB10D3015002470FDBA0432`
- `DeepFilterNet3_onnx.tar.gz`: SHA-256 `C94D91F70911001C946E0FABB4AA9ADC37045F45A03B56008CB0C8244CB63616`

上线前需完成 Chrome、Edge、Firefox 和 Safari 的耳机/扬声器实机测试，并对键盘、风扇、空调、多人声及低配置终端记录 CPU、音频卡顿率和主观 MOS。第三方包采用 Apache-2.0 OR MIT，交付时应保留包内许可证文件。
