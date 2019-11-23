import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, notification, Empty, Tag, message, Input } from 'antd'
import { parse as ymlParse, stringify as ymlStringify } from 'yaml'
import { get, all, create } from 'axios'


import SharedGroup from './components/sharedGroup'
import RawDrawer from './components/inputDrawer'

import { setCache, getCache } from "./utils/cache"

import './App.css';

const fileDownload = require('react-file-download')

const { Header, Content, Sider, Footer } = Layout;

const RAW_CONFIG = "raw"
const SUB_CONFIG = "subs"
const PROXIES_CONFIG = "proxies"

const RULE_TYPES = ["DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN", "DOMAIN-SUFFIX", "IP-CIDR", "GEOIP", "FINAL"]

const localPort = 54637
const client = create({
  baseURL: `http://127.0.0.1:${localPort}`,
  headers: {
    'content-type': 'application/x-www-form-urlencoded'
  }
})

function App() {
  const rawConfig = useDrawerInput({ title: "Input raw config.yaml", initValue: getCache(RAW_CONFIG) || "", cacheKey: RAW_CONFIG })
  const { 'setValue': setRawConfig, 'setVisible': setRawDrawerVisible } = rawConfig
  const subsURLs = useDrawerInput({ title: "Input subscriptions(.yaml) url line by line", initValue: getCache(SUB_CONFIG) || "", cacheKey: SUB_CONFIG })
  const { 'setVisible': setSubDrawerVisible } = subsURLs
  const [syncBtnLoading, setSyncBtnLoading] = useState(false)
  const [groupIndex, setGroupIndex] = useState("0")
  const [moreFileterStr, setMoreFilterStr] = useState("")

  const [isLocalMode, setIsLocalMode] = useState(false)
  useEffect(() => {
    client.get('/ping').then(({ data = "", status }) => {
      setIsLocalMode(status === 200 && data === "pong")
    })
  }, [])

  const [subProxies, setSubProxies] = useState(getCache(PROXIES_CONFIG) || [])
  useEffect(() => {
    setCache(PROXIES_CONFIG, subProxies)
  }, [subProxies])

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
    if (order.length <= 0) {
      notification.error({
        message: "Could not complete!",
        description: "Proxy Group shold have more than one proxies."
      })
      return
    }
    let { 'Proxy Group': gs = [] } = rawObj
    gs[groupIndex].proxies = order
    const yml = ymlStringify({ ...rawObj, 'Proxy Group': gs })
    setRawConfig(yml)
  }

  function handleMoreFilterChange(e) {
    const { value } = e.target
    setMoreFilterStr(value)
  }

  async function handleDownloadProfile() {
    const { 'Proxy': proxies = [], 'Proxy Group': groups = [], 'Rule': rules = [] } = rawObj
    let finalRules = []
    for (let rule of rules) {
      const ps = rule.split(',').map(p => p.trim())
      const [type, url, proxy] = ps
      if (type === 'RULE-SET') {
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
      for (let ps of g.proxies) {
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
    } else {
      fileDownload(fileContent, fileName)
    }
  }

  const { 'Proxy Group': gs = [], 'Proxy': ps = [] } = rawObj
  const proxyGroupNames = gs.map((g, idx) => {
    return (
      <Menu.Item key={idx}>{g.name}</Menu.Item>
    )
  })

  let groupProxies = []
  if (groupIndex < gs.length) {
    groupProxies = gs[groupIndex * 1].proxies
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
    } catch {}
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
          <Menu.Item key="4" onClick={() => window.location.href = "https://github.com/Fndroid/clash-config-builder"}>Github</Menu.Item>
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
              <div className="list-title">Proxies</div>
              <Empty hidden={groupProxies.length !== 0} />
              <SharedGroup
                items={groupProxies}
                onChange={handleProxiesChange}
              />
            </div>

            <div className="list">
              <div className="list-title">More</div>
              <SharedGroup
                items={moreProxies}
                onChange={() => { }}
              />
              <Input
                className="filter-input"
                placeholder="flter by regular expression"
                value={moreFileterStr}
                onChange={handleMoreFilterChange}
              ></Input>
            </div>

          </Content>
        </Layout>
      </Layout>
      <Footer className="footer">
        <Button className="btn" loading={syncBtnLoading} icon="cloud-download" onClick={handleSyncProxies}>Sync Proxies</Button>
        <Button className="btn" type="primary" icon="download" onClick={handleDownloadProfile}>Download Profile</Button>
        <Tag className="mode-tag" color={isLocalMode ? "green" : "volcano"}>{`${isLocalMode ? "Local" : "Remote"} Mode`}</Tag>
      </Footer>
      <RawDrawer
        {...rawConfig}
      ></RawDrawer>
      <RawDrawer
        {...subsURLs}
      ></RawDrawer>
    </Layout>
  );
}


function useDrawerInput({ title, initValue, cacheKey }) {
  const [value, setValue] = useState(initValue)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (cacheKey) {
      setCache(cacheKey, value)
    }
  })

  function handleChange(t) {
    setVisible(false)
    setValue(t)
  }

  return {
    title,
    visible,
    value,
    onClose: () => setVisible(false),
    onChange: handleChange,
    setValue,
    setVisible,
  }
}


export default App;
