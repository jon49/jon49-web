/// <reference path="./idiomorph.d.ts" />
import { Idiomorph } from "idiomorph"

// Swaps a response document's elements into the page, then signals
// hz:completed (with `detail`, if given). window.htmz calls it with the htmz
// iframe's document; a page that renders a response itself, without the
// service worker, calls window.htmzSwap with a document it parsed.
function swapIn(doc: Document, detail?: unknown) {
  for (let incoming of Array.from(doc.body.children).concat(Array.from(doc.head.children))) {
    // The iframe is a separate realm, so `incoming instanceof Node` is false up
    // here. Idiomorph branches on exactly that and falls through to its "iterable
    // of nodes" case, which throws on a lone element. importNode re-creates the
    // subtree in this document; adoptNode is not enough, as a node keeps the
    // prototype of the realm that created it. Inserting a node adopts it
    // implicitly, which is why the hz-swap paths never needed this.
    let el = document.importNode(incoming, true)

    // before, prepend, append, after
    let swap = el.getAttribute("hz-swap")
    el.removeAttribute("hz-swap")
    let targetQuery = el.getAttribute("hz-target") || el.id && `#${el.id}`
    if (!targetQuery) {
      console.warn("HTMZ: No hz-target or id on incoming element.", el)
      continue
    }
    let target
    try {
      target = document.querySelector(targetQuery)
    } catch {
      console.warn(`HTMZ: Invalid hz-target selector "${targetQuery}".`, el)
      continue
    }
    if (!target) continue
    el.removeAttribute("hz-target")
    // @ts-ignore
    if (el.tagName === "TEMPLATE") el = el.content.cloneNode(true) as DocumentFragment
    if (!swap) {
      if (el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        target.replaceWith(el)
      } else {
        // outerHTML is idiomorph's default. Matching is by id-set intersection,
        // so any element you want preserved across a morph — anything holding
        // listeners, transitions, or an `_load` component — needs a stable id.
        Idiomorph.morph(target, el)
      }
    } else {
      // @ts-ignore
      target[swap]?.(el)
    }
  }

  // Custom event to signal hz completed
  document.dispatchEvent(new CustomEvent("hz:completed", { detail }))
}

// @ts-ignore
window.htmzSwap = swapIn

// @ts-ignore
window.htmz = function htmz(frame: HTMLIFrameElement) {
  let location = frame.contentWindow?.location
  if (location == null || location.href === "about:blank") return;

  let doc = frame.contentDocument
  if (doc == null) return
  swapIn(doc)

  frame.remove()
  document.body.appendChild(frame)
  location.replace("about:blank")
}

document.body.insertAdjacentHTML("beforeend", `<iframe hidden name=htmz onload="window.htmz(this)"></iframe>`)
