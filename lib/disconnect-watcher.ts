interface Disconnectable {
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

let w = window
w.app = w.app || {}
// @ts-ignore - utility, not an attribute-triggered action
w.app.disconnectWatcher = (el: HTMLElement, instance: Disconnectable) => watcher.register(el, instance)
