import type {
	AttachmentBlock,
	Channel,
	EmbedBlock,
	ImageBlock,
	LinkBlock,
	TextBlock,
} from "@aredotna/sdk";
import type {
	BlockImage,
	BlockSource,
	ChannelOwner,
	MarkdownContent,
} from "@aredotna/sdk/api";
import type {
	ArenaBlock,
	ArenaChannel,
	ArenaDescription,
	ArenaImage,
	ArenaSource,
	ArenaUser,
} from ".";

// ======================================= type conversion helper ===================================
function apiSourceToArenaSource(
	source: BlockSource | null | undefined,
): ArenaSource {
	return {
		url: source?.url || "",
	};
}

function apiImageToArenaImage(
	image: BlockImage | null | undefined,
): ArenaImage | undefined {
	if (!image) return undefined;
	return {
		src: image.src,
	};
}

function apiUserToArenaUser(user: ChannelOwner): ArenaUser {
	return {
		name: user.name,
		slug: user.slug,
	};
}

function apiDescriptionToArenaDescription(
	description: MarkdownContent | null | undefined,
): ArenaDescription | undefined {
	if (!description) return undefined;
	return {
		markdown: description.markdown,
		html: description.html,
		plain: description.plain,
	};
}

export function apiBlockToArenaBlock(
	block: TextBlock | ImageBlock | LinkBlock | AttachmentBlock | EmbedBlock,
): ArenaBlock {
	return {
		id: block.id,
		title: block.title || "",
		type: block.type,
		description: block.description,
		source: apiSourceToArenaSource(block.source),
		image:
			block.type !== "Text" ? apiImageToArenaImage(block.image) : undefined,
		channels: undefined,
	};
}

export function apiChannelToArenaChannel(channel: Channel): ArenaChannel {
	return {
		id: channel.id,
		title: channel.title,
		slug: channel.slug,
		counts: { contents: channel.counts.contents },
		type: channel.type,
		description: apiDescriptionToArenaDescription(channel.description),
		owner: apiUserToArenaUser(channel.owner),
	};
}

export function parseChannelContents(
	contents: (
		| TextBlock
		| ImageBlock
		| LinkBlock
		| AttachmentBlock
		| EmbedBlock
		| Channel
	)[],
): (ArenaBlock | ArenaChannel)[] {
	if (!contents) return [];
	const newContents: (ArenaBlock | ArenaChannel)[] = [];
	for (const content of contents) {
		const newVal =
			content.type === "Channel"
				? apiChannelToArenaChannel(content)
				: apiBlockToArenaBlock(content);
		newContents.push(newVal);
	}
	return newContents;
}

function parseBlockChannels(channels: Channel[] | undefined): ArenaChannel[] {
	if (!channels) return [];
	return channels.map((channel) => apiChannelToArenaChannel(channel));
}
