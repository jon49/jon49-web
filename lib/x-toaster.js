// @ts-check

class XToaster {
    /**
     * @param {HTMLElement} el 
     */
    constructor(el) {
        let timeout = +(el.dataset.timeout || 3e3)
        this.timeoutId = setTimeout(() => el.remove(), timeout)
    }

    disconnectedCallback() {
        clearTimeout(this.timeoutId)
    }
}

// @ts-ignore
window.defineTrait("x-toaster", XToaster)
