## Clash Config Builder
Clash配置文件在线定义

### 地址
在线地址：https://fndroid.github.io/clash-config-builder/

### 注意
**服务商提供的Clash配置地址一般会被[CORS](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Access_control_CORS)，所以默认情况下此工具会通过API代理其请求，如担心隐私问题，请勿使用！！！**


### 使用步骤
#### 1. 编辑基础配置文件
点击界面顶部``Raw Config.yaml``，填入如下基础配置后点击底部``Save``按钮保存
```yaml
Proxy: []
Proxy Group:
  - name: UrlTest
    type: url-test
    proxies: 
      - DIRECT
    url: http://www.gstatic.com/generate_204
    interval: 300
  - name: PROXY
    type: select
    proxies:
      - UrlTest
  - name: Final
    type: select
    proxies:
      - PROXY
      - DIRECT
  - name: Apple
    type: select
    proxies:
      - DIRECT
      - PROXY
  - name: GlobalMedia
    type: select
    proxies:
      - PROXY
  - name: HKMTMedia
    type: select
    proxies:
      - DIRECT
Rule:
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/Unbreak.list,DIRECT
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/GlobalMedia.list,GlobalMedia
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/HKMTMedia.list,HKMTMedia
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/Global.list,PROXY
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/Apple.list,Apple
  - RULE-SET,https://raw.githubusercontent.com/ConnersHua/Profiles/master/Surge/Ruleset/China.list,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,Final

```

#### 2. 填入Clash托管订阅
点击界面顶部``Subscriptions``，在打开的窗口中填入服务商提供的Clash配置文件地址（每行一个），后点击底部``Save``按钮保存

#### 3. 同步节点信息
点击主界面底部``Sync Proxies``按钮拉取节点，节点会生成在右边``More``列表中

#### 4. 编辑策略组
将``More``中节点拖动至``Proxies``列表中即可将节点添加至对应策略组，相反，从``Proxies``拖动至``More``则会移除策略中该节点

#### 5. 生成配置
点击界面底部``Download Profile``后，浏览器将会提示下载


### 模式

#### Remote Mode
 
这是此工具默认情况下的模式，此模式下：
- Subscriptions节点获取会通过远程API（cloudcompute.lbyczf.com）进行代理
- 最终配置文件会通过浏览器下载

#### Local Mode

此模式需要在本地启动一个服务端，此模式下：
- Subscriptsions节点获取会通过本地服务端代理，无隐私问题
- 最终配置文件可以直接唤醒Clash for Windows进行更新
- 可以挂载在Clash for Windows中跟随其运行

##### 配置方法

1. 下载``clash-config-builder-server.exe``，地址：https://github.com/Fndroid/clash-config-builder-server/releases
2. 进入Clash for Windows中General界面，点击``General YML``下方小字体，打开文本编辑
3. 在文件末端输入：
    ```yaml
    cfw-child-process:
      - command: clash-config-builder-server.exe
        options:
          cwd: C:\ # clash-config-builder-server.exe所在目录
    ```
4. 重启Clash for Windows，刷新网页，如右下角显示绿色``Local Mode``即表示开启成功

参考：https://docs.cfw.lbyczf.com/contents/childprocess.html