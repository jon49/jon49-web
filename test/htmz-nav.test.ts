import { test, describe, beforeEach } from "node:test"
import assert from "node:assert/strict"

import { doc } from "./setup.ts"
import "../lib/htmz-nav.ts"

const w = (globalThis as any).window

// Pages as the service worker would render them, by path.
let pages: Record<string, string> = {}
let fetched: string[] = []
;(globalThis as any).fetch = async (url: string) => {
    let path = new URL(url).pathname
    fetched.push(path)
    let body = pages[path]
    return body == null
        ? new Response("missing", { status: 404 })
        : Object.defineProperty(
            new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }),
            "url", { value: new URL(path, "http://localhost").href })
}

const head = `<link rel=stylesheet href="/web/css/app.css"><script src="/web/js/app.js" type=module></script>`
const page = (title: string, main: string, extraHead = "") =>
    `<!doctype html><html data-theme=dark><head><title>${title}</title>${head}${extraHead}</head>` +
    `<body><nav><a id=to-b href="/web/b" target=_self>B</a></nav><main id=main>${main}</main></body></html>`

// Shows a page as if it had been loaded normally, at `path`.
function show(path: string) {
    w.history.replaceState(null, "", path)
    let parsed = new w.DOMParser().parseFromString(pages[path], "text/html")
    doc.documentElement.innerHTML = parsed.documentElement.innerHTML
    doc.body.insertAdjacentHTML("beforeend", `<iframe hidden name=htmz></iframe>`)
}

// Resolves with hz:completed's detail when the next page is in.
const navigated = () => new Promise<unknown>(r =>
    doc.addEventListener("hz:completed", e => r((e as CustomEvent).detail), { once: true }))

function click(selector: string) {
    let a = doc.querySelector(selector) as HTMLElement
    a.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
}

// A few turns of the event loop, for a change that shouldn't happen.
const settle = () => new Promise(r => setTimeout(r, 20))

beforeEach(() => {
    fetched = []
    pages = {
        "/web/a": page("A", "page a"),
        "/web/b": page("B", "page b"),
    }
    show("/web/a")
})

describe("htmz-nav", () => {

    test("a link to another page morphs it in and adds it to the history", async () => {
        let length = w.history.length
        let done = navigated()
        click("#to-b")

        assert.deepEqual(await done, { navigation: true })
        assert.deepEqual(fetched, ["/web/b"])
        assert.equal(w.location.pathname, "/web/b")
        assert.equal(w.history.length, length + 1)
        assert.equal(doc.querySelector("#main")!.textContent, "page b")
        assert.equal(doc.title, "B")
    })

    test("keeps the htmz iframe", async () => {
        let frame = doc.querySelector("iframe[name=htmz]")
        let done = navigated()
        click("#to-b")
        await done

        assert.equal(doc.querySelector("iframe[name=htmz]"), frame)
    })

    test("back loads the earlier page the same way", async () => {
        let done = navigated()
        click("#to-b")
        await done

        done = navigated()
        w.history.back()
        await done

        assert.equal(w.location.pathname, "/web/a")
        assert.equal(doc.querySelector("#main")!.textContent, "page a")
        assert.deepEqual(fetched, ["/web/b", "/web/a"])
    })

    test("leaves a page with other stylesheets or scripts to a normal load", async () => {
        pages["/web/b"] = page("B", "page b", `<script>start()</script>`)
        click("#to-b")
        await settle()

        assert.deepEqual(fetched, ["/web/b"])
        assert.equal(w.location.pathname, "/web/a", "no history entry for a page not shown")
        assert.equal(doc.querySelector("#main")!.textContent, "page a")
    })

    test("leaves links that aren't the app's own pages alone", async () => {
        doc.querySelector("nav")!.insertAdjacentHTML("beforeend", `
            <a id=htmz href="/web/b">into htmz</a>
            <a id=login href="/login/" target=_self>login</a>
            <a id=off href="/web/b" target=_self data-hz-nav=off>off</a>
            <a id=file href="/web/b" target=_self download>file</a>`)
        for (let id of ["#htmz", "#login", "#off", "#file"]) click(id)
        await settle()

        assert.deepEqual(fetched, [])
    })
})
