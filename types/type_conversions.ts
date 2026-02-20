import { ArenaBlock, ArenaChannel, ArenaImage, ArenaSource, ArenaUser, Station } from "."
// ======================================= type conversion helper ===================================
export function blockToStation(block: ArenaBlock): Station{
  return {
    id: block.id,
    title: block.title,
    generated_title: block.generated_title,
    class: block.class,
    description: block.description,
    source: apiSourceToArenaSource(block.source),
    image: block.image,
    channels: parseBlockChannels(block.channels),
    searched_ids: [block.id]
  }
}

function apiSourceToArenaSource(source: { url: string } | undefined): ArenaSource {
  return {
    url: source?.url || ''
  }
}

function apiImageToArenaImage(image: { original: ArenaSource } | undefined): ArenaImage | undefined {
  if(!image) return undefined
  return {
    original: apiSourceToArenaSource(image.original)
  }
}

function apiUserToArenaUser(user: ArenaUser): ArenaUser {
  return {
    username: user.username,
    slug: user.slug
  }
}

function apiBlockToArenaBlock(block: ArenaBlock): ArenaBlock{
  return {
    id: block.id,
    title: block.title,
    generated_title: block.generated_title,
    class: block.class,
    description: block.description,
    source: apiSourceToArenaSource(block.source),
    image: apiImageToArenaImage(block.image),
    channels: undefined
  }
}

export function apiChannelToArenaChannel(channel: ArenaChannel): ArenaChannel {
  return {
    id: channel.id,
    title: channel.title,
    slug: channel.slug,
    length: channel.length,
    class: channel.class,
    metadata: channel.metadata,
    user: apiUserToArenaUser(channel.user),
    contents: parseChannelContents(channel.contents)
  }
}

export function parseChannelContents(contents: (ArenaBlock | ArenaChannel)[] | undefined): (ArenaBlock | ArenaChannel)[] {
  if (!contents) return []
  return contents.map((content: ArenaChannel | ArenaBlock) => content.class === 'Channel' ? apiChannelToArenaChannel(content as ArenaChannel) : apiBlockToArenaBlock(content as ArenaBlock))
}


function parseBlockChannels(channels: ArenaChannel[] | undefined): ArenaChannel[]{
  if (!channels) return []
  return channels.map(channel => apiChannelToArenaChannel(channel))
}