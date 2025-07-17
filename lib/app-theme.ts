// @ts-ignore
document.addEventListener("app-theme", (e: CustomEvent) => {
    let theme = e.detail.theme;
    let docElement = document.documentElement
    theme === "neither" ? docElement.removeAttribute("data-theme") : docElement.setAttribute("data-theme", theme)
})