let queue = Promise.resolve()

export function enqueueApiSync(work) {
  const result = queue.then(work)
  queue = result.catch(() => {})
  return result
}
