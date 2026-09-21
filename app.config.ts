import { defineAppConfig } from 'wxt/utils/define-app-config'

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    per: number
    max_channel_length: number
    firefox_arena_client_id: string
    chrome_arena_client_id: string
  }
}

export default defineAppConfig({
  per: 100,
  max_channel_length: 600,
  firefox_arena_client_id: 'OrdORBujGQriu963U--4jJtCP3aeo4m5unixjW6T-u8',
  chrome_arena_client_id: 'MqzWjWr9bsnOMGA3Pv0X19VSR6QD1vncskWCojWi-Vg',
})
