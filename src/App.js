import React, { useState } from 'react';
import { Layout, Menu, Drawer, Input, Button, notification } from 'antd'
import * as yaml from 'yaml'
import * as axios from 'axios'
import Sortable from 'react-sortablejs';
import uniqueId from 'lodash/uniqueId';

import './App.css';

const fileDownload = require('react-file-download')

const { Header, Content, Sider, Footer } = Layout;
const { TextArea } = Input

const RAW_CONFIG = "raw"
const SUB_CONFIG = "subs"
const PROXIES_CONFIG = "proxies"

function App() {
  const [syncBtnLoading, setSyncBtnLoading] = useState(false)
  const [rawDrawerVisible, setRawDrawerVisible] = useState(false)
  const [rawConfig, setRawConfig] = useState(getCache(RAW_CONFIG) || "")
  const [subDrawerVisible, setSubDrawerVisible] = useState(false)
  const [subsURLs, setSubsURLs] = useState(getCache(SUB_CONFIG) || "")
  const [groupIndex, setGroupIndex] = useState("0")
  const [subProxies, setSubProxies] = useState(getCache(PROXIES_CONFIG) || [])

  function handleRawConfigChange(t) {
    const message = "Could not complete!"
    try {
      let obj = yaml.parse(t)
      if (obj) {
        setRawConfig(t)
        setCache(RAW_CONFIG, t)
        setRawDrawerVisible(false)
      } else {
        notification.error({
          message,
          description: "null object"
        })
      }
    } catch (e) {
      notification.error({
        message,
        description: e.stack
      })
    }
  }

  async function handleSyncProxies(e) {
    setSyncBtnLoading(true)
    const urls = subsURLs.split('\n')
    const resps = await axios.all(urls.map(url => axios.get(url, {
      validateStatus: _ => true
    })))
    let proxies = []
    resps.forEach(resp => {
      const { data = "" } = resp
      let yml = {}
      try {
        yml = yaml.parse(data)
      } catch{ }
      const { 'Proxy': p = [] } = yml
      proxies = proxies.concat(p)
    })
    setSubProxies(proxies)
    setCache(PROXIES_CONFIG, proxies)
    const rawObj = yaml.parse(rawConfig)
    const { 'Proxy': rawProxies } = rawObj
    const allProxies = rawProxies.concat(proxies)
    const yml = yaml.stringify({ ...rawObj, 'Proxy': allProxies })
    setRawConfig(yml)
    setCache(RAW_CONFIG, yml)
    setSyncBtnLoading(false)
  }

  function handleSubURLsChange(e) {
    let t = e.target.value
    setSubsURLs(t)
    setCache(SUB_CONFIG, t)
  }

  function handleProxiesChange(order) {
    if (order.length <= 0) {
      notification.error({
        message: "Could not complete!",
        description: "Proxy Group shold have more than one proxies."
      })
      return
    }
    const rawObj = yaml.parse(rawConfig)
    let { 'Proxy Group': gs = [] } = rawObj
    gs[groupIndex].proxies = order
    const yml = yaml.stringify({ ...rawObj, 'Proxy Group': gs })
    setRawConfig(yml)
    setCache(RAW_CONFIG, yml)
  }

  function handleDownloadProfile() {
    const rawObj = yaml.parse(rawConfig)
    const { 'Proxy': proxies = [] } = rawObj
    fileDownload(yaml.stringify({ ...rawObj, 'Proxy': proxies.concat(subProxies) }), 'config.yaml')
  }

  const rawObj = yaml.parse(rawConfig) || {}

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
    ...(ps ? ps.map(p => p.name) : []),
    ...subProxies.map(p => p.name)
  ].filter(p => {
    return !groupProxies.includes(p)
  })

  return (
    <Layout className="main">
      <Header className="header">
        <div className="logo" />
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={['1']}
          style={{ lineHeight: '64px' }}
        >
          <Menu.Item key="1">Proxy Group</Menu.Item>
          <Menu.Item key="2" onClick={() => setRawDrawerVisible(true)}>Raw Config.yml</Menu.Item>
          <Menu.Item key="3" onClick={() => setSubDrawerVisible(true)}>Subscription</Menu.Item>
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
              <SharedGroup
                items={groupProxies}
                onChange={handleProxiesChange}
              />
            </div>

            <div className="list">
              <div className="list-title">More</div>
              <SharedGroup
                items={moreProxies}
              />
            </div>

          </Content>
        </Layout>
      </Layout>
      <Footer className="footer">
        <Button className="btn" loading={syncBtnLoading} icon="cloud-download" onClick={handleSyncProxies}>Sync Proxies</Button>
        <Button className="btn" type="primary" icon="download" onClick={handleDownloadProfile}>Download Profile</Button>
      </Footer>
      <RawDrawer
        title="Input raw config.yml"
        visible={rawDrawerVisible}
        value={rawConfig}
        onClose={() => setRawDrawerVisible(false)}
        onChange={handleRawConfigChange}
      ></RawDrawer>
      <RawDrawer
        title="Input subscriptions line by line"
        visible={subDrawerVisible}
        value={subsURLs}
        onClose={() => setSubDrawerVisible(false)}
        onChange={handleSubURLsChange}
      ></RawDrawer>
    </Layout>
  );
}

function RawDrawer(props) {
  const [value, setValue] = useState(props.value)
  const { title = "", onClose = () => { }, visible = false, onChange = () => { } } = props
  return (
    <Drawer
      title={title}
      placement="right"
      onClose={onClose}
      visible={visible}
      width={"70%"}
    >
      <TextArea rows={30} onChange={(e) => setValue(e.target.value)} defaultValue={value} onPressEnter={() => { }}></TextArea>
      <Button className="drawer-btn" type="primary" onClick={() => { onChange(value) }}>Save</Button>
    </Drawer>
  )
}

function SharedGroup({ items = [], onChange = () => { } }) {
  const its = items.map(val => (<div className="menu-item" key={uniqueId()} data-id={val}>{val}</div>));

  return (
    <Sortable
      options={{
        group: 'shared',
        animation: 150,
      }}
      onChange={onChange}
      className="menu"
    >
      {its}
    </Sortable>
  );
}

function setCache(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function getCache(key) {
  const str = window.localStorage.getItem(key) || ""
  try {
    const obj = JSON.parse(str)
    return obj
  } catch{ }
  return str
}

export default App;
