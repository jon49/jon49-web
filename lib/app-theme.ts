// @ts-ignore
doc.addEventListener("app-theme", (e: CustomEvent) => {
    let theme = e.detail.theme;
    let docElement = doc.documentElement
    theme === "neither" ? docElement.removeAttribute("data-theme") : docElement.setAttribute("data-theme", theme)
})