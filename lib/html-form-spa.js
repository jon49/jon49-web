const w = window,
    doc = document

let loadedScripts = new Set()
doc.addEventListener("hf:script-loaded", async e => {
    let detail = e.detail
    if (!detail.script) return
    let script = w.app.scripts.get(detail.script)
    if (!script) return
    if (script.load) {
        loadedScripts.add(detail.script)
        await script.load()
    }
})

doc.addEventListener("hf:request-before", e => {
    let detail = e.detail
    if (detail.method === "get" && detail.form.id === "href") {
        for (let script of loadedScripts) {
            w.app.scripts.get(script)?.unload()
        }
        loadedScripts.clear()
    }
})

let shouldHandleHash = true
doc.addEventListener("hf:completed", e => {
    let detail = e.detail
    if (detail.method !== "get") return
    if (detail.form.id === "href") {
        let url = new URL(detail?.submitter?.formAction ?? detail.form.action)
        shouldHandleHash = false
        location.hash = url.pathname + url.search
        shouldHandleHash = true
    }
})

// In the future use the `navigate` event.
// https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event
doc.addEventListener("click", e => {
    let target = e.target
    if (target instanceof HTMLAnchorElement) {
        let pathname = target.getAttribute("href")
        if (target.getAttribute("href") === "#") {
            e.preventDefault()
            w.scrollTo(0, 0)
            return
        }
        if (pathname.startsWith("/web/")) {
            e.preventDefault()
            shouldHandleHash = false
            location.hash = pathname
            handleHash()
        }
    }
})

w.addEventListener("hashchange", () => {
    if (shouldHandleHash) {
        handleHash()
    }
    shouldHandleHash = true
})

function handleHash() {
    let form = doc.getElementById("href")
    /** @type {String} */
    let hashLocation = w.location.hash.slice(1)
    if (hashLocation.length === 0) {
        hashLocation = w.location.pathname
    }
    if (!hashLocation.startsWith("/web/")) return
    form.setAttribute("action", hashLocation)
    form.requestSubmit()
}

if (location.hash) {
    handleHash()
}

w.app.updateUrl = function (url) {
    shouldHandleHash = false
    location.hash = url
    doc.getElementById("href").setAttribute("action", url)
}

