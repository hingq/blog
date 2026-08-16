---
title: 'Go 基础知识整理'
date: '2026-07-30'
tags: ['Go']
draft: false
summary: '整理 Go 语言的基础语法、数据类型、函数、并发、错误处理、泛型和常用标准库。'
---

# Go 基础知识整理

## 基本程序结构

```go
package main

import "fmt"

func main() {
	fmt.Println("Hello, Go!")
}
```

说明：

- `package main`：声明当前文件属于 `main` 包
- `import "fmt"`：导入标准库
- `func main()`：程序入口
- `fmt.Println()`：输出内容

运行程序：

```bash
go run main.go
```

编译程序：

```bash
go build main.go
```

---

## 变量

### 完整声明

```go
var name string = "Tom"
var age int = 18
```

### 类型推断

```go
var name = "Tom"
var age = 18
```

### 简短声明

只能在函数内部使用：

```go
name := "Tom"
age := 18
```

### 批量声明

```go
var (
	name string = "Tom"
	age  int    = 18
)
```

### 零值

变量没有赋值时，会获得对应类型的零值：

```go
var number int     // 0
var price float64  // 0
var text string    // ""
var enabled bool   // false
var pointer *int   // nil
```

---

## 常量

```go
const pi = 3.14
const appName string = "Go App"
```

批量声明：

```go
const (
	StatusSuccess = 200
	StatusNotFound = 404
)
```

使用 `iota` 创建递增常量：

```go
const (
	Monday = iota // 0
	Tuesday       // 1
	Wednesday     // 2
)
```

---

## 基本数据类型

### 整数

```go
var age int = 18
var number int64 = 100
var count uint = 10
```

常见类型：

- `int`
- `int8`
- `int16`
- `int32`
- `int64`
- `uint`
- `uint8`
- `uint16`
- `uint32`
- `uint64`

### 浮点数

```go
var price float32 = 19.9
var amount float64 = 99.99
```

### 字符串

```go
name := "Go语言"
```

多行字符串：

```go
text := `
第一行
第二行
`
```

字符串不可直接修改：

```go
name := "Go"
// name[0] = 'g' // 错误
```

### 布尔值

```go
enabled := true
finished := false
```

### byte 和 rune

```go
var b byte = 'A'
var r rune = '中'
```

- `byte` 是 `uint8` 的别名
- `rune` 是 `int32` 的别名
- `rune` 常用于表示 Unicode 字符

---

## 类型转换

Go 不会自动转换不同类型：

```go
age := 18
price := float64(age)

fmt.Println(price)
```

字符串和数字转换通常使用 `strconv`：

```go
package main

import (
	"fmt"
	"strconv"
)

func main() {
	number, err := strconv.Atoi("123")
	if err != nil {
		fmt.Println("转换失败")
		return
	}

	text := strconv.Itoa(456)

	fmt.Println(number)
	fmt.Println(text)
}
```

---

## 运算符

### 算术运算符

```go
a := 10
b := 3

fmt.Println(a + b) // 13
fmt.Println(a - b) // 7
fmt.Println(a * b) // 30
fmt.Println(a / b) // 3
fmt.Println(a % b) // 1
```

整数相除的结果仍然是整数：

```go
fmt.Println(10 / 3) // 3
```

### 比较运算符

```go
a == b
a != b
a > b
a < b
a >= b
a <= b
```

### 逻辑运算符

```go
a && b // 与
a || b // 或
!a     // 非
```

---

## 条件判断

### if

```go
age := 20

if age >= 18 {
	fmt.Println("成年人")
} else {
	fmt.Println("未成年人")
}
```

### else if

```go
score := 85

if score >= 90 {
	fmt.Println("优秀")
} else if score >= 60 {
	fmt.Println("及格")
} else {
	fmt.Println("不及格")
}
```

### 在 if 中声明变量

```go
if score := 80; score >= 60 {
	fmt.Println("及格")
}
```

变量 `score` 只能在当前 `if` 结构中使用。

---

## switch

```go
day := 2

switch day {
case 1:
	fmt.Println("星期一")
case 2:
	fmt.Println("星期二")
default:
	fmt.Println("其他")
}
```

多个条件：

```go
switch day {
case 1, 2, 3, 4, 5:
	fmt.Println("工作日")
case 6, 7:
	fmt.Println("周末")
}
```

不指定判断变量：

```go
score := 85

switch {
case score >= 90:
	fmt.Println("优秀")
case score >= 60:
	fmt.Println("及格")
default:
	fmt.Println("不及格")
}
```

Go 的 `case` 默认不会自动执行下一个分支。

---

## 循环

Go 只有 `for` 循环。

### 普通循环

