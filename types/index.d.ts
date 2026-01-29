export interface Message {
  type: string
  value: any
}

export interface ArenaUser {
  username: string
}

export interface ArenaSource {
  url: string
}

export interface ArenaBlock {
  id: number
  title: string
  generated_title: string
  class: string
  description?: string
  source?: ArenaSource
  image?: ArenaImage
  channels?: ArenaChannel[]
}

export interface ArenaChannel {
  id: number
  title: string
  slug: string
  length: number
  class: string
  user: ArenaUser
  contents?: (ArenaBlock | ArenaChannel)[]
  full_fetch?: boolean
}

export interface ArenaImage {
  original: ArenaSource
}

export interface Station {
  id: number
  title: string
  generated_title: string
  class: string
  description?: string
  source: ArenaSource
  image?: {
    original: ArenaSource
  }
  channels: ArenaChannel[]
  searched_ids: number[]
}