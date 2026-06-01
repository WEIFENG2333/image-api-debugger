import { openAiImagesProvider } from './openaiImages.js'
import { geminiNativeProvider } from './geminiNative.js'

export const providers = [openAiImagesProvider, geminiNativeProvider]

export function providerById(id) {
  return providers.find((provider) => provider.id === id) || openAiImagesProvider
}
