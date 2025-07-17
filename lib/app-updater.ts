function SkipWaiting(el: HTMLElement) {
    el.addEventListener("click", (e: MouseEvent) => {
        e.preventDefault()
        // @ts-ignore
        window.app.sw.postMessage({ action: 'skipWaiting' })
    })
}

// @ts-ignore
window.defineTrait("skip-waiting", SkipWaiting)