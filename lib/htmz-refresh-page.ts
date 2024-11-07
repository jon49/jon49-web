let doc = document

let x = doc.createElement("x")
x.innerHTML = `
<form hidden is=form-subscribe data-event="refresh" hf-ignore target=htmz>
<input type=hidden name=hz>
</form>`

doc.body.appendChild(x.firstElementChild as HTMLFormElement)

export {}

