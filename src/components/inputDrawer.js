import React, { useState, useEffect } from 'react'
import { Drawer, Input, Button } from 'antd'

const { TextArea } = Input

export default function (props) {
    const { title = "", onClose = () => { }, visible = false, onChange, 'value': v } = props
    const [value, setValue] = useState(v)

    useEffect(() => {
        setValue(v)
    }, [v])

    return (
        <Drawer
            title={title}
            placement="right"
            onClose={onClose}
            visible={visible}
            width={"70%"}
        >
            <TextArea rows={30} onChange={(e) => setValue(e.target.value)} value={value} onPressEnter={() => { }}></TextArea>
            <Button className="drawer-btn" type="primary" onClick={() => { onChange(value) }}>Save</Button>
        </Drawer>
    )
}