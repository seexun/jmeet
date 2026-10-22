type OpenViduLangs = 'en' | 'es' | 'de' | 'fr' | 'cn' | 'hi' | 'it' | 'ja' | 'nl' | 'pt';
export type AvailableLangs = OpenViduLangs | string;

export interface LangOption {
	name: string;
	lang: AvailableLangs;
}
