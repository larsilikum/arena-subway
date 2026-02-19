export interface Message {
  type: string
  value: any
}

export interface ArenaUser {
  username: string,
  slug: string
}

export interface ArenaSource {
  url: string
}

export interface ArenaBlock {
  id: number
  title: string
  generated_title: string
  class: 'Image' | 'Link' | 'Text' | 'Media' | 'Attachment'
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
  class: 'Channel'
  user: ArenaUser
  metadata: { 
    description: string
  }
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