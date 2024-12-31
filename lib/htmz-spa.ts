export default `
<script>
(() => {
let wasCalled = false, w = window
w.htmz = function htmz($frame) {
    if (!wasCalled) {
        wasCalled = true
        return
    }
    setTimeout(() => {
        let dom = $frame.contentDocument?.querySelectorAll("head>template")[0]?.content
        if (!dom) return
        let select = $frame.getAttribute("hf-select")
        if (!select) return
        w.htmf.selectSwap(select, dom, true)
    });
}
})()
</script>

<iframe
    onload="window.htmz(this)"
    name=htmz
    hidden
    hf-select="title,#head,#nav-main,main,#errors,#toasts,#scripts">
</iframe>
`
