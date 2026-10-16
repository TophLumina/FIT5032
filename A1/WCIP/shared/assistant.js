export const questionLimit = 1200
export const historyLimit = 12000
export const replyLimit = 6000

// Keep whole user/assistant pairs, followed by the new question.
export function conversationInput(messages, question) {
  const history = messages.slice(-10).map(({ role, content }) => ({ role, content }))
  while (
    history.length &&
    history.reduce((sum, item) => sum + item.content.length, question.length) > historyLimit
  )
    history.splice(0, 2)
  return [...history, { role: 'user', content: question }]
}