```go
for i := 0; i < 3; i++ {
	fmt.Println(i)
}
```

### 类似 while

```go
count := 0

for count < 3 {
	fmt.Println(count)
	count++
}
```

### 无限循环

```go
for {
	fmt.Println("持续执行")
}
```

### break 和 continue

```go
for i := 0; i < 10; i++ {
	if i == 3 {
		continue
	}

	if i == 8 {
		break
	}

	fmt.Println(i)
}
```

- `continue`：跳过本次循环
- `break`：结束循环

---

## 数组

数组长度固定，并且长度属于数组类型的一部分。

```go
numbers := [3]int{10, 20, 30}

fmt.Println(numbers[0])
fmt.Println(len(numbers))
```

自动计算长度：

```go
numbers := [...]int{10, 20, 30}
```

遍历数组：

```go
for index, value := range numbers {
	fmt.Println(index, value)
}
```

---

## 切片（Slice）

切片是动态长度的集合，比数组更常用。

```go
numbers := []int{10, 20, 30}
```

添加元素：

```go
numbers = append(numbers, 40)
```

截取切片：

```go
numbers := []int{10, 20, 30, 40}

fmt.Println(numbers[1:3]) // [20 30]
fmt.Println(numbers[:2])  // [10 20]
fmt.Println(numbers[2:])  // [30 40]
```

使用 `make`：

```go
numbers := make([]int, 3, 5)
```

- 长度：`3`
- 容量：`5`

```go
fmt.Println(len(numbers))
fmt.Println(cap(numbers))
```

复制切片：

```go
source := []int{1, 2, 3}
target := make([]int, len(source))

copy(target, source)
```

---

## map

`map` 用于存储键值对。

```go
scores := map[string]int{
	"Tom":  90,
	"Jack": 80,
}
```

添加和修改：

```go
scores["Lucy"] = 95
scores["Tom"] = 100
```

读取：

```go
fmt.Println(scores["Tom"])
```

判断键是否存在：

```go
score, exists := scores["Bob"]

if exists {
	fmt.Println(score)
} else {
	fmt.Println("不存在")
}
```

删除：

```go
delete(scores, "Tom")
```

遍历：

```go
for name, score := range scores {
	fmt.Println(name, score)
}
```

使用 `make` 创建：

```go
scores := make(map[string]int)
```

---

## 函数

### 普通函数

```go
func add(a int, b int) int {
	return a + b
}
```

相同类型可以简写：

```go
func add(a, b int) int {
	return a + b
}
```

### 多个返回值

```go
func divide(a, b int) (int, int) {
	return a / b, a % b
}

func main() {
	result, remainder := divide(10, 3)
	fmt.Println(result, remainder)
}
```

忽略某个返回值：

```go
result, _ := divide(10, 3)
```

### 命名返回值

```go
func calculate(a, b int) (sum int, difference int) {
	sum = a + b
	difference = a - b
	return
}
```

### 可变参数

```go
func sum(numbers ...int) int {
	total := 0

	for _, number := range numbers {
		total += number
	}

	return total
}

func main() {
	fmt.Println(sum(1, 2, 3, 4))
}
```

### 匿名函数

```go
add := func(a, b int) int {
	return a + b
}

fmt.Println(add(1, 2))
```

---

## 指针

指针保存变量的内存地址。

```go
number := 10
pointer := &number

fmt.Println(pointer)  // 地址
fmt.Println(*pointer) // 10
```

通过指针修改变量：

```go
*pointer = 20

fmt.Println(number) // 20
```

- `&变量`：获取变量地址
- `*指针`：访问指针指向的值

函数中使用指针：

```go
func change(number *int) {
	*number = 100
}

func main() {
	value := 10
	change(&value)

	fmt.Println(value) // 100
}
```

---

## 结构体（struct）

结构体用于组合多个字段。

```go
type User struct {
	Name string
	Age  int
}
```

创建结构体：

```go
user := User{
	Name: "Tom",
	Age:  18,
}
```

访问和修改字段：

```go
fmt.Println(user.Name)

user.Age = 20
```

结构体指针：

```go
user := &User{
	Name: "Tom",
	Age:  18,
}

user.Age = 20
```

Go 会自动处理：

```go
user.Age
```

不需要手动写成：

```go
(*user).Age
```

---

## 方法

方法是绑定到特定类型的函数。

### 值接收者

```go
type User struct {
	Name string
	Age  int
}

func (u User) SayHello() {
	fmt.Println("你好，我是", u.Name)
}
```

调用：

```go
user := User{Name: "Tom", Age: 18}
user.SayHello()
```

值接收者不会修改原对象：

```go
func (u User) GrowUp() {
	u.Age++
}
```

### 指针接收者

