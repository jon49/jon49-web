/// <reference path="./idiomorph.d.ts" />
import { Idiomorph } from "idiomorph"

// Faster page changes for an app whose pages a service worker renders. A click
// on a link to another of the app's pages fetches that page and morphs it into
// this one, rather than loading a new document, and records it with
// history.pushState, so the address bar, reload, back and forward all behave
// as they would for a normal page load. Back and forward load their page the
// same way and put back its scroll position.
//
// Which links: those that open in this window (target=_self, or no target and
// no <base target>; a page with <base target=htmz> sends its other links to
// the htmz iframe), on this origin, under the same first path segment as this
// page (/web/...). Not with
// `download` or data-hz-nav=off, and not clicks with a modifier key (new tab
// and the like). A page with other stylesheets or scripts than this one, or a
// response that isn't an HTML page, is loaded normally instead: inline scripts
// in a morphed page wouldn't run.
//
// After each change it signals hz:completed with { navigation: true }, so
// _load actions run as after any swap; listeners that only care about the
// user's edits can skip it.
//
// A page that can render the app's pages itself, without a round trip to the
// service worker, sets window.htmzFetch(url): it answers with the page's
// Response, or null to leave that page to fetch.

let current = withoutHash(location.href)
let pending: AbortController | null = null

history.scrollRestoration = "manual"

function withoutHash(url: string) {
  return url.split("#")[0]
}

function scopeOf(path: string) {
  return path.split("/")[1]
}

function saveScroll() {
  history.replaceState({ ...history.state, scrollY: window.scrollY }, "")
}

// The page's stylesheets and scripts, as one comparable string.
function assets(d: Document) {
  let list = Array.from(d.querySelectorAll("link[rel=stylesheet], script"), el =>
    el instanceof HTMLLinkElement || el.localName === "link"
      ? `css ${el.getAttribute("href")}`
      : `js ${el.getAttribute("src") ?? el.textContent}`)
  return list.sort().join("\n")
}

function copyAttributes(from: Element, to: Element) {
  for (let { name } of Array.from(to.attributes)) {
    if (!from.hasAttribute(name)) to.removeAttribute(name)
  }
  for (let { name, value } of Array.from(from.attributes)) {
    if (to.getAttribute(name) !== value) to.setAttribute(name, value)
  }
}

async function render(url: string): Promise<Response | null> {
  try {
    return await ((window as any).htmzFetch?.(url) ?? null)
  } catch (e) {
    console.error(e)
    return null
  }
}

async function go(url: string, push: boolean, scrollY = 0) {
  pending?.abort()
  let controller = pending = new AbortController()
  let res: Response
  try {
    res = await render(url) ?? await fetch(url, { signal: controller.signal })
  } catch {
    if (!controller.signal.aborted) location.assign(url)
    return
  }
  let isPage = res.ok && (res.headers.get("content-type") ?? "").includes("text/html")
  let text = isPage ? await res.text() : ""
  if (pending !== controller) return
  pending = null
  let finalUrl = res.url || url
  let doc = new DOMParser().parseFromString(text, "text/html")
  if (!isPage || assets(doc) !== assets(document)) {
    location.assign(finalUrl)
    return
  }

  if (push) {
    saveScroll()
    history.pushState({ scrollY: 0 }, "", finalUrl)
  } else if (finalUrl !== location.href) {
    history.replaceState(history.state, "", finalUrl)
  }
  current = withoutHash(finalUrl)

  document.title = doc.title
  copyAttributes(doc.documentElement, document.documentElement)
  for (let meta of Array.from(doc.head.querySelectorAll("meta[name]"))) {
    let mine = document.head.querySelector(`meta[name="${meta.getAttribute("name")}"]`)
    if (mine) mine.setAttribute("content", meta.getAttribute("content") ?? "")
  }
  copyAttributes(doc.body, document.body)
  Idiomorph.morph(document.body, doc.body, {
    morphStyle: "innerHTML",
    // Keep the htmz iframe, which htmz adds to the page after it loads.
    callbacks: { beforeNodeRemoved: node => !(node instanceof HTMLIFrameElement && node.name === "htmz") },
  })

  let hash = new URL(finalUrl).hash.slice(1)
  let anchor = hash && document.getElementById(decodeURIComponent(hash))
  if (anchor) anchor.scrollIntoView()
  else window.scrollTo(0, scrollY)

  document.dispatchEvent(new CustomEvent("hz:completed", { detail: { navigation: true } }))
}

document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  let a = e.target instanceof Element ? e.target.closest("a[href]") : null
  if (!(a instanceof HTMLAnchorElement)) return
  let target = a.getAttribute("target") ?? document.querySelector("base[target]")?.getAttribute("target") ?? ""
  if ((target !== "" && target !== "_self") || a.hasAttribute("download") || a.dataset.hzNav === "off") return
  let url = new URL(a.href)
  if (url.origin !== location.origin || scopeOf(url.pathname) !== scopeOf(location.pathname)) return
  // A link to a spot on this page: the browser scrolls to it.
  if (url.hash && withoutHash(url.href) === current) return
  e.preventDefault()
  go(url.href, true)
})

window.addEventListener("popstate", e => {
  // Only the hash changed: the browser scrolls.
  if (withoutHash(location.href) === current) return
  go(location.href, false, e.state?.scrollY ?? 0)
})

// Scroll positions survive a reload too, as they would with the browser
// restoring them.
window.addEventListener("pagehide", saveScroll)
window.addEventListener("load", () => {
  let y = history.state?.scrollY
  if (typeof y === "number") window.scrollTo(0, y)
})
