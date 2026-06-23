let w = window

let tick = setTimeout

export interface AppActionContext {
  app: Record<string, AppAction>
  ev: Event
  target: HTMLElement
  el: HTMLElement
  form?: HTMLFormElement
}

export type AppAction = (ctx: AppActionContext) => 1 | void

declare global {
  interface Window {
    app: Record<string, AppAction>
  }
}

w.app = w.app || {}

Object.assign(w.app, {
  redirect: ({ el }) => {
    tick(() => document.location.href = el.dataset.url || "/" )
  },

  refresh: () => {
    tick(() => document.location.reload(), 500)
  },

  theme: ({ el }) => {
    tick(() => {
      let theme = el.dataset.theme;
      let docElement = document.documentElement
      theme === "" ? docElement.removeAttribute("data-theme") : docElement.setAttribute("data-theme", theme || "")
      el.remove()
    })
  },

  reset: ({ form }) => {
    tick(() => form?.reset())
  },

  clearAutoFocus: ({ target }) => {
    target.removeAttribute("autofocus")
  },

  confirm: ({ ev, target }): 1 | void => {
    if (!confirm(target.dataset.confirm)) {
      ev.preventDefault()
    }
  },

  defaultTheme: ({ target }) => {
    // Get system theme
    let isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    let theme = isDark ? "dark" : "light"
    let url = new URL((target as HTMLAnchorElement).href)
    url.searchParams.set("theme", theme)
    ;(target as HTMLAnchorElement).href = url.toString()
  },

  submit: ({ form }) => {
    form?.requestSubmit()
  }
} as Record<string, AppAction>)
