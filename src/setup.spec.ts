(function handleUnhandledPromiseRejections() {
  const globalOrWindow: any = new Function(`return this`)()
  if (globalOrWindow.addEventListener) {
    globalOrWindow.addEventListener('unhandledRejection', (reason: any) => { throw reason; })
  } else {
    globalOrWindow.process.on('unhandledRejection', (reason: any) => { throw reason; })
  }
})()
