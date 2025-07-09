// @ts-check

class XToaster {
    /**
     * @param {HTMLElement} el 
     */
    constructor(el) {
        let timeout = +(el.dataset.timeout || 3e3)
        setTimeout(() => el.remove(), timeout)
    }
}

// @ts-ignore
window.defineTrait("x-toaster", XToaster)
