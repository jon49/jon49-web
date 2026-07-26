// The lib modules are side-effecting scripts that read `window`/`document` at
// import time, so a DOM has to exist on globalThis before any of them is
// imported. Test files must import this module first.
import { JSDOM } from "jsdom"

export const dom = new JSDOM(
    `<!doctype html><html><head></head><body></body></html>`,
    { url: "http://localhost/" })

const w: any = dom.window

for (const key of Object.getOwnPropertyNames(w)) {
    if (!(key in globalThis)) {
        try { (globalThis as any)[key] = w[key] } catch { }
    }
}

// Node ships its own Event, CustomEvent, DOMException and friends. Those are not
// interchangeable with jsdom's, and `document.dispatchEvent(new CustomEvent(...))`
// throws if the two are mixed, so these are copied unconditionally.
for (const key of [
    "window", "document", "Event", "CustomEvent", "Node", "Element", "HTMLElement",
    "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLFormElement",
    "DocumentFragment", "HTMLCollection", "MutationObserver", "DOMParser",
    "getComputedStyle", "requestAnimationFrame",
]) {
    (globalThis as any)[key] = w[key]
}

export const doc: Document = w.document

/** Reset the page between tests. */
export function resetBody(html = "") {
    doc.body.innerHTML = html
    doc.head.querySelectorAll("[data-test]").forEach(el => el.remove())
}

/**
 * Build a document in a *separate realm*, standing in for the htmz iframe.
 *
 * This is the point of the exercise: nodes created here are instances of this
 * realm's Node/Element, not the main page's, exactly as an iframe's are. Code
 * that branches on `instanceof Node` sees false for these.
 */
export function foreignDoc(bodyHtml: string, headHtml = ""): Document {
    return new JSDOM(
        `<!doctype html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`
    ).window.document
}

/**
 * An <iframe> whose contentDocument/contentWindow are stubbed to a foreign-realm
 * response, so `window.htmz(frame)` can be driven synchronously. Navigating a real
 * iframe would work too, but htmz removes and re-appends the frame, which makes
 * jsdom re-fetch `src` and re-enter on every call.
 */
export function responseFrame(bodyHtml: string, headHtml = "") {
    const frame = doc.createElement("iframe")
    doc.body.appendChild(frame)
    let replacedWith: string | null = null
    Object.defineProperty(frame, "contentDocument", {
        value: foreignDoc(bodyHtml, headHtml), configurable: true,
    })
    Object.defineProperty(frame, "contentWindow", {
        configurable: true,
        value: {
            location: {
                href: "http://localhost/response",
                replace(url: string) { replacedWith = url },
            },
        },
    })
    return { frame, get replacedWith() { return replacedWith } }
}

/** Let pending MutationObserver callbacks run. */
export const flush = () => new Promise(r => setTimeout(r, 0))
