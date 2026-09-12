export default {
	// Thanks to clyzermk1 https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
	djb2(str: string) {
		var hash = 5381;
		for (var i = 0; i < str.length; i++) {
			hash = (hash << 5) + hash + str.charCodeAt(i); /* hash * 33 + c */
		}
		return hash;
	},

	hashStringToColor(str: string) {
		var hash = this.djb2(str);
		var r = (hash & 0xff0000) >> 16;
		var g = (hash & 0x00ff00) >> 8;
		var b = hash & 0x0000ff;
		const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		const secColor = brightness > 128 ? "#333" : "white";
		return {
			primary: "rgb(" + r + "," + g + "," + b + ")",
			secondary: secColor,
		};
	},
};
