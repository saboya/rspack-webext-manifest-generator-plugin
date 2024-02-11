import type { Compiler } from '@rspack/core'
import type { javascript } from 'webpack'

export interface Script<T extends string> {
  js: string[]
  type: T
}

export interface BackgroundScript extends Script<'background'> {
  run_at: string
  matches: string[]
}

export interface ContentScript extends Script<'content'> {
  run_at: string
  matches: string[]
}

type MetaPluginReturn = Record<string, ContentScript | BackgroundScript>

const meta = async (compiler: Compiler): Promise<MetaPluginReturn> => {
  return await new Promise<MetaPluginReturn>((resolve) => {
    compiler.hooks.normalModuleFactory.tap('ChromeManifestGenerator', factory => {
      const files: Record<string, any> = {}

      const handler = (parser: javascript.JavascriptParser): void => {
        parser.hooks.program.tap('ChromeManifestGenerator', (_, comments) => {
          const file = parser.state.current.resource
          const regexp = /^\s*(__RUN_AT__|__MATCHES__|__TYPE__):\s*(.+)\s*$/
          const keys: Record<string, any> = {
            __MATCHES__: 'matches',
            __RUN_AT__: 'run_at',
            __TYPE__: 'type',
          }

          comments
            .filter(comment => {
              return comment.type === 'Block' && regexp.test(comment.value)
            })
            .forEach(comment => {
              if (files[file] === undefined) {
                files[file] = {}
              }

              const match = regexp.exec(comment.value)

              if (match === null) {
                return
              }

              try {
                files[file][keys[match[1]]] = JSON.parse(match[2])
              } catch (err) {
                throw new Error(`[chrome-extension-plugin]: Eror parsing ${match[1]} field in ${file}.`)
              }
            })
        })
      }

      factory.hooks.parser.for('javascript/auto').tap('ChromeManifestGenerator', handler)
      factory.hooks.parser.for('javascript/dynamic').tap('ChromeManifestGenerator', handler)
      factory.hooks.parser.for('javascript/esm').tap('ChromeManifestGenerator', handler)

      resolve(files)
    })
  })
}

export default meta
