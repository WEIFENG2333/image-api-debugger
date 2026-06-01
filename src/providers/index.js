import { openAiImagesProvider } from './openaiImages.js'
import { geminiNativeProvider } from './geminiNative.js'
import { codexCliProxyProvider } from './codexCliProxy.js'

export const providers = [openAiImagesProvider, codexCliProxyProvider, geminiNativeProvider]

export function providerById(id) {
  return providers.find((provider) => provider.id === id) || openAiImagesProvider
}
