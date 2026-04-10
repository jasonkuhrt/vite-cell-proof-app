import { describeRuntime } from '@proof/conditional-surface-lib/runtime'
import { Browser, origin } from '@proof/conditional-surface-lib/namespace'

document.querySelector('#app').textContent = [
  describeRuntime(),
  origin,
  Browser.thing(),
].join(' ')