```go
func (u *User) GrowUp() {
	u.Age++
}
```

指针接收者可以修改原对象：

```go
user.GrowUp()
fmt.Println(user.Age)
```

通常以下情况使用指针接收者：

- 需要修改对象
- 结构体较大，避免复制
- 希望方法集合保持一致

---

## 接口（interface）

接口定义一组行为。

```go
type Speaker interface {
	Speak()
}
```

实现接口：

```go
type Dog struct{}

func (d Dog) Speak() {
	fmt.Println("汪汪")
}
```

使用接口：

```go
func makeSound(s Speaker) {
	s.Speak()
}

func main() {
	dog := Dog{}
	makeSound(dog)
}
```

Go 使用隐式接口实现：只要类型实现了接口要求的所有方法，就自动实现该接口。

### 空接口

```go
var value any

value = 100
value = "hello"
value = true
```

`any` 是 `interface{}` 的别名。

类型断言：

```go
value := any("hello")

text, ok := value.(string)
if ok {
	fmt.Println(text)
}
```

类型选择：

```go
func printType(value any) {
	switch v := value.(type) {
	case int:
		fmt.Println("整数：", v)
	case string:
		fmt.Println("字符串：", v)
	default:
		fmt.Println("其他类型")
	}
}
```

---

## 错误处理

Go 通常使用返回值处理错误。

```go
package main

import (
	"errors"
	"fmt"
)

func divide(a, b int) (int, error) {
	if b == 0 {
		return 0, errors.New("除数不能为 0")
	}

	return a / b, nil
}

func main() {
	result, err := divide(10, 0)

	if err != nil {
		fmt.Println("错误：", err)
		return
	}

	fmt.Println(result)
}
```

格式化错误：

```go
return 0, fmt.Errorf("无效的除数：%d", b)
```

判断错误：

```go
if errors.Is(err, targetErr) {
	// 处理指定错误
}
```

---

## defer

`defer` 会将函数调用推迟到当前函数结束前执行。

```go
func main() {
	defer fmt.Println("最后执行")

	fmt.Println("先执行")
}
```

输出：

```text
先执行
最后执行
```

多个 `defer` 按后进先出的顺序执行：

```go
defer fmt.Println("第一个注册")
defer fmt.Println("第二个注册")
```

输出：

```text
第二个注册
第一个注册
```

常见用途：

- 关闭文件
- 释放锁
- 关闭数据库连接
- 清理资源

---

## panic 和 recover

`panic` 用于表示程序无法正常继续执行：

```go
panic("发生严重错误")
```

使用 `recover` 捕获 `panic`：

```go
func safeRun() {
	defer func() {
		if err := recover(); err != nil {
			fmt.Println("捕获错误：", err)
		}
	}()

	panic("程序异常")
}
```

普通业务错误优先使用 `error`，不要随意使用 `panic`。

---

## 包和模块

### 初始化模块

```bash
go mod init example.com/myapp
```

生成：

```text
go.mod
```

### 项目结构

```text
myapp/
├── go.mod
├── main.go
└── calculator/
    └── calculator.go
```

`calculator/calculator.go`：

```go
package calculator

func Add(a, b int) int {
	return a + b
}
```

`main.go`：

```go
package main

import (
	"fmt"

	"example.com/myapp/calculator"
)

func main() {
	fmt.Println(calculator.Add(1, 2))
}
```

首字母大写的名称可以被其他包访问：

```go
func Add() {} // 公开
func add() {} // 包内私有
```

---

## goroutine

使用 `go` 关键字启动并发任务：

```go
package main

import (
	"fmt"
	"time"
)

func sayHello() {
	fmt.Println("Hello")
}

func main() {
	go sayHello()

	time.Sleep(time.Second)
}
```

匿名 goroutine：

```go
go func() {
	fmt.Println("异步执行")
}()
```

不能依赖 `Sleep` 管理真实并发程序，通常应使用 Channel 或 `sync.WaitGroup`。

---

## Channel

Channel 用于 goroutine 之间通信。

```go
package main

import "fmt"

func main() {
	ch := make(chan string)

	go func() {
		ch <- "任务完成"
	}()

	message := <-ch
	fmt.Println(message)
}
```

- `ch <- value`：发送数据
- `value := <-ch`：接收数据

### 缓冲 Channel

```go
ch := make(chan int, 2)

ch <- 10
ch <- 20

fmt.Println(<-ch)
fmt.Println(<-ch)
```

### 关闭 Channel

```go
close(ch)
```

读取关闭状态：

```go
value, ok := <-ch

if !ok {
	fmt.Println("Channel 已关闭")
}
```

遍历 Channel：

```go
for value := range ch {
	fmt.Println(value)
}
```

