/// <reference lib="webworker" />
import { runScenario, type Variant } from './scenario'

self.onmessage = (event: MessageEvent<{ variant: Variant }>) => {
  self.postMessage(runScenario(event.data.variant))
}

export {}
