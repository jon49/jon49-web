export interface Disconnectable {
  disconnectedCallback: () => void
}

class DisconnectWatcher {
  registry = new Map<HTMLElement, Disconnectable>()

  constructor() {
    let observer = new MutationObserver(mutations => {
      if (this.registry.size === 0) return
      for (let mutation of mutations) {
        for (let node of mutation.removedNodes) {
          for (let [el, instance] of this.registry) {
            if (node.contains(el)) {
              this.registry.delete(el)
              instance.disconnectedCallback()
            }
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  register(el: HTMLElement, instance: Disconnectable) {
    this.registry.set(el, instance)
  }
}

let watcher = new DisconnectWatcher()

const doc = document, w = window

for (let event of ["click", "change", "submit"]) {
  doc.addEventListener(event, e => {
    let target = e.target
    let action = findAttr(target, event)
    if (!action) return

    // @ts-ignore
    handleCall(e, target, action)
  })
}

function handleLoad() {
  for (let el of doc.querySelectorAll("[_load]")) {
    let action = el.getAttribute("_load")
    if (!action) continue
    // @ts-ignore
    handleCall(new Event("load"), el, action)
    el.removeAttribute("_load")
  }
}

doc.addEventListener("hz:completed", handleLoad)
w.addEventListener("load", handleLoad)

function findAttr(target: EventTarget | null, attr: string): string | null | undefined {
  if (!target) return
  // @ts-ignore
  let result = target?.closest?.(`[_${attr}]`)?.getAttribute(`_${attr}`)
  if (!result) {
    // @ts-ignore
    return findAttr(target?.form, attr)
  }
  return result
}

function handleCall(
  e: Event,
  target: HTMLElement,
  action: string): void {
  // @ts-ignore
  let form = target.tagName === "FORM" ? target : target.form

  let actions = action.split(" ")

  for (let action of actions) {
    let fn: Function | undefined

    fn = w.app?.[action]
    if (fn) {
      let result = fn.call(null, { app: w.app, ev: e, target, el: target, form })
      if (result?.disconnectedCallback) {
        watcher.register(target, result as Disconnectable)
      }
    } else {
      console.warn(`ACTION: Could not find function ${action}. Target element`, target)
    }
  }
}
