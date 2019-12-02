import React, { useState, useEffect } from 'react'
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json'
import 'prismjs/themes/prism-okaidia.css'
import { Drawer } from 'antd'


export default function (props) {
    const { title = "", visible = false, onChange, 'value': v, isHieghtlight = true } = props
    const [value, setValue] = useState(v)

    useEffect(() => {
        setValue(v)
    }, [v])

    return (
        <Drawer
            title={title}
            placement="right"
            onClose={() => onChange(value)}
            visible={visible}
            width={"84%"}
        >
            <Editor
                value={value}
                onValueChange={code => setValue(code)}
                highlight={code => isHieghtlight ? highlight(code, languages.yaml, 'yaml') : code}
                padding={10}
                style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    borderRadius: 5,
                    backgroundColor: "rgb(40, 44, 52)",
                    color: "#ffffff"
                }}
            />
        </Drawer>
    )
}