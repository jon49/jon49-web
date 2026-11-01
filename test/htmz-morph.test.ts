import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"

import { doc, resetBody, responseFrame, foreignDoc } from "./setup.ts"
import "../lib/htmz-morph.ts"

const htmz = (frame: HTMLIFrameElement) => (globalThis as any).window.htmz(frame)

let warnings: string[] = []
const realWarn = console.warn
beforeEach(() => { warnings = []; console.warn = (...a: any[]) => { warnings.push(String(a[0])) } })
afterEach(() => { console.warn = realWarn })

describe("htmz-morph", () => {

    test("ignores a frame still sitting at about:blank", () => {
        resetBody(`<div id=box>original</div>`)
        const { frame } = responseFrame(`<div id=box>replaced</div>`)
        Object.defineProperty(frame, "contentWindow", {
            value: { location: { href: "about:blank", replace() { } } }, configurable: true,
        })

        htmz(frame)

        assert.equal(doc.querySelector("#box")!.textContent, "original")
    })

    test("morphs onto the element matching the incoming id", () => {
        resetBody(`<div id=box><p id=msg>old</p></div>`)
        const msg = doc.querySelector("#msg")
        const { frame } = responseFrame(`<div id=box><p id=msg>new</p></div>`)

        htmz(frame)

        assert.equal(doc.querySelector("#msg")!.textContent, "new")
        assert.equal(doc.querySelector("#msg"), msg, "morph must reuse the existing node")
    })

    // Regression: the htmz iframe is a separate realm, so `incoming instanceof
    // Node` is false in the main page. Idiomorph branches on that check and falls
    // through to its iterable case, which throws on a lone element and takes the
    // whole swap loop down with it. htmz-morph importNodes before morphing.
    test("accepts nodes created in another realm", () => {
        resetBody(`<div id=box><p id=msg>old</p></div>`)
        const { frame } = responseFrame(`<div id=box><p id=msg>new</p></div>`)

        assert.equal(
            frame.contentDocument!.body.children[0] instanceof (globalThis as any).Node,
            false,
            "precondition: the response node must be foreign to the main realm")

        assert.doesNotThrow(() => htmz(frame))
        assert.equal(doc.querySelector("#msg")!.textContent, "new")
    })

    test("preserves untouched siblings when a row is inserted", () => {
        resetBody(`<ul id=list><li id=a>a</li><li id=b>b</li></ul>`)
        const a = doc.querySelector("#a"), b = doc.querySelector("#b")
        const { frame } = responseFrame(
            `<ul id=list><li id=z>z</li><li id=a>a</li><li id=b>b</li></ul>`)

        htmz(frame)

        assert.equal(doc.querySelector("#a"), a)
        assert.equal(doc.querySelector("#b"), b)
        assert.equal(doc.querySelectorAll("#list li").length, 3)
    })

    test("hz-target overrides the incoming element's own id", () => {
        resetBody(`<div id=box>box</div><div id=other>other</div>`)
        const { frame } = responseFrame(`<div id=box hz-target="#other">landed</div>`)

        htmz(frame)

        assert.equal(doc.querySelector("#other"), null, "target was morphed into the incoming element")
        assert.equal(doc.querySelector("#box")!.textContent, "box", "the id must not have been used")
        assert.equal(doc.body.textContent!.includes("landed"), true)
    })

    test("hz-swap applies the named DOM method instead of morphing", () => {
        resetBody(`<ul id=list><li id=one>one</li></ul>`)
        const one = doc.querySelector("#one")
        const { frame } = responseFrame(`<li id=two hz-target="#list" hz-swap="append">two</li>`)

        htmz(frame)

        assert.equal(doc.querySelector("#one"), one)
        assert.deepEqual(
            [...doc.querySelectorAll("#list li")].map(el => el.id),
            ["one", "two"])
    })

    test("does not leak hz-swap or hz-target into the page", () => {
        resetBody(`<div id=host></div>`)
        const { frame } = responseFrame(`<p id=in hz-target="#host" hz-swap="append">x</p>`)

        htmz(frame)

        assert.equal(doc.querySelector("[hz-swap]"), null)
        assert.equal(doc.querySelector("[hz-target]"), null)
    })

    test("clones <template> content and replaces the target", () => {
        resetBody(`<div id=slot>before</div>`)
        const { frame } = responseFrame(
            `<template hz-target="#slot"><p id=first>one</p><p id=second>two</p></template>`)

        htmz(frame)

        assert.equal(doc.querySelector("#slot"), null)
        assert.equal(doc.querySelector("#first")!.textContent, "one")
        assert.equal(doc.querySelector("#second")!.textContent, "two")
        assert.equal(doc.querySelector("template"), null, "the template itself must not land")
    })

    test("applies head children as well as body children", () => {
        resetBody(`<div id=body-target>old</div>`)
        doc.head.insertAdjacentHTML("beforeend", `<meta data-test id=head-target content=old>`)
        const { frame } = responseFrame(
            `<div id=body-target>new</div>`,
            `<meta id=head-target content=new>`)

        htmz(frame)

        assert.equal(doc.querySelector("#body-target")!.textContent, "new")
        assert.equal(doc.querySelector("#head-target")!.getAttribute("content"), "new")
        doc.querySelector("#head-target")?.remove()
    })

    describe("bad input", () => {
        test("warns and skips an element with neither hz-target nor id", () => {
            resetBody(`<div id=box>kept</div>`)
            const { frame } = responseFrame(`<div>nowhere</div><div id=box>swapped</div>`)

            htmz(frame)

            assert.match(warnings.join("\n"), /No hz-target or id/)
            assert.equal(doc.querySelector("#box")!.textContent, "swapped",
                "the well-formed sibling must still be applied")
        })

        test("warns and skips an invalid selector", () => {
            resetBody(`<div id=box>kept</div>`)
            const { frame } = responseFrame(
                `<div hz-target="#!!bad">nowhere</div><div id=box>swapped</div>`)

            htmz(frame)

            assert.match(warnings.join("\n"), /Invalid hz-target selector/)
            assert.equal(doc.querySelector("#box")!.textContent, "swapped")
        })

        test("silently skips a target that is not on the page", () => {
            resetBody(`<div id=box>kept</div>`)
            const { frame } = responseFrame(
                `<div id=absent>nowhere</div><div id=box>swapped</div>`)

            htmz(frame)

            assert.deepEqual(warnings, [])
            assert.equal(doc.querySelector("#absent"), null)
            assert.equal(doc.querySelector("#box")!.textContent, "swapped")
        })
    })

    describe("after swapping", () => {
        test("dispatches hz:completed exactly once per response", () => {
            resetBody(`<div id=a>a</div><div id=b>b</div>`)
            const { frame } = responseFrame(`<div id=a>A</div><div id=b>B</div>`)
            let completed = 0
            const onDone = () => completed++
            doc.addEventListener("hz:completed", onDone)

            htmz(frame)
            doc.removeEventListener("hz:completed", onDone)

            assert.equal(completed, 1)
        })

        test("resets the frame to about:blank and keeps it in the document", () => {
            resetBody(`<div id=box>old</div>`)
            const response = responseFrame(`<div id=box>new</div>`)

            htmz(response.frame)

            assert.equal(response.replacedWith, "about:blank")
            assert.equal(response.frame.isConnected, true)
        })
    })

    test("leaves the response document's own nodes out of the page", () => {
        resetBody(`<div id=box>old</div>`)
        const foreign = foreignDoc(`<div id=box>new</div>`)
        const original = foreign.body.children[0]
        const frame = doc.createElement("iframe")
        doc.body.appendChild(frame)
        Object.defineProperty(frame, "contentDocument", { value: foreign, configurable: true })
        Object.defineProperty(frame, "contentWindow", {
            value: { location: { href: "http://x/", replace() { } } }, configurable: true,
        })

        htmz(frame)

        assert.equal(doc.querySelector("#box")!.textContent, "new")
        assert.equal(doc.contains(original), false,
            "the page must hold an imported copy, not the iframe's node")
    })
})

