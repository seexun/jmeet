export const formatDurationToHMS = (durationSeconds?: number): string => {
	if (!durationSeconds || durationSeconds === 0) return '-';

	const total = Math.floor(durationSeconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const formatDurationToTime = (durationSeconds?: number): string => {
	if (!durationSeconds || durationSeconds === 0) return '-';

	const hours = Math.floor(durationSeconds / 3600);
	const minutes = Math.floor((durationSeconds % 3600) / 60);
	const seconds = Math.floor(durationSeconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatBytes = (bytes?: number): string => {
	if (!bytes || bytes === 0) return '-';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};
