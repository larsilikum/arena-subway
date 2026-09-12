import { MarkdownContent } from '@aredotna/sdk/api'

export interface Message {
  type: string
  value: any
}

export interface ArenaUser {
  name: string
  slug: string
}

export interface ArenaSource {
  url: string
}

export interface ArenaBlock {
  id: number
  title: string
  type: 'Text' | 'Image' | 'Link' | 'Attachment' | 'Embed'
  description?: MarkdownContent | null
  source?: ArenaSource
  image?: ArenaImage
  channels?: ArenaChannel[]
}

export interface ArenaDescription {
  markdown: string
  html: string
  plain: string
}

export interface ArenaChannel {
  id: number
  title: string
  slug: string
  counts: {
    contents: number
  }
  type: 'Channel'
  owner: ArenaUser
  description?: ArenaDescription
  contents?: (ArenaBlock | ArenaChannel)[]
  full_fetch?: boolean
  pages?: number
}

export interface ArenaImage {
  src?: string
}
