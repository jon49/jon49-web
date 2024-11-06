// @ts-ignore
let doc = document

let temp = doc.createElement("x")
temp.innerHTML = `
<form hidden is=form-subscribe data-event="refresh" hf-ignore target=htmz>
<input type=hidden name=hz>
</form>`

let $form = temp.querySelector("form") as HTMLFormElement
doc.body.appendChild($form)

// @ts-ignore
doc.addEventListener("htmz:completed", (event: CustomEvent) => {
    $form.action = event.detail.frame.contentDocument?.location.href ?? "/web/"
})

