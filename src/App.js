import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, notification } from 'antd'
import * as yaml from 'yaml'
import * as axios from 'axios'


import SharedGroup from './components/sharedGroup'
import RawDrawer from './components/inputDrawer'

import { setCache, getCache } from "./utils/cache"

import './App.css';

const fileDownload = require('react-file-download')

const { Header, Content, Sider, Footer } = Layout;

const RAW_CONFIG = "raw"
const SUB_CONFIG = "subs"
const PROXIES_CONFIG = "proxies"

function App() {
  const rawConfig = useDrawerInput({ title: "Input raw config.yml", initValue: getCache(RAW_CONFIG) || "", cacheKey: RAW_CONFIG })
  const { 'setValue': setRawConfig, 'setVisible': setRawDrawerVisible } = rawConfig
  const subsURLs = useDrawerInput({ title: "Input subscriptions url line by line", initValue: getCache(SUB_CONFIG) || "", cacheKey: SUB_CONFIG })
  const { 'setVisible': setSubDrawerVisible } = subsURLs
  const [syncBtnLoading, setSyncBtnLoading] = useState(false)
  const [groupIndex, setGroupIndex] = useState("0")

  const [subProxies, setSubProxies] = useState(getCache(PROXIES_CONFIG) || [])
  useEffect(() => {
    setCache(PROXIES_CONFIG, subProxies)
  }, [subProxies])

  const [rawObj, setRawObj] = useState({})
  useEffect(() => {
    let obj = {}
    try {
      obj = yaml.parse(rawConfig.value)
    } catch{ }
    setRawObj(obj || {})
  }, [rawConfig.value])

  async function handleSyncProxies() {
    setSyncBtnLoading(true)
    try {
      const urls = subsURLs.value.split('\n')
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
    const yml = yaml.stringify({ ...rawObj, 'Proxy Group': gs })
    setRawConfig(yml)
  }

  function handleDownloadProfile() {
    const { 'Proxy': proxies = [] } = rawObj
    fileDownload(yaml.stringify({ ...rawObj, 'Proxy': proxies.concat(subProxies) }), 'config.yaml')
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
                onChange={() => { }}
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
