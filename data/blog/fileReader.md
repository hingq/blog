---
title: 'FileReader 与 URL.createObjectURL：前端文件读取的四种方式'
date: '2026-06-10'
tags: ['前端基础', 'JavaScript', '文件处理']
draft: false
summary: '前端拿到 File 或 Blob 后，常用的读取转化只有四条路：readAsText、readAsDataURL、readAsArrayBuffer 和 URL.createObjectURL。这篇文章梳理它们的返回类型、内存代价和适用场景，帮你快速判断该用哪一个。'
---

# FileReader 与 URL.createObjectURL

在前端，无论文件来自 `<input type="file">`、拖拽还是粘贴，拿到的都是一个 `File`（`Blob` 的子类）对象。它本身只是一个引用，要拿到里面的内容，常用的转化方式有四种：`readAsText`、`readAsDataURL`、`readAsArrayBuffer` 和 `URL.createObjectURL`。

它们的差别集中在两件事上：返回什么类型，以及付出多大的内存代价。

## FileReader 的基本用法

`FileReader` 是异步的。你调用 `readAsXxx()` 启动读取，结果不会马上返回，而是要等 `onload` 回调触发后从 `reader.result` 里取。

```js
const reader = new FileReader()

reader.onload = () => {
  console.log(reader.result) // 读取结果
}
reader.onerror = () => {
  console.error(reader.error)
}

reader.readAsText(file)
```

如果想用 `async/await`，包一层 Promise ：

```js
function readFile(file, method = 'readAsText') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader[method](file)
  })
}
```

下面三个方法的区别，只在于 `result` 最终是什么类型。

## readAsText

读成纯文本字符串。可以指定编码，默认是 `utf-8`，遇到 GBK 等老编码的文件需要手动传：

```js
reader.readAsText(file, 'gbk')
```

适用场景是读取文本内容：纯文本、JSON 配置、CSV 表格、XML 数据。读完直接 `JSON.parse` 或按行切分就能用。

## readAsDataURL

读成一段 Base64 编码的 Data URL，形如 `data:image/png;base64,...`。它把整个文件内容编码进了字符串里，所以文件多大字符串就多长——而且 Base64 会让体积膨胀约 33%。

```js
reader.onload = () => {
  img.src = reader.result // data:image/png;base64,...
}
reader.readAsDataURL(file)
```

它的好处是结果是一个自包含的字符串，能直接塞进 `src`、写进 HTML/CSS，不依赖任何外部引用。适合小文件的本地预览（比如头像上传预览），或者把小图标直接内联进页面以省掉一次 HTTP 请求。因为体积惩罚明显，不要拿它处理大文件。

## readAsArrayBuffer

读成 `ArrayBuffer`，也就是一段固定长度、连续的原始二进制内存。

`ArrayBuffer` 不能直接读写，你得套一层视图来操作它：用类型化数组（`Uint8Array`、`Int32Array` 等）按数值访问，或者用 `DataView` 做更精细的字节控制。

```js
reader.onload = () => {
  const bytes = new Uint8Array(reader.result)
  console.log(bytes[0]) // 第一个字节
}
reader.readAsArrayBuffer(file)
```

需要直接接触二进制时就用它，常见的有几类：

- **大文件分片上传**：配合 `Blob.prototype.slice()` 把文件切片，转成二进制分批上传。
- **前端文件校验**：计算文件的 MD5 / SHA256 特征码，常配合 `crypto.subtle` 或 SparkMD5 这类库。
- **二进制解析**：在前端直接解析 Excel 内部结构、PDF、音视频切片、ZIP 解压等。
- **实时通信**：通过 WebSocket 或 Fetch 传输纯二进制数据，追求更高性能。

## URL.createObjectURL

严格来说它不属于 `FileReader`，而是 `URL` 对象的静态方法。但在文件处理里，它和 `FileReader` 是并列的两条路，放在一起讲才完整。

它返回一个唯一的 Blob URL，形如 `blob:http://localhost:8080/a1b2c3d4-...`。和前面三个方法不同，它**不读取也不转码文件**，只是在内存里为这个 `File` / `Blob` 建一个临时引用，浏览器拿着这个 URL 就能直接访问到内存中的文件。

```js
const url = URL.createObjectURL(file)
video.src = url
```

它最大的优势是性能。即使是几个 GB 的视频，生成 URL 也是瞬间完成、几乎不占额外内存，因为它存的只是一个指针，而不像 Data URL 那样要把整个文件读成一个巨大的字符串。所以大文件、音视频、高清图的本地预览基本都用它；动态生成下载链接（配合 `<a>` 标签的 `download` 属性）也是它的常见用法。

> [!WARNING]
> `createObjectURL` 生成的 URL 生命周期跟当前文档绑定。页面不关闭，这个引用就一直留在内存里。用完必须手动调用 `URL.revokeObjectURL(url)` 释放，否则会造成内存泄漏。

```js
const url = URL.createObjectURL(file)
img.src = url
img.onload = () => URL.revokeObjectURL(url) // 用完即释放
```

## 选型指南

| 转换方式              | 返回类型        | 内存消耗               | 生命周期               | 最佳场景                       |
| --------------------- | --------------- | ---------------------- | ---------------------- | ------------------------------ |
| `readAsText`          | 文本字符串      | 取决于文本大小         | 随变量垃圾回收         | 读配置、JSON、文本内容         |
| `readAsDataURL`       | Base64 字符串   | 高（约原文件 1.33 倍） | 随字符串销毁           | 小文件预览、内联嵌入 HTML      |
| `readAsArrayBuffer`   | ArrayBuffer     | 适中（直接映射内存）   | 随变量垃圾回收         | 加密校验、切片上传、二进制解析 |
| `URL.createObjectURL` | Blob URL 字符串 | 极低（仅存指针）       | 需手动释放或等页面关闭 | 大文件、音视频的本地预览       |