describe("htmzSwap", () => {
    const htmzSwap = (d: Document, detail?: unknown) => (globalThis as any).window.htmzSwap(d, detail)

    test("swaps in a document the page rendered itself, and passes on its detail", () => {
        resetBody(`<div id=box><p id=msg>old</p></div><div id=toasts></div>`)
        const msg = doc.querySelector("#msg")
        let seen: unknown = "not fired"
        doc.addEventListener("hz:completed", (e) => { seen = (e as CustomEvent).detail }, { once: true })

        htmzSwap(foreignDoc(`<div id=box><p id=msg>new</p></div><div id=toasts><p>Saved</p></div>`),
            { handler: "save" })

        assert.equal(doc.querySelector("#msg")!.textContent, "new")
        assert.equal(doc.querySelector("#msg"), msg, "morph must reuse the existing node")
        assert.equal(doc.querySelector("#toasts")!.textContent, "Saved")
        assert.deepEqual(seen, { handler: "save" })
    })

    test("leaves the htmz iframe alone", () => {
        resetBody(`<div id=box>old</div>`)
        const frames = doc.querySelectorAll("iframe[name=htmz]").length

        htmzSwap(foreignDoc(`<div id=box>new</div>`))

        assert.equal(doc.querySelector("#box")!.textContent, "new")
        assert.equal(doc.querySelectorAll("iframe[name=htmz]").length, frames)
    })
})
