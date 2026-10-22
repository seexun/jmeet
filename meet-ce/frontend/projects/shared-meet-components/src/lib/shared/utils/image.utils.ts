/**
 * 把用户选择的图片文件降采样为居中裁剪的方形 data URL（JPEG）。
 * 头像类上传统一走这里：控制入库体积（256px JPEG ≈ 15-30KB），
 * 也避免超大原图直接塞进用户文档。
 */
export function downscaleImageToDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Canvas 2D context unavailable'));
					return;
				}
				// 短边铺满、居中裁剪（cover）
				const scale = Math.max(size / img.width, size / img.height);
				const drawWidth = img.width * scale;
				const drawHeight = img.height * scale;
				ctx.drawImage(img, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.onerror = () => reject(new Error('Invalid image file'));
			img.src = String(reader.result);
		};
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});
}
