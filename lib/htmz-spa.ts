export default `
<script>
function htmz(frame) {
    setTimeout(() => {
        let dom = frame.contentDocument?.querySelectorAll("head>template")[0]?.content
        if (!dom) return
        let select = frame.getAttribute("hf-select")
        if (!select) return
        window.htmf.selectSwap(select, dom, true)
    })
}
</script>

<iframe
    onload="window.htmz(this)"
    name=htmz
    hidden
    hf-select="title,#head,#nav-main,main,#errors,#toasts,#scripts">
</iframe>
`