---

## select

`select` 用于同时等待多个 Channel。

```go
select {
case message := <-ch1:
	fmt.Println("收到 ch1：", message)
case message := <-ch2:
	fmt.Println("收到 ch2：", message)
default:
	fmt.Println("暂时没有数据")
}
```

超时控制：

```go
select {
case result := <-ch:
	fmt.Println(result)
case <-time.After(time.Second):
	fmt.Println("操作超时")
}
```

---

## sync.WaitGroup

等待多个 goroutine 完成：

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup

	for i := 0; i < 3; i++ {
		wg.Add(1)

		go func(id int) {
			defer wg.Done()
			fmt.Println("任务：", id)
		}(i)
	}

	wg.Wait()
	fmt.Println("全部完成")
}
```

---

## Mutex 互斥锁

多个 goroutine 修改共享数据时，可以使用锁：

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var (
		count int
		mu    sync.Mutex
		wg    sync.WaitGroup
	)

	for i := 0; i < 100; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()

			mu.Lock()
			count++
			mu.Unlock()
		}()
	}

	wg.Wait()
	fmt.Println(count)
}
```

也可以使用 `defer` 解锁：

```go
mu.Lock()
defer mu.Unlock()
```

---

## 泛型

泛型允许函数处理多种类型：

```go
func Add[T int | float64](a, b T) T {
	return a + b
}

func main() {
	fmt.Println(Add(1, 2))
	fmt.Println(Add(1.5, 2.5))
}
```

定义泛型类型：

```go
type Box[T any] struct {
	Value T
}
```

使用：

```go
numberBox := Box[int]{Value: 100}
textBox := Box[string]{Value: "hello"}
```

---

## 常用标准库

| 包              | 作用                   |
| --------------- | ---------------------- |
| `fmt`           | 格式化输入输出         |
| `strings`       | 字符串处理             |
| `strconv`       | 字符串类型转换         |
| `time`          | 时间处理               |
| `os`            | 操作系统功能           |
| `io`            | 输入输出               |
| `bufio`         | 缓冲输入输出           |
| `errors`        | 错误处理               |
| `encoding/json` | JSON 编解码            |
| `net/http`      | HTTP 服务和客户端      |
| `sync`          | 并发同步               |
| `context`       | 上下文、取消和超时控制 |

---

## JSON 处理

```go
package main

import (
	"encoding/json"
	"fmt"
)

type User struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func main() {
	user := User{
		Name: "Tom",
		Age:  18,
	}

	data, err := json.Marshal(user)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Println(string(data))
}
```

JSON 转结构体：

```go
text := `{"name":"Tom","age":18}`

var user User

err := json.Unmarshal([]byte(text), &user)
if err != nil {
	fmt.Println(err)
	return
}

fmt.Println(user.Name)
```

---

## 文件操作

写入文件：

```go
package main

import "os"

func main() {
	err := os.WriteFile("test.txt", []byte("Hello Go"), 0644)
	if err != nil {
		panic(err)
	}
}
```

读取文件：

```go
data, err := os.ReadFile("test.txt")
if err != nil {
	panic(err)
}

fmt.Println(string(data))
```

---

## 常用命令

```bash
# 运行程序
go run main.go

# 编译程序
go build

# 初始化模块
go mod init example.com/myapp

# 整理依赖
go mod tidy

# 格式化代码
go fmt ./...

# 运行测试
go test ./...

# 检查代码
go vet ./...
```

---

## 测试

业务代码：

```go
package calculator

func Add(a, b int) int {
	return a + b
}
```

测试文件 `calculator_test.go`：

```go
package calculator

import "testing"

func TestAdd(t *testing.T) {
	result := Add(1, 2)

	if result != 3 {
		t.Errorf("期望 3，实际得到 %d", result)
	}
}
```

运行：

```bash
go test
```

---

## 完整示例

```go
package main

import (
	"errors"
	"fmt"
)

type User struct {
	Name string
	Age  int
}

func (u *User) GrowUp() {
	u.Age++
}

func (u User) IsAdult() bool {
	return u.Age >= 18
}

func findUser(users []User, name string) (*User, error) {
	for i := range users {
		if users[i].Name == name {
			return &users[i], nil
		}
	}

	return nil, errors.New("用户不存在")
}

func main() {
	users := []User{
		{Name: "Tom", Age: 17},
		{Name: "Lucy", Age: 20},
	}

	user, err := findUser(users, "Tom")
	if err != nil {
		fmt.Println(err)
		return
	}

	user.GrowUp()

	if user.IsAdult() {
		fmt.Printf("%s 是成年人，年龄 %d\n", user.Name, user.Age)
	}
}
```
