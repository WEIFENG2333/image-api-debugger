export const geminiPreviewProvider = {
  id: 'gemini-generate-content',
  label: 'Gemini generateContent preview',
  supportsSend: false,
  endpoint(state) {
    return `/v1beta/models/${encodeURIComponent(state.model)}:generateContent`
  },
  payload(state) {
    return {
      contents: [{ parts: [{ text: state.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectFromSize(state.size),
          imageSize: state.quality === 'high' ? '2K' : '1K',
        },
      },
      ...state.extra,
    }
  },
}

function aspectFromSize(size) {
  if (size === '1536x1024') return '3:2'
  if (size === '1024x1536') return '2:3'
  return '1:1'
}
