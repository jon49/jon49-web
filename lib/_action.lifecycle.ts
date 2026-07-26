export interface Disconnectable {
    disconnectedCallback: () => void
}

class DisconnectWatcher {
    registry = new Map<HTMLElement, Disconnectable>()

    constructor() {
        let observer = new MutationObserver(() => this.sweep())
        observer.observe(document.documentElement, { childList: true, subtree: true })
        document.addEventListener("hz:completed", () => this.sweep())
    }

    // Drop anything no longer in the document. Keying off `isConnected` catches
    // removals the observer can't attribute to a single removed node (moves into
    // detached trees, morphdom replacements) and keeps this O(registry) instead
    // of O(registry * removedNodes).
    sweep() {
        if (this.registry.size === 0) return
        for (let [el, instance] of this.registry) {
            if (!el.isConnected) {
                this.registry.delete(el)
                instance.disconnectedCallback()
            }
        }
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

let hasLoaded: WeakMap<HTMLElement, string[]> = new WeakMap()

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
            if (e.type === "load") {
                if (!hasLoaded.get(target)?.includes(action)) {
                    hasLoaded.get(target)?.push(action) || hasLoaded.set(target, [action])
                    let result = fn.call(null, { app: w.app, ev: e, target, el: target, form })
                    if (result?.disconnectedCallback) {
                        watcher.register(target, result as Disconnectable)
                    }
                }
            } else {
                fn.call(null, { app: w.app, ev: e, target, el: target, form })
            }
        } else {
            console.warn(`ACTION: Could not find function ${action}. Target element`, target)
        }
    }
}
