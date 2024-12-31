export default `
<script>
(() => {
let wasCalled = false
function htmz() {
    if (!wasCalled) {
        wasCalled = true
        return
    }
    setTimeout(() => {
        let dom = ($frame.contentDocument?.querySelectorAll("head>template")[0] as HTMLTemplateElement)?.content
        if (!dom) return
        let select = $frame.getAttribute("hf-select")
        if (!select) return
        // @ts-ignore
        w.htmf.selectSwap(select, dom, true)
    });
}
})()
</script>

<iframe
    name=htmz
    hidden
    hf-select="title,#head,#nav-main,main,#errors,#toasts,#scripts">
</iframe>
`
