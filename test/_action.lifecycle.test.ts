import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"

import { doc, resetBody, flush } from "./setup.ts"
import "../lib/_action.lifecycle.ts"

const w: any = (globalThis as any).window

/** Drive the same signal htmz emits after a swap: sweeps, then runs `_load`. */
const swapped = () => doc.dispatchEvent(new (globalThis as any).CustomEvent("hz:completed", {}))

type Call = { action: string, target: Element, type: string }
let calls: Call[]
let warnings: string[]
const realWarn = console.warn

/** Register an action that records its invocations. */
function action(name: string, impl?: (ctx: any) => any) {
    w.app[name] = (ctx: any) => {
        calls.push({ action: name, target: ctx.el, type: ctx.ev.type })
        return impl?.(ctx)
    }
}
const countOf = (name: string) => calls.filter(c => c.action === name).length

beforeEach(() => {
    calls = []
    warnings = []
    w.app = {}
    console.warn = (...a: any[]) => { warnings.push(String(a[0])) }
})
afterEach(() => { console.warn = realWarn })

describe("_action.lifecycle", () => {

    describe("_load", () => {
        test("runs the action once the DOM is swapped in", () => {
            action("init")
            resetBody(`<div id=c _load="init"></div>`)

            swapped()

            assert.equal(countOf("init"), 1)
            assert.equal(calls[0].target, doc.querySelector("#c"))
            assert.equal(calls[0].type, "load")
        })

        // The attribute used to be removed to enforce run-once. `hasLoaded` does
        // that now, per element+action, and a morph would restore the attribute
        // from the server markup regardless.
        test("leaves the _load attribute on the element", () => {
            action("init")
            resetBody(`<div id=c _load="init"></div>`)

            swapped()

            assert.equal(doc.querySelector("#c")!.getAttribute("_load"), "init")
        })

        test("does not re-run on later swaps", () => {
            action("init")
            resetBody(`<div id=c _load="init"></div>`)

            swapped()
            swapped()
            swapped()

            assert.equal(countOf("init"), 1)
        })

        test("runs every action in a space-separated list", () => {
            action("one"); action("two"); action("three")
            resetBody(`<div _load="one two three"></div>`)

            swapped()

            assert.deepEqual(calls.map(c => c.action), ["one", "two", "three"])
        })

        test("tracks run-once per action, so a newly added one still runs", () => {
            action("one"); action("two")
            resetBody(`<div id=c _load="one"></div>`)

            swapped()
            doc.querySelector("#c")!.setAttribute("_load", "one two")
            swapped()

            assert.equal(countOf("one"), 1, "already-run action must not repeat")
            assert.equal(countOf("two"), 1, "newly listed action must run")
        })

        test("warns and keeps going when an action is not registered", () => {
            action("real")
            resetBody(`<div _load="missing real"></div>`)

            assert.doesNotThrow(swapped)
            assert.match(warnings.join("\n"), /Could not find function missing/)
            assert.equal(countOf("real"), 1)
        })
    })

    describe("disconnect", () => {
        test("calls disconnectedCallback once the element leaves the document", () => {
            let disconnected = 0
            action("comp", () => ({ disconnectedCallback: () => { disconnected++ } }))
            resetBody(`<div id=c _load="comp"></div>`)
            swapped()

            doc.querySelector("#c")!.remove()
            swapped()

            assert.equal(disconnected, 1)
        })

        test("is driven by the MutationObserver too, with no hz:completed", async () => {
            let disconnected = 0
            action("comp", () => ({ disconnectedCallback: () => { disconnected++ } }))
            resetBody(`<div id=c _load="comp"></div>`)
            swapped()

            doc.querySelector("#c")!.remove()
            await flush()

            assert.equal(disconnected, 1)
        })

        test("does not fire while the element is still connected", () => {
            let disconnected = 0
            action("comp", () => ({ disconnectedCallback: () => { disconnected++ } }))
            resetBody(`<div id=c _load="comp"></div>`)

            swapped()
            swapped()

            assert.equal(disconnected, 0)
        })

        test("fires only once even across repeated sweeps", () => {
            let disconnected = 0
            action("comp", () => ({ disconnectedCallback: () => { disconnected++ } }))
            resetBody(`<div id=c _load="comp"></div>`)
            swapped()
            const el = doc.querySelector("#c")!

            el.remove()
            swapped()
            swapped()

            assert.equal(disconnected, 1)
        })

        // Without clearing hasLoaded in sweep(), a re-attached component stays dead:
        // it has been disconnected but its `_load` is still suppressed forever.
        test("re-initializes a component that is re-attached", () => {
            let disconnected = 0
            action("comp", () => ({ disconnectedCallback: () => { disconnected++ } }))
            resetBody(`<div id=c _load="comp"></div>`)
            swapped()
            const el = doc.querySelector("#c")!

            el.remove()
            swapped()
            doc.body.appendChild(el)
            swapped()

            assert.equal(disconnected, 1)
            assert.equal(countOf("comp"), 2, "_load must run again for the new lifetime")
        })

        // Documented limitation: only components that opted into the lifecycle are
        // tracked, so only they get re-initialized.
        test("leaves a plain action suppressed after a detach and re-attach", () => {
            action("plain")
            resetBody(`<div id=c _load="plain"></div>`)
            swapped()
            const el = doc.querySelector("#c")!

            el.remove()
            swapped()
            doc.body.appendChild(el)
            swapped()

            assert.equal(countOf("plain"), 1)
        })
    })

    describe("event delegation", () => {
        test("finds _click on an ancestor of the event target", () => {
            action("go")
            resetBody(`<div _click="go"><span id=inner>x</span></div>`)

            doc.querySelector("#inner")!.dispatchEvent(
                new (globalThis as any).window.MouseEvent("click", { bubbles: true }))

            assert.equal(countOf("go"), 1)
        })

        test("runs on every occurrence, unlike _load", () => {
            action("go")
            resetBody(`<button _click="go">x</button>`)
            const btn = doc.querySelector("button")!

            btn.dispatchEvent(new (globalThis as any).window.MouseEvent("click", { bubbles: true }))
            btn.dispatchEvent(new (globalThis as any).window.MouseEvent("click", { bubbles: true }))

            assert.equal(countOf("go"), 2)
        })

        test("ignores events with no matching attribute", () => {
            action("go")
            resetBody(`<button>x</button>`)

            doc.querySelector("button")!.dispatchEvent(
                new (globalThis as any).window.MouseEvent("click", { bubbles: true }))

            assert.equal(calls.length, 0)
            assert.deepEqual(warnings, [])
        })

        test("falls back to the target's owning form when it is not an ancestor", () => {
            action("save")
            resetBody(`<form id=f _change="save"></form><input id=i form=f>`)
            const input = doc.querySelector("#i") as HTMLInputElement
            assert.equal(input.form, doc.querySelector("#f"), "precondition: form association")

            input.dispatchEvent(new (globalThis as any).Event("change", { bubbles: true }))

            assert.equal(countOf("save"), 1)
        })

        test("passes the owning form to the action", () => {
            let seenForm: any = "unset"
            w.app.save = (ctx: any) => { seenForm = ctx.form }
            resetBody(`<form id=f _click="save"><button id=b>x</button></form>`)

            doc.querySelector("#b")!.dispatchEvent(
                new (globalThis as any).window.MouseEvent("click", { bubbles: true }))

            assert.equal(seenForm, doc.querySelector("#f"))
        })
    })
})
