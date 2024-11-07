const doc = document
const w = window

let x = doc.createElement("x")
x.innerHTML = `
<iframe
    name=htmz
    hidden
    hf-select="title,#head,#nav-main,main,#errors,#toasts,#scripts">
</iframe>`
let $frame = x.firstElementChild as HTMLIFrameElement
doc.body.appendChild($frame)

$frame.onload =
function htmz() {
    setTimeout(() => {
        let dom = ($frame.contentDocument?.querySelectorAll("head>template")[0] as HTMLTemplateElement)?.content
        if (!dom) return
        let select = $frame.getAttribute("hf-select")
        if (!select) return
        // @ts-ignore
        w.htmf.selectSwap(select, dom, true)
    });
}

export {}

