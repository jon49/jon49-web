// Component lifecycle for `_load` actions. An action invoked via `_load` may
// return an object with a `disconnectedCallback`; it is called once the element
// leaves the document.
//
// Identity is the contract. Both the run-once record and the disconnect registry
// are keyed on the element reference, so a component survives a swap exactly as
// long as its DOM node does. Under htmz-be every swapped node is new, so
// components always tear down and re-init.
//
// Under htmz-morph, **give any `_load` element a stable `id`**. Idiomorph matches
// by id-set intersection; an id-less node in a re-rendered list is instead matched
// positionally and morphed in place to hold different content. It never leaves the
// document, so nothing here notices: `sweep()` sees `isConnected`, no
// `disconnectedCallback` runs, and `hasLoaded` keeps suppressing `_load`. The
// component silently keeps running against content it was not initialized for.
// That failure is quiet by design — an id is the only thing that prevents it.
export interface Disconnectable {
    disconnectedCallback: () => void
}

let hasLoaded: WeakMap<HTMLElement, string[]> = new WeakMap()

class DisconnectWatcher {
    registry = new Map<HTMLElement, Disconnectable>()

    constructor() {
        let observer = new MutationObserver(() => this.sweep())
        observer.observe(document.documentElement, { childList: true, subtree: true })
        document.addEventListener("hz:completed", () => this.sweep())
    }

    // Drop anything no longer in the document. Keying off `isConnected` catches
    // removals the observer can't attribute to a single removed node (moves into
    // detached trees, nodes idiomorph discards rather than morphs) and keeps this
    // O(registry) instead of O(registry * removedNodes).
    //
    // This only reads `isConnected`, so it works under either swap module —
    // htmz-be replaces nodes outright, htmz-morph preserves them.
    sweep() {
        if (this.registry.size === 0) return
        for (let [el, instance] of this.registry) {
            if (!el.isConnected) {
                this.registry.delete(el)
                // Forget the run-once record too, so a re-attached element gets
                // re-initialized rather than staying dead after its disconnect.
                hasLoaded.delete(el)
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

// `_load` is left on the element. `hasLoaded` is what enforces run-once, and it
// does so per element+action, so stripping the attribute buys nothing — idiomorph
// restores it from the server markup on the next morph anyway.
function handleLoad() {
    for (let el of doc.querySelectorAll("[_load]")) {
        let action = el.getAttribute("_load")
        if (!action) continue
        // @ts-ignore
        handleCall(new Event("load"), el, action)
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
