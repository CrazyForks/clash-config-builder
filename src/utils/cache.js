function setCache(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value))
}

function getCache(key) {
    const str = window.localStorage.getItem(key)
    try {
        const obj = JSON.parse(str)
        return obj
    } catch{ }
    return str
}

export {
    setCache,
    getCache
}