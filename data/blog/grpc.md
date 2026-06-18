---
title: 'gRPC'
date: '2026-06-18'
tags: ['grpc', '传输协议']
draft: false
summary: 'grpc相关知识介绍'
---

## 是什么gRPC

在 gRPC 里**客户端**应用可以像调用本地对象一样直接调用另一台不同的机器上**服务端**应用的方法，使得能够更容易地创建分布式应用和服务。

与许多 RPC 系统类似，gRPC 也是基于以下理念：定义一个**服务**，指定其能够被远程调用的方法（包含参数和返回类型）。在服务端实现这个接口，并运行一个 gRPC 服务器来处理客户端调用。在客户端拥有一个**存根**能够像服务端一样的方法。

### protocol buffers

gRPC 默认使用 _protocol buffers_，这是 Google 开源的一套成熟的结构数据序列化机制（当然也可以使用其他数据格式如 JSON）。在 [Protocol Buffers 文档](http://doc.oschina.net/https：//developers.google.com/protocol-buffers/docs/overview)可以到更多关于 Protocol Buffers 的资料。

### 定义服务

使用 protocol buffers 接口定义语言来定义服务方法，用 protocol buffer 来定义参数和返回类型。客户端和服务端均使用服务定义生成的接口代码。定义好服务，我们可以使用 protocol buffer 编译器 `protoc` 来生成创建应用所需的特定客户端和服务端的代码 ，可以生成任意 gRPC 支持的语言的代码

gRPC 基于如下思想：定义一个服务， 指定其可以被远程调用的方法及其参数和返回类型。gRPC 默认使用 [protocol buffers](https://developers.google.com/protocol-buffers/) 作为接口定义语言，来描述服务接口和有效载荷消息结构。如果有需要的话，可以使用其他替代方案。

```
service HelloService {
  rpc SayHello (HelloRequest) returns (HelloResponse);
}

message HelloRequest {
  required string greeting = 1;
}

message HelloResponse {
  required string reply = 1;
}
```

gRPC 允许你定义四类服务方法：

- 单项 RPC，即客户端发送一个请求给服务端，从服务端获取一个应答，就像一次普通的函数调用。

```
rpc SayHello(HelloRequest) returns (HelloResponse){
}
```

- 服务端流式 RPC，即客户端发送一个请求给服务端，可获取一个数据流用来读取一系列消息。客户端从返回的数据流里一直读取直到没有更多消息为止。

```
rpc LotsOfReplies(HelloRequest) returns (stream HelloResponse){
}
```

- 客户端流式 RPC，即客户端用提供的一个数据流写入并发送一系列消息给服务端。一旦客户端完成消息写入，就等待服务端读取这些消息并返回应答。

```
rpc LotsOfGreetings(stream HelloRequest) returns (HelloResponse) {
}
```

- 双向流式 RPC，即两边都可以分别通过一个读写数据流来发送一系列消息。这两个数据流操作是相互独立的，所以客户端和服务端能按其希望的任意顺序读写，例如：服务端可以在写应答前等待所有的客户端消息，或者它可以先读一个消息再写一个消息，或者是读写相结合的其他方式。每个数据流里消息的顺序会被保持。

```
rpc BidiHello(stream HelloRequest) returns (stream HelloResponse){
}
```

我们将在下面 RPC 生命周期章节里看到各类 RPC 的技术细节。

### 使用 API 接口

gRPC 提供 protocol buffer 编译插件，能够从一个服务定义的 .proto 文件生成客户端和服务端代码。通常 gRPC 用户可以在服务端实现这些API，并从客户端调用它们。

- 在服务侧，服务端实现服务接口，运行一个 gRPC 服务器来处理客户端调用。gRPC 底层架构会解码传入的请求，执行服务方法，编码服务应答。
- 在客户侧，客户端有一个*存根*实现了服务端同样的方法。客户端可以在本地存根调用这些方法，用合适的 protocol buffer 消息类型封装这些参数— gRPC 来负责发送请求给服务端并返回服务端 protocol buffer 响应。

### 同步 vs 异步

同步 RPC 调用一直会阻塞直到从服务端获得一个应答，这与 RPC 希望的抽象最为接近。另一方面网络内部是异步的，并且在许多场景下能够在不阻塞当前线程的情况下启动 RPC 是非常有用的。

在多数语言里，gRPC 编程接口同时支持同步和异步的特点。你可以从每个语言教程和参考文档里找到更多内容(很快就会有完整文档)。

## RPC 生命周期

现在让我们来仔细了解一下当 gRPC 客户端调用 gRPC 服务端的方法时到底发生了什么。我们不究其实现细节，关于实现细节的部分，你可以在我们的特定语言页面里找到更为详尽的内容。

### 单项 RPC

首先我们来了解一下最简单的 RPC 形式：客户端发出单个请求，获得单个响应。

- 一旦客户端通过桩调用一个方法，服务端会得到相关通知 ，通知包括客户端的元数据，方法名，允许的响应期限（如果可以的话）
- 服务端既可以在任何响应之前直接发送回初始的元数据，也可以等待客户端的请求信息，到底哪个先发生，取决于具体的应用。
- 一旦服务端获得客户端的请求信息，就会做所需的任何工作来创建或组装对应的响应。如果成功的话，这个响应会和包含状态码以及可选的状态信息等状态明细及可选的追踪信息返回给客户端 。
- 假如状态是 OK 的话，客户端会得到应答，这将结束客户端的调用。

### 服务端流式 RPC

服务端流式 RPC 除了在得到客户端请求信息后发送回一个应答流之外，与我们的简单例子一样。在发送完所有应答后，服务端的状态详情(状态码和可选的状态信息)和可选的跟踪元数据被发送回客户端，以此来完成服务端的工作。客户端在接收到所有服务端的应答后也完成了工作。

### 客户端流式 RPC

客户端流式 RPC 也基本与我们的简单例子一样，区别在于客户端通过发送一个请求流给服务端，取代了原先发送的单个请求。服务端通常（但并不必须）会在接收到客户端所有的请求后发送回一个应答，其中附带有它的状态详情和可选的跟踪数据。

### 双向流式 RPC

双向流式 RPC ，调用由客户端调用方法来初始化，而服务端则接收到客户端的元数据，方法名和截止时间。服务端可以选择发送回它的初始元数据或等待客户端发送请求。 下一步怎样发展取决于应用，因为客户端和服务端能在任意顺序上读写 - 这些流的操作是完全独立的。例如服务端可以一直等直到它接收到所有客户端的消息才写应答，或者服务端和客户端可以像"乒乓球"一样：服务端后得到一个请求就回送一个应答，接着客户端根据应答来发送另一个请求，以此类推。

### 简单 RPC

`routeGuideServer` 实现了我们所有的服务方法。首先让我们看看最简单的类型 `GetFeature`，它从客户端拿到一个 `Point` 对象，然后从返回包含从数据库拿到的feature信息的 `Feature`.

```go
func (s *routeGuideServer) GetFeature(ctx context.Context, point *pb.Point) (*pb.Feature, error) {
    for _, feature := range s.savedFeatures {
        if proto.Equal(feature.Location, point) {
            return feature, nil
        }
    }
    // No feature was found, return an unnamed feature
    return &pb.Feature{"", point}, nil
}
```

```js
function checkFeature(point) {
  var feature
  // Check if there is already a feature object for the given point
  for (var i = 0; i < feature_list.length; i++) {
    feature = feature_list[i]
    if (
      feature.location.latitude === point.latitude &&
      feature.location.longitude === point.longitude
    ) {
      return feature
    }
  }
  var name = ''
  feature = {
    name: name,
    location: point,
  }
  return feature
}
function getFeature(call, callback) {
  callback(null, checkFeature(call.request))
}
```

该方法传入了 RPC 的上下文对象，以及客户端的 `Point` protocol buffer请求。它返回了一个包含响应信息和`error` 的 `Feature` protocol buffer对象。在方法中我们用适当的信息填充 `Feature`，然后将其和一个`nil`错误一起返回，告诉 gRPC 我们完成了对 RPC 的处理，并且 `Feature` 可以返回给客户端。

### 创建存根

[node](https://github.com/grpc/grpc-node/blob/%40grpc/grpc-js%401.9.0/examples/routeguide/dynamic_codegen/route_guide_server.js)

[go](https://github.com/grpc/grpc-go/blob/master/examples/route_guide/client/client.go)

要调用服务方法，我们首先需要创建一个*存根（stub）*。为此，我们只需要调用 RouteGuide 存根构造函数，并指定服务器地址和端口。

```js
new routeguide.RouteGuide('localhost:50051', grpc.credentials.createInsecure())
```

### 调用服务方法

现在让我们看看如何调用我们的服务方法。请注意，所有这些方法都是异步的：它们使用事件或回调函数来获取结果。

### 简单 RPC

调用简单的 RPC `GetFeature` 几乎和调用本地异步方法一样简单。

```js
var point = { latitude: 409146138, longitude: -746188906 }
stub.getFeature(point, function (err, feature) {
  if (err) {
    // process error
  } else {
    // process feature
  }
})
```
