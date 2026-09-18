import { defineAppConfig } from 'wxt/utils/define-app-config'

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    per: number
    max_channel_length: number
  }
}

export default defineAppConfig({
  per: 100,
  max_channel_length: 600,
})
