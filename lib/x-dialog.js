// @ts-check

class XDialog {
    /**
     * @param {HTMLDialogElement} el 
     */
    constructor(el) {
        if (!(el instanceof HTMLDialogElement)) {
            throw new Error("XDialog must be initialized with an HTMLDialogElement")
        }
        this.el = el
        if (el.hasAttribute("show-modal") && !el.open) {
            el.showModal()
        }

        el.addEventListener("close", this)
        el.addEventListener("click", this)
    }

    /**
     * 
     * @param {Event} event 
     */
    handleEvent(event) {
        // @ts-ignore
        this[event.type]?.(event)
    }

    /**
     * Close the dialog when clicking outside of the interactive area.
     * @param {MouseEvent} e
     * */
    click(e) {
        if (!this.el.open) return
        // @ts-ignore
        let dialog = e.target?.closest("[data-box]")
        if (dialog) return
        this.el.close()
    }

    close() {
        this.el.remove()
    }
}

// @ts-ignore
window.defineTrait("x-dialog", XDialog)
