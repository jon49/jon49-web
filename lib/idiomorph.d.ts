// idiomorph ships JSDoc-typed source but publishes no declarations, and there is
// no @types/idiomorph. This mirrors the typedefs in dist/idiomorph.esm.js.
declare module "idiomorph" {
    export interface IdiomorphHeadConfig {
        style?: "merge" | "append" | "morph" | "none"
        block?: boolean
        ignore?: boolean
        shouldPreserve?: (el: Element) => boolean
        shouldReAppend?: (el: Element) => boolean
        shouldRemove?: (el: Element) => boolean
        afterHeadMorphed?: (head: Element, added: { added: Node[], kept: Element[], removed: Element[] }) => void
    }

    export interface IdiomorphCallbacks {
        beforeNodeAdded?: (node: Node) => boolean
        afterNodeAdded?: (node: Node) => void
        beforeNodeMorphed?: (oldNode: Element, newNode: Node) => boolean
        afterNodeMorphed?: (oldNode: Element, newNode: Node) => void
        beforeNodeRemoved?: (node: Element) => boolean
        afterNodeRemoved?: (node: Element) => void
        beforeAttributeUpdated?: (attributeName: string, node: Element, mutationType: "update" | "remove") => boolean
    }

    export interface IdiomorphConfig {
        morphStyle?: "outerHTML" | "innerHTML"
        ignoreActive?: boolean
        ignoreActiveValue?: boolean
        restoreFocus?: boolean
        callbacks?: IdiomorphCallbacks
        head?: IdiomorphHeadConfig
    }

    export const Idiomorph: {
        morph(
            oldNode: Element | Document,
            newContent: Element | Node | HTMLCollection | Node[] | string | null,
            config?: IdiomorphConfig): Node[] | undefined
        defaults: IdiomorphConfig
    }
}
