// @ts-check
// @ts-ignore
window.app.toast = ({ el }) => {
  let timeout = +(el.dataset.timeout || 3e3)
  setTimeout(() => el.remove(), timeout)
}
