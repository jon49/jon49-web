export const hook: { cb: null | ((frame: HTMLIFrameElement) => void) } = {
    cb: null
}
let iframe = document.createElement("iframe")
iframe.name = "htmz"
iframe.hidden = true
iframe.setAttribute("hf-select", "title,#head,#nav-main,main,#errors,#toasts,#scripts")
document.body.appendChild(iframe)
iframe.onload =
function htmz(event: Event) {
    let frame = event.target as HTMLIFrameElement
    setTimeout(() => {
        let dom = (frame.contentDocument?.querySelectorAll("head>template")[0] as HTMLTemplateElement)?.content
        if (!dom) return
        let select = frame.getAttribute("hf-select")
        if (!select) return
        // @ts-ignore
        window.htmf.selectSwap(select, dom, true)
        hook.cb?.(frame)
    });
}

