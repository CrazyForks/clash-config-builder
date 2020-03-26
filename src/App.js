import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, notification, Empty, Tag, message, Input, Checkbox, Badge } from 'antd'
import { parse as ymlParse, stringify as ymlStringify } from 'yaml'
import { get, all, create, put } from 'axios'


import SharedGroup from './components/sharedGroup'
import RawDrawer from './components/inputDrawer'

import { setCache, getCache } from "./utils/cache"

import './App.css';

const fileDownload = require('react-file-download')

const { Header, Content, Sider, Footer } = Layout;

const RAW_CONFIG = "raw"
const SUB_CONFIG = "subs"
const PROXIES_CONFIG = "proxies"
const IS_FLAT_RULESET = "isFlatRules"
const CLASHRESTFULAPI = "clashAPI"

const RULE_TYPES = ["DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN", "DOMAIN-SUFFIX", "IP-CIDR", "GEOIP", "FINAL"]

const localPort = 54637
const client = create({
  baseURL: `http://127.0.0.1:${localPort}`,
  headers: {
    'content-type': 'application/x-www-form-urlencoded'
  }
})

function App() {
  const rawConfig = useDrawerInput({ title: "Input raw config.yaml", cacheKey: RAW_CONFIG })
  const { 'setValue': setRawConfig, 'setVisible': setRawDrawerVisible } = rawConfig
  const subsURLs = useDrawerInput({ title: "Input subscriptions(.yaml) url line by line", cacheKey: SUB_CONFIG })
  const { 'setVisible': setSubDrawerVisible } = subsURLs
  const [syncBtnLoading, setSyncBtnLoading] = useState(false)
  const [groupIndex, setGroupIndex] = useState("0")
  const [moreFileterStr, setMoreFilterStr] = useState("")

  const [isLocalMode, setIsLocalMode] = useState(false)
  useEffect(() => {
    client.get('/ping').then(({ data = "", status }) => {
      setIsLocalMode(status === 200 && data === "pong")
    }).catch(_ => { })
  }, [])

  const [subProxies, setSubProxies] = useLocalStorage(PROXIES_CONFIG, [])
  const [isFlatRuleset, setIsFlatRuleset] = useLocalStorage(IS_FLAT_RULESET, true)
  const [clashAPI, setClashAPI] = useLocalStorage(CLASHRESTFULAPI, "")

  const [rawObj, setRawObj] = useState({})
  useEffect(() => {
    let obj = {}
    try {
      obj = ymlParse(rawConfig.value)
    } catch{ }
    setRawObj(obj || {})
  }, [rawConfig.value])

  async function handleSyncProxies() {
    const request = async url => {
      try {
        let resp = await get(url)
        return resp.data
      } catch {
        return ""
      }
    }

    setSyncBtnLoading(true)
    try {
      const urls = subsURLs.value.split('\n').filter(url => /^https?:\/\//.test(url))
      const proxyURL = isLocalMode ? `http://127.0.0.1:${localPort}/proxy?url=` : "https://cloudcompute.lbyczf.com/proxy-content?url="
      const resps = await all(urls.map(url => request(`${proxyURL}${encodeURIComponent(url)}`)))
      let proxies = []
      resps.forEach((data, index) => {
        if (data === "") {
          notification.error({
            message: "Could not download from subscription",
            description: urls[index]
          })
          return
        }
        let yml = {}
        try {
          yml = ymlParse(data)
        } catch{ }
        const { 'Proxy': p = [] } = yml
        proxies = proxies.concat(p)
      })
      setSubProxies(proxies)
    } catch (e) {
      notification.error({
        message: "Sync Error",
        description: e.stack,
      })
    }
    setSyncBtnLoading(false)
  }

  function handleProxiesChange(order) {
    let { 'Proxy Group': gs = [] } = rawObj
    gs[groupIndex].proxies = order
    const yml = ymlStringify({ ...rawObj, 'Proxy Group': gs })
    setRawConfig(yml)
  }

  function handleMoreFilterChange(e) {
    const { value } = e.target
    setMoreFilterStr(value)
  }

  function handleIsFlatRulesetChange(e) {
    const { checked = true } = e.target
    setIsFlatRuleset(checked)
  }

  function handleClashAPIChange(e) {
    const { value = "" } = e.target
    setClashAPI(value)
  }

  async function handleDownloadProfile() {
    const { 'Proxy': proxies = [], 'Proxy Group': groups = [], 'Rule': rules = [] } = rawObj
    let finalRules = []
    for (let rule of rules) {
      const ps = rule.split(',').map(p => p.trim())
      const [type, url, proxy] = ps
      if (type === 'RULE-SET' && isFlatRuleset) {
        try {
          const resp = await get(url)
          const { status, data } = resp
          if (status === 200) {
            const lines = data.split('\n')
            finalRules = [...finalRules, ...lines.map(l => {
              const [type, payload, args] = l.split(',').map(p => p.trim())
              if (!RULE_TYPES.includes(type)) return null;
              let res = `${type},${payload},${proxy}`
              if (args === 'no-resolve') {
                res += ",no-resolve"
              }
              return res
            }).filter(r => r)]
          }
        } catch {
          notification.error({
            message: "Ruleset download failed",
            description: url
          })
          return
        }
      } else {
        finalRules = [...finalRules, rule]
      }
    }
    const finalProxies = proxies.concat(subProxies)
    const allProxyNames = [
      ...finalProxies.map(p => p.name),
      ...groups.map(g => g.name),
      ...["DIRECT", "REJECT", "GLOBAL"]
    ]
    for (let [idx, g] of groups.entries()) {
      const { proxies = [] } = g
      for (let ps of proxies) {
        if (!allProxyNames.includes(ps)) {
          message.error(`Group [${g.name}] contains a not exist proxy [${ps}]`, 5)
          setGroupIndex(idx + "")
          return
        }
      }
    }
    const fileName = 'config.yml'
    const fileContent = ymlStringify({ ...rawObj, 'Proxy': finalProxies, 'Rule': finalRules })
    if (isLocalMode) {
      const { 'status': s } = await client({
        method: "post",
        url: "/config",
        data: "config=" + encodeURIComponent(fileContent)
      })
      if (s === 204) {
        window.location.href = `clash://install-config?url=${encodeURIComponent(`http://127.0.0.1:${localPort}/config`)}`
      }
    } else if (clashAPI) {
      try {
        await put(`${clashAPI}/configs`, { payload: fileContent }, { validateStatus: s => s !== 200 })
        notification.success({
          message: "Done",
          description: "Enjoy your free time."
        })
      } catch (e) {
        notification.info({
          message: "Could not write profile to Clash",
          description: e.stack
        })
      }
    } else {
      fileDownload(fileContent, fileName)
    }
  }

  const { 'Proxy Group': gs = [], 'Proxy': ps = [] } = rawObj
  const proxyGroupNames = gs.map((g, idx) => {
    const { use } = g
    return (
      <Menu.Item key={idx}>{g.name}</Menu.Item>
    )
  })

  let groupProxies = []
  if (groupIndex < gs.length) {
    const { proxies = [] } = gs[groupIndex * 1]
    groupProxies = proxies
  }

  const moreProxies = [
    'DIRECT',
    'GLOBAL',
    'REJECT',
    ...gs.map(g => g.name),
    ...ps.map(p => p.name),
    ...subProxies.map(p => p.name)
  ].filter(p => {
    let exp = /^/
    try {
      exp = new RegExp(moreFileterStr)
    } catch { }
    return !groupProxies.includes(p) && exp.test(p)
  })

  return (
    <Layout className="main">
      <Header className="header">
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={['1']}
          style={{ lineHeight: '64px' }}
        >
          <Menu.Item key="1">Proxy Group</Menu.Item>
          <Menu.Item key="2" onClick={() => setRawDrawerVisible(true)}>Raw Config</Menu.Item>
          <Menu.Item key="3" onClick={() => setSubDrawerVisible(true)}>Subscription</Menu.Item>
          <Menu.Item key="4" onClick={() => window.open("https://github.com/Fndroid/clash-config-builder", "_blank")}>Github</Menu.Item>
        </Menu>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[groupIndex]}
            onClick={(item) => setGroupIndex(item.key)}
            style={{ height: '100%', borderRight: 0 }}
          >
            {proxyGroupNames}
          </Menu>
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            className="content"
          >
            <div className="list">
              <Badge count={groupProxies.length} overflowCount={2000} offset={[20, 0]} style={{ backgroundColor: '#f50' }}>
                <div className="list-title">Proxies</div>
              </Badge>
              {/* <Empty hidden={groupProxies.length !== 0} /> */}
              <SharedGroup
                items={groupProxies}
                onChange={handleProxiesChange}
              />
            </div>

            <div className="list">
              <Badge count={moreProxies.length} overflowCount={2000} offset={[20, 0]} style={{ backgroundColor: '#52c41a' }}>
                <div className="list-title">More</div>
              </Badge>
              <SharedGroup
                items={moreProxies}
                onChange={() => { }}
              />
              <Input
                className="filter-input"
                placeholder="flter by regular expression"
                value={moreFileterStr}
                onChange={handleMoreFilterChange}
                allowClear
              ></Input>
            </div>

          </Content>
        </Layout>
      </Layout>
      <Footer className="footer">
        <Button className="btn" loading={syncBtnLoading} icon="cloud-download" onClick={handleSyncProxies}>Sync Proxies</Button>
        <Button className="btn" type="primary" icon="download" onClick={handleDownloadProfile}>Download Profile</Button>
        <Checkbox className='btn' checked={isFlatRuleset} onChange={handleIsFlatRulesetChange}>Flat Ruleset</Checkbox>
        <Tag className="btn mode-tag" color={isLocalMode ? "green" : "volcano"}>{`${isLocalMode ? "Local" : "Remote"} Mode`}</Tag>
        <Input value={clashAPI} className="input" placeholder="http://127.0.0.1:9090" onChange={handleClashAPIChange} ></Input>
      </Footer>
      <RawDrawer
        {...rawConfig}
      ></RawDrawer>
      <RawDrawer
        {...subsURLs}
        isHieghtlight={false}
      ></RawDrawer>
    </Layout>
  );
}

function useLocalStorage(key, initValue) {
  const c = getCache(key)
  const [value, setValue] = useState(c === null ? initValue : c)

  function setValueCache(val) {
    setValue(val)
    setCache(key, val)
  }

  return [value, setValueCache]
}

function useDrawerInput({ title, initValue = "", cacheKey }) {
  const [value, setValue] = useLocalStorage(cacheKey, initValue)
  const [visible, setVisible] = useState(false)

  function handleChange(t) {
    setVisible(false)
    setValue(t)
  }

  return {
    title,
    visible,
    value,
    onChange: handleChange,
    setValue,
    setVisible,
  }
}


export default App;
