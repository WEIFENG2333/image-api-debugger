import { openAiImagesProvider } from './openaiImages.js'
import { geminiNativeProvider } from './geminiNative.js'
import { codexDirectProvider } from './codexDirect.js'

export const providers = [openAiImagesProvider, codexDirectProvider, geminiNativeProvider]

export function providerById(id) {
  return providers.find((provider) => provider.id === id) || openAiImagesProvider
}
