import { openAiImagesProvider } from './openaiImages.js'
import { geminiPreviewProvider } from './geminiPreview.js'

export const providers = [openAiImagesProvider, geminiPreviewProvider]

export function providerById(id) {
  return providers.find((provider) => provider.id === id) || openAiImagesProvider
}
